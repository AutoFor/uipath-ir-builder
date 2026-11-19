// Integration Service の自作コネクタ（Connector Builder）の生成器。
// AI は小さな IR（コネクタ・認証・アクティビティ）を書き、生成器が `uip is connectors builder` のコマンドに直して流す。
// element.json などのファイルは直接書かない（既定の項目が多く、SR と element.json の同期もあるので CLI に任せる）。
// 生成器が決めること：
//   - 認証の種類（apiKey は customApiKey。Bearer は prefix "Bearer " で、トークンは暗号化される PASSWORD の欄になる）
//   - フィールドの per-method の形（request / response、required はメソッドの下）
//   - 引数は配列で node から CLI に渡す（シェルを通さないので Git Bash のパスの書き換えが起きない）
//   - フック（preRequest / postRequest の JS）は activity hook create で置く。配列の本文を Studio の平らな欄から組み立てるのに使う
//     （Studio のデザイナーは、親の欄 "x[*]" の無い "x[*].y" を捨てる。knowledge/connector-builder.md）
// Studio の XAML（Insert Record など）は tools/connector/xaml.ts
// knowledge/connector-builder.md
//
// 使い方:
//   node tools/connector/gen.ts <ir.json> --out <空のフォルダ> [--organization <組織>]   # コネクタを作って validate まで（ローカルだけ）
//   node tools/connector/gen.ts <ir.json> --print                                        # 流すコマンドを表示するだけ
//   node tools/connector/gen.ts <ir.json> --out <dir> --import [--publish]              # テナントに上げる（publish はテナント全体に公開）
// 終了コード: 0 = OK、1 = IR の誤り・CLI の失敗・validate の失敗、2 = 使い方の間違い

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type FieldIr = {
  name: string; // 例 "to"、"messages[*].text"（配列は [*]）
  type?: "string" | "number" | "integer" | "boolean" | "object" | "array" | "date";
  label?: string; // 画面の表示名
  description?: string;
  sample?: unknown; // 例の値
  required?: boolean; // request だけ
  primary?: boolean; // 画面で最初から出す（design.position = primary）
  enum?: string[];
};

export type ActivityIr = {
  name: string; // 英小文字・数字・_（リソース名。パスの一部になる）
  displayName?: string;
  description?: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string; // ベース URL からのパス（/ で始める）
  request?: FieldIr[];
  response?: FieldIr[];
  // JS のフック。文字列か行の配列。return ではなく done({...}) で返す（使える変数は uip is connectors builder activity hook create --help）
  hooks?: { preRequest?: string | string[]; postRequest?: string | string[] };
};

export type AuthIr =
  | { type: "apiKey"; header?: string; query?: string; prefix?: string; label?: string; validate?: string }
  | { type: "oauth2"; authorizationUrl: string; tokenUrl: string; scope: string; validate?: string }
  | { type: "basic"; validate?: string }
  | { type: "none" };

export type ConnectorIr = {
  connector: string; // 表示名。キーは design-{組織}-{名前を小文字にして記号を除いたもの}
  description?: string;
  // 公開する版（publish --version）。公開し直すときは前より上げる（同じ版は「must be higher than the existing version」で落ちる）。省くと 1.0.0
  version?: string;
  categories?: string[];
  baseUrl: string;
  headers?: Record<string, string>; // すべての呼び出しに付ける固定のヘッダー
  auth: AuthIr;
  activities: ActivityIr[];
};

export type Issue = { path: string; message: string };
// 1 つの CLI の呼び出し。args の "{root}" は init が返すコネクタのフォルダに置き換える。files は呼ぶ前に作業フォルダに書く
export type Command = { args: string[]; files?: Record<string, string> };

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const CATEGORIES = ["Sales and marketing", "CRM", "eSignature", "Collaboration", "Project management", "Content management", "Productivity", "Artificial intelligence", "Human resources", "Finance and accounting", "Healthcare", "Social media", "Machine learning", "Generative AI", "Meetings", "Developer", "Email", "Computer vision", "IT and help desk", "E-commerce", "Data and analytics", "Messaging", "ERP"];

