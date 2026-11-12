// Coded Action App（Action Center のタスクの画面。React + TypeScript）を IR から作る。
//
//   node tools/apps/coded-action.ts <app.json> --out <dir> [--check]
//     --out <dir>  プロジェクトのフォルダに書く（package.json、action-schema.json、src/...）
//     --check      検証だけ
//   終了コード: 0 = 書けた / 1 = 検証で弾かれた / 2 = 使い方の誤り
//
// パーツ（knowledge/apps.md）:
//   - データの約束：action-schema.json（inputs / outputs / inOuts / outcomes）。uip codedapp の検証器と同じ規則で調べる
//   - 画面：フィールドの型ごとの部品（文字・数・日付・真偽・選択・一覧・ファイル）。inputs は読むだけ、outputs / inOuts は書ける
//   - 結果のボタン：outcomes。押すと completeTask(<名前>, formData)
//   - 決まった骨組み：App.tsx（テーマ）、main.tsx、uipath.ts、vite.config.ts（base: './'）、CSS（UiPath のスキルのテンプレートのまま）
//
// 書いたあとは、そのフォルダで npm install → npm run build。uip codedapp pack / publish -t Action / deploy で Action Center に出す。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATES = join(root, "templates", "coded-action-app");

// ---- IR ----

export type FieldType = "string" | "number" | "integer" | "boolean" | "array" | "object" | "file";
export type Dir = "in" | "out" | "inout";
export type SchemaProp = { type: FieldType; required?: boolean; description?: string; format?: "uuid" | "date"; items?: SchemaProp; properties?: Record<string, SchemaProp> };
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
};
export type Outcome = { name: string; label?: string; primary?: boolean; validate?: boolean }; // validate: false は必須の入力が空でも押せる（却下など）
export type ActionApp = { app: string; kind?: "action"; title: string; subtitle?: string; fields: Field[]; outcomes: Outcome[] };
export type Issue = { path: string; code: string; message: string };

