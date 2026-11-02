// XAML → IR の取り込みと、置き換えの見積もりのテスト。
//
// - samples/generated/**/*.xaml … XAML → IR → XAML で文字まで元に戻ること（GUID は出てきた順の番号にして比べる）。IR が検証を通ること
// - knowledge/default-xaml/*.json … Studio の既定 XAML が例外なく読めて、捨てたものが一覧に出ること
// - samples/xaml-import/ … Studio が書く形（要素で書く引数、ViewState、注釈など）と、取り込めない形（C#、Flowchart など）

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { loadCatalog } from "./catalog.ts";
import { generate } from "./generate.ts";
import { generateCoded } from "./generate-coded.ts";
import { CATALOG_FILES, canonLines, checkRoundTrip, importAndCheck, importXaml, irType, normalizeXaml, parseXml, repoRoot as root } from "./import-xaml.ts";
import { loadMappings } from "./mapping.ts";
import { droppedPropsMarkdown, formatReport, loadBehaviorNotes, reportWorkflow } from "./migrate-report.ts";
import { validate } from "./validate.ts";

const cat = loadCatalog(root, CATALOG_FILES);
const { maps } = loadMappings(root);
const notes = loadBehaviorNotes(root);
const rel = (f: string) => relative(root, f).replaceAll("\\", "/");