export function check(ir: ConnectorIr): Issue[] {
  const out: Issue[] = [];
  const bad = (path: string, message: string) => out.push({ path, message });
  if (!ir.connector?.trim()) bad("connector", "コネクタの名前が要る");
  if (!/^https:\/\/[^/\s]+/.test(ir.baseUrl ?? "")) bad("baseUrl", "https:// で始まる URL にする");
  if (ir.version !== undefined && !/^\d+\.\d+\.\d+$/.test(ir.version)) bad("version", "1.0.1 のような x.y.z にする");
  if (/\/$/.test(ir.baseUrl ?? "")) bad("baseUrl", "最後の / は付けない（パスは activities[].path に / から書く）");
  for (const c of ir.categories ?? []) if (!CATEGORIES.some((x) => x.toLowerCase() === c.toLowerCase())) bad("categories", `「${c}」は使えない。使えるのは ${CATEGORIES.join(", ")}`);
  const a = ir.auth;
  if (!a) bad("auth", "認証が要る（無いなら { \"type\": \"none\" }）");
  else if (a.type === "apiKey") { if (!a.header === !a.query) bad("auth", "apiKey は header か query のどちらか1つ"); }
  else if (a.type === "oauth2") { if (!a.authorizationUrl || !a.tokenUrl || !a.scope) bad("auth", "oauth2 は authorizationUrl・tokenUrl・scope が要る"); }
  else if (a.type !== "basic" && a.type !== "none") bad("auth.type", `知らない種類：${(a as { type: string }).type}（apiKey・oauth2・basic・none）`);
  if ("validate" in (a ?? {}) && (a as { validate?: string }).validate && !(a as { validate: string }).validate.startsWith("/")) bad("auth.validate", "/ で始まるパスにする（GET で呼ぶ読み取りだけの API）");
  if (!ir.activities?.length) bad("activities", "アクティビティが1つは要る");
  const names = new Set<string>();
  (ir.activities ?? []).forEach((act, i) => {
    const p = `activities[${i}]`;
    if (!/^[a-z][a-z0-9_]*$/.test(act.name ?? "")) bad(`${p}.name`, "英小文字で始まる英小文字・数字・_ にする");
    if (names.has(act.name)) bad(`${p}.name`, `「${act.name}」が重なっている`);
    names.add(act.name);
    if (!METHODS.has(act.method)) bad(`${p}.method`, "GET・POST・PUT・PATCH・DELETE のどれか");
    if (!(act.path ?? "").startsWith("/")) bad(`${p}.path`, "/ で始める");
    const seen = new Set<string>();
    for (const [side, list] of [["request", act.request], ["response", act.response]] as const) {
      (list ?? []).forEach((f, j) => {
        if (!f.name) bad(`${p}.${side}[${j}].name`, "名前が要る");
        if (seen.has(`${side}:${f.name}`)) bad(`${p}.${side}[${j}].name`, `「${f.name}」が重なっている`);
        seen.add(`${side}:${f.name}`);
        if (side === "response" && f.required) bad(`${p}.response[${j}].required`, "required は request だけ");
      });
    }
    for (const [k, v] of Object.entries(act.hooks ?? {})) {
      if (k !== "preRequest" && k !== "postRequest") bad(`${p}.hooks.${k}`, "preRequest か postRequest");
      else if (!/\bdone\s*\(/.test(hookCode(v))) bad(`${p}.hooks.${k}`, "done(...) を呼ぶ（return ではなく done で返す）");
    }
    if (act.method === "GET" && act.request?.length) bad(`${p}.request`, "GET に本文は無い（クエリの引数はまだ扱っていない）");
  });
  return out;
}

export const hookCode = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join("\n") : v ?? "");

