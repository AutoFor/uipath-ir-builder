// 自作コネクタ（tools/connector/gen.ts の IR）のアクティビティを、Studio の XAML（Integration Service の Insert Record）にする。
// Studio で Insert Record を置いて保存した XAML（2026-11-19、UiPath.IntegrationService.Activities 1.36.0）を写した形：
//   <isactr:ConnectorActivity Configuration="<gzip した JSON の base64>" ConnectionId="<接続>" UiPathActivityTypeId="<GUID>">
//     <isactr:ConnectorActivity.FieldObjects>
//       <isactr:FieldObject Name="_to" Type="FieldArgument"><isactr:FieldObject.Value><InArgument x:TypeArguments="x:String">…</InArgument></…></…>
//       <isactr:FieldObject Name="out_sentMessages_array_sub_id" Type="FieldArgument" />
// - Configuration の JSON は、欄（FieldsContainer）・コネクタのキー・オブジェクト（= アクティビティの name）・操作を持つ。IR から組み立てられる
// - FieldObject の Name は欄の名前を識別子にしたもの（ランタイムの NamingHelper：. → _sub_、[*] → _array、C# か VB で使えない名前は先頭に _、出力は out_）
// - UiPathActivityTypeId（コネクタと操作ごとの GUID）は IR からは作れない。`uip rpa activities find --query "<コネクタ名>"` で引いて渡す
// - 接続は ConnectionId に直接書く（bindings_v2.json・.project には何も入らない）
// knowledge/connector-builder.md
//
// 使い方:
//   node tools/connector/xaml.ts <ir.json> --activity push_message --connection <接続の Id> --type-id <Insert Record の GUID>
//        [--organization autofor | --connector-key custom-…] [--set to=@in_To] [--set 'text=こんにちは'] [--arg in_To] [--out Main.xaml]
//   --set の値は、@ で始めると C# の式、@@ で始めると @ で始まる文字列、そうでなければ文字列そのまま。--arg は Main の入力引数（String）
// 終了コード: 0 = OK、1 = IR・指定の誤り、2 = 使い方の間違い

import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, type ActivityIr, type ConnectorIr, type FieldIr } from "./gen.ts";

// C# と VB の予約語（NamingHelper は CodeDomProvider.IsValidIdentifier で調べ、使えなければ先頭に _ を付ける。VB は大文字小文字を区別しない）
const CS = new Set("abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while".split(" "));
const VB = new Set("addhandler addressof alias and andalso as boolean byref byte byval call case catch cbool cbyte cchar cdate cdbl cdec char cint class clng cobj const continue csbyte cshort csng cstr ctype cuint culng cushort date decimal declare default delegate dim directcast do double each else elseif end endif enum erase error event exit false finally for friend function get gettype getxmlnamespace global gosub goto handles if implements imports in inherits integer interface is isnot let lib like long loop me mod module mustinherit mustoverride mybase myclass namespace narrowing new next not nothing notinheritable notoverridable object of on operator option optional or orelse overloads overridable overrides paramarray partial private property protected public raiseevent readonly redim rem removehandler resume return sbyte select set shadows shared short single static step stop string structure sub synclock then throw to true try trycast typeof uinteger ulong ushort using variant wend when while widening with withevents writeonly xor".split(" "));

/** 欄の名前 → FieldObject の Name（ランタイムの NamingHelper.GetValidDesignPropertyName と同じ。出力は out_ を付けてから） */
export function fieldId(name: string, output = false): string {
  let v = output ? `out_${name}` : name;
  for (const [a, b] of [[":::", "_sub_"], ["[*]", "_array"], ["::", "_sub_"], [".", "_sub_"]] as const) v = v.split(a).join(b);
  let s = "", first = true;
  for (const c of v) {
    if (/\p{L}|\p{Nl}/u.test(c)) s += c;
    else if (/\p{Mn}|\p{Mc}|\p{Nd}|\p{Pc}/u.test(c)) { if (first && c !== "_") s += "_"; s += c; }
    else s += ({ "+": "plus_sign", "-": "minus_sign", $: "dl" } as Record<string, string>)[c] ?? `_${c.charCodeAt(0).toString(16).toUpperCase()}_`;
    first = false;
  }
  if (!/^[\p{L}_][\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}]*$/u.test(s) || CS.has(s) || VB.has(s.toLowerCase()) || s === "_") s = `_${s}`;
  if (s.toLowerCase() === "file" || s.toLowerCase() === "displayname") s = `_${s}`;
  return s;
}

