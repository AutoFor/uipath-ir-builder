// ローコードの UiPath Apps（Studio Web の「RPA アプリ」）を IR から作り、Studio Web に取り込めるソリューションにする。
//
//   node tools/apps/rpa-app.ts <app.json> (--out <dir> | --uis <file.uis> | --check)
//     --out <dir>        ソリューションのフォルダを書く（<dir>/<solution>.uipx、<dir>/<app>/...）
//     --uis <file.uis>   取り込み用の zip を書く。Studio Web へは uip solution upload <file.uis>
//                        （フォルダを upload に渡すと .local が送られず、イベントがつながらない）
//     --check            検証だけ
//   終了コード: 0 = 書けた / 1 = 検証で弾かれた / 2 = 使い方の誤り
//
// パーツ（knowledge/apps.md の「ローコードの Apps」）:
//   - ページ：.app/models/models-<systemName>.json。部品は Studio Web の書き出しから取った雛形（templates/rpa-app/controls.json）を
//     写して id を振り直し、文字や必須などの式（expressions）だけを書き換える
//   - App の変数：App 本体の JSON の appFields。式から使うと tokens と bindingReferences でつなぐ
//   - イベント（ボタンのクリック）：RPA のワークフロー <ページ>_<部品>_click.xaml。部品の events から start-automation で呼ぶ。
//     .local/ProjectSettings.json の ProjectAppMetadata で、その XAML をページの codebehind にする
//   - Studio Web が作る DLL（.entities、JitCustomTypes）と、XAML の Apps.* の参照は書かない（取り込んだあと Studio Web が作る）

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { deflateRawSync, crc32 } from "node:zlib";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATES = join(root, "templates", "rpa-app");

// ---- IR ----

export type Value = string | boolean | number | { var: string } | { vb: string };
// ボタンを押したときの手順。式（value / fields / id / if）は VB
export type Step =
  | { set: string; value: string } // App の変数に代入
  | { open: string } // ページを開く
  | { create: string; fields: Record<string, string> } // Data Fabric の表に 1 行足す
  | { update: string; id: string; fields: Record<string, string> } // id（Guid の式）の行を直す
  | { delete: string; id: string } // id の行を消す
  | { query: string; into: string; top?: number } // 表を読み、list の App の変数に入れる
  | { if: string; then: Step[]; else?: Step[] };
export type Column = { heading: string; value: string }; // value は行の列の名前
export type Control = {
  type: ControlType;
  name: string;
  label?: Value; text?: Value; placeholder?: Value; required?: Value; checked?: Value; hidden?: Value; disabled?: Value;
  min?: Value; max?: Value; rows?: Value;
  props?: Record<string, Value>; // 雛形の部品にある式の項目を名前で直接（tooltip など）
  onClick?: Step[]; // button だけ
  source?: Value; columns?: Column[]; // table だけ。source は list の App の変数
};
export type Page = { name: string; controls: Control[] };
export type Variable = { name: string; type: "string"; default?: string } | { name: string; type: "list"; of: string; default?: undefined };
// entities：Data Fabric の表の定義（tools/apps/rpa-app-entities.ts で作る）。IR のファイルからの相対パス
export type RpaApp = { app: string; solution?: string; kind?: "rpa-app"; entities?: string; variables?: Variable[]; pages: Page[] };
export type Store = any; // rpa-app-entities.ts の出力
export type Issue = { path: string; code: string; message: string };

export type ControlType = "textbox" | "number" | "textarea" | "checkbox" | "dropdown" | "date" | "button" | "label" | "table";
export const COMPONENT: Record<ControlType, string> = {
  textbox: "form-text-vb", number: "form-text-number-vb", textarea: "form-text-area-vb", checkbox: "form-check-box",
  dropdown: "form-dropdown-vb", date: "form-mobile-date-picker-vb", button: "form-button", label: "form-label", table: "form-simple-table-vb",
};
// IR の項目 → 部品の式の項目
const FRIENDLY: Record<string, string> = {
  label: "label", text: "text", placeholder: "placeholder", required: "required", checked: "resolvableChecked",
  hidden: "resolvableHidden", disabled: "resolvableDisabled", min: "inputControlMinValue", max: "inputControlMaxValue", rows: "numberOfRows",
};
const DATA_TYPE: Record<Variable["type"], string> = { string: "System.String", list: "Apps.Controls.ListSource" };
const xamlType = (v: Variable) => (v.type === "list" ? `ac:ListSource(de:${v.of})` : "x:String");
// Data Fabric の列の型 → XAML の型
const SQL_XAML: Record<string, string> = {
  DATE: "s:DateTime", DATETIME: "s:DateTime", DATETIMEOFFSET: "s:DateTimeOffset", BIT: "x:Boolean", NVARCHAR: "x:String", NTEXT: "x:String",
  INT: "x:Int32", BIGINT: "x:Int64", DECIMAL: "x:Decimal", FLOAT: "x:Double", UNIQUEIDENTIFIER: "s:Guid",
};
// 書き出しの「型の出どころ」の id。Data Fabric の表の型はこれが付いていた（knowledge/apps.md）
const ENTITY_TYPE_SOURCE = "5ba47f0c-5858-4f65-9378-b4be1cff98f2";
type Field = { id: string; name: string; xaml: string; required: boolean; system: boolean };
type Entity = { id: string; name: string; fields: Map<string, Field> };
export function entitiesOf(store: Store | undefined): Map<string, Entity> {
  const m = new Map<string, Entity>();
  if (!store) return m;
  for (const e of JSON.parse(store.EntitiesJson).entities) {
    m.set(e.name, { id: e.id, name: e.name, fields: new Map(e.fields.map((f: Json) => [f.name, { id: f.id, name: f.name, xaml: SQL_XAML[f.sqlType?.name] ?? "x:Object", required: !!f.isRequired, system: !!f.isSystemField }])) });
  }
  return m;
}
const STEP_KEYS = ["set", "open", "create", "update", "delete", "query", "if"] as const;
const usesEntities = (steps: Step[]): boolean => steps.some((s: Json) => "create" in s || "update" in s || "delete" in s || "query" in s || ("if" in s && (usesEntities(s.then) || usesEntities(s.else ?? []))));
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const VB_RESERVED = new Set(["and", "as", "boolean", "byref", "byval", "call", "case", "catch", "class", "const", "date", "decimal", "dim", "do", "double", "each", "else", "end", "error", "false", "finally", "for", "function", "get", "if", "in", "integer", "is", "let", "long", "loop", "me", "mod", "module", "new", "next", "not", "nothing", "object", "of", "on", "or", "property", "public", "rem", "return", "select", "set", "short", "single", "static", "step", "stop", "string", "sub", "then", "to", "true", "try", "until", "when", "while", "with"]);