/** アクティビティのフィールドを CLI の --fields-file の形にする（同じ名前の request と response は1つにまとめる） */
export function fieldsOf(act: ActivityIr): Record<string, unknown>[] {
  const byName = new Map<string, Record<string, unknown>>();
  const put = (f: FieldIr, side: "request" | "response") => {
    const o = byName.get(f.name) ?? { name: f.name, type: f.type ?? "string", method: { [act.method]: {} } };
    if (f.label) o.displayName = f.label;
    if (f.description) o.description = f.description;
    if (f.sample !== undefined) o.sampleValue = f.sample;
    if (f.enum) o.enum = f.enum;
    if (f.primary) o.design = { position: "primary" };
    const m = (o.method as Record<string, Record<string, boolean>>)[act.method];
    m[side] = true;
    if (side === "request" && f.required) m.required = true;
    byName.set(f.name, o);
  };
  for (const f of act.request ?? []) put(f, "request");
  for (const f of act.response ?? []) put(f, "response");
  return [...byName.values()];
}

function authArgs(a: AuthIr): string[] {
  const v = "validate" in a && a.validate ? ["--validation-vendor-path", a.validate, "--validation-method", "GET"] : [];
  switch (a.type) {
    case "apiKey":
      return ["--auth-type", "customApiKey",
        "--api-key-param-name", (a.header ?? a.query)!,
        ...(a.query ? ["--api-key-location", "query"] : []),
        ...(a.prefix ? ["--api-key-prefix", a.prefix] : []),
        ...(a.label ? ["--key-config-display-name", a.label] : []), ...v];
    case "oauth2":
      return ["--auth-type", "oauth2", "--authorization-url", a.authorizationUrl, "--token-url", a.tokenUrl, "--scope", a.scope, ...v];
    case "basic":
      return ["--auth-type", "basic", ...v];
    case "none":
      return ["--auth-type", "none"];
  }
}

/** IR を CLI の呼び出しの並びにする（init → auth set → activity create … → validate） */
export function plan(ir: ConnectorIr, opt: { organization?: string } = {}): { commands: Command[]; issues: Issue[] } {
  const issues = check(ir);
  if (issues.length) return { commands: [], issues };
  const B = ["is", "connectors", "builder"];
  const at = ["--connector-dir", "{root}"];
  const commands: Command[] = [];
  commands.push({ args: [...B, "init", "--name", ir.connector,
    ...(ir.description ? ["--description", ir.description] : []),
    ...(ir.categories?.length ? ["--categories", ir.categories.join(",")] : []),
    "--base-url", ir.baseUrl,
    ...Object.entries(ir.headers ?? {}).flatMap(([k, v]) => ["--header", `${k}=${v}`]),
    ...(opt.organization ? ["--organization", opt.organization] : [])] });
  commands.push({ args: [...B, "auth", "set", ...at, ...authArgs(ir.auth)] });
  for (const act of ir.activities) {
    const fields = fieldsOf(act);
    const file = `fields-${act.name}.json`;
    const hasBody = (act.request ?? []).length > 0;
    commands.push({
      args: [...B, "activity", "create", ...at, "--name", act.name,
        ...(act.displayName ? ["--display-name", act.displayName] : []),
        "--vendor-path", act.path, "--methods", act.method,
        ...(!hasBody && act.method !== "GET" && act.method !== "DELETE" ? ["--no-body"] : []),
        ...(fields.length ? ["--fields-file", file] : [])],
      ...(fields.length ? { files: { [file]: JSON.stringify(fields, null, 2) + "\n" } } : {}),
    });
    for (const [type, code] of Object.entries(act.hooks ?? {})) {
      const js = `hook-${act.name}-${type}.js`;
      commands.push({
        args: [...B, "activity", "hook", "create", ...at, "--resource-name", act.name, "--method", act.method, "--hook-type", type, "--custom-code-file", js],
        files: { [js]: hookCode(code) + "\n" },
      });
    }
  }
  commands.push({ args: [...B, "validate", ...at] });
  return { commands, issues: [] };
}

// ---- CLI を流す ----

const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");

export type RunResult = { ok: boolean; root?: string; key?: string; log: { args: string[]; result: string; data?: unknown }[]; error?: string };