const OPERATION: Record<ActivityIr["method"], string> = { POST: "Create", PUT: "Replace", PATCH: "Update", DELETE: "Delete", GET: "List" };

/** ConnectorActivity の Configuration（JSON）。Studio で Insert Record を作って保存したものと同じ項目・並び */
export function configuration(ir: ConnectorIr, act: ActivityIr, opt: { organization: string; connectorKey?: string; language?: string; packageVersion?: string }) {
  const field = (f: FieldIr) => ({ Name: f.name, DisplayName: f.label ?? f.name, Description: f.description ?? `The ${f.name}`, Type: f.type ?? "string" });
  const operation = OPERATION[act.method];
  const label = act.displayName ?? act.name;
  return {
    FieldsContainer: {
      SearchableFields: [],
      InputFields: (act.request ?? []).map((f) => ({
        ...field(f), ...(f.primary ? { Design: { Position: "Primary" } } : {}), Required: !!f.required, FieldLocation: "Body",
      })),
      OutputFields: (act.response ?? []).map((f, i) => ({
        ...field(f), Request: false, Response: true, ResponseCurated: true, FieldLocation: "Output", ...(i === 0 ? { IsMainResponseField: true } : {}),
      })),
    },
    // Version と ConnectorVersion は、どちらもコネクタの版（Studio が保存したもの（1.0.0）では両方とも同じ値だった）
    InstanceParameters: { Version: ir.version ?? "1.0.0", ConnectorKey: opt.connectorKey ?? connectorKey(ir, opt.organization), ActivityType: "Generic", Operation: operation },
    LocalizedActivityName: "Insert Record",
    CachedLookupValues: { ObjectName: [{ Id: act.name, DisplayColumns: [label], StringFormatDisplayColumns: "{0}", DisplayName: label, Custom: false }] },
    CachedBrowserItems: {},
    PrimaryKeys: [],
    PackageVersion: opt.packageVersion ?? "1.36.0",
    ConnectorName: ir.connector,
    ConnectorVersion: ir.version ?? "1.0.0",
    ObjectDisplayName: label,
    ObjectName: act.name,
    Operation: operation,
    HttpMethod: act.method,
    Path: `/${act.name}`,
    Language: opt.language ?? "ja",
    MaxPageSize: 200,
    HasBreakingChanges: false,
    IsFieldAsSolutionResourceEnabled: true,
    TextBlocks: [],
  };
}