type Json = any;
let cache: { controls: Json; page: Json; app: Json; event: string; eventEntities: string } | undefined;
function templates() {
  if (!cache) {
    const r = (f: string) => readFileSync(join(TEMPLATES, f), "utf8");
    cache = { controls: JSON.parse(r("controls.json")), page: JSON.parse(r("page.json")), app: JSON.parse(r("app.json")), event: r("event.xaml"), eventEntities: r("event-entities.xaml") };
  }
  return cache;
}
const vbProps = (component: string): Set<string> =>
  new Set(Object.entries<Json>(templates().controls[component].control.properties).filter(([, p]) => p.valueType === "vb-expression").map(([n]) => n));

// ---- 検証 ----

export function check(a: RpaApp, store?: Store): Issue[] {
  const out: Issue[] = [];
  const ents = entitiesOf(store);
  const add = (path: string, code: string, message: string) => out.push({ path, code, message });
  const name = (n: unknown, at: string) => {
    if (typeof n !== "string" || !IDENT.test(n)) add(at, "APP_NAME", `名前は英字で始まる英数字と _ にする（${JSON.stringify(n)}）`);
    else if (VB_RESERVED.has(n.toLowerCase())) add(at, "APP_NAME", `VB の予約語は名前にできない（${n}）`);
  };
  if (a.kind && a.kind !== "rpa-app") add("kind", "APP_KIND", `kind は "rpa-app"（${a.kind}）`);
  name(a.app, "app");
  const vars = new Map<string, Variable>();
  (a.variables ?? []).forEach((v, i) => {
    const at = `variables[${i}]`;
    name(v.name, `${at}.name`);
    if (vars.has(v.name)) add(`${at}.name`, "APP_NAME", `変数の名前が重なっている（${v.name}）`);
    vars.set(v.name, v);
    if (!(v.type in DATA_TYPE)) add(`${at}.type`, "APP_UNSUPPORTED", `変数の型 ${v.type} はまだ書けない（string と list だけ。knowledge/apps.md）`);
    else if (v.type === "list" && !ents.has(v.of)) add(`${at}.of`, "APP_REF", `表 ${v.of} が entities に無い`);
  });
  if (a.entities && !store) add("entities", "APP_REF", `表の定義 ${a.entities} が読めない`);
  if (!Array.isArray(a.pages) || !a.pages.length) { add("pages", "APP_SHAPE", "ページが 1 つも無い"); return out; }
  const pages = new Map<string, Set<string>>();
  a.pages.forEach((p, i) => {
    name(p.name, `pages[${i}].name`);
    if (pages.has(p.name)) add(`pages[${i}].name`, "APP_NAME", `ページの名前が重なっている（${p.name}）`);
    if (vars.has(p.name)) add(`pages[${i}].name`, "APP_NAME", `ページと変数の名前が重なっている（${p.name}）`);
    pages.set(p.name, new Set((p.controls ?? []).map((c) => c.name)));
  });
  const value = (v: Value, at: string) => {
    if (v && typeof v === "object") {
      if ("var" in v) { if (!vars.has(v.var)) add(at, "APP_REF", `変数 ${v.var} が無い`); }
      else if (!("vb" in v) || typeof v.vb !== "string" || !v.vb.trim()) add(at, "APP_SHAPE", "値は文字・真偽・数、{ var }、{ vb } のどれか");
      else controlsRef(v.vb, at);
    } else if (!["string", "boolean", "number"].includes(typeof v)) add(at, "APP_SHAPE", "値は文字・真偽・数、{ var }、{ vb } のどれか");
  };
  // 式の中の Controls.<ページ>.<部品> がある名前か
  const controlsRef = (expr: string, at: string) => {
    for (const m of expr.matchAll(/\bControls\.(\w+)(?:\.(\w+))?/g)) {
      const ctl = pages.get(m[1]);
      if (!ctl) add(at, "APP_REF", `ページ ${m[1]} が無い（${m[0]}）`);
      else if (m[2] && !ctl.has(m[2])) add(at, "APP_REF", `ページ ${m[1]} に部品 ${m[2]} が無い（${m[0]}）`);
    }
  };
  a.pages.forEach((p, pi) => {
    const seen = new Set<string>();
    (p.controls ?? []).forEach((c, ci) => {
      const at = `pages[${pi}].controls[${ci}]`;
      name(c.name, `${at}.name`);
      if (seen.has(c.name)) add(`${at}.name`, "APP_NAME", `部品の名前がページの中で重なっている（${c.name}）`);
      seen.add(c.name);
      const comp = COMPONENT[c.type as ControlType];
      if (!comp) { add(`${at}.type`, "APP_TYPE", `部品 ${c.type} は無い（${Object.keys(COMPONENT).join(" / ")}）`); return; }
      const has = vbProps(comp);
      if (c.source !== undefined || c.columns) {
        if (c.type !== "table") add(`${at}.source`, "APP_PROP", "source と columns は table だけ");
        else {
          const sv = c.source as Json;
          const lv = sv && typeof sv === "object" && "var" in sv ? vars.get(sv.var) : undefined;
          if (!lv || lv.type !== "list") add(`${at}.source`, "APP_REF", "source は list の App の変数（{ var }）");
          const cols = lv?.type === "list" ? ents.get(lv.of)?.fields : undefined;
          (c.columns ?? []).forEach((col, k) => {
            if (typeof col?.heading !== "string" || typeof col?.value !== "string") add(`${at}.columns[${k}]`, "APP_SHAPE", "列は { heading, value }");
            else if (cols && !cols.has(col.value)) add(`${at}.columns[${k}].value`, "APP_REF", `表 ${(lv as Json).of} に列 ${col.value} が無い`);
          });
        }
      }
      for (const [k, v] of Object.entries(c)) {
        if (["type", "name", "props", "onClick", "source", "columns"].includes(k)) continue;
        if (!(k in FRIENDLY)) { add(`${at}.${k}`, "APP_PROP", `項目 ${k} は無い（${Object.keys(FRIENDLY).join(", ")}、props、onClick）`); continue; }
        if (!has.has(FRIENDLY[k])) { add(`${at}.${k}`, "APP_PROP", `${c.type} に ${k} は無い`); continue; }
        value(v as Value, `${at}.${k}`);
      }
      for (const [k, v] of Object.entries(c.props ?? {})) {
        if (!has.has(k)) add(`${at}.props.${k}`, "APP_PROP", `${c.type}（${comp}）に式の項目 ${k} は無い`);
        else value(v, `${at}.props.${k}`);
      }
      if (c.onClick) {
        if (c.type !== "button") add(`${at}.onClick`, "APP_PROP", "onClick は button だけ");
        const vb = (x: unknown, at2: string) => {
          if (typeof x !== "string" || !x.trim()) add(at2, "APP_SHAPE", "VB の式を書く");
          else controlsRef(x, at2);
        };
        const entity = (n: unknown, at2: string) => {
          const e = ents.get(n as string);
          if (!e) add(at2, "APP_REF", store ? `表 ${n} が entities に無い` : `表 ${n} を使うには entities（表の定義）が要る`);
          return e;
        };
        const fields = (e: Entity | undefined, f: unknown, at2: string) => {
          if (!f || typeof f !== "object") { add(at2, "APP_SHAPE", "fields は { 列の名前: VB の式 }"); return; }
          for (const [k, x] of Object.entries(f)) {
            const fd = e?.fields.get(k);
            if (e && !fd) add(`${at2}.${k}`, "APP_REF", `表 ${e.name} に列 ${k} が無い`);
            else if (fd?.system) add(`${at2}.${k}`, "APP_REF", `列 ${k} は Data Fabric が書く列`);
            vb(x, `${at2}.${k}`);
          }
        };
        const steps = (list: Json, base: string) => {
          if (!Array.isArray(list)) { add(base, "APP_SHAPE", "手順は配列"); return; }
          list.forEach((s: Json, si: number) => {
            const sat = `${base}[${si}]`;
            const kinds = STEP_KEYS.filter((k) => s && typeof s === "object" && k in s);
            if (kinds.length !== 1) { add(sat, "APP_SHAPE", `手順は ${STEP_KEYS.map((k) => `{ ${k} }`).join(" / ")} のどれか 1 つ`); return; }
            if ("set" in s) {
              const v = vars.get(s.set);
              if (!v) add(`${sat}.set`, "APP_REF", `変数 ${s.set} が無い`);
              vb(s.value, `${sat}.value`);
            } else if ("open" in s) {
              if (!pages.has(s.open)) add(`${sat}.open`, "APP_REF", `ページ ${s.open} が無い`);
              else if (s.open === p.name) add(`${sat}.open`, "APP_REF", "いまのページは開けない");
            } else if ("create" in s) {
              const e = entity(s.create, `${sat}.create`);
              fields(e, s.fields, `${sat}.fields`);
              for (const f of e?.fields.values() ?? []) if (f.required && !f.system && !(f.name in (s.fields ?? {}))) add(`${sat}.fields`, "APP_REF", `必須の列 ${f.name} が無い`);
            } else if ("update" in s) {
              fields(entity(s.update, `${sat}.update`), s.fields, `${sat}.fields`);
              vb(s.id, `${sat}.id`);
            } else if ("delete" in s) {
              entity(s.delete, `${sat}.delete`);
              vb(s.id, `${sat}.id`);
            } else if ("query" in s) {
              entity(s.query, `${sat}.query`);
              const v = vars.get(s.into);
              if (!v || v.type !== "list" || v.of !== s.query) add(`${sat}.into`, "APP_REF", `into は表 ${s.query} の list の App の変数`);
              if (s.top !== undefined && !(Number.isInteger(s.top) && s.top > 0 && s.top <= 1000)) add(`${sat}.top`, "APP_SHAPE", "top は 1〜1000");
            } else {
              vb(s.if, `${sat}.if`);
              steps(s.then, `${sat}.then`);
              if (s.else !== undefined) steps(s.else, `${sat}.else`);
            }
          });
        };
        steps(c.onClick, `${at}.onClick`);
      }
    });
  });
  return out;
}

