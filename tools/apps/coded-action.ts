// Coded Action App（Action Center のタスクの画面。React + TypeScript）を IR から作る。
//
//   node tools/apps/coded-action.ts <app.json> --out <dir> [--check]
//     --out <dir>  プロジェクトのフォルダに書く（package.json、action-schema.json、src/...）
//     --check      検証だけ
//   終了コード: 0 = 書けた / 1 = 検証で弾かれた / 2 = 使い方の誤り
//
// パーツ（knowledge/apps.md）:
//   - データの約束：action-schema.json（inputs / outputs / inOuts / outcomes）。uip codedapp の検証器と同じ規則で調べる
//   - 画面：フィールドの型ごとの部品（文字・数・日付・真偽・選択・一覧・まとまり・ファイル）。inputs は読むだけ、outputs / inOuts は書ける
//     書ける array は行を足す・消す一覧、object は中のフィールド、file は添付を上げる（Attachments.create → { ID }）
//   - SDK（@uipath/uipath-typescript）：file の show で添付を開く・画像で見せる、records で Data Fabric のレコードを表で見せる。
//     使うときだけ uipath.ts に SDK を入れ、uipath.json（scope と clientId）を書く。sdk.initialize() は呼ばない
//   - 結果のボタン：outcomes。押すと completeTask(<名前>, formData)
//   - 決まった骨組み：App.tsx（テーマ）、main.tsx、uipath.ts、vite.config.ts（base: './'）、CSS（UiPath のスキルのテンプレートのまま）
//
// 書いたあとは、そのフォルダで npm install → npm run build。uip codedapp pack / publish -t Action / deploy で Action Center に出す。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { ATTACHMENT_TSX, RECORD_LIST_CSS, RECORD_LIST_TSX, checkRecords, recordListJsx, type RecordList } from "./coded-parts.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATES = join(root, "templates", "coded-action-app");

// ---- IR ----

export type FieldType = "string" | "number" | "integer" | "boolean" | "array" | "object" | "file";
export type Dir = "in" | "out" | "inout";
export type SchemaProp = {
  type: FieldType; required?: boolean; description?: string; format?: "uuid" | "date"; items?: SchemaProp; properties?: Record<string, SchemaProp>;
  label?: string; // object の中のフィールドの見出し（画面だけ。action-schema.json には入らない）
};
export type Field = SchemaProp & {
  name: string; // camelCase。FormData のキー
  dir: Dir; // in = inputs（読むだけ）、out = outputs（書く）、inout = inOuts（入っていて直せる）
  label?: string; // 画面の見出し。無ければ name
  section?: string; // 画面のまとまり。無ければ dir ごと（「内容」「記入」）
  hidden?: boolean; // 画面に出さない（スキーマと FormData には入る）
  control?: "text" | "textarea" | "select" | "radio"; // string の部品。無ければ text（format: date は日付）
  options?: string[]; // select / radio の選択肢
  placeholder?: string;
  min?: number; max?: number; // number / integer
  currency?: string; // number の表示（読むだけのとき。例 "JPY"）
  show?: "download" | "image"; // file だけ。SDK（Attachments.getById）で添付を取り出す。download はボタン、image は画像で見せる
};
export type Outcome = { name: string; label?: string; primary?: boolean; validate?: boolean }; // validate: false は必須の入力が空でも押せる（却下など）
export type ActionApp = {
  app: string; kind?: "action"; title: string; subtitle?: string; fields: Field[]; outcomes: Outcome[];
  records?: RecordList[]; // Data Fabric のレコードの表（フォームの下に出す）
  clientId?: string; // SDK を使うときの External Application の client ID（uipath.json に書く）
};
export type { Issue, RecordList } from "./coded-parts.ts";
import type { Issue } from "./coded-parts.ts";

const TYPES: FieldType[] = ["string", "integer", "number", "boolean", "array", "object", "file"];
const SECTION_OF: Record<Dir, string> = { in: "inputs", out: "outputs", inout: "inOuts" };
const DEFAULT_SECTION: Record<Dir, string> = { in: "内容", inout: "確認して直す", out: "記入" };
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PRIMS: FieldType[] = ["string", "number", "integer", "boolean"];
const TS_RESERVED = new Set(["break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for", "function", "if", "import", "in", "instanceof", "new", "null", "return", "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with"]);

// uip codedapp（JsonActionSchemaValidator）と同じ規則。スキルの validate-action-schema.js を写したもの
function checkProp(p: SchemaProp, at: string, add: (path: string, code: string, m: string) => void) {
  if (!TYPES.includes(p.type)) { add(`${at}.type`, "APP_TYPE", `type は ${TYPES.join(" / ")}（"${p.type}"）`); return; }
  if (p.required !== undefined && typeof p.required !== "boolean") add(`${at}.required`, "APP_SHAPE", "required は true / false");
  if (p.description !== undefined && typeof p.description !== "string") add(`${at}.description`, "APP_SHAPE", "description は文字列");
  if (p.format !== undefined && !(p.type === "string" && (p.format === "uuid" || p.format === "date"))) add(`${at}.format`, "APP_FORMAT", "format は string にだけ、uuid か date");
  if (p.type === "array") {
    if (!p.items) add(`${at}.items`, "APP_SHAPE", "array には items（要素の型）が要る");
    else if (p.items.type === "array") add(`${at}.items.type`, "APP_SHAPE", "array の入れ子はできない");
    else checkProp(p.items, `${at}.items`, add);
  }
  if (p.type === "object" && !p.properties) add(`${at}.properties`, "APP_SHAPE", "object には properties が要る");
  for (const [k, c] of Object.entries(p.properties ?? {})) checkProp(c, `${at}.properties.${k}`, add);
}