/** 公開したコネクタのキー（custom-{組織}-{名前を小文字にして英数字だけ}） */
export const connectorKey = (ir: ConnectorIr, organization: string) => `custom-${organization}-${ir.connector.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

/** Configuration の属性の値（JSON を gzip して base64。Studio と同じ符号化。ランタイムは GZip で戻して読む） */
export const encodeConfiguration = (c: unknown) => gzipSync(Buffer.from(JSON.stringify(c), "utf8")).toString("base64");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 欄に入れる値：lit は文字列そのまま、cs は C# の式 */
export type FieldValue = { lit: string } | { cs: string };

export type InsertRecordOpt = {
  activity: string; // IR のアクティビティの name
  connectionId: string;
  activityTypeId: string; // uip rpa activities find で引いた Insert Record の GUID
  organization: string;
  connectorKey?: string; // 公開したコネクタのキー（uip is connectors list の custom-…）。組織と名前から組み立てたキーと違うときに渡す
  values: Record<string, FieldValue>; // 欄の名前（IR の request の name）→ 値
  displayName?: string;
  idRef?: number;
};

export type Issue = { path: string; message: string };

export function checkInsertRecord(ir: ConnectorIr, opt: InsertRecordOpt): Issue[] {
  const out: Issue[] = check(ir);
  const bad = (path: string, message: string) => out.push({ path, message });
  const act = ir.activities?.find((a) => a.name === opt.activity);
  if (!act) { bad("activity", `「${opt.activity}」は IR に無い`); return out; }
  if (act.method !== "POST") bad("activity", "Insert Record は POST のアクティビティだけ（List Records などはまだ扱っていない）");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opt.connectionId)) bad("connectionId", "接続の Id（GUID）にする");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opt.activityTypeId)) bad("activityTypeId", "uip rpa activities find で引いた GUID にする");
  if (opt.connectorKey !== undefined) {
    if (!/^custom-[a-z0-9-]+$/.test(opt.connectorKey)) bad("connectorKey", "uip is connectors list に出るキー（custom-… の英小文字・数字・-）にする");
  } else if (!/^[a-z0-9]+$/.test(opt.organization ?? "")) {
    // 英小文字・数字だけのときは、キーを custom-{組織}-{名前} と組み立てられる。- などがあるときの組み立て方は確かめていないので、キーを直に渡す
    bad("organization", "組織の名前（英小文字・数字。例 autofor）。それ以外の文字があるときは、uip is connectors list で引いたキーを --connector-key で渡す");
  }
  const names = new Set((act.request ?? []).map((f) => f.name));
  for (const k of Object.keys(opt.values)) if (!names.has(k)) bad(`values.${k}`, `「${k}」は ${act.name} の request に無い`);
  // 文字列のまま書く値は、欄の型に読めるかを見る（読めないと、ワークフローを読み込むときに初めて落ちる）
  for (const f of act.request ?? []) {
    const v = opt.values[f.name];
    if (!v || !("lit" in v)) continue;
    const why = literalProblem(f.type, v.lit);
    if (why) bad(`values.${f.name}`, why);
  }
  for (const f of act.request ?? []) if (f.required && !(f.name in opt.values)) bad(`values.${f.name}`, "必須の欄に値が無い");
  for (const f of act.request ?? []) if (f.name.includes("[*]")) bad(`values.${f.name}`, "配列の欄（[*]）は Studio が捨てる。フックで平らな欄から組み立てる（gen.ts の hooks）");
  return out;
}

/** 文字列のまま書いた値が、欄の型（XAML の型変換）で読めないときの理由。読めれば undefined */
export function literalProblem(type: FieldIr["type"], s: string): string | undefined {
  switch (type) {
    case "number": return /^\s*-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(s) ? undefined : `数値の欄に「${s}」は入らない（C# の式なら @ を付ける）`;
    case "integer": return /^\s*-?\d+\s*$/.test(s) ? undefined : `整数の欄に「${s}」は入らない（C# の式なら @ を付ける）`;
    case "boolean": return /^\s*(true|false)\s*$/i.test(s) ? undefined : `真偽の欄は True か False（C# の式なら @ を付ける）`;
    case "date": return /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/.test(s.trim()) ? undefined : `日付の欄は 2026-11-20 や 2026-11-20T09:00:00 の形（C# の式なら @ を付ける）`;
    default: return undefined;
  }
}

/** --set の値：@式 は C# の式、@@… は @ で始まる文字列、それ以外は文字列そのまま */
export const parseSetValue = (v: string): FieldValue => (v.startsWith("@@") ? { lit: v.slice(1) } : v.startsWith("@") ? { cs: v.slice(1) } : { lit: v });

/** XAML の要素の中に文字のまま書くと変わってしまう文字列か（改行・タブ・前後の空白・連続した空白は、XAML の空白のまとめで消える・1つになる） */
export const needsCsLiteral = (s: string) => /[\r\n\t]/.test(s) || /^\s|\s$/.test(s) || / {2,}/.test(s);

/** 文字列を C# の文字列リテラルにする（"…"。\ " 改行・タブなどは \ でエスケープ） */
export const csString = (s: string) =>
  `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/[\u0000-\u001f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)}"`;

const xType = (t: FieldIr["type"]) => ({ number: "x:Double", integer: "x:Int64", boolean: "x:Boolean", date: "s:DateTime" } as Record<string, string>)[t ?? "string"] ?? "x:String";