// ---- 生成 ----

const hex = () => randomBytes(16).toString("hex");
const vbString = (s: string) => `"${s.replace(/"/g, '""')}"`;
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Ids = { next: () => string };

// 雛形を写し、32 桁の id（部品・式）を新しくし、内部の通し番号（"id": "ID1234"）を振り直す
function cloneWithNewIds(t: Json, ids: Ids, map = new Map<string, string>()): Json {
  const re = (s: string) => s.replace(/\bid[0-9a-f]{32}\b/g, (old) => { if (!map.has(old)) map.set(old, `id${hex()}`); return map.get(old)!; });
  const walk = (v: Json): Json => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: Json = {};
      for (const [k, x] of Object.entries(v)) o[re(k)] = k === "id" && typeof x === "string" && /^ID\d+$/.test(x) ? ids.next() : walk(x);
      return o;
    }
    return typeof v === "string" ? re(v) : v;
  };
  return walk(t);
}

type Built = { model: Json; formId: string; systemName: string; events: { file: string; xaml: string }[] };

function setExpr(ctl: Json, group: Json, prop: string, v: Value, appFields: Map<string, Json>, refs: Json) {
  const p = ctl.properties[prop];
  const eid = p.value.expressionId;
  const e = group.expressions[eid];
  if (!e) throw new Error(`雛形の ${ctl.component} に ${prop} の式が無い（templates/rpa-app を作り直す）`);
  writeExpr(e, eid, v, appFields, refs);
}