export function check(app: ActionApp): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(app.app ?? "")) add("app", "APP_NAME", "app は小文字の kebab-case（例 loan-review）。フォルダ名と URL になる");
  if (!app.title) add("title", "APP_SHAPE", "title（画面の見出し）が要る");
  if (app.kind !== undefined && app.kind !== "action") add("kind", "APP_KIND", "kind は action だけ（Web App は tools/apps/coded-web.ts）");
  const names = new Set<string>();
  (app.fields ?? []).forEach((f, i) => {
    const at = `fields[${i}]`;
    if (!IDENT.test(f.name ?? "") || TS_RESERVED.has(f.name)) add(`${at}.name`, "APP_NAME", `name "${f.name}" は英数字の識別子（TypeScript の予約語は不可）`);
    if (names.has(f.name)) add(`${at}.name`, "APP_NAME", `"${f.name}" が重なっている（inputs / outputs / inOuts / outcomes をまたいで 1 つ）`);
    names.add(f.name);
    if (!["in", "out", "inout"].includes(f.dir)) add(`${at}.dir`, "APP_DIR", "dir は in / out / inout");
    checkProp(f, at, add);
    const editable = f.dir !== "in";
    if (f.control && (f.type !== "string" || !["text", "textarea", "select", "radio"].includes(f.control))) add(`${at}.control`, "APP_CONTROL", "control は string にだけ、text / textarea / select / radio");
    if ((f.control === "select" || f.control === "radio") && !(f.options ?? []).length) add(`${at}.options`, "APP_CONTROL", `${f.control} には options（選択肢）が要る`);
    if (f.options && f.control !== "select" && f.control !== "radio") add(`${at}.options`, "APP_CONTROL", "options は control が select / radio のときだけ");
    if ((f.min !== undefined || f.max !== undefined) && f.type !== "number" && f.type !== "integer") add(`${at}.min`, "APP_CONTROL", "min / max は number / integer にだけ");
    if (f.currency && f.type !== "number") add(`${at}.currency`, "APP_CONTROL", "currency は number にだけ");
    if (f.show !== undefined && (f.type !== "file" || !["download", "image"].includes(f.show))) add(`${at}.show`, "APP_CONTROL", "show は file にだけ、download / image");
    // 書ける部品があるのは、要素が文字・数・真偽の array と、中が文字・数・真偽の object
    if (editable && !f.hidden && f.type === "array" && f.items && !PRIMS.includes(f.items.type)) add(`${at}.items.type`, "APP_UNSUPPORTED", `要素が ${f.items.type} の array を書ける部品はまだ無い（string / number / integer / boolean だけ。dir: in にするか hidden にする）`);
    if (editable && !f.hidden && f.type === "object") for (const [k, c] of Object.entries(f.properties ?? {})) {
      if (!PRIMS.includes(c.type)) add(`${at}.properties.${k}.type`, "APP_UNSUPPORTED", `object の中の ${c.type} を書ける部品はまだ無い（string / number / integer / boolean だけ）`);
      if (!IDENT.test(k) || TS_RESERVED.has(k)) add(`${at}.properties.${k}`, "APP_NAME", `書ける object の中の名前 "${k}" は英数字の識別子`);
    }
  });
  checkRecords(app.records, "records", add);
  if (app.clientId !== undefined && typeof app.clientId !== "string") add("clientId", "APP_SHAPE", "clientId は文字列");
  const outs = new Set<string>();
  if (!(app.outcomes ?? []).length) add("outcomes", "APP_SHAPE", "outcomes（結果のボタン）が 1 つは要る");
  (app.outcomes ?? []).forEach((o, i) => {
    if (!o.name || /["'`\\]/.test(o.name)) add(`outcomes[${i}].name`, "APP_NAME", "outcome の name が要る（引用符は不可）");
    if (outs.has(o.name)) add(`outcomes[${i}].name`, "APP_NAME", `outcome "${o.name}" が重なっている`);
    // 根の名前は outcomes も含めて 1 回だけ。フィールドと同じ名前は、初めての publish・install で「The action schema uses the same property name more than once」になる
    else if (names.has(o.name)) add(`outcomes[${i}].name`, "APP_NAME", `outcome "${o.name}" がフィールドの名前と重なっている（inputs / outputs / inOuts / outcomes をまたいで 1 つ）`);
    outs.add(o.name);
  });
  return issues;
}

// ---- 作る ----

const schemaProp = (p: SchemaProp): SchemaProp => ({
  type: p.type,
  ...(p.required !== undefined ? { required: p.required } : {}),
  ...(p.description ? { description: p.description } : {}),
  ...(p.format ? { format: p.format } : {}),
  ...(p.items ? { items: schemaProp(p.items) } : {}),
  ...(p.properties ? { properties: Object.fromEntries(Object.entries(p.properties).map(([k, v]) => [k, schemaProp(v)])) } : {}),
});

export function actionSchema(app: ActionApp) {
  const sec = (d: Dir) => ({ type: "object", properties: Object.fromEntries(app.fields.filter((f) => f.dir === d).map((f) => [f.name, schemaProp(f)])) });
  return { inputs: sec("in"), outputs: sec("out"), inOuts: sec("inout"), outcomes: { type: "object", properties: Object.fromEntries(app.outcomes.map((o) => [o.name, { type: "string" }])) } };
}

const tsType = (p: SchemaProp): string => {
  switch (p.type) {
    case "string": return "string";
    case "number": case "integer": return "number";
    case "boolean": return "boolean";
    case "file": return "{ ID: string }";
    case "array": return `${p.items ? wrap(tsType(p.items)) : "unknown"}[]`;
    case "object": return p.properties ? `{ ${Object.entries(p.properties).map(([k, v]) => `${k}${v.required ? "" : "?"}: ${tsType(v)}`).join("; ")} }` : "Record<string, unknown>";
  }
};
const wrap = (t: string) => (/[{|]/.test(t) && !t.startsWith("{") ? `(${t})` : t);
const initial = (p: SchemaProp): string => {
  if (p.type === "object") {
    const req = Object.entries(p.properties ?? {}).filter(([, v]) => v.required);
    return req.length ? `{ ${req.map(([k, v]) => `${k}: ${initial(v)}`).join(", ")} }` : "{}";
  }
  return ({ string: "''", number: "0", integer: "0", boolean: "false", array: "[]", file: "{ ID: '' }" })[p.type];
};
const js = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
const jsx = (s: string) => s.replace(/[{}<>&]/g, (c) => `{'${c}'}`);
const pascal = (s: string) => s.replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/^[^A-Za-z]+/, "") || "Outcome";

// 必須の判定（書けるフィールドだけ）
function requiredCheck(f: Field): string {
  const v = `formData.${f.name}`;
  if (f.type === "string") return `${v}.trim() !== ''`;
  if (f.type === "number" || f.type === "integer") return `Number.isFinite(${v})`;
  if (f.type === "array") return `${v}.length > 0`;
  if (f.type === "file") return `!!${v}?.ID`;
  return "true"; // boolean は false も値。object は中の部品に任せる
}

// 書ける array / object の中の 1 つの値の部品。onChange の式の中では e（イベント）が使える
const fromEvent = (p: SchemaProp) => (p.type === "boolean" ? "e.target.checked" : p.type === "number" ? "Number(e.target.value) || 0" : p.type === "integer" ? "Math.trunc(Number(e.target.value)) || 0" : "e.target.value");
function primInput(p: SchemaProp, value: string, onChange: string, extra: string): string {
  if (p.type === "boolean") return `<input type="checkbox" className="form-check"${extra} checked={${value}} onChange={(e) => ${onChange}} disabled={isReadOnly} />`;
  const type = p.type === "number" || p.type === "integer" ? ` type="number" step=${p.type === "integer" ? "{1}" : '"any"'}` : p.format === "date" ? ` type="date"` : "";
  return `<input${type}${extra} value={${value}} onChange={(e) => ${onChange}} readOnly={isReadOnly} />`;
}

// 1 つのフィールドの部品
function control(f: Field, ind: string): string {
  const id = f.name;
  const label = jsx(f.label ?? f.name);
  const req = f.required && f.dir !== "in" ? ` <span className="req" aria-hidden="true">*</span>` : "";
  const lab = `${ind}  <label htmlFor="${id}">${label}${req}</label>`;
  const ro = f.dir === "in";
  const desc = f.description ? `\n${ind}  <small className="field-hint">${jsx(f.description)}</small>` : "";
  const wrapGroup = (inner: string, extra = "") => `${ind}<div className="form-group${extra}">\n${lab}\n${inner}${desc}\n${ind}</div>`;
  const v = `formData.${id}`;
  const roAttr = ro ? "readOnly" : "readOnly={isReadOnly}";
  switch (f.type) {
    case "string": {
      if (f.control === "textarea") return wrapGroup(`${ind}  <textarea id="${id}" name="${id}" rows={4}${f.placeholder ? ` placeholder=${JSON.stringify(f.placeholder)}` : ""} value={${v}} onChange={handleTextChange} ${roAttr} />`, " form-group--spaced");
      if (f.control === "select" && !ro) return wrapGroup(`${ind}  <select id="${id}" name="${id}" value={${v}} onChange={handleTextChange} disabled={isReadOnly}>\n${ind}    <option value="">（選ぶ）</option>\n${(f.options ?? []).map((o) => `${ind}    <option value=${JSON.stringify(o)}>${jsx(o)}</option>`).join("\n")}\n${ind}  </select>`);
      if (f.control === "radio" && !ro) return wrapGroup(`${ind}  <div className="radio-group" role="radiogroup" aria-labelledby="${id}">\n${(f.options ?? []).map((o) => `${ind}    <label className="radio-option"><input type="radio" name="${id}" value=${JSON.stringify(o)} checked={${v} === ${JSON.stringify(o)}} onChange={handleTextChange} disabled={isReadOnly} />${jsx(o)}</label>`).join("\n")}\n${ind}  </div>`);
      const type = f.format === "date" ? ` type="date"` : "";
      return wrapGroup(`${ind}  <input id="${id}" name="${id}"${type}${f.placeholder ? ` placeholder=${JSON.stringify(f.placeholder)}` : ""} value={${v}} ${ro ? "readOnly" : `onChange={handleTextChange} readOnly={isReadOnly}`} />`);
    }
    case "number": case "integer": {
      if (ro) return wrapGroup(`${ind}  <input id="${id}" readOnly value={${f.currency ? `formatCurrency(${v}, ${js(f.currency)})` : `String(${v})`}} />`);
      const attrs = [f.min !== undefined ? `min={${f.min}}` : "", f.max !== undefined ? `max={${f.max}}` : "", `step=${f.type === "integer" ? `{1}` : `"any"`}`].filter(Boolean).join(" ");
      return wrapGroup(`${ind}  <input id="${id}" name="${id}" type="number" ${attrs} value={${v}} onChange={${f.type === "integer" ? "handleIntegerChange" : "handleNumberChange"}} readOnly={isReadOnly} />`);
    }
    case "boolean":
      return wrapGroup(`${ind}  <input id="${id}" name="${id}" type="checkbox" className="form-check" checked={${v}} onChange={handleCheckChange} disabled={${ro ? "true" : "isReadOnly"}} />`, " form-group--check");
    case "array": {
      // 書けるもの：要素ごとの部品と、行を消す・足すボタン
      if (!ro && f.items) {
        const it = f.items;
        const set = (expr: string) => `setField(${js(id)}, ${expr})`;
        const row = primInput(it, "x", set(`${v}.map((y, j) => (j === i ? ${fromEvent(it)} : y))`), ` aria-label={${js(f.label ?? f.name)} + ' ' + (i + 1)}`);
        return wrapGroup([
          `${ind}  <div id="${id}" className="list-editor">`,
          `${ind}    {${v}.map((x, i) => (`,
          `${ind}      <div className="list-editor__row" key={i}>`,
          `${ind}        ${row}`,
          `${ind}        <button type="button" className="list-editor__remove" onClick={() => ${set(`${v}.filter((_, j) => j !== i)`)}} disabled={isReadOnly} aria-label="この行を消す">×</button>`,
          `${ind}      </div>`,
          `${ind}    ))}`,
          `${ind}    <button type="button" className="list-editor__add" onClick={() => ${set(`[...${v}, ${initial(it)}]`)}} disabled={isReadOnly}>＋ 行を足す</button>`,
          `${ind}  </div>`,
        ].join("\n"));
      }
      return wrapGroup(`${ind}  <ul id="${id}" className="value-list">\n${ind}    {${v}.map((x, i) => <li key={i}>{typeof x === 'object' ? JSON.stringify(x) : String(x)}</li>)}\n${ind}  </ul>`);
    }
    case "object": {
      // 書けるもの：中のフィールドごとの部品。値はまるごと置き換える
      if (!ro) {
        const set = (expr: string) => `setField(${js(id)}, ${expr})`;
        const items = Object.entries(f.properties ?? {}).map(([k, p]) => {
          const value = `${v}.${k} ?? ${initial(p)}`;
          const star = p.required ? ` <span className="req" aria-hidden="true">*</span>` : "";
          return `${ind}    <label className="object-editor__item"><span>${jsx(p.label ?? k)}${star}</span>${primInput(p, value, set(`{ ...${v}, ${k}: ${fromEvent(p)} }`), "")}</label>`;
        });
        return wrapGroup([`${ind}  <div id="${id}" className="object-editor">`, ...items, `${ind}  </div>`].join("\n"));
      }
      return wrapGroup(`${ind}  <pre id="${id}" className="value-json">{JSON.stringify(${v}, null, 2)}</pre>`);
    }
    case "file": {
      // show があれば SDK で添付を取り出す（Attachment.tsx）。無ければ Id だけ
      const view = f.show ? `<Attachment id={${v}?.ID ?? ''} mode="${f.show}" />` : "";
      if (ro) return wrapGroup(view ? `${ind}  <div id="${id}">${view}</div>` : `${ind}  <input id="${id}" readOnly value={${v}?.ID ?? ''} />`);
      // 書けるもの：選んだファイルを上げ、Attachments.create の id を { ID } にして値にする
      return wrapGroup([
        `${ind}  <div className="file-field">`,
        `${ind}    {${v}?.ID ? ${view || `<span className="file-field__current">添付あり（{${v}.ID}）</span>`} : null}`,
        `${ind}    <input id="${id}" type="file" onChange={(e) => uploadFile(${js(id)}, e)} disabled={isReadOnly || uploading !== null} />`,
        `${ind}    {uploading === ${js(id)} && <small className="field-hint">送っています…</small>}`,
        `${ind}  </div>`,
      ].join("\n"));
    }
  }
}

export function formTsx(app: ActionApp): string {
  const visible = app.fields.filter((f) => !f.hidden);
  const sections: { title: string; fields: Field[] }[] = [];
  for (const f of visible) {
    const t = f.section ?? DEFAULT_SECTION[f.dir];
    let s = sections.find((x) => x.title === t);
    if (!s) sections.push((s = { title: t, fields: [] }));
    s.fields.push(f);
  }
  const used = new Set(visible.filter((f) => f.dir !== "in").map((f) => (f.type === "string" ? "text" : f.type === "boolean" ? "check" : f.type === "integer" ? "integer" : f.type === "number" ? "number" : f.type)));
  const anyText = used.has("text");
  const uploads = visible.filter((f) => f.dir !== "in" && f.type === "file");
  const usesSetField = used.has("array") || used.has("object") || used.has("file");
  const usesView = visible.some((f) => f.type === "file" && f.show);
  const records = app.records ?? [];
  const needsChangeEvent = ["text", "number", "integer", "check", "file"].some((k) => used.has(k));
  const reqs = app.fields.filter((f) => f.dir !== "in" && f.required && !f.hidden && ["string", "number", "integer", "array", "file"].includes(f.type)).map(requiredCheck);
  // 書ける object の中の必須の文字・数
  for (const f of visible.filter((x) => x.dir !== "in" && x.type === "object")) {
    for (const [k, p] of Object.entries(f.properties ?? {})) {
      if (!p.required) continue;
      if (p.type === "string") reqs.push(`(formData.${f.name}.${k} ?? '').trim() !== ''`);
      else if (p.type === "number" || p.type === "integer") reqs.push(`Number.isFinite(formData.${f.name}.${k})`);
    }
  }
  const usesCurrency = visible.some((f) => f.dir === "in" && f.currency);
  const handlers: string[] = [];
  const update = `    const updated = { ...formData, [name]: value };\n    setFormData(updated);\n    codedActionAppService.setTaskData(toTaskData(updated, given.current));`;
  if (anyText) handlers.push(`  const handleTextChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {\n    if (isReadOnly) return;\n    const { name, value } = e.target;\n${update}\n  };`);
  if (used.has("number")) handlers.push(`  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {\n    if (isReadOnly) return;\n    const { name } = e.target;\n    const parsed = e.target.value === '' ? 0 : Number(e.target.value);\n    const value = Number.isNaN(parsed) ? 0 : parsed;\n${update}\n  };`);
  if (used.has("integer")) handlers.push(`  const handleIntegerChange = (e: ChangeEvent<HTMLInputElement>) => {\n    if (isReadOnly) return;\n    const { name } = e.target;\n    const parsed = e.target.value === '' ? 0 : Math.trunc(Number(e.target.value));\n    const value = Number.isNaN(parsed) ? 0 : parsed;\n${update}\n  };`);
  if (usesSetField) handlers.push(`  // 値をまるごと置き換える（一覧・まとまり・添付）。上げ終わりを待つ間に他を書いても消えないよう、前の値に重ねる
  const setField = <K extends keyof FormData>(name: K, value: FormData[K]) => {
    if (isReadOnly) return;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      codedActionAppService.setTaskData(toTaskData(updated, given.current));
      return updated;
    });
  };`);
  if (uploads.length) handlers.push(`  // 添付を上げる。Attachments.create は上げ終わってから返り、その id が file の値（{ ID }）になる
  const uploadFile = async (name: FileKey, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isReadOnly) return;
    setUploading(name);
    try {
      const created = await attachments.create(file.name, file);
      setField(name, { ID: created.id });
    } catch (err) {
      codedActionAppService.showMessage(\`添付を上げられませんでした：\${err instanceof Error ? err.message : String(err)}\`, MessageSeverity.Error);
    } finally {
      setUploading(null);
    }
  };`);
  if (used.has("check")) handlers.push(`  const handleCheckChange = (e: ChangeEvent<HTMLInputElement>) => {\n    if (isReadOnly) return;\n    const { name, checked: value } = e.target;\n${update}\n  };`);
  const outcomes = app.outcomes.map((o) => ({ ...o, fn: `handle${pascal(o.name)}` }));
  const fnNames = new Set<string>();
  for (const o of outcomes) { let n = o.fn, i = 2; while (fnNames.has(n)) n = `${o.fn}${i++}`; o.fn = n; fnNames.add(n); }
  const primary = outcomes.some((o) => o.primary) ? outcomes : outcomes.map((o, i) => ({ ...o, primary: i === outcomes.length - 1 }));
  const ind = "              ";
  const body = sections.map((s) => {
    const grid = s.fields.filter((f) => f.control !== "textarea");
    const wide = s.fields.filter((f) => f.control === "textarea");
    return [
      `          <section className="form-section">`,
      `            <h2 className="form-title">${jsx(s.title)}</h2>`,
      ...(grid.length ? [`            <div className="form-grid">`, ...grid.map((f) => control(f, ind)), `            </div>`] : []),
      ...wide.map((f) => control(f, "            ")),
      `          </section>`,
    ].join("\n");
  }).concat(records.map((r) => [`          <section className="form-section">`, recordListJsx(r, "entities", "            "), `          </section>`].join("\n"))).join("\n\n");
  const sdkImports = [...(uploads.length ? ["attachments"] : []), ...(records.length ? ["entities"] : [])];

  return `// tools/apps/coded-action.ts が IR（${app.app}）から作った。手で直さない
import { useState, useEffect, useRef } from 'react';
${needsChangeEvent ? "import type { ChangeEvent } from 'react';\n" : ""}import { MessageSeverity, Theme } from '@uipath/coded-action-app';
import { codedActionAppService${sdkImports.map((s) => `, ${s}`).join("")} } from '../uipath';
${usesView ? "import Attachment from './Attachment';\n" : ""}${records.length ? "import RecordList from './RecordList';\n" : ""}import './Form.css';
import './Parts.css';

interface FormData {
${(["in", "inout", "out"] as Dir[]).flatMap((d) => {
  const fs = app.fields.filter((f) => f.dir === d);
  return fs.length ? [`  // ${SECTION_OF[d]}`, ...fs.map((f) => `  ${f.name}: ${tsType(f)};`)] : [];
}).join("\n")}
}