/** plan を work（空のフォルダ）で流す。import / publish はテナントに上げる */
export function run(ir: ConnectorIr, work: string, opt: { organization?: string; import?: boolean; publish?: boolean } = {}): RunResult {
  const { commands, issues } = plan(ir, opt);
  if (issues.length) return { ok: false, log: [], error: issues.map((i) => `${i.path}: ${i.message}`).join("\n") };
  mkdirSync(work, { recursive: true });
  const log: RunResult["log"] = [];
  let root: string | undefined, key: string | undefined;
  const call = (args: string[]) => {
    const real = args.map((a) => (a === "{root}" ? root! : a));
    const r = spawnSync(process.execPath, [uipJs, ...real, "--output", "json"], {
      cwd: work, encoding: "utf8", maxBuffer: 64 << 20,
      env: { ...process.env, UIPATH_CLI_DISABLE_VERSION_SYNC: "1" },
    });
    const text = r.stdout ?? "";
    let j: { Result?: string; Data?: Record<string, unknown>; Message?: string } = {};
    try { j = JSON.parse(text.slice(text.indexOf("{"))); } catch { /* JSON でない */ }
    log.push({ args: real, result: j.Result ?? `exit ${r.status}`, data: j.Data });
    return { ok: r.status === 0 && j.Result === "Success", j, raw: text || r.stderr };
  };
  for (const c of [...commands, ...(opt.import ? [{ args: ["is", "connectors", "import", "--connector-dir", "{root}"] }] : []), ...(opt.publish ? [{ args: ["is", "connectors", "publish", "--connector-dir", "{root}", "--wait", ...(ir.version ? ["--version", ir.version] : [])] }] : [])]) {
    for (const [name, content] of Object.entries(c.files ?? {})) writeFileSync(join(work, name), content);
    const r = call(c.args);
    if (!r.ok) return { ok: false, root, key, log, error: `${c.args.slice(0, 4).join(" ")}: ${r.j.Message ?? r.raw.slice(0, 2000)}` };
    if (c.args[3] === "init") { root = r.j.Data?.ConnectorRoot as string; key = r.j.Data?.ElementKey as string; }
    if (c.args[3] === "validate" && r.j.Data?.Valid !== true) return { ok: false, root, key, log, error: `validate: ${JSON.stringify(r.j.Data?.Errors)}` };
  }
  return { ok: true, root, key, log };
}

function main() {
  const args = process.argv.slice(2);
  const take = (f: string) => { const i = args.indexOf(f); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const out = take("--out"), organization = take("--organization");
  const print = args.includes("--print"), doImport = args.includes("--import"), doPublish = args.includes("--publish");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file || (!out && !print) || (doPublish && !doImport)) {
    console.error("使い方: node tools/connector/gen.ts <ir.json> --out <空のフォルダ> [--organization <組織>] [--import [--publish]] | --print");
    process.exit(2);
  }
  const ir: ConnectorIr = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const { commands, issues } = plan(ir, { organization });
  if (issues.length) {
    console.error(`NG ${file}`);
    for (const i of issues) console.error(`  ${i.path}: ${i.message}`);
    process.exit(1);
  }
  if (print) {
    for (const c of commands) {
      console.log(`uip ${c.args.map((a) => (/[\s'"{}]/.test(a) ? `'${a}'` : a)).join(" ")}`);
      for (const [n, t] of Object.entries(c.files ?? {})) console.log(`  # ${n}\n${t.replace(/^/gm, "  ")}`);
    }
    if (!out) return;
  }
  const work = resolve(out!);
  if (existsSync(work) && readdirSync(work).length) { console.error(`--out は空のフォルダにする（作り直す）：${work}`); process.exit(2); }
  const r = run(ir, work, { organization, import: doImport, publish: doPublish });
  for (const l of r.log) console.log(`  ${l.result.padEnd(16)} uip ${l.args.slice(0, 4).join(" ")}`);
  if (!r.ok) { console.error(`NG ${r.error}`); process.exit(1); }
  console.log(`OK ${r.key} -> ${r.root}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