// 表：データの元（config.sourceBinding）と列（config.columns）。列の値の式の形は Studio Web で確かめる（knowledge/apps.md）
function tableSetup(ctl: Json, group: Json, c: Control, appFields: Map<string, Json>, refs: Json, ids: Ids) {
  if (c.source !== undefined) {
    const eid = ctl.config.sourceBinding.expressionId;
    writeExpr(group.expressions[eid], eid, c.source, appFields, refs);
  }
  if (!c.columns) return;
  const base = ctl.config.columns[0];
  for (const col of ctl.config.columns) { delete group.expressions[col.headingExpression.expressionId]; delete group.expressions[col.valueExpression.expressionId]; }
  const expr = (contextSourceId: string, expression: string, isLiteral: boolean) => ({ id: ids.next(), expression, isLiteral, sourceType: "expression-config-panel", contextSourceId, skipCompilation: false, tokens: [], addedVia: "EE", validationConfig: { id: ids.next() } });
  ctl.config.columns = c.columns.map((x) => {
    const col = structuredClone(base);
    col.id = ids.next();
    col.valueExpression = { expressionId: `id${hex()}`, isLiteral: true };
    col.headingExpression = { ...col.headingExpression, id: ids.next(), expressionId: `id${hex()}`, workflow: { id: ids.next() } };
    const at = `$.controls.${ctl.id}.config.columns[?(@.id=="${col.id}")]`;
    group.expressions[col.headingExpression.expressionId] = expr(`${at}.headingExpression`, vbString(x.heading), true);
    group.expressions[col.valueExpression.expressionId] = expr(`${at}.valueExpression`, x.value, true);
    return col;
  });
}

function writeExpr(e: Json, eid: string, v: Value, appFields: Map<string, Json>, refs: Json) {
  e.tokens = [];
  if (v && typeof v === "object" && "var" in v) {
    const f = appFields.get(v.var)!;
    Object.assign(e, { expression: v.var, isLiteral: false, addedVia: "VEB" });
    e.tokens = [{ token: v.var, type: "AppVariables.AppVariable", startIndex: 0, endIndex: v.var.length, tokenId: f.id, tokenType: "app-variable", isContextualArg: false, properties: [] }];
    (refs[f.id] ??= []).push(eid);
  } else if (v && typeof v === "object") Object.assign(e, { expression: v.vb, isLiteral: false });
  else Object.assign(e, { expression: typeof v === "string" ? vbString(v) : String(v), isLiteral: true });
}

type Ctx = { page: string; forms: Map<string, { formId: string }>; vars: Map<string, Variable>; ents: Map<string, Entity>; n: Map<string, number>; locals: string[] };
const nextId = (c: Ctx, k: string) => { const v = (c.n.get(k) ?? 0) + 1; c.n.set(k, v); return `${k}_${v}`; };
const ind = (s: string, d: number) => s.split("\n").map((l) => " ".repeat(d) + l).join("\n");

function assignXaml(c: Ctx, to: string, ty: string, value: string): string {
  return `<Assign DisplayName="Assign" sap2010:WorkflowViewState.IdRef="${nextId(c, "Assign")}">
  <Assign.To>
    <OutArgument x:TypeArguments="${ty}">[${xml(to)}]</OutArgument>
  </Assign.To>
  <Assign.Value>
    <InArgument x:TypeArguments="${ty}">[${xml(value)}]</InArgument>
  </Assign.Value>
</Assign>`;
}