const defaultFormData: FormData = {
${app.fields.map((f) => `  ${f.name}: ${initial(f)},`).join("\n")}
};
${uploads.length ? `\n// 添付を上げられるフィールド\ntype FileKey = ${uploads.map((f) => js(f.name)).join(" | ")};\n` : ""}
// 送るデータ：タスクに無かった欄で、値が空（'' / null / { ID: '' }）のものは送らない。
// 送ると、書かなかった欄も空の値でタスクに残る（2026-11-17、Action Center で payOn: "" と receipt: { ID: "" } が残った）。
// タスクに入っていた欄は、空にしたこともそのまま送る
const isEmptyValue = (v: unknown): boolean =>
  v === '' || v === null || v === undefined ||
  (typeof v === 'object' && !Array.isArray(v) && 'ID' in (v as object) && (v as { ID: unknown }).ID === '');
const toTaskData = (data: FormData, given: Set<string>): Partial<FormData> =>
  Object.fromEntries(Object.entries(data).filter(([k, v]) => given.has(k) || !isEmptyValue(v))) as Partial<FormData>;

const isDarkTheme = (theme: Theme): boolean =>
  theme === Theme.Dark || theme === Theme.DarkHighContrast;
${usesCurrency ? `
const formatCurrency = (n: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n || 0);
` : ""}
interface FormProps {
  onInitTheme: (isDark: boolean) => void;
  darkTheme: boolean;
  onToggleTheme: () => void;
}

