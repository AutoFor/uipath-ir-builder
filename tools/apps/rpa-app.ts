// ローコードの UiPath Apps（Studio Web の「RPA アプリ」）を IR から作り、Studio Web に取り込めるソリューションにする。
//
//   node tools/apps/rpa-app.ts <app.json> (--out <dir> | --uis <file.uis> | --check)
//     --out <dir>        ソリューションのフォルダを書く（<dir>/<solution>.uipx、<dir>/<app>/...）
//     --uis <file.uis>   取り込み用の zip を書く。Studio Web へは uip solution upload <file.uis>
//                        （フォルダを upload に渡すと .local が送られず、イベントがつながらない）
//     --check            検証だけ
//     --solution-id <Id> Studio Web の既にあるソリューションの Id にする。--uis を upload すると、そのソリューションを上書きする
//                        （Action: Overwritten。上書きの前の版は Studio Web に残る。IR に無いプロジェクトは消える。knowledge/apps.md）
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

// { action }：アクションのプロパティ（ActionProperties.<名>）。アクションを持つアプリだけ
export type Value = string | boolean | number | { var: string } | { vb: string } | { action: string };
// ボタンを押したときの手順。式（value / fields / id / if）は VB
export type Step =
  | { submit: string; values?: Record<string, string> } // Submit Action。結果（outcome）と、outputs / inOuts に入れる VB の式
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
  min?: Value; max?: Value; rows?: Value; step?: Value; value?: Value; url?: Value; src?: Value;
  props?: Record<string, Value>; // 雛形の部品にある式の項目を名前で直接（tooltip など）
  onClick?: Step[]; // button だけ
  source?: Value; columns?: Column[]; // table だけ。source は list の App の変数
  options?: string[]; // dropdown / radio / multiselect / list の選択肢（List source に {"A", "B"}.ToListSource() と書く）
  hideCharacters?: boolean; // textbox だけ。パスワードのように伏せ字にする（Studio Web の Hide characters。式ではなく真偽の項目）
  controls?: Control[]; // container だけ。中に並べる部品（入れ子にできる）
};
// onLoad：ページを開いたときの手順（Studio Web のページの Events → Loaded。根のパネルの load のイベント）
export type Page = { name: string; controls: Control[]; onLoad?: Step[] };
export type Variable = { name: string; type: "string"; default?: string } | { name: string; type: "list"; of: string; default?: undefined };
// entities：Data Fabric の表の定義（tools/apps/rpa-app-entities.ts で作る）。IR のファイルからの相対パス
// action：Action Center のタスクの画面にする（アプリ 1 つに 1 つ）。形は Studio Web の Simple Approval の書き出し（AUT-1193）
export type ActionField = { name: string; type?: "string" | "boolean"; description?: string; required?: boolean };
export type Action = { description?: string; inputs?: ActionField[]; outputs?: ActionField[]; inOuts?: ActionField[]; outcomes: (string | { name: string; description?: string })[] };
export type RpaApp = { app: string; solution?: string; kind?: "rpa-app"; entities?: string; variables?: Variable[]; action?: Action; pages: Page[] };
export type Store = any; // rpa-app-entities.ts の出力
export type Issue = { path: string; code: string; message: string };

export type ControlType = "textbox" | "number" | "textarea" | "checkbox" | "dropdown" | "date" | "button" | "label" | "table"
  | "radio" | "multiselect" | "slider" | "switch" | "email" | "fileUpload" | "fileDownload" | "header" | "divider" | "iframe" | "documentViewer"
  | "richText" | "multiFileUpload" | "list" | "container";