// Create / Update の列：InputEntityInFieldView（With の式）と State（列ごとの引数）
function entityFields(e: Entity, fields: Record<string, string>): { inline: string; state: string } {
  const used = Object.entries(fields);
  const inline = `[new DataService.Entities.${e.name}() With { ${used.map(([k, v]) => ` .${k} = ${v}`).join(", ")} }]`;
  const req = [...e.fields.values()].filter((f) => f.required && !f.system).length;
  const sel = used.map(([k, v]) => {
    const f = e.fields.get(k)!;
    return `      <udam:DynamicEntityField Id="${f.id}"${f.required ? ' IsRequired="True"' : ""} Name="${k}">
        <udam:DynamicEntityField.ArgumentValue>
          <InArgument x:TypeArguments="${f.xaml}">[${xml(v)}]</InArgument>
        </udam:DynamicEntityField.ArgumentValue>
      </udam:DynamicEntityField>`;
  });
  return { inline, state: `<udam:RecordState RequiredFieldCount="${req}">
  <udam:RecordState.SelectedFields>
    <scg:List x:TypeArguments="udam:DynamicEntityField" Capacity="${Math.max(used.length, 1)}">
${sel.join("\n")}
    </scg:List>
  </udam:RecordState.SelectedFields>
</udam:RecordState>` };
}

// Data Fabric の手順の共通の属性。ScopeValue は Studio Web（日本語の画面）が書いた値のまま
const SCOPE = 'ScopeValue="テナント" TimeoutInMs="30000"';

function stepXaml(c: Ctx, s: Step): string {
  if ("set" in s) return assignXaml(c, `AppVariable.${s.set}`, xamlType(c.vars.get(s.set)!), s.value);
  if ("create" in s || "update" in s) {
    const kind = "create" in s ? "CreateEntityRecord" : "UpdateEntityRecord";
    const e = c.ents.get("create" in s ? s.create : s.update)!;
    const { inline, state } = entityFields(e, s.fields);
    const rec = "update" in s ? ` RecordId="[${xml(s.id)}]" Version="{x:Null}"` : "";
    const label = "create" in s ? "エンティティ レコードを作成" : "エンティティ レコードを更新";
    return `<uda:${kind} x:TypeArguments="de:${e.name}" InputEntity="{x:Null}" IsInRecordView="{x:Null}" OutputEntity="{x:Null}" SolutionEntityKey="{x:Null}" SolutionEntityName="{x:Null}" sap:WorkflowViewStateService.ViewState="{x:Null}" VisibleDynamicPropertiesInfo="{x:Null}" ContinueOnError="False" DisplayName="${label}" EntityId="${e.id}" ExpansionDepth="2" sap2010:WorkflowViewState.IdRef="${nextId(c, kind + "`1")}" InputEntityInFieldView="${xml(inline)}"${rec} ${SCOPE}>
  <uda:${kind}.State>
${ind(state, 4)}
  </uda:${kind}.State>
</uda:${kind}>`;
  }
  if ("delete" in s) {
    const e = c.ents.get(s.delete)!;
    return `<uda:DeleteEntityRecord x:TypeArguments="de:${e.name}" InputEntity="{x:Null}" SolutionEntityKey="{x:Null}" SolutionEntityName="{x:Null}" Version="{x:Null}" ContinueOnError="False" DisplayName="エンティティ レコードを削除" EntityId="${e.id}" sap2010:WorkflowViewState.IdRef="${nextId(c, "DeleteEntityRecord`1")}" RecordId="[${xml(s.id)}]" ${SCOPE} />`;
  }
  if ("query" in s) {
    const e = c.ents.get(s.query)!;
    const ref = nextId(c, "QueryEntityRecords`1");
    const local = `rows${c.locals.length + 1}`;
    c.locals.push(`<Variable x:TypeArguments="scg:IList(de:${e.name})" Name="${local}" />`);
    return `<uda:QueryEntityRecords x:TypeArguments="de:${e.name}" FilterArguments="{x:Null}" FilterValues="{x:Null}" RequiredForReadInput="{x:Null}" SolutionEntityKey="{x:Null}" SolutionEntityName="{x:Null}" SortByField="{x:Null}" TotalRecords="{x:Null}" sap:WorkflowViewStateService.ViewState="{x:Null}" ContinueOnError="False" DisplayName="エンティティ レコードにクエリを実行" EntityId="${e.id}" ExpansionDepth="2" sap2010:WorkflowViewState.IdRef="${ref}" OutputRecords="[${local}]" QueriedEntityId="${e.id}" ${SCOPE} Skip="0" SortAscending="True" Top="${s.top ?? 1000}">
  <uda:QueryEntityRecords.RequiredForReadFieldNames>
    <scg:List x:TypeArguments="x:String" Capacity="0" />
  </uda:QueryEntityRecords.RequiredForReadFieldNames>
</uda:QueryEntityRecords>
${assignXaml(c, `AppVariable.${s.into}`, xamlType(c.vars.get(s.into)!), `${local}.ToListSource()`)}`;
  }
  if ("if" in s) {
    const seq = (list: Step[]) => `<Sequence DisplayName="Sequence" sap2010:WorkflowViewState.IdRef="${nextId(c, "Sequence")}">
${list.map((x) => ind(stepXaml(c, x), 2)).join("\n")}
</Sequence>`;
    return `<If Condition="[${xml(s.if)}]" DisplayName="If" sap2010:WorkflowViewState.IdRef="${nextId(c, "If")}">
  <If.Then>
${ind(seq(s.then), 4)}
  </If.Then>${s.else?.length ? `
  <If.Else>
${ind(seq(s.else), 4)}
  </If.Else>` : ""}
</If>`;
  }
  return `<uwana:OpenAppsPage AsBottomSheet="{x:Null}" AsBottomSheetEnabled="{x:Null}" AsPopOver="{x:Null}" AsPopOverEnabled="{x:Null}" OpenInPageContainer="{x:Null}" PageContainerArg="{x:Null}" PageContainerId="{x:Null}" PreventCloseOnClick="{x:Null}" PreventCloseOnClickEnabled="{x:Null}" Result="{x:Null}" CurrentFormId="${c.forms.get(c.page)!.formId}" DisplayName="Open Apps Page" sap2010:WorkflowViewState.IdRef="${nextId(c, "OpenAppsPage")}" PageFormId="${c.forms.get(s.open)!.formId}" PageName="${s.open}">
  <uwana:OpenAppsPage.OpenInPageContainerExpression>
    <scg:Dictionary x:TypeArguments="x:String, x:String" />
  </uwana:OpenAppsPage.OpenInPageContainerExpression>
  <uwana:OpenAppsPage.PageArg>
    <InArgument x:TypeArguments="x:String">
      <Literal x:TypeArguments="x:String">
        <sap:WorkflowViewStateService.ViewState>
          <scg:Dictionary x:TypeArguments="x:String, x:Object">
            <x:String x:Key="apps::expression">Controls.${s.open}</x:String>
          </scg:Dictionary>
        </sap:WorkflowViewStateService.ViewState>${s.open}</Literal>
    </InArgument>
  </uwana:OpenAppsPage.PageArg>
  <uwana:OpenAppsPage.PageNameExpression>
    <scg:Dictionary x:TypeArguments="x:String, x:String" />
  </uwana:OpenAppsPage.PageNameExpression>
</uwana:OpenAppsPage>`;
}