const TYPES: FieldType[] = ["string", "integer", "number", "boolean", "array", "object", "file"];
const SECTION_OF: Record<Dir, string> = { in: "inputs", out: "outputs", inout: "inOuts" };
const DEFAULT_SECTION: Record<Dir, string> = { in: "内容", inout: "確認して直す", out: "記入" };
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
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
  if (app.kind !== undefined && app.kind !== "action") add("kind", "APP_KIND", "kind は action だけ（Web App はまだ）");
  const names = new Set<string>();
  (app.fields ?? []).forEach((f, i) => {
    const at = `fields[${i}]`;
    if (!IDENT.test(f.name ?? "") || TS_RESERVED.has(f.name)) add(`${at}.name`, "APP_NAME", `name "${f.name}" は英数字の識別子（TypeScript の予約語は不可）`);
    if (names.has(f.name)) add(`${at}.name`, "APP_NAME", `"${f.name}" が重なっている（inputs / outputs / inOuts をまたいで 1 つ）`);
    names.add(f.name);
    if (!["in", "out", "inout"].includes(f.dir)) add(`${at}.dir`, "APP_DIR", "dir は in / out / inout");
    checkProp(f, at, add);
    const editable = f.dir !== "in";
    if (f.control && (f.type !== "string" || !["text", "textarea", "select", "radio"].includes(f.control))) add(`${at}.control`, "APP_CONTROL", "control は string にだけ、text / textarea / select / radio");
    if ((f.control === "select" || f.control === "radio") && !(f.options ?? []).length) add(`${at}.options`, "APP_CONTROL", `${f.control} には options（選択肢）が要る`);
    if (f.options && f.control !== "select" && f.control !== "radio") add(`${at}.options`, "APP_CONTROL", "options は control が select / radio のときだけ");
    if ((f.min !== undefined || f.max !== undefined) && f.type !== "number" && f.type !== "integer") add(`${at}.min`, "APP_CONTROL", "min / max は number / integer にだけ");
    if (f.currency && f.type !== "number") add(`${at}.currency`, "APP_CONTROL", "currency は number にだけ");
    if (editable && !f.hidden && ["array", "object", "file"].includes(f.type)) add(`${at}.type`, "APP_UNSUPPORTED", `${f.type} を書ける部品はまだ無い（dir: in にするか hidden にする）`);
  });
  const outs = new Set<string>();
  if (!(app.outcomes ?? []).length) add("outcomes", "APP_SHAPE", "outcomes（結果のボタン）が 1 つは要る");
  (app.outcomes ?? []).forEach((o, i) => {
    if (!o.name || /["'`\\]/.test(o.name)) add(`outcomes[${i}].name`, "APP_NAME", "outcome の name が要る（引用符は不可）");
    if (outs.has(o.name)) add(`outcomes[${i}].name`, "APP_NAME", `outcome "${o.name}" が重なっている`);
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
const initial = (p: SchemaProp): string => ({ string: "''", number: "0", integer: "0", boolean: "false", array: "[]", object: "{}", file: "{ ID: '' }" })[p.type];
const js = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
const jsx = (s: string) => s.replace(/[{}<>&]/g, (c) => `{'${c}'}`);
const pascal = (s: string) => s.replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/^[^A-Za-z]+/, "") || "Outcome";

// 必須の判定（書けるフィールドだけ）
function requiredCheck(f: Field): string {
  const v = `formData.${f.name}`;
  if (f.type === "string") return `${v}.trim() !== ''`;
  if (f.type === "number" || f.type === "integer") return `Number.isFinite(${v})`;
  return "true"; // boolean は false も値
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
    case "array":
      return wrapGroup(`${ind}  <ul id="${id}" className="value-list">\n${ind}    {${v}.map((x, i) => <li key={i}>{typeof x === 'object' ? JSON.stringify(x) : String(x)}</li>)}\n${ind}  </ul>`);
    case "object":
      return wrapGroup(`${ind}  <pre id="${id}" className="value-json">{JSON.stringify(${v}, null, 2)}</pre>`);
    case "file":
      return wrapGroup(`${ind}  <input id="${id}" readOnly value={${v}?.ID ?? ''} />`);
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
  const used = new Set(visible.filter((f) => f.dir !== "in").map((f) => (f.type === "string" ? "text" : f.type === "boolean" ? "check" : f.type === "integer" ? "integer" : f.type === "number" ? "number" : "")));
  const anyText = used.has("text");
  const reqs = app.fields.filter((f) => f.dir !== "in" && f.required && !f.hidden && ["string", "number", "integer"].includes(f.type));
  const usesCurrency = visible.some((f) => f.dir === "in" && f.currency);
  const handlers: string[] = [];
  const update = `    const updated = { ...formData, [name]: value };\n    setFormData(updated);\n    codedActionAppService.setTaskData(updated);`;
  if (anyText) handlers.push(`  const handleTextChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {\n    if (isReadOnly) return;\n    const { name, value } = e.target;\n${update}\n  };`);
  if (used.has("number")) handlers.push(`  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {\n    if (isReadOnly) return;\n    const { name } = e.target;\n    const parsed = e.target.value === '' ? 0 : Number(e.target.value);\n    const value = Number.isNaN(parsed) ? 0 : parsed;\n${update}\n  };`);
  if (used.has("integer")) handlers.push(`  const handleIntegerChange = (e: ChangeEvent<HTMLInputElement>) => {\n    if (isReadOnly) return;\n    const { name } = e.target;\n    const parsed = e.target.value === '' ? 0 : Math.trunc(Number(e.target.value));\n    const value = Number.isNaN(parsed) ? 0 : parsed;\n${update}\n  };`);
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
  }).join("\n\n");

  return `// tools/apps/coded-action.ts が IR（${app.app}）から作った。手で直さない
import { useState, useEffect } from 'react';
${anyText || used.size ? "import type { ChangeEvent } from 'react';\n" : ""}import { Theme } from '@uipath/coded-action-app';
import { codedActionAppService } from '../uipath';
import './Form.css';
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

  useEffect(() => {
    codedActionAppService.getTask().then((task) => {
      // task.data には inputs と inOuts しか無い（outputs は最初は無い）。既定値の上に重ねる
      const merged = task.data
        ? { ...defaultFormData, ...(task.data as Partial<FormData>) }
        : defaultFormData;
      setFormData(merged);
      setIsReadOnly(task.isReadOnly);
      onInitTheme(isDarkTheme(task.theme));
    });
  }, [onInitTheme]);

${handlers.join("\n\n")}${handlers.length ? "\n\n" : ""}  // 必須の記入が済んでいて、読むだけでない
  const isFormValid =
    !isReadOnly${reqs.map((f) => ` &&\n    ${requiredCheck(f)}`).join("")};

${outcomes.map((o) => `  const ${o.fn} = async () => {\n    await codedActionAppService.completeTask(${js(o.name)}, formData);\n  };`).join("\n")}

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
  "src/uipath.ts": () => `import { CodedActionAppService } from '@uipath/coded-action-app';

// Action Center の iframe の中で動く。sdk.initialize() は呼ばない
export const codedActionAppService = new CodedActionAppService();
`,
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
};
const packageJson = (a: ActionApp) => JSON.stringify({
  name: a.app, private: true, version: "1.0.0", type: "module",
  scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
  dependencies: { "@uipath/coded-action-app": PACKAGE_VERSIONS["@uipath/coded-action-app"], react: PACKAGE_VERSIONS.react, "react-dom": PACKAGE_VERSIONS["react-dom"] },
  devDependencies: { "@types/react": PACKAGE_VERSIONS["@types/react"], "@types/react-dom": PACKAGE_VERSIONS["@types/react-dom"], "@vitejs/plugin-react": PACKAGE_VERSIONS["@vitejs/plugin-react"], typescript: PACKAGE_VERSIONS.typescript, vite: PACKAGE_VERSIONS.vite },
}, null, 2) + "\n";

export function generateFiles(app: ActionApp): Record<string, string> {
  const files: Record<string, string> = {};
  files["action-schema.json"] = JSON.stringify(actionSchema(app), null, 2) + "\n";
  files["src/components/Form.tsx"] = formTsx(app);
  for (const [p, f] of Object.entries(FIXED)) files[p] = f(app);
  for (const [p, t] of Object.entries(COPIED)) files[p] = readFileSync(join(TEMPLATES, t), "utf8");
  return files;
}

// package.json は無いときだけ書く（npm install で版が足されたものを消さない）
export function writeProject(app: ActionApp, out: string): string[] {
  const written: string[] = [];
  const put = (p: string, s: string) => { const f = join(out, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s, "utf8"); written.push(f); };
  for (const [p, s] of Object.entries(generateFiles(app))) put(p, s);
  if (!existsSync(join(out, "package.json"))) put("package.json", packageJson(app));
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
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();