/** Insert Record の <isactr:ConnectorActivity> 要素 */
export function insertRecord(ir: ConnectorIr, opt: InsertRecordOpt, indent = "    "): string {
  const issues = checkInsertRecord(ir, opt);
  if (issues.length) throw new Error(issues.map((i) => `${i.path}: ${i.message}`).join("\n"));
  const act = ir.activities.find((a) => a.name === opt.activity)!;
  const conf = encodeConfiguration(configuration(ir, act, { organization: opt.organization, connectorKey: opt.connectorKey }));
  const n = opt.idRef ?? 1;
  const i1 = indent + "  ", i2 = i1 + "  ", i3 = i2 + "  ", i4 = i3 + "  ";
  const objs: string[] = [];
  for (const f of act.request ?? []) {
    const v = opt.values[f.name];
    if (!v) continue;
    const t = xType(f.type);
    // 文字列の値に改行・タブ・前後や連続の空白があるときは、C# の文字列の式にする（要素の中の文字は XAML が空白をまとめるので、改行が空白になってしまう）
    const cs = "lit" in v ? (t === "x:String" && needsCsLiteral(v.lit) ? csString(v.lit) : undefined) : v.cs;
    const body = cs === undefined
      ? `<InArgument x:TypeArguments="${t}">${esc((v as { lit: string }).lit)}</InArgument>`
      : `<InArgument x:TypeArguments="${t}">\n${i4}  <mca:CSharpValue x:TypeArguments="${t}">${esc(cs)}</mca:CSharpValue>\n${i4}</InArgument>`;
    objs.push(`${i2}<isactr:FieldObject Name="${fieldId(f.name)}" Type="FieldArgument">\n${i3}<isactr:FieldObject.Value>\n${i4}${body}\n${i3}</isactr:FieldObject.Value>\n${i2}</isactr:FieldObject>`);
  }
  for (const f of act.response ?? []) objs.push(`${i2}<isactr:FieldObject Name="${fieldId(f.name, true)}" Type="FieldArgument" />`);
  return [
    `${indent}<isactr:ConnectorActivity Configuration="${conf}" ConnectionId="${opt.connectionId}" DisplayName="${esc(opt.displayName ?? act.displayName ?? "Insert Record")}" sap2010:WorkflowViewState.IdRef="ConnectorActivity_${n}" UiPathActivityTypeId="${opt.activityTypeId}">`,
    `${i1}<isactr:ConnectorActivity.FieldObjects>`,
    // Studio の形：項目があれば FieldObject を直に並べ、無ければ空の Collection
    objs.length ? objs.join("\n") : `${i2}<sco:Collection x:TypeArguments="isactr:FieldObject" />`,
    `${i1}</isactr:ConnectorActivity.FieldObjects>`,
    `${indent}</isactr:ConnectorActivity>`,
  ].join("\n");
}

// Studio が Insert Record を置いて保存したときの imports と AssemblyReference（C# の空のプロジェクト + Integration Service）
const NAMESPACES = ["System.Activities", "System.Activities.Statements", "System.Activities.Expressions", "System.Activities.Validation", "System.Activities.XamlIntegration", "Microsoft.VisualBasic", "Microsoft.VisualBasic.Activities", "System", "System.Collections", "System.Collections.Generic", "System.Collections.ObjectModel", "System.Data", "System.Diagnostics", "System.Drawing", "System.IO", "System.Linq", "System.Net.Mail", "System.Xml", "System.Text", "System.Xml.Linq", "UiPath.Core", "UiPath.Core.Activities", "System.Windows.Markup", "GlobalVariablesNamespace", "GlobalConstantsNamespace", "UiPath.IntegrationService.Activities.Runtime.Models.FilterBuilder", "System.Runtime.Serialization", "UiPath.IntegrationService.Activities.Runtime.Models", "System.ComponentModel", "UiPath.IntegrationService.Activities.Runtime.Helpers.TypeDetailsCustomization", "UiPath.IntegrationService.Activities.Runtime.Activities", "UiPath.Platform.Activities"];
const REFERENCES = ["Microsoft.CSharp", "System", "System.Linq", "System.Core", "System.Activities", "System.Data", "System.Data.Common", "System.Runtime.Serialization", "System.ServiceModel", "System.ServiceModel.Activities", "System.Xaml", "Microsoft.VisualBasic", "System.Private.CoreLib", "mscorlib", "System.Drawing", "System.Drawing.Primitives", "System.Drawing.Common", "System.Xml", "System.Xml.Linq", "UiPath.System.Activities", "UiPath.UiAutomation.Activities", "System.Data.DataSetExtensions", "System.Net.Mail", "System.ObjectModel", "System.ComponentModel.TypeConverter", "UiPath.Studio.Constants", "UiPath.IntegrationService.Activities.Runtime", "System.Runtime.Serialization.Formatters", "System.Private.DataContractSerialization", "System.Runtime.Serialization.Primitives", "System.ComponentModel.EventBasedAsync", "WindowsBase", "System.ComponentModel", "System.ComponentModel.Primitives", "UiPath.Platform"];