function Form({ onInitTheme, darkTheme, onToggleTheme }: FormProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isReadOnly, setIsReadOnly] = useState(false);
  // タスクに最初から入っていた欄の名前（toTaskData が使う）
  const given = useRef<Set<string>>(new Set());
${uploads.length ? "  const [uploading, setUploading] = useState<FileKey | null>(null);\n" : ""}
  useEffect(() => {
    codedActionAppService.getTask().then((task) => {
      // task.data には inputs と inOuts しか無い（outputs は最初は無い）。既定値の上に重ねる
      const merged = task.data
        ? { ...defaultFormData, ...(task.data as Partial<FormData>) }
        : defaultFormData;
      given.current = new Set(Object.keys(task.data ?? {}));
      setFormData(merged);
      setIsReadOnly(task.isReadOnly);
      onInitTheme(isDarkTheme(task.theme));
    });
  }, [onInitTheme]);

${handlers.join("\n\n")}${handlers.length ? "\n\n" : ""}  // 必須の記入が済んでいて、読むだけでない
  const isFormValid =
    !isReadOnly${reqs.map((r) => ` &&\n    ${r}`).join("")};

${outcomes.map((o) => `  const ${o.fn} = async () => {\n    try {\n      await codedActionAppService.completeTask(${js(o.name)}, toTaskData(formData, given.current));\n    } catch (e) {\n      // 完了に失敗したら、Action Center の中で人に知らせる\n      codedActionAppService.showMessage(\`完了できませんでした：\${e instanceof Error ? e.message : String(e)}\`, MessageSeverity.Error);\n    }\n  };`).join("\n")}

  return (
    <div className="review-app">
      <header className="review-header">
        <div className="review-header__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M9 15l2 2 4-4" />
          </svg>
        </div>
        <div className="review-header__titles">
          <h1 className="review-header__title">${jsx(app.title)}</h1>
${app.subtitle ? `          <p className="review-header__subtitle">${jsx(app.subtitle)}</p>\n` : ""}        </div>
        <div className="review-header__actions">
          {isReadOnly && <span className="review-badge">読むだけ</span>}
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={darkTheme ? 'ライトモードにする' : 'ダークモードにする'}
            title={darkTheme ? 'ライトモードにする' : 'ダークモードにする'}
          >
            {darkTheme ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="form-container form-container--enter">
${body}
      </div>

      <div className="form-buttons">
${primary.map((o) => `        <button
          type="button"
          className="outcome-btn outcome-btn--${o.primary ? "primary" : "secondary"}"
          onClick={${o.fn}}
          disabled={${o.validate === false ? "isReadOnly" : "!isFormValid"}}
        >
          ${jsx(o.label ?? o.name)}
        </button>`).join("\n")}
      </div>
    </div>
  );
}