function eventXaml(page: string, control: string, steps: Step[], forms: Map<string, { formId: string }>, vars: Map<string, Variable>, ents: Map<string, Entity>): string {
  const T = templates();
  const withEntities = usesEntities(steps) || [...vars.values()].some((v) => v.type === "list");
  const c: Ctx = { page, forms, vars, ents, n: new Map([["Sequence", 1]]), locals: [] };
  const body = steps.map((s) => ind(stepXaml(c, s), 4)).join("\n");
  const locals = c.locals.length ? `    <Sequence.Variables>\n${c.locals.map((l) => `      ${l}`).join("\n")}\n    </Sequence.Variables>\n` : "";
  return `${withEntities ? T.eventEntities : T.event}  <Sequence sap:VirtualizedContainerService.HintSize="356,732" sap2010:WorkflowViewState.IdRef="Sequence_1">
${locals}    <sap:WorkflowViewStateService.ViewState>
      <scg:Dictionary x:TypeArguments="x:String, x:Object">
        <x:Boolean x:Key="IsExpanded">True</x:Boolean>
      </scg:Dictionary>
    </sap:WorkflowViewStateService.ViewState>
    <ui:ManualTrigger Result="{x:Null}" DisplayName="${page}_${control} : クリック時 Event" sap2010:WorkflowViewState.IdRef="ManualTrigger_1" />
${body}
  </Sequence>
</Activity>`;
}