// radio から下は、2026-11-17 に Studio Web の Toolbox で足して書き出したもの（tools/apps/rpa-app-templates.ts --add-controls）
export const COMPONENT: Record<ControlType, string> = {
  textbox: "form-text-vb", number: "form-text-number-vb", textarea: "form-text-area-vb", checkbox: "form-check-box",
  dropdown: "form-dropdown-vb", date: "form-mobile-date-picker-vb", button: "form-button", label: "form-label", table: "form-simple-table-vb",
  radio: "form-radio-button-vb", multiselect: "form-multiselect-vb", slider: "form-slider-vb", switch: "form-mobile-switch", email: "form-text-email-vb",
  fileUpload: "form-file-uploader", fileDownload: "form-file-downloader", header: "form-page-heading", divider: "form-mobile-divider",
  iframe: "form-iframe", documentViewer: "form-document-viewer",
  richText: "form-rich-text-editor", multiFileUpload: "form-multi-file-uploader", list: "form-list-vb", container: "form-vb-panel",
};
// 入れ子もたどって、ページの部品をすべて並べる
export const allControls = (list: Control[] = []): Control[] => list.flatMap((c) => [c, ...(c.type === "container" ? allControls(c.controls) : [])]);
// 選択肢（List source）を持つ部品。config.sourceBinding の式に {"A", "B"}.ToListSource()、genericType は System.String（Studio Web の書き出し）
const WITH_OPTIONS = new Set<ControlType>(["dropdown", "radio", "multiselect", "list"]);
// IR の項目 → 部品の式の項目。部品によって名前が違うものは、その部品にある最初のもの
const FRIENDLY: Record<string, string[]> = {
  label: ["label"], text: ["text", "labelText"], placeholder: ["placeholder"], required: ["required"], checked: ["resolvableChecked", "resolvableSwitchValue"],
  hidden: ["resolvableHidden"], disabled: ["resolvableDisabled"], min: ["inputControlMinValue", "minValue"], max: ["inputControlMaxValue", "maxValue"],
  rows: ["numberOfRows"], step: ["sliderStep"], value: ["sliderValue"], url: ["url"], src: ["src", "documentViewerSrc"],
};
const friendly = (k: string, has: Set<string>) => FRIENDLY[k]?.find((p) => has.has(p));
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
const STEP_KEYS = ["submit", "set", "open", "create", "update", "delete", "query", "if"] as const;
const ACTION_TYPE = { string: { net: "System.String", xaml: "x:String" }, boolean: { net: "System.Boolean", xaml: "x:Boolean" } } as const;
const outcomeName = (o: string | { name: string }) => (typeof o === "string" ? o : o?.name);
const usesEntities = (steps: Step[]): boolean => steps.some((s: Json) => "create" in s || "update" in s || "delete" in s || "query" in s || ("if" in s && (usesEntities(s.then) || usesEntities(s.else ?? []))));
// 文書：英字で始まる英数字と _。日本語は VB の制限で使えない（AUT-1208 の 19）
const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;
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
  // アクション：名前は inputs / outputs / inOuts / outcomes をまたいで 1 回だけ（AUT-1187 と同じ決まり）
  const readable = new Set<string>(), writable = new Set<string>(), outcomes = new Set<string>();
  if (a.action !== undefined) {
    const act = a.action;
    const seenA = new Set<string>();
    const one = (n: unknown, at: string) => {
      name(n, at);
      if (typeof n === "string") { if (seenA.has(n)) add(at, "APP_NAME", `アクションの名前は inputs・outputs・inOuts・outcomes をまたいで重ねられない（${n}）`); seenA.add(n); }
    };
    for (const sec of ["inputs", "outputs", "inOuts"] as const) {
      (act[sec] ?? []).forEach((f, i) => {
        const at = `action.${sec}[${i}]`;
        one(f?.name, `${at}.name`);
        if (f?.type !== undefined && !(f.type in ACTION_TYPE)) add(`${at}.type`, "APP_UNSUPPORTED", `アクションの型 ${f.type} はまだ書けない（string と boolean だけ）`);
        if (sec !== "outputs") readable.add(f?.name);
        if (sec !== "inputs") writable.add(f?.name);
      });
    }
    if (!Array.isArray(act.outcomes) || !act.outcomes.length) add("action.outcomes", "APP_SHAPE", "結果（outcomes）を 1 つ以上書く（Submit Action が選ぶ）");
    (act.outcomes ?? []).forEach((o, i) => { one(outcomeName(o), `action.outcomes[${i}]`); outcomes.add(outcomeName(o)); });
  }
  if (!Array.isArray(a.pages) || !a.pages.length) { add("pages", "APP_SHAPE", "ページが 1 つも無い"); return out; }
  const pages = new Map<string, Set<string>>();
  a.pages.forEach((p, i) => {
    name(p.name, `pages[${i}].name`);
    if (pages.has(p.name)) add(`pages[${i}].name`, "APP_NAME", `ページの名前が重なっている（${p.name}）`);
    if (vars.has(p.name)) add(`pages[${i}].name`, "APP_NAME", `ページと変数の名前が重なっている（${p.name}）`);
    pages.set(p.name, new Set(allControls(p.controls).map((c) => c.name)));
  });
  const value = (v: Value, at: string) => {
    if (v && typeof v === "object") {
      if ("var" in v) { if (!vars.has(v.var)) add(at, "APP_REF", `変数 ${v.var} が無い`); }
      else if ("action" in v) { if (!a.action) add(at, "APP_REF", "{ action } はアクションを持つアプリだけ（action を書く）"); else if (!readable.has(v.action)) add(at, "APP_REF", `アクションの inputs・inOuts に ${v.action} が無い`); }
      else if (!("vb" in v) || typeof v.vb !== "string" || !v.vb.trim()) add(at, "APP_SHAPE", "値は文字・真偽・数、{ var }、{ vb }、{ action } のどれか");
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
  // 手順（ボタンの onClick と、ページの onLoad）。page は手順が動くページ
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
  const checkSteps = (list: Json, base: string, page: string) => {
    if (!Array.isArray(list)) { add(base, "APP_SHAPE", "手順は配列"); return; }
    list.forEach((s: Json, si: number) => {
      const sat = `${base}[${si}]`;
      const kinds = STEP_KEYS.filter((k) => s && typeof s === "object" && k in s);
      if (kinds.length !== 1) { add(sat, "APP_SHAPE", `手順は ${STEP_KEYS.map((k) => `{ ${k} }`).join(" / ")} のどれか 1 つ`); return; }
      if ("submit" in s) {
        if (!a.action) add(`${sat}.submit`, "APP_REF", "submit はアクションを持つアプリだけ（action を書く）");
        else if (!outcomes.has(s.submit)) add(`${sat}.submit`, "APP_REF", `結果 ${s.submit} が action.outcomes に無い`);
        for (const [k, x] of Object.entries(s.values ?? {})) {
          if (a.action && !writable.has(k)) add(`${sat}.values.${k}`, "APP_REF", `アクションの outputs・inOuts に ${k} が無い`);
          vb(x, `${sat}.values.${k}`);
        }
      } else if ("set" in s) {
        const v = vars.get(s.set);
        if (!v) add(`${sat}.set`, "APP_REF", `変数 ${s.set} が無い`);
        vb(s.value, `${sat}.value`);
      } else if ("open" in s) {
        if (!pages.has(s.open)) add(`${sat}.open`, "APP_REF", `ページ ${s.open} が無い`);
        else if (s.open === page) add(`${sat}.open`, "APP_REF", "いまのページは開けない");
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
        checkSteps(s.then, `${sat}.then`, page);
        if (s.else !== undefined) checkSteps(s.else, `${sat}.else`, page);
      }
    });
  };
  a.pages.forEach((p, pi) => {
    if (p.onLoad !== undefined) checkSteps(p.onLoad, `pages[${pi}].onLoad`, p.name);
    const seen = new Set<string>();
    const each = (list: Control[], base: string) => (list ?? []).forEach((c, ci) => {
      const at = `${base}[${ci}]`;
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
      if (c.options !== undefined) {
        if (!WITH_OPTIONS.has(c.type)) add(`${at}.options`, "APP_PROP", `options は ${[...WITH_OPTIONS].join(" / ")} だけ`);
        else if (!Array.isArray(c.options) || !c.options.length || c.options.some((o) => typeof o !== "string")) add(`${at}.options`, "APP_SHAPE", "options は文字の配列（1 つ以上）");
      }
      for (const [k, v] of Object.entries(c)) {
        if (["type", "name", "props", "onClick", "source", "columns", "options", "hideCharacters", "controls"].includes(k)) continue;
        if (!(k in FRIENDLY)) { add(`${at}.${k}`, "APP_PROP", `項目 ${k} は無い（${Object.keys(FRIENDLY).join(", ")}、options、props、onClick）`); continue; }
        if (!friendly(k, has)) { add(`${at}.${k}`, "APP_PROP", `${c.type} に ${k} は無い`); continue; }
        value(v as Value, `${at}.${k}`);
      }
      for (const [k, v] of Object.entries(c.props ?? {})) {
        if (!has.has(k)) add(`${at}.props.${k}`, "APP_PROP", `${c.type}（${comp}）に式の項目 ${k} は無い`);
        else value(v, `${at}.props.${k}`);
      }
      if (c.onClick) {
        if (c.type !== "button") add(`${at}.onClick`, "APP_PROP", "onClick は button だけ");
        checkSteps(c.onClick, `${at}.onClick`, p.name);
      }
      if (c.hideCharacters !== undefined) {
        if (c.type !== "textbox") add(`${at}.hideCharacters`, "APP_PROP", "hideCharacters は textbox だけ");
        else if (typeof c.hideCharacters !== "boolean") add(`${at}.hideCharacters`, "APP_SHAPE", "hideCharacters は true / false");
      }
      if (c.controls !== undefined) {
        if (c.type !== "container") add(`${at}.controls`, "APP_PROP", "controls は container だけ");
        else if (!Array.isArray(c.controls)) add(`${at}.controls`, "APP_SHAPE", "controls は部品の配列");
        else each(c.controls, `${at}.controls`);
      }
    });
    each(p.controls, `pages[${pi}].controls`);
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
  // スライダーの既定値：isLiteral: true（雛形の形）のままだと、画面の位置は変わるが .Value は動かすまで雛形の 50 のまま。
  // Studio Web の式の編集で書くと isLiteral: false になり、.Value も既定値になった（2026-11-17、trial の Debug で確かめた）
  if (prop === "sliderValue") e.isLiteral = false;
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

// アクションの id（generateFiles が作り、式と Submit Action が使う）
type ActCtx = { instanceKey: string; guid: Map<string, string>; xaml: Map<string, string> };
let ACT: ActCtx | undefined;

function writeExpr(e: Json, eid: string, v: Value, appFields: Map<string, Json>, refs: Json) {
  e.tokens = [];
  if (v && typeof v === "object" && "action" in v) {
    // Studio Web の書き出しと同じ：ActionProperties（アクションの instance の key）と、そのプロパティ（guid）の 2 つのトークン
    const n = v.action;
    Object.assign(e, { expression: `ActionProperties.${n}`, isLiteral: false, addedVia: "VEB" });
    e.tokens = [
      { token: "ActionProperties", type: "action.ActionSchema", startIndex: 0, endIndex: 16, tokenId: ACT!.instanceKey, tokenType: "action", isContextualArg: false, properties: [] },
      { token: n, type: "action.ActionProperties", startIndex: 17, endIndex: 17 + n.length, tokenId: ACT!.guid.get(n), tokenType: "action-property", isContextualArg: false, properties: [] },
    ];
  } else if (v && typeof v === "object" && "var" in v) {
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
  if ("submit" in s) {
    // Studio Web の Simple Approval のボタンの XAML と同じ形。values は Properties override（outputs・inOuts に入る値）
    const ov = Object.entries(s.values ?? {}).map(([k, x]) => `    <InArgument x:TypeArguments="${ACT?.xaml.get(k) ?? "x:String"}" x:Key="${k}">[${xml(x)}]</InArgument>`);
    return `<uwana:SubmitAction Result="{x:Null}" DisplayName="Submit Action" sap2010:WorkflowViewState.IdRef="${nextId(c, "SubmitAction")}" Outcome="${xml(s.submit)}">
  <uwana:SubmitAction.OutcomeExpression>
    <x:String x:Key="expressionId">id${hex()}</x:String>
    <x:String x:Key="formId">${c.forms.get(c.page)!.formId}</x:String>
  </uwana:SubmitAction.OutcomeExpression>${ov.length ? `
  <uwana:SubmitAction.PropertyOverrides>
${ov.join("\n")}
  </uwana:SubmitAction.PropertyOverrides>` : ""}
</uwana:SubmitAction>`;
  }
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

// trigger：ManualTrigger の DisplayName。Studio Web は「<ページ>_<部品> : クリック時 Event」（日本語の画面）、
// ページの読み込みは「<ページ>_<ページ> : Loaded Event」（英語の画面、2026-11-17 の書き出し）と書いた
function eventXaml(page: string, trigger: string, steps: Step[], forms: Map<string, { formId: string }>, vars: Map<string, Variable>, ents: Map<string, Entity>): string {
  const T = templates();
  const withEntities = usesEntities(steps) || [...vars.values()].some((v) => v.type === "list");
  const c: Ctx = { page, forms, vars, ents, n: new Map([["Sequence", 1]]), locals: [] };
  const body = steps.map((s) => ind(stepXaml(c, s), 4)).join("\n");
  const locals = c.locals.length ? `    <Sequence.Variables>\n${c.locals.map((l) => `      ${l}`).join("\n")}\n    </Sequence.Variables>\n` : "";
  let head: string = withEntities ? T.eventEntities : T.event;
  // Submit Action の式はアクションの名前空間を使う（Studio Web の書き出しと同じ 2 つ）
  if (body.includes("<uwana:SubmitAction ")) head = head.replace("<x:String>UiPath.WorkflowEvents.Activities.NetCore.Activities</x:String>", "<x:String>UiPath.WorkflowEvents.Activities.NetCore.Activities</x:String>\n      <x:String>action</x:String>\n      <x:String>__Action_ActionSchema</x:String>");
  return `${head}  <Sequence sap:VirtualizedContainerService.HintSize="356,732" sap2010:WorkflowViewState.IdRef="Sequence_1">
${locals}    <sap:WorkflowViewStateService.ViewState>
      <scg:Dictionary x:TypeArguments="x:String, x:Object">
        <x:Boolean x:Key="IsExpanded">True</x:Boolean>
      </scg:Dictionary>
    </sap:WorkflowViewStateService.ViewState>
    <ui:ManualTrigger Result="{x:Null}" DisplayName="${xml(trigger)}" sap2010:WorkflowViewState.IdRef="ManualTrigger_1" />
${body}
  </Sequence>
</Activity>`;
}

// solutionId：Studio Web の既にあるソリューションの Id。渡すと uip solution upload がそこへ上書きする（AUT-1200）
export function generateFiles(a: RpaApp, store?: Store, opts: { solutionId?: string } = {}): Record<string, string> {
  const T = templates();
  const ents = entitiesOf(store);
  const solution = a.solution ?? a.app;
  const solutionId = opts.solutionId ?? randomUUID(), projectId = randomUUID(), projectKey = randomUUID();
  const appSystemName = `ID${hex()}`;
  const vars = new Map((a.variables ?? []).map((v) => [v.name, v]));
  const actionKey = randomUUID();
  const fieldsOf = (sec: "inputs" | "outputs" | "inOuts") => a.action?.[sec] ?? [];
  ACT = a.action ? {
    instanceKey: `id${hex()}`,
    guid: new Map(["inputs", "outputs", "inOuts"].flatMap((sec) => fieldsOf(sec as "inputs").map((f) => [f.name, `id${hex()}`] as [string, string]))),
    xaml: new Map(["outputs", "inOuts"].flatMap((sec) => fieldsOf(sec as "inputs").map((f) => [f.name, ACTION_TYPE[f.type ?? "string"].xaml] as [string, string]))),
  } : undefined;

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
    const place = (c: Control, parentId: string) => {
      const t = T.controls[COMPONENT[c.type]];
      const map = new Map<string, string>();
      const ctl = cloneWithNewIds(t.control, ids, map);
      const group = cloneWithNewIds(t.expressions, ids, map);
      Object.assign(ctl, { name: c.name, _logicalParent: parentId });
      // Hide characters：式ではなく真偽の項目（Studio Web の書き出し：properties.hideCharacters.value）
      if (c.hideCharacters !== undefined) ctl.properties.hideCharacters.value = c.hideCharacters;
      const has = vbProps(COMPONENT[c.type]);
      for (const [k, v] of Object.entries(c)) if (k in FRIENDLY) setExpr(ctl, group, friendly(k, has)!, v as Value, appFields, refs);
      for (const [k, v] of Object.entries(c.props ?? {})) setExpr(ctl, group, k, v, appFields, refs);
      if (c.type === "table") tableSetup(ctl, group, c, appFields, refs, ids);
      if (c.options?.length) {
        // 選択肢：Studio Web で List source に {"A", "B", "C"}.ToListSource() と書いて書き出した形（2026-11-17）
        const sb = ctl.config.sourceBinding;
        sb.genericType = "System.String";
        Object.assign(group.expressions[sb.expressionId], { expression: `{${c.options.map(vbString).join(", ")}}.ToListSource()`, isLiteral: false });
      }
      if (c.onClick?.length) {
        const file = `${pg.name}_${c.name}_click.xaml`;
        const automationId = randomUUID();
        ctl.events.click.executors = [{ id: ids.next(), executorMethod: "start-automation", config: { automationId, workflowPath: file } }];
        ctl.events.click.actionType = "automation";
        page.workflowBindings[automationId] = { id: ids.next(), controlId: ctl.id, workflowPath: null, activities: {} };
        files[P(file)] = eventXaml(pg.name, `${pg.name}_${c.name} : クリック時 Event`, c.onClick, forms, vars, ents);
        appMetadata[file] = { AppFormId: formId, IsAppQueryBuilder: null };
      }
      page.controls[ctl.id] = ctl;
      page.controls[parentId].config.childIds.push(ctl.id);
      page.expressions[ctl.id] = group;
      // 入れ物（container）：子の _logicalParent を入れ物にし、入れ物の childIds に並べる（Studio Web の書き出しと同じ）
      if (c.type === "container") for (const x of c.controls ?? []) place(x, ctl.id);
    };
    for (const c of pg.controls ?? []) place(c, rootId);
    // ページの読み込み：根のパネルの events.load から呼ぶ。ファイル名は <ページ>_<ページ>_load.xaml（Studio Web の Define workflow file と同じ）
    if (pg.onLoad?.length) {
      const file = `${pg.name}_${pg.name}_load.xaml`;
      const automationId = randomUUID();
      const load = page.controls[rootId].events.load;
      load.executors = [{ id: ids.next(), executorMethod: "start-automation", config: { automationId, workflowPath: file } }];
      load.actionType = "automation";
      page.workflowBindings[automationId] = { id: ids.next(), controlId: rootId, workflowPath: null, activities: {} };
      files[P(file)] = eventXaml(pg.name, `${pg.name}_${pg.name} : Loaded Event`, pg.onLoad, forms, vars, ents);
      appMetadata[file] = { AppFormId: formId, IsAppQueryBuilder: null };
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
  if (a.action && ACT) {
    // アクション：App 本体に appUsageType 1 と定義の key、schemas/ に定義、models/ に type "action" の model（Simple Approval の書き出しの形）
    Object.assign(app, { appUsageType: 1, actionDefinitionId: actionKey, actionDefinitionVersion: 0 });
    const act = a.action;
    const schemaId = `ID${hex()}`, actionSys = `ID${hex()}`;
    const keys = new Map<string, string>();
    const keyOf = (n: string) => { if (!keys.has(n)) keys.set(n, randomUUID()); return keys.get(n)!; };
    const net = (f: ActionField) => ACTION_TYPE[f.type ?? "string"].net;
    const schemaField = (f: ActionField) => ({ name: f.name, ...(f.description ? { description: f.description } : {}), required: !!f.required, customType: null, properties: [], type: net(f), typeNamespace: "system", isList: false, collectionDataType: null, key: keyOf(f.name) });
    const outs = act.outcomes.map((o) => (typeof o === "string" ? { name: o } : o));
    const outcomeSchema = (o: { name: string; description?: string }) => ({ name: o.name, ...(o.description ? { description: o.description } : {}), required: false, customType: null, properties: [], type: "System.String", typeNamespace: "system", isList: false, collectionDataType: null, key: keyOf(o.name) });
    files[P(`.app/schemas/schema-${actionKey}.json`)] = JSON.stringify({
      key: actionKey, version: 0, __isDeleted: false, dateLastModified: new Date().toISOString(), description: act.description ?? "", id: schemaId,
      inOuts: fieldsOf("inOuts").map(schemaField), inputs: fieldsOf("inputs").map(schemaField), name: "ActionSchema",
      outcomes: outs.map(outcomeSchema), outputs: fieldsOf("outputs").map(schemaField), actionSchemaGenerationSource: "manual",
    });
    const modelField = (f: ActionField) => ({ id: `id${hex()}`, uniqueIdentifier: f.name, guid: ACT!.guid.get(f.name), key: keyOf(f.name), name: f.name, type: net(f), customType: null, typeNamespace: "system", isList: false, fields: [], collectionDataType: null, required: !!f.required, ...(f.description ? { description: f.description } : {}) });
    files[P(`.app/models/models-${actionSys}.json`)] = JSON.stringify({
      id: actionSys, order: a.pages.length, dateCreated: new Date().toISOString(), dateLastOpened: new Date().toISOString(), type: "action", iconUrl: "assets/svg/action/action.svg", idCounter: 3000,
      ownerFqn: "", ownerId: "", createdByFqn: "", createdById: "", systemName: actionSys, categorySystemName: "j-category-integration-organization", appSystemName,
      buildVersion: app.buildVersion, modelVersion: 1, currentModelVersion: 2, dllVersion: 1, modelTypesVersion: 0, ownerDisplayName: "", rootReferences: {}, title: "DefaultTenant", description: "",
      allModelErrors: {}, valueBindingMetadata: {}, url: null, properties: [],
      instances: [{
        id: schemaId, uniqueIdentifier: "ActionSchema", name: "ActionSchema", description: "Action Schema", key: ACT.instanceKey, schemaId, schemaType: "apps-schema", dirtySaveMetadata: null,
        actionSchemaKey: actionKey, version: 0, inputs: fieldsOf("inputs").map(modelField), outputs: fieldsOf("outputs").map(modelField), inOuts: fieldsOf("inOuts").map(modelField),
        outcomes: outs.map((o) => ({ id: `id${hex()}`, uniqueIdentifier: o.name, guid: `id${hex()}`, key: keyOf(o.name), name: o.name, type: "string", customType: "", typeNamespace: "system", isList: false, fields: [], collectionDataType: null, required: true, ...(o.description ? { description: o.description } : {}) })),
      }],
    });
  }
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
  // アクションを持つアプリは type が "workflow Action"、置き場も app/workflow Action/（Simple Approval の書き出し）
  const appType = a.action ? "workflow Action" : "Regular";
  files[`resources/solution_folder/app/${a.action ? "workflow Action/" : ""}${a.app}.json`] = res("app", "apps.uipath.com/v1", [{ name: a.app, kind: "appVersion" }, { name: a.app, kind: "process" }], { name: a.app, description: null, type: appType, version: null, appSystemName: null, appVersionRef: { key: key.appVersion }, codeBehindProcess: { key: key.process }, actionSchema: null, manualActivationActions: null }, true, a.action ? { type: appType } : {});
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
export function notices(a: RpaApp, store?: Store): string[] {
  const opens = (list: Step[]): string[] => list.flatMap((s: Json) => ("open" in s ? [s.open] : "if" in s ? [...opens(s.then ?? []), ...opens(s.else ?? [])] : []));
  const targets = new Set(a.pages.flatMap((p) => [...opens(p.onLoad ?? []), ...allControls(p.controls).flatMap((c) => opens(c.onClick ?? []))]));
  const out = [...targets].map((t) => `APP_OPEN_PAGE  ページ ${t} を開く手順がある。取り込んだあと、Studio Web で ${t} の部品の式を 1 回直して保存するまで「Selected page is not accessible」になる`);
  // 表（Table）は日付の書式を持たない。DateTime の列は 2026-11-23T00:00:00.0000000Z のまま出る（文書の Edit Grid の注意。
  // 2026-11-17 に Studio Web で、列の Source は行の型のメンバーの名前だけで、匿名型に写した一覧は「not declared」になると確かめた）
  const ents = entitiesOf(store);
  const vars = new Map((a.variables ?? []).map((v) => [v.name, v]));
  for (const p of a.pages) for (const c of allControls(p.controls)) {
    if (c.type !== "table" || !c.source || typeof c.source !== "object" || !("var" in c.source)) continue;
    const v = vars.get(c.source.var);
    const e = v?.type === "list" ? ents.get(v.of) : undefined;
    for (const col of c.columns ?? []) {
      const f = e?.fields.get(col.value);
      if (f && (f.xaml === "s:DateTime" || f.xaml === "s:DateTimeOffset")) out.push(`APP_TABLE_DATE  ${p.name}.${c.name} の列 ${col.value} は日時のまま（2026-11-23T00:00:00.0000000Z の形）で出る。表の部品には書式が無い（knowledge/apps.md）`);
    }
  }
  return out;
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
  const out = val("--out"), uis = val("--uis"), solutionId = val("--solution-id"), checkOnly = args.includes("--check");
  const files = args.filter((a, i) => !a.startsWith("--") && !["--out", "--uis", "--solution-id"].includes(args[i - 1]));
  if (files.length !== 1 || (!out && !uis && !checkOnly)) { console.error("使い方: node tools/apps/rpa-app.ts <app.json> (--out <dir> | --uis <file.uis> | --check) [--solution-id <Studio Web のソリューションの Id>]"); process.exit(2); }
  if (solutionId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(solutionId)) { console.error(`--solution-id は GUID（${solutionId}）`); process.exit(2); }
  const app: RpaApp = JSON.parse(readFileSync(files[0], "utf8"));
  const store = loadStore(app, files[0]);
  const issues = check(app, store);
  if (issues.length) {
    console.log(`NG ${files[0]}`);
    for (const i of issues) console.log(`  ${i.code.padEnd(16)} ${i.path}: ${i.message}`);
    process.exit(1);
  }
  for (const n of notices(app, store)) console.log(`  注意 ${n}`);
  if (checkOnly) { console.log(`OK ${files[0]}`); return; }
  const gen = generateFiles(app, store, { solutionId });
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