export default Form;
`;
}

// ---- 決まった骨組み（UiPath のスキルのテンプレートと同じ） ----

const FIXED: Record<string, (app: ActionApp) => string> = {
  "index.html": (a) => `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${a.title.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  "vite.config.ts": () => `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' は必ず要る（Action Center がルートでない場所に置く）
export default defineConfig({
  plugins: [react()],
  base: './',
});
`,
  "tsconfig.json": () => JSON.stringify({
    compilerOptions: {
      target: "ES2022", lib: ["ES2022", "DOM", "DOM.Iterable"], module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx",
      strict: true, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true, isolatedModules: true, noUnusedLocals: true, noUnusedParameters: true, types: ["vite/client"],
    },
    include: ["src"],
  }, null, 2) + "\n",
  "src/main.tsx": () => `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,
  "src/App.tsx": () => `import { useState, useCallback, useEffect } from 'react';
import Form from './components/Form';
import './App.css';

function App() {
  const [darkTheme, setDarkTheme] = useState(false);

  // タスクのテーマ（Action Center）で最初に決める
  const handleInitTheme = useCallback((isDark: boolean) => {
    setDarkTheme(isDark);
  }, []);

  // 見出しのボタンで切り替える
  const toggleTheme = useCallback(() => setDarkTheme((d) => !d), []);

  useEffect(() => {
    document.body.className = darkTheme ? 'dark' : 'light';
  }, [darkTheme]);

  return (
    <div className={\`app-shell \${darkTheme ? 'dark' : 'light'}\`}>
      <Form onInitTheme={handleInitTheme} darkTheme={darkTheme} onToggleTheme={toggleTheme} />
    </div>
  );
}

export default App;
`,
  "src/uipath.ts": (a) => {
    const s = sdkServices(a);
    if (!s.attachments && !s.entities) return `import { CodedActionAppService } from '@uipath/coded-action-app';

// Action Center の iframe の中で動く。sdk.initialize() は呼ばない
export const codedActionAppService = new CodedActionAppService();
`;
    // スキルのテンプレート（action-app-template.md の「With SDK services」）の形
    return `import { UiPath } from '@uipath/uipath-typescript/core';
${s.attachments ? "import { Attachments } from '@uipath/uipath-typescript/attachments';\n" : ""}${s.entities ? "import { Entities } from '@uipath/uipath-typescript/entities';\n" : ""}import { CodedActionAppService } from '@uipath/coded-action-app';

// Action Center の iframe の中で動き、セッションは Action Center が渡す。sdk.initialize()（OAuth のリダイレクト）は呼ばない
const sdk = new UiPath();

export const codedActionAppService = new CodedActionAppService();
${s.attachments ? "export const attachments = new Attachments(sdk);\n" : ""}${s.entities ? "export const entities = new Entities(sdk);\n" : ""}`;
  },
  "src/components/Parts.css": () => `/* tools/apps/coded-action.ts が足す部品（選択・ラジオ・チェック・一覧）。色は index.css のトークン */
.form-group select {
  width: 100%;
  background: var(--bg-input);
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  color: var(--text-primary);
  font-size: 0.92rem;
  font-family: inherit;
  box-sizing: border-box;
}
.form-group select:focus { outline: none; border-color: var(--border-focus); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.16); }
.form-group--check { flex-direction: row-reverse; justify-content: flex-end; align-items: center; gap: 0.6rem; }
.form-group--check label { margin-bottom: 0; }
.form-group .form-check { width: 1.1rem; height: 1.1rem; padding: 0; accent-color: var(--border-focus); }
.radio-group { display: flex; flex-wrap: wrap; gap: 0.9rem; }
.radio-option { display: flex; align-items: center; gap: 0.35rem; text-transform: none !important; letter-spacing: 0 !important; font-weight: 500 !important; color: var(--text-primary) !important; }
.radio-option input { width: auto !important; }
.field-hint { margin-top: 0.3rem; color: var(--text-muted); font-size: 0.78rem; }
.value-list { margin: 0; padding: 0.55rem 0.85rem 0.55rem 1.8rem; background: var(--bg-hover); border: 1.5px dashed var(--border-color); border-radius: var(--radius-sm); color: var(--text-secondary); }
.value-json { margin: 0; padding: 0.65rem 0.85rem; background: var(--bg-hover); border: 1.5px dashed var(--border-color); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 0.82rem; overflow: auto; }
/* 書ける一覧（array） */
.list-editor { display: flex; flex-direction: column; gap: 0.4rem; }
.list-editor__row { display: flex; align-items: center; gap: 0.4rem; }
.list-editor__row input:not([type="checkbox"]) { flex: 1; min-width: 0; }
.list-editor__remove, .list-editor__add, .attachment__button { border: 1.5px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-input); color: var(--text-secondary); font-family: inherit; cursor: pointer; }
.list-editor__remove { flex: none; width: 2rem; height: 2rem; }
.list-editor__add { align-self: flex-start; padding: 0.35rem 0.8rem; font-size: 0.85rem; }
.list-editor__remove:disabled, .list-editor__add:disabled, .attachment__button:disabled { opacity: 0.5; cursor: default; }
/* 書けるまとまり（object） */
.object-editor { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.6rem; padding: 0.7rem; border: 1.5px dashed var(--border-color); border-radius: var(--radius-sm); }
.object-editor__item { display: flex; flex-direction: column; gap: 0.25rem; text-transform: none !important; letter-spacing: 0 !important; min-width: 0; }
.object-editor__item > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 添付（file） */
.file-field { display: flex; flex-direction: column; gap: 0.4rem; }
.file-field__current { color: var(--text-secondary); font-size: 0.85rem; overflow-wrap: anywhere; }
.attachment { display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
.attachment__image { max-width: 100%; max-height: 20rem; object-fit: contain; border: 1px solid var(--border-color); border-radius: var(--radius-sm); align-self: flex-start; }
.attachment__bar { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.attachment__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); font-size: 0.85rem; }
.attachment__button { flex: none; padding: 0.35rem 0.8rem; font-size: 0.85rem; }
.attachment__none { color: var(--text-muted); font-size: 0.85rem; }
.attachment__error { color: #dc2626; overflow-wrap: anywhere; }
`,
  ".gitignore": () => "node_modules\ndist\n.uipath\n",
};

// UiPath のスキルのテンプレートの CSS（templates/coded-action-app/ に写したもの。そのまま使う）
const COPIED: Record<string, string> = { "src/index.css": "index.css", "src/App.css": "App.css", "src/components/Form.css": "Form.css" };

// 版は、このマシンの npm のキャッシュにあったもの（npm install --prefer-offline で入る）
export const PACKAGE_VERSIONS = {
  "@uipath/coded-action-app": "^1.0.0",
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "@vitejs/plugin-react": "^6.0.0",
  typescript: "~5.9.3",
  vite: "^8.0.0",
  "@uipath/uipath-typescript": "^1.8.4", // SDK を使うときだけ
};
const packageJson = (a: ActionApp) => JSON.stringify({
  name: a.app, private: true, version: "1.0.0", type: "module",
  scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
  dependencies: {
    "@uipath/coded-action-app": PACKAGE_VERSIONS["@uipath/coded-action-app"],
    ...(usesSdk(a) ? { "@uipath/uipath-typescript": PACKAGE_VERSIONS["@uipath/uipath-typescript"] } : {}),
    react: PACKAGE_VERSIONS.react, "react-dom": PACKAGE_VERSIONS["react-dom"],
  },
  devDependencies: { "@types/react": PACKAGE_VERSIONS["@types/react"], "@types/react-dom": PACKAGE_VERSIONS["@types/react-dom"], "@vitejs/plugin-react": PACKAGE_VERSIONS["@vitejs/plugin-react"], typescript: PACKAGE_VERSIONS.typescript, vite: PACKAGE_VERSIONS.vite },
}, null, 2) + "\n";

// ---- SDK（@uipath/uipath-typescript）----

// 使うサービス。添付を上げる・開く → Attachments、レコードの表 → Entities
export function sdkServices(app: ActionApp): { attachments: boolean; entities: boolean } {
  const visible = app.fields.filter((f) => !f.hidden && f.type === "file");
  return { attachments: visible.some((f) => f.dir !== "in" || !!f.show), entities: (app.records ?? []).length > 0 };
}
const usesSdk = (app: ActionApp) => { const s = sdkServices(app); return s.attachments || s.entities; };

// OAuth のスコープ。SDK の docs/oauth-scopes.md の表と、スキルの oauth-scopes.md の「Common Scope Bundles」から
export function scopes(app: ActionApp): string {
  const s = sdkServices(app);
  const up = app.fields.some((f) => !f.hidden && f.type === "file" && f.dir !== "in");
  return [
    ...(s.attachments ? [up ? "OR.Folders" : "OR.Folders.Read"] : []), // getById は OR.Folders(.Read)、create は OR.Folders(.Write)
    ...(s.entities ? ["DataFabric.Schema.Read", "DataFabric.Data.Read"] : []), // getAllRecords / getRecordsByName は DataFabric.Data.Read
  ].join(" ");
}
export const CLIENT_ID_PLACEHOLDER = "<External Application の client ID>";

export function generateFiles(app: ActionApp): Record<string, string> {
  const files: Record<string, string> = {};
  files["action-schema.json"] = JSON.stringify(actionSchema(app), null, 2) + "\n";
  files["src/components/Form.tsx"] = formTsx(app);
  for (const [p, f] of Object.entries(FIXED)) files[p] = f(app);
  for (const [p, t] of Object.entries(COPIED)) files[p] = readFileSync(join(TEMPLATES, t), "utf8");
  // SDK を使うときだけ：uipath.json（uip codedapp が pack で読む）と部品
  if (usesSdk(app)) files["uipath.json"] = JSON.stringify({ scope: scopes(app), clientId: app.clientId ?? CLIENT_ID_PLACEHOLDER }, null, 2) + "\n";
  if (app.fields.some((f) => !f.hidden && f.type === "file" && f.show)) files["src/components/Attachment.tsx"] = ATTACHMENT_TSX;
  if ((app.records ?? []).length) { files["src/components/RecordList.tsx"] = RECORD_LIST_TSX; files["src/components/RecordList.css"] = RECORD_LIST_CSS; }
  return files;
}

// package.json は無いときだけ書く（npm install で版が足されたものを消さない）。SDK が要るのに無ければ足す
export function writeProject(app: ActionApp, out: string): string[] {
  const written: string[] = [];
  const put = (p: string, s: string) => { const f = join(out, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s, "utf8"); written.push(f); };
  for (const [p, s] of Object.entries(generateFiles(app))) put(p, s);
  const pkg = join(out, "package.json");
  if (!existsSync(pkg)) put("package.json", packageJson(app));
  else if (usesSdk(app)) {
    const j = JSON.parse(readFileSync(pkg, "utf8"));
    if (!j.dependencies?.["@uipath/uipath-typescript"]) {
      j.dependencies = { ...j.dependencies, "@uipath/uipath-typescript": PACKAGE_VERSIONS["@uipath/uipath-typescript"] };
      put("package.json", JSON.stringify(j, null, 2) + "\n");
    }
  }
  return written;
}

function main() {
  const args = process.argv.slice(2);
  const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const out = val("--out");
  const checkOnly = args.includes("--check");
  const files = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
  if (files.length !== 1 || (!out && !checkOnly)) { console.error("使い方: node tools/apps/coded-action.ts <app.json> (--out <dir> | --check)"); process.exit(2); }
  const app: ActionApp = JSON.parse(readFileSync(files[0], "utf8"));
  const issues = check(app);
  if (issues.length) {
    console.log(`NG ${files[0]}`);
    for (const i of issues) console.log(`  ${i.code.padEnd(16)} ${i.path}: ${i.message}`);
    process.exit(1);
  }
  if (checkOnly) { console.log(`OK ${files[0]}`); return; }
  const w = writeProject(app, resolvePath(out!));
  console.log(`OK ${files[0]} -> ${out}（${w.length} ファイル）`);
  if (usesSdk(app)) console.log(`  SDK を使う（scope: ${scopes(app)}）。${app.clientId ? "" : "uipath.json の clientId に External Application の client ID を書く（IR の clientId）。"}`);
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();