export function generateFiles(a: RpaApp, store?: Store): Record<string, string> {
  const T = templates();
  const ents = entitiesOf(store);
  const solution = a.solution ?? a.app;
  const solutionId = randomUUID(), projectId = randomUUID(), projectKey = randomUUID();
  const appSystemName = `ID${hex()}`;
  const vars = new Map((a.variables ?? []).map((v) => [v.name, v]));

  // App の変数
  const appFields = new Map<string, Json>();
  (a.variables ?? []).forEach((v, i) => appFields.set(v.name, {
    id: `hs${[...randomBytes(13)].map((b) => String(b % 100).padStart(2, "0")).join("").slice(0, 25)}`,
    name: v.name, type: v.type === "list" ? "object" : v.type, defaultValue: v.default ?? null,
    appVariableDefinition: v.type === "list"
      ? { id: `ID${2001 + i}`, name: v.name, baseType: "generic", dataType: DATA_TYPE.list, defaultValue: null, options: [{ baseType: "class", dataType: `[${ENTITY_TYPE_SOURCE}]::DataService.Entities.${v.of}`, dataTypeTokenId: null, dataTypeTokenType: null }], fields: [] }
      : { id: `ID${2001 + i}`, name: v.name, baseType: "primitive", dataType: DATA_TYPE[v.type], defaultValue: v.default ?? null, options: [], dataTypeTokenId: null, dataTypeTokenType: null, fields: [] },
  }));

  // ページの id を先に決める（Open Apps Page が別のページの formId を使う）
  const forms = new Map(a.pages.map((p) => [p.name, { formId: `id${hex()}`, systemName: `ID${hex()}` }]));
  const files: Record<string, string> = {};
  const appMetadata: Record<string, Json> = {};
  const P = (f: string) => `${a.app}/${f}`;

  a.pages.forEach((pg, order) => {
    const { formId, systemName } = forms.get(pg.name)!;
    const page = structuredClone(T.page);
    let counter = page.idCounter;
    const ids: Ids = { next: () => `ID${++counter}` };
    const rootId = page.rootPanelId;
    const appRef = Object.values<Json>(page.rootReferences)[0];
    Object.assign(page, { id: `ID${hex()}`, order, systemName, appSystemName, formId, title: pg.name, rootReferences: { [appSystemName]: appRef } });
    const refs: Json = {};
    for (const c of pg.controls ?? []) {
      const t = T.controls[COMPONENT[c.type]];
      const map = new Map<string, string>();
      const ctl = cloneWithNewIds(t.control, ids, map);
      const group = cloneWithNewIds(t.expressions, ids, map);
      Object.assign(ctl, { name: c.name, _logicalParent: rootId });
      for (const [k, v] of Object.entries(c)) if (k in FRIENDLY) setExpr(ctl, group, FRIENDLY[k], v as Value, appFields, refs);
      for (const [k, v] of Object.entries(c.props ?? {})) setExpr(ctl, group, k, v, appFields, refs);
      if (c.type === "table") tableSetup(ctl, group, c, appFields, refs, ids);
      if (c.onClick?.length) {
        const file = `${pg.name}_${c.name}_click.xaml`;
        const automationId = randomUUID();
        ctl.events.click.executors = [{ id: ids.next(), executorMethod: "start-automation", config: { automationId, workflowPath: file } }];
        ctl.events.click.actionType = "automation";
        page.workflowBindings[automationId] = { id: ids.next(), controlId: ctl.id, workflowPath: null, activities: {} };
        files[P(file)] = eventXaml(pg.name, c.name, c.onClick, forms, vars, ents);
        appMetadata[file] = { AppFormId: formId, IsAppQueryBuilder: null };
      }
      page.controls[ctl.id] = ctl;
      page.controls[rootId].config.childIds.push(ctl.id);
      page.expressions[ctl.id] = group;
    }
    page.bindingReferences = refs;
    page.idCounter = counter + 1;
    files[P(`.app/models/models-${systemName}.json`)] = JSON.stringify(page);
  });

  // App 本体
  const start = forms.get(a.pages[0].name)!;
  const app = structuredClone(T.app);
  const ref = Object.values<Json>(app.rootReferences)[0];
  Object.assign(app, {
    id: `ID${hex()}`, systemName: appSystemName, title: a.app, appFields: [...appFields.values()],
    rootReferences: { [start.systemName]: ref },
    defaultForm: { ...app.defaultForm, rootSystemName: start.systemName, instanceJPath: `$.rootReferences.${start.systemName}.instances[?(@.id=="${ref.instances[0].id}")]` },
    unifiedProjectId: projectId, unifiedBuildSolutionId: solutionId, cacheKey: String(Date.now()),
  });
  files[P(`.app/models/models-${appSystemName}.json`)] = JSON.stringify(app);
  files[P(`.app/.context/${appSystemName}.json`)] = JSON.stringify({ expressionLanguage: "VB", isBlankApp: "true", projectType: "Process" }, null, 2);
  files[P(".app/documents/libraries-metadata.json")] = JSON.stringify({ [app.id]: { id: app.id, isPublic: false, parentId: null, metadata: { createdByDisplayName: "", createdByEmail: "", createdByFqn: "", createdOnDate: new Date().toISOString(), description: "", title: a.app } } });
  files[P(".local/ProjectSettings.json")] = JSON.stringify({ ProjectBreakpoints: '{"Value":{}}', ProjectWatches: '{"Value":[]}', ActivitiesMetadata: "{}", ProjectAppMetadata: JSON.stringify(appMetadata), ProjectAppExpressionsMetadata: "{}" });

  // そのまま写すファイル（トリガーの id だけ新しくする）
  const triggerId = randomUUID();
  const fixed = join(TEMPLATES, "files");
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  for (const f of walk(fixed)) {
    const rel = relative(fixed, f).replace(/\\/g, "/");
    files[P(rel)] = readFileSync(f, "utf8").replace(/c469b871-8511-4639-b839-6b3688ad5cd6/g, triggerId);
  }
  const project = JSON.parse(files[P("project.json")]);
  Object.assign(project, { name: a.app, projectId });
  // Data Fabric の表：定義だけ置く（型の DLL と JitCustomTypes は取り込んだあと Studio Web が作る）
  if (store) {
    project.entitiesStores = [{ serviceDocument: ".entities/EntitiesStore.json", namespace: store.Namespace ?? "DataService.Entities" }];
    files[P(".entities/EntitiesStore.json")] = JSON.stringify(store);
  }
  files[P("project.json")] = JSON.stringify(project, null, 2);
  files[P("project.uiproj")] = JSON.stringify({ ProjectType: "WebApp", WebAppSettings: { AppId: appSystemName, IsCoreProject: true }, Name: a.app, Description: null, MainFile: "Main.xaml" }, null, 2);

  // ソリューション
  files[`${solution}.uipx`] = JSON.stringify({ DocVersion: "1.0.0", StudioMinVersion: "2025.04.0", SolutionId: solutionId, Projects: [{ Type: "WebApp", ProjectRelativePath: P("project.uiproj"), Id: projectKey }], AutomationHubIdeaUrl: null }, null, 2);
  files["SolutionStorage.json"] = JSON.stringify({ SolutionId: solutionId, Projects: [{ ProjectId: projectId, ProjectRelativePath: P("project.uiproj") }] }, null, 2);
  const key = { app: randomUUID(), appVersion: randomUUID(), package: randomUUID(), process: randomUUID() };
  const res = (kind: string, apiVersion: string, deps: Json[], spec: Json, folders = true, extra: Json = {}) => JSON.stringify({ docVersion: "1.0.0", resource: { name: a.app, kind, ...extra, apiVersion, projectKey, isOverridable: true, dependencies: deps, runtimeDependencies: [], files: [], folders: folders ? [{ fullyQualifiedName: "solution_folder" }] : [], spec, locks: [], key: (key as Json)[kind] } }, null, 2);
  files[`resources/solution_folder/app/${a.app}.json`] = res("app", "apps.uipath.com/v1", [{ name: a.app, kind: "appVersion" }, { name: a.app, kind: "process" }], { name: a.app, description: null, type: "Regular", version: null, appSystemName: null, appVersionRef: { key: key.appVersion }, codeBehindProcess: { key: key.process }, actionSchema: null, manualActivationActions: null });
  files[`resources/solution_folder/appVersion/${a.app}.json`] = res("appVersion", "apps.uipath.com/v2", [], { name: a.app, description: null, publishNote: null, version: null, projectId: null, isAppPublic: false, packageFile: null, packageKey: null }, false);
  files[`resources/solution_folder/package/${a.app}.json`] = res("package", "orchestrator.uipath.com/v1", [], { fileName: null, fileReference: null, name: a.app, description: null });
  files[`resources/solution_folder/process/webApp/${a.app}.json`] = res("process", "orchestrator.uipath.com/v1", [{ name: a.app, kind: "package" }], {
    entryPointUniqueId: null, inputArgumentsSchema: null, outputArgumentsSchema: null, inputArgumentsSchemaV2: null, outputArgumentsSchemaV2: null, type: "WebApp", name: a.app, description: null,
    package: { key: key.package }, packageName: `${solution.replace(/\s+/g, ".")}.webApp.${a.app}`, packageVersion: null, entryPointName: null, inputArguments: null, jobPriority: "Medium",
    hiddenForAttendedUser: true, alwaysRunning: true, autoStartProcess: false, jobRecording: "Disabled", targetFrameworkValue: "Portable", duration: 40, frequency: 500, quality: 100,
    remoteControlAccess: "None", robotSize: "Automatic", retentionAction: "Delete", retentionPeriod: 30, retentionBucketRef: null, staleRetentionAction: "Delete", staleRetentionPeriod: 180,
    staleRetentionBucketRef: null, entryPoints: null, connections: null, tags: [],
  }, true, { type: "webApp" });
  return files;
}