function xamls(dir: string): string[] {
  const out: string[] = [];
  const walk = (p: string) => {
    for (const e of readdirSync(p).sort()) {
      const q = join(p, e);
      if (statSync(q).isDirectory()) walk(q);
      else if (e.endsWith(".xaml")) out.push(q);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

for (const f of xamls(join(root, "samples", "generated"))) {
  test(`往復 ${rel(f)}`, () => {
    const xml = readFileSync(f, "utf8");
    const r = importXaml(xml, cat);
    assert.deepEqual(r.errors, [], "取り込めない");
    assert.deepEqual(r.warnings, [], "取り込みの警告");
    assert.deepEqual(validate(r.wf!, cat), [], "取り込んだ IR が検証を通らない");
    assert.equal(normalizeXaml(generate(r.wf!, cat)), normalizeXaml(xml), "元の XAML に戻らない");
  });
}

test("既定 XAML がすべて例外なく読めて、値を黙って捨てない", () => {
  const dir = join(root, "knowledge", "default-xaml");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const res = JSON.parse(readFileSync(join(dir, f), "utf8").replace(/^﻿/, ""));
    if (res.Result !== "Success") continue;
    const xml = res.Data.message as string;
    const r = importXaml(xml, cat);
    assert.ok(r.wf || r.errors.length, f);
    // 取り込めたものは、作り直して消える属性があれば警告に出ている（空の属性や既定値は別）
    if (r.wf && !r.errors.length) assert.doesNotThrow(() => checkRoundTrip(xml, r.wf!, cat), f);
  }
});

const fixture = (name: string) => readFileSync(join(root, "samples", "xaml-import", name), "utf8");

test("Studio が書く形を読む", () => {
  const r = importAndCheck(fixture("StudioStyle.xaml"), cat);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.validation, []);
  const wf = r.wf!;
  assert.deepEqual(wf.arguments, [{ name: "in_Name", dir: "In", type: "String" }, { name: "out_Text", dir: "Out", type: "String" }]);
  const seq = wf.body[0];
  assert.deepEqual(seq.variables, [{ name: "count", type: "Int32", default: "3" }, { name: "label", type: "String", default: '"abc"' }, { name: "names", type: "List<String>" }]);
  const [assign, log, iff, invoke] = seq.body!;
  assert.deepEqual(assign.props, { To: "count", Value: "count + 1" });
  assert.equal(assign.typeArg, undefined, "代入先の宣言と同じ型なら typeArg は要らない");
  assert.equal(log.props!.Message, "label & count.ToString", "VisualBasicValue は式になる");
  assert.deepEqual(iff.then![0].props, { Level: "Warn", Message: { lit: "大きい" } });
  assert.deepEqual(invoke.args, [
    { name: "in_A", dir: "In", type: "String", value: "in_Name" },
    { name: "out_B", dir: "Out", type: "String", value: "out_Text" },
  ]);
  const kinds = new Set(r.dropped.map((d) => d.kind));
  for (const k of ["IdRef", "ViewState", "注釈", "値なし"]) assert.ok(kinds.has(k as never), `捨てたものに ${k} が無い`);
  const codes = r.warnings.map((w) => w.code);
  assert.ok(codes.includes("ANNOTATION"), "注釈は警告にも出す");
  assert.ok(codes.includes("EXTRA_IMPORT"), "IR に持てない import は警告にする");
  assert.ok(r.dropped.some((d) => d.kind === "注釈" && d.value === "呼び出し元の名前"), "引数の注釈の中身も一覧に出す");
  assert.equal(r.roundTrip?.sameMeaning, true, r.warnings.map((w) => w.message).join("\n"));
});

// Studio 26.0.204.0 で「フォーム データを抽出」を置いて保存した Main.xaml をそのまま置いたもの（AUT-1088。画面の情報なし。FieldMappings={x:Null}、Target なし、Version 属性なし）
test("Studio が保存した NExtractFormDataGeneric を読む（AUT-1088）", () => {
  const r = importAndCheck(fixture("StudioExtractFormData.xaml"), cat);
  assert.deepEqual(r.errors, []);
  const ext = r.wf!.body[0].body![0].body![0].body![0];
  assert.equal(ext.act, "NExtractFormDataGeneric");
  assert.equal(ext.typeArg, "Object");
  assert.equal(ext.dicts, undefined, "FieldMappings={x:Null} は値なし");
  assert.ok(r.dropped.some((d) => d.kind === "値なし" && d.name === "FieldMappings"));
  // Studio は Target 無しで保存できる。生成器の検証は Target / InUiElement を求める（Studio の外で build できる形にするため）
  assert.deepEqual(r.validation.map((v) => v.code).sort(), ["UIA_TARGET_EMPTY", "UIA_TARGET_MISSING"]);
  // 作り直すと Version=V5 が増える差（Studio 26.0.204 + UIAutomation 25.2.1-preview は Version を書かない。生成器は Helm の既定 XAML に合わせて V5 を書く）
  assert.deepEqual(r.warnings.filter((w) => w.code === "ROUNDTRIP_ADDED").map((w) => w.message.replace(/^.*@/, "@")), ["@Version=V5"]);
});

const expectErrors = (name: string, codes: string[]) => test(`取り込めない形 ${name}`, () => {
  const r = importXaml(fixture(`unsupported/${name}`), cat);
  const got = new Set(r.errors.map((e) => e.code));
  assert.deepEqual([...got].sort(), [...codes].sort());
});
expectErrors("Flowchart.xaml", ["UNSUPPORTED_FLOWCHART"]);
expectErrors("NestedStateMachine.xaml", ["UNSUPPORTED_STATEMACHINE"]);
expectErrors("CSharpExpr.xaml", ["CSHARP_EXPR"]);
expectErrors("Unknowns.xaml", ["UNKNOWN_ACT", "UNKNOWN_PROP", "UNKNOWN_TYPE"]);

test("壊れた XML と、ワークフローでない XML はエラーになる", () => {
  assert.equal(importXaml("<Activity><Sequence></Activity>", cat).errors[0].code, "XML_PARSE");
  assert.equal(importXaml("<Foo />", cat).errors[0].code, "NOT_WORKFLOW");
});

test("型の逆引き（接頭辞と assembly の違いを吸収する）", () => {
  const ns = (m: Record<string, string>) => new Map(Object.entries({ x: "http://schemas.microsoft.com/winfx/2006/xaml", ...m }));
  const scg = { scg: "clr-namespace:System.Collections.Generic;assembly=mscorlib" };
  assert.deepEqual(irType("scg:List(x:String)", ns(scg)), { type: "List<String>" });
  assert.deepEqual(irType("scg:Dictionary(x:String, scg:List(x:Int32))", ns(scg)), { type: "Dictionary<String, List<Int32>>" });
  assert.deepEqual(irType("s:String[]", ns({ s: "clr-namespace:System;assembly=mscorlib" })), { type: "String[]" });
  assert.deepEqual(irType("data:DataTable", ns({ data: "clr-namespace:System.Data;assembly=System.Data" })), { type: "DataTable" });
  assert.ok("error" in irType("foo:Bar", ns({ foo: "clr-namespace:Foo;assembly=Foo" })));
  assert.ok("error" in irType("nope:Bar", ns({})));
});

test("XML の読み方（実体参照、CDATA、コメント）", () => {
  const e = parseXml(`<?xml version="1.0"?><!-- c --><a b="&quot;x&#xA;y&quot;" xmlns:p="u"><p:c>1 &lt; 2<![CDATA[<raw>]]></p:c></a>`);
  assert.equal(e.attrs.find((a) => a.local === "b")!.value, '"x\ny"');
  assert.equal(e.kids[0].uri, "u");
  assert.equal(e.kids[0].text, "1 < 2<raw>");
});

test("意味の比較は、要素と属性の書き分けを同じに扱う", () => {
  const head = `xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"`;
  const a = `<Activity x:Class="A" ${head}><ui:LogMessage Message="[x]" /></Activity>`;
  const b = `<Activity x:Class="A" ${head}><ui:LogMessage><ui:LogMessage.Message><InArgument x:TypeArguments="x:Object">[x]</InArgument></ui:LogMessage.Message></ui:LogMessage></Activity>`;
  const c = `<Activity x:Class="A" ${head}><ui:LogMessage Message="[y]" /></Activity>`;
  assert.deepEqual(canonLines(a), canonLines(b));
  assert.notDeepEqual(canonLines(a), canonLines(c));
});

// ---- 見積もり ----

const report = (file: string) => {
  const f = join(root, "samples", "generated", file);
  return reportWorkflow(f, readFileSync(f, "utf8"), cat, maps, notes);
};

const importSample = (file: string) => importXaml(readFileSync(join(root, "samples", "generated", file), "utf8"), cat).wf!;

test("CultureInfo の属性は文字列のリテラルになる（C# で ja-JP という式にしない）", () => {
  const xml = readFileSync(join(root, "samples", "generated", "UiPath.System.Activities", "FormatDateAsText_Min.xaml"), "utf8").replace('LocalizationCode="ja-JP"', 'LocalizationCode="en-US"');
  const wf = importXaml(xml, cat).wf!;
  assert.deepEqual(wf.body.find((x) => x.act === "FormatDateAsText")!.props!.LocalizationCode, { lit: "en-US" });
  // 既定値（ja-JP）と同じなら IR には残らないが、C# では同じ値になる
  const min = importSample("UiPath.System.Activities/FormatDateAsText_Min.xaml");
  assert.equal(min.body.find((x) => x.act === "FormatDateAsText")!.props!.LocalizationCode, undefined);
  assert.match(generateCoded(min, cat, maps, { namespace: "Migrated" }).code, /new System\.Globalization\.CultureInfo\("ja-JP"\)/);
});

for (const [file, act] of [["GetQueueItems_Full", "GetQueueItems"], ["SetTransactionStatus_Var", "SetTransactionStatus"]])
  test(`既定値を落としても対応表の when がそろう：${file}`, () => {
    const wf = importSample(`UiPath.System.Activities/${file}.xaml`);
    const issues = generateCoded(wf, cat, maps, { namespace: "Migrated" }).issues;
    assert.deepEqual(issues.filter((i) => i.code === "MAPPING_UNUSED_PROP"), [], act);
  });

test("Activity<T> の子は、値を返すアクティビティでもよい（AnchorProvider）", () => {
  const seq = importSample("UiPath.UIAutomation.Activities/AnchorBase_Min.xaml").body.find((x) => x.act === "OpenBrowser")!;
  const anchor = JSON.stringify(seq);
  assert.match(anchor, /"AnchorProvider":\[\{"act":"WaitUiElementAppear"/);
});

test("変数の既定値の TimeSpan は TimeSpan.Parse の式になる", () => {
  const head = `xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:s="clr-namespace:System;assembly=mscorlib" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"`;
  const r = importXaml(`<Activity x:Class="A" ${head}><Sequence><Sequence.Variables><Variable x:TypeArguments="s:TimeSpan" Default="00:05:00" Name="d" /></Sequence.Variables></Sequence></Activity>`, cat);
  assert.deepEqual(r.errors, []);
  assert.equal(r.wf!.body[0].variables![0].default, 'TimeSpan.Parse("00:05:00")');
});

test("見積もり：対応表の ignore で捨てられる値を一覧にする（対応表の中身は固定で持たない）", () => {
  // 対応表から ignore を持つアクティビティを選び、サンプルがあるものを確かめる
  let checked = 0;
  for (const f of xamls(join(root, "samples", "generated")).slice(0, 400)) {
    const r = reportWorkflow(f, readFileSync(f, "utf8"), cat, maps, notes);
    for (const d of r.dropped.filter((x) => x.where === "ignore")) {
      const m = [...maps.values()].find((x) => x.activity === d.act);
      assert.ok(m?.ignore?.includes(d.prop), `${d.act}.${d.prop}`);
      checked++;
    }
  }
  assert.ok(checked > 0);
});

test("見積もり：動きが違うものの警告は knowledge/coded-workflow.md から読む", () => {
  assert.ok(notes.some((n) => n.subject === "ChangeType"));
  const r = report("UiPath.System.Activities/ChangeType_Min.xaml");
  assert.ok(r.behavior.some((b) => b.subject === "ChangeType"));
  assert.ok(r.activities.some((a) => a.status === "syntax"));
});

test("見積もり：ContinueOnError が False のものは警告にしない", () => {
  const r = report("UiPath.System.Activities/WriteTextFile_Full.xaml");
  assert.ok(!r.behavior.some((b) => b.subject === "ContinueOnError"));
});

test("見積もり：coded: null は理由つきで一覧に出て、C# は作れない", () => {
  const nullMap = [...maps.values()].find((m) => m.coded === null && existsSync(join(root, "samples", "generated", m.package, `${m.activity}_Min.xaml`)));
  assert.ok(nullMap, "coded: null のサンプルがあるはず");
  const r = report(`${nullMap!.package}/${nullMap!.activity}_Min.xaml`);
  const row = r.activities.find((a) => a.status === "null" && a.act === nullMap!.activity);
  assert.equal(row?.reason, nullMap!.reason);
  assert.equal(r.codedOk, false);
  assert.match(formatReport(r), /Coded API なし/);
});

test("見積もり：取り込めない XAML は理由を出す", () => {
  const r = reportWorkflow("Flowchart.xaml", fixture("unsupported/Flowchart.xaml"), cat, maps, notes);
  assert.equal(r.importable, false);
  assert.match(formatReport(r), /UNSUPPORTED_FLOWCHART/);
});

test("捨てられるプロパティの一覧は、全対応表の ignore を含む", () => {
  const md = droppedPropsMarkdown(maps);
  for (const m of maps.values()) for (const k of m.ignore ?? []) assert.ok(md.includes(k), `${m.activity}.${k}`);
});