/** Insert Record を1つ持つワークフロー（C#）。args は String の入力引数（--set の @式 から参照する） */
export function workflow(ir: ConnectorIr, opt: InsertRecordOpt & { className?: string; args?: string[] }): string {
  const act = insertRecord(ir, opt, "    ");
  const members = (opt.args ?? []).map((a) => `    <x:Property Name="${esc(a)}" Type="InArgument(x:String)" />`);
  return `<Activity mc:Ignorable="sap sap2010" x:Class="${esc(opt.className ?? "Main")}" sap2010:ExpressionActivityEditor.ExpressionActivityEditor="C#" sap2010:WorkflowViewState.IdRef="ActivityBuilder_1" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:isactr="http://schemas.uipath.com/workflow/integration-service-activities/isactr" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mca="clr-namespace:Microsoft.CSharp.Activities;assembly=System.Activities" xmlns:s="clr-namespace:System;assembly=System.Private.CoreLib" xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation" xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation" xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib" xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=System.Private.CoreLib" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
${members.length ? `  <x:Members>\n${members.join("\n")}\n  </x:Members>\n` : ""}  <TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
${NAMESPACES.map((n) => `      <x:String>${n}</x:String>`).join("\n")}
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
${REFERENCES.map((n) => `      <AssemblyReference>${n}</AssemblyReference>`).join("\n")}
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>
  <Sequence DisplayName="Main Sequence" sap2010:WorkflowViewState.IdRef="Sequence_1">
${act}
  </Sequence>
</Activity>
`;
}

function main() {
  const args = process.argv.slice(2);
  const take = (f: string) => { const i = args.indexOf(f); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const takeAll = (f: string) => { const out: string[] = []; for (let v = take(f); v !== undefined; v = take(f)) out.push(v); return out; };
  const activity = take("--activity"), connectionId = take("--connection"), activityTypeId = take("--type-id");
  const organization = take("--organization") ?? "autofor", connectorKey = take("--connector-key"), out = take("--out");
  const sets = takeAll("--set"), wfArgs = takeAll("--arg");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file || !activity || !connectionId || !activityTypeId) {
    console.error("使い方: node tools/connector/xaml.ts <ir.json> --activity <name> --connection <接続の Id> --type-id <GUID> [--organization <組織> | --connector-key <custom-…>] [--set 欄=値|欄=@C#の式|欄=@@@で始まる文字列]... [--arg <入力引数>]... [--out <file>]");
    process.exit(2);
  }
  const values: Record<string, FieldValue> = {};
  for (const s of sets) {
    const i = s.indexOf("=");
    if (i < 1) { console.error(`--set は 欄=値：${s}`); process.exit(2); }
    values[s.slice(0, i)] = parseSetValue(s.slice(i + 1));
  }
  const ir: ConnectorIr = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const opt = { activity, connectionId, activityTypeId, organization, connectorKey, values, args: wfArgs };
  const issues = checkInsertRecord(ir, opt);
  if (issues.length) {
    console.error(`NG ${file}`);
    for (const i of issues) console.error(`  ${i.path}: ${i.message}`);
    process.exit(1);
  }
  const x = workflow(ir, opt);
  if (out) { writeFileSync(out, x); console.log(`OK ${out}`); } else process.stdout.write(x);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