// 開く先のページは、取り込んだあと Studio Web で式を 1 回直すまで DLL ができない（knowledge/apps.md）
export function notices(a: RpaApp): string[] {
  const targets = new Set(a.pages.flatMap((p) => p.controls.flatMap((c) => (c.onClick ?? []).flatMap((s) => ("open" in s ? [s.open] : [])))));
  return [...targets].map((t) => `APP_OPEN_PAGE  ページ ${t} を開く手順がある。取り込んだあと、Studio Web で ${t} の部品の式を 1 回直して保存するまで「Selected page is not accessible」になる`);
}

// ---- zip（.uis）----

export function zip(files: Record<string, string>): Buffer {
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, "utf8"), comp = deflateRawSync(data), n = Buffer.from(name, "utf8"), crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    local.push(h, n, comp); central.push(c, n);
    offset += h.length + n.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

// IR の entities（IR のファイルからの相対パス）を読む。読めなければ undefined（check が APP_REF にする）
export function loadStore(app: RpaApp, irFile: string): Store | undefined {
  if (!app.entities) return undefined;
  try { return JSON.parse(readFileSync(resolvePath(dirname(irFile), app.entities), "utf8")); } catch { return undefined; }
}

function main() {
  const args = process.argv.slice(2);
  const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const out = val("--out"), uis = val("--uis"), checkOnly = args.includes("--check");
  const files = args.filter((a, i) => !a.startsWith("--") && !["--out", "--uis"].includes(args[i - 1]));
  if (files.length !== 1 || (!out && !uis && !checkOnly)) { console.error("使い方: node tools/apps/rpa-app.ts <app.json> (--out <dir> | --uis <file.uis> | --check)"); process.exit(2); }
  const app: RpaApp = JSON.parse(readFileSync(files[0], "utf8"));
  const store = loadStore(app, files[0]);
  const issues = check(app, store);
  if (issues.length) {
    console.log(`NG ${files[0]}`);
    for (const i of issues) console.log(`  ${i.code.padEnd(16)} ${i.path}: ${i.message}`);
    process.exit(1);
  }
  for (const n of notices(app)) console.log(`  注意 ${n}`);
  if (checkOnly) { console.log(`OK ${files[0]}`); return; }
  const gen = generateFiles(app, store);
  if (out) {
    for (const [p, s] of Object.entries(gen)) { const f = join(resolvePath(out), p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s, "utf8"); }
    console.log(`OK ${files[0]} -> ${out}（${Object.keys(gen).length} ファイル）`);
  }
  if (uis) {
    mkdirSync(dirname(resolvePath(uis)), { recursive: true });
    writeFileSync(uis, zip(gen));
    console.log(`OK ${files[0]} -> ${uis}（Studio Web へは uip solution upload ${uis}）`);
  }
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();
