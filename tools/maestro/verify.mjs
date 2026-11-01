// Maestro の検証の窓口（AUT-1077）。公式 SDK のソース（*.flow.ts / *.bpmn.ts / *.case.ts）を1回で流し、結果を1つにまとめる。
// ローカルだけで動く。アップロード、公開、デプロイ、実行はしない。
//
// 流す順番:
//   Flow: types → check --source → compile --no-check → validate --strict-expressions
//   BPMN: types → check --source → compile → format → validate
//   Case: types → check --source → compile → validate --strict
// types は tsc。uip の check と compile は型を見ないので、`script({ cod: ... })` のような綴りの間違いはここでしか名前が出ない
// できあがったファイル（*.flow / *.bpmn / *.json）を渡すと、validate だけ流す（BPMN は format も）。
//
// check が NG でも、後ろの工程は続ける。`$vars.review.status` のように check でしか止まらない間違いがあり、
// 一方で validate でしか止まらない間違いもあるので、1回で全部見せるため。前の工程の成果物が無いときだけ skip にする。
//
// 使い方:
//   node tools/maestro/verify.mjs [--out <dir>] [--strict] [--json] [--pack] [--tenant] [--workspace <dir>] <ファイル>...
//     --strict     warning も NG にする
//     --json       結果を JSON で標準出力に書く（人向けの表は標準エラーに書く）
//     --pack       成果物を init の雛形に入れて .nupkg まで作る（ローカルだけ）
//     --tenant     成果物が指す資源がテナントにあるかを照合する（一覧を読むだけ。ログインが要る）
//     --workspace  .flow-sdk/（bindings.json、connectors-local）がある場所。コネクタを使うソースで指定する
// 既定ではテナントに一切触らない。テナントを読むのは --tenant のときだけで、書き込みは無い。
// 終了コード: 0 = すべて OK、1 = NG がある、2 = 使い方の間違いか、環境の問題（uip や SDK が無い）

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkRefs, extractRefs } from "./tenant-refs.mjs";
import { unassignedTasks } from "./task-assign.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

// ---- 純粋な部分（テストする）----

/** ファイル名から種類を決める。分からなければ null */
export function classify(file) {
  const name = basename(file);
  const m = name.match(/^(.*)\.(flow|bpmn|case)\.ts$/);
  if (m) return { family: m[2], source: true, name: m[1] };
  const ext = extname(name);
  const stem = name.slice(0, name.length - ext.length);
  if (ext === ".flow") return { family: "flow", source: false, name: stem };
  if (ext === ".bpmn") return { family: "bpmn", source: false, name: stem };
  if (ext === ".json") return { family: "case", source: false, name: stem };
  return null;
}

/** 種類ごとの工程。成果物のパスの決め方も含む */
export function planSteps(info, input, artifact, opts = {}) {
  const f = info.family;
  const ws = opts.workspace;
  const extra = ws && f !== "case" ? ["--connectors-local", join(ws, ".flow-sdk", "connectors-local")] : [];
  const bindings = ws ? ["--bindings", join(ws, ".flow-sdk", "bindings.json")] : [];
  const compileConnectors = ws ? ["--connectors-local", join(ws, ".flow-sdk", "connectors-local")] : [];
  const steps = [];
  if (info.source) {
    steps.push({ name: "check", args: ["maestro", f, "check", input, "--source", ...extra], needs: input });
    // Flow の compile は既定で check も流す。ここでは check を別に流しているので、結果が2回出ないように止める
    steps.push({
      name: "compile",
      args: ["maestro", f, "compile", input, "-o", artifact, ...(f === "flow" ? ["--no-check"] : []), ...bindings, ...compileConnectors],
      needs: input,
      produces: artifact,
    });
  }
  const target = artifact;
  if (f === "bpmn") steps.push({ name: "format", args: ["maestro", "bpmn", "format", target], needs: target });
  // Case の compile は bindings_v2.json を作らないので、validate --strict の前に作る（ローカルだけ）
  if (f === "case") steps.push({ name: "bindings", args: ["maestro", "case", "bindings", "sync", target], needs: target });
  const strictFlag = f === "flow" ? ["--strict-expressions"] : f === "case" ? ["--strict"] : [];
  steps.push({ name: "validate", args: ["maestro", f, "validate", target, ...strictFlag], needs: target });
  return steps;
}

/** validate の箇条書きを分ける。"  - [review] CODE: 文" / "  - [error] [nodes[s].inputs.script] [CODE] 文" / "  - [(xml)] 文" */
export function parseIssueLines(text, defaultLevel = "warning") {
  if (typeof text !== "string") return [];
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*(?:\[(error|warning)\]\s*)?\[(.+?)\]\s+(.*)$/);
    if (!m) continue;
    const c = m[3].match(/^\[([A-Z][A-Z0-9_]+)\]\s*(.*)$/) ?? m[3].match(/^([A-Z][A-Z0-9_]+):\s*(.*)$/);
    out.push(withKnown({ level: m[1] ?? defaultLevel, code: c ? c[1] : null, where: m[2], message: c ? c[2] : m[3] }));
  }
  return out;
}

// SDK が compile した BPMN には必ず出る warning（script だけの例でも出る）。自分で直せないので数えず、note にする。
// 害が無いと確かめたわけではない（docs/maestro-verify.md）
const KNOWN_NOISE = [/^unknown attribute <type>$/];
function withKnown(d) {
  return KNOWN_NOISE.some((r) => r.test(d.message)) ? { ...d, level: "note" } : d;
}

/** uip の封筒（{ Result, Data, Message, Instructions }）から、そろえた診断を取り出す */
export function normalizeEnvelope(env) {
  const data = env?.Data ?? {};
  const diagnostics = [];
  for (const d of data.Diagnostics ?? []) {
    diagnostics.push({
      level: String(d.Level ?? "error").toLowerCase(),
      code: d.Code ?? null,
      where: d.Step ?? d.NodeId ?? d.Path ?? null,
      message: d.Message ?? "",
      ...(d.Suggestion ? { suggestion: d.Suggestion } : {}),
    });
  }
  // validate の Issues（Case）は Warnings の文字列と中身が同じ。コードが取れるので、こちらを優先する
  const issues = Array.isArray(data.Issues) ? data.Issues : [];
  for (const i of issues) {
    diagnostics.push(withKnown({
      level: String(i.Level ?? i.Severity ?? "warning").toLowerCase(),
      code: i.Code ?? null,
      where: i.Path ?? i.NodeId ?? null,
      message: i.Message ?? "",
    }));
  }
  if (!issues.length) diagnostics.push(...parseIssueLines(data.Warnings));
  // Flow の validate は、失敗の中身を Instructions に書く
  diagnostics.push(...(env?.Result === "Success" ? [] : parseIssueLines(env?.Instructions, "error")));
  // 失敗なのに error が無いときは、Message か Data の中の文を残す
  if (env?.Result !== "Success" && !diagnostics.some((d) => d.level === "error")) {
    diagnostics.push({ level: "error", code: env?.ErrorCode ?? null, where: null, message: data.Error ?? env?.Message ?? "失敗（詳細なし）" });
  }
  return diagnostics;
}

/** BPMN と Case の compile は check と同じ診断をもう一度出す。同じものを消す */
export function dropRepeated(diagnostics, seen) {
  const out = [];
  for (const d of diagnostics) {
    const key = `${d.level}|${d.code}|${d.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

/** 標準出力の中の JSON を取り出す。余計な行が前に付いていてもよい */
export function parseEnvelope(stdout) {
  const i = stdout.indexOf("{");
  if (i < 0) return null;
  try {
    return JSON.parse(stdout.slice(i));
  } catch {
    return null;
  }
}

/** 工程の結果をまとめて、ファイルの判定を出す */
export function judge(steps, strict) {
  const counts = { errors: 0, warnings: 0 };
  for (const s of steps) {
    for (const d of s.diagnostics ?? []) {
      if (d.level === "error") counts.errors++;
      else if (d.level === "warning") counts.warnings++;
    }
  }
  const failed = steps.some((s) => s.status === "ng");
  const ok = !failed && !(strict && counts.warnings > 0);
  return { ok, ...counts };
}

// ---- 実行 ----

export function findUip() {
  const candidates = [process.env.UIP_JS, join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js")];
  return candidates.find((c) => c && existsSync(c)) ?? null;
}

function runUip(uipJs, args, cwd = here) {
  const started = Date.now();
  // uip は呼び出し元のフォルダから SDK を探すので、cwd は tools/maestro
  const r = spawnSync(process.execPath, [uipJs, ...args, "--output", "json"], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const env = parseEnvelope(r.stdout ?? "");
  const ms = Date.now() - started;
  if (!env) {
    return { status: "ng", ms, diagnostics: [{ level: "error", code: "NO_RESULT", where: null, message: ((r.stderr ?? "") + (r.stdout ?? "")).trim().slice(0, 800) || "uip の結果が読めない" }] };
  }
  const diagnostics = normalizeEnvelope(env);
  const failed = r.status !== 0 || env.Result !== "Success";
  return { status: failed ? "ng" : diagnostics.some((d) => d.level === "warning") ? "warn" : "ok", ms, diagnostics, data: env.Data };
}

export function verifyFile(uipJs, input, outDir, opts = {}) {
  const abs = resolve(input);
  const info = classify(abs);
  if (!info) return { file: input, family: null, ok: false, errors: 1, warnings: 0, steps: [], message: "種類が分からない（.flow.ts / .bpmn.ts / .case.ts / .flow / .bpmn / .json）" };
  if (!existsSync(abs)) return { file: input, family: info.family, ok: false, errors: 1, warnings: 0, steps: [], message: "ファイルが無い" };
  const dir = join(outDir, `${info.name}.${info.family}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const artifact = join(dir, info.family === "case" ? "caseplan.json" : `${info.name}.${info.family}`);

  // BPMN の format はファイルを書き換える。渡されたものを変えないよう、成果物はコピーを検証する
  if (!info.source) copyFileSync(abs, artifact);
  const results = [];
  const seen = new Set();
  if (info.source) results.push({ name: "types", ...runTsc(abs, dir) });
  for (const step of planSteps(info, abs, artifact, opts)) {
    if (!existsSync(step.needs)) {
      results.push({ name: step.name, status: "skip", ms: 0, diagnostics: [], reason: "前の工程の成果物が無い" });
      continue;
    }
    const r = runUip(uipJs, step.args);
    // compile が失敗したのに古いものが残らないように、上で dir を消してある
    results.push({ name: step.name, ...r, diagnostics: dropRepeated(r.diagnostics, seen) });
  }
  const target = artifact;
  if (existsSync(target)) results.push({ name: "assign", ...checkAssign(info.family, target) });
  if (opts.tenant) {
    if (!existsSync(target)) results.push({ name: "tenant", status: "skip", ms: 0, diagnostics: [], reason: "前の工程の成果物が無い" });
    else results.push({ name: "tenant", ...checkTenant(uipJs, info.family, target) });
  }
  if (opts.pack) {
    // NG のものは pack しない。Flow の script の文法の間違いは pack を通ってしまうので、pack の OK を合格と読ませない
    if (!existsSync(target) || results.some((s) => s.status === "ng")) results.push({ name: "pack", status: "skip", ms: 0, diagnostics: [], reason: "前の工程が NG" });
    else results.push({ name: "pack", ...packArtifact(uipJs, info.family, target, dir) });
  }
  const j = judge(results, opts.strict);
  const steps = results.map(({ data, ...s }) => s);
  return { file: input, family: info.family, artifact: existsSync(artifact) ? artifact : null, ...j, steps };
}

// 割り当て先の無い人のタスク（AUT-1090）。未割り当てでも動くので error にしない。--strict では NG になる
function checkAssign(family, artifact) {
  const started = Date.now();
  let names;
  try {
    names = unassignedTasks(family, readFileSync(artifact, "utf8"));
  } catch {
    return { status: "skip", ms: Date.now() - started, diagnostics: [], reason: "成果物が読めない（validate の結果を見る）" };
  }
  const diagnostics = names.map((where) => ({ level: "warning", code: "TASK_UNASSIGNED", where, message: "人のタスクに割り当て先が無い。未割り当てで作られる（docs/task-assignment.md）" }));
  return { status: names.length ? "warn" : "ok", ms: Date.now() - started, diagnostics };
}

// テナントの一覧は、1回の実行で1度だけ読む
let tenantCache = null;
function readTenant(uipJs) {
  if (tenantCache) return tenantCache;
  const list = (args) => {
    const r = spawnSync(process.execPath, [uipJs, ...args, "--output", "json"], { cwd: here, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const env = parseEnvelope(r.stdout ?? "");
    if (r.status !== 0 || env?.Result !== "Success" || !Array.isArray(env.Data)) throw new Error(`${args.join(" ")}: ${env?.Message ?? "読めない"}`);
    if (env.Pagination?.HasMore) throw new Error(`${args.join(" ")}: 一覧が途中で切れた`);
    return env.Data;
  };
  tenantCache = {
    processes: list(["or", "processes", "list", "--all-folders", "--limit", "1000"]),
    apps: list(["solution", "resources", "list", "--kind", "App"]),
    connections: list(["is", "connections", "list", "--all-folders"]),
  };
  return tenantCache;
}

function checkTenant(uipJs, family, artifact) {
  const started = Date.now();
  let diagnostics;
  try {
    diagnostics = checkRefs(extractRefs(family, readFileSync(artifact, "utf8")), readTenant(uipJs));
  } catch (e) {
    // 読めないときに OK にしない
    return { status: "ng", ms: Date.now() - started, diagnostics: [{ level: "error", code: "TENANT_UNREADABLE", where: null, message: e.message }] };
  }
  const status = diagnostics.some((d) => d.level === "error") ? "ng" : diagnostics.length ? "warn" : "ok";
  return { status, ms: Date.now() - started, diagnostics };
}

// 成果物を init の雛形に入れて .nupkg を作る（ローカルだけ。アップロードしない）
function packArtifact(uipJs, family, artifact, dir) {
  const work = join(dir, "pack");
  mkdirSync(work, { recursive: true });
  const name = "Pkg";
  const init = runUip(uipJs, ["maestro", family, "init", name], work);
  if (init.status === "ng") return init;
  const project = join(work, `${name}Solution`, name);
  copyFileSync(artifact, join(project, family === "case" ? "caseplan.json" : `${name}.${family}`));
  // BPMN の entry-points.json は雛形の開始イベントを指しているので、作り直す
  if (family === "bpmn") {
    const refresh = runUip(uipJs, ["maestro", "bpmn", "refresh", project], work);
    if (refresh.status === "ng") return { ...refresh, data: undefined };
  }
  const r = runUip(uipJs, ["maestro", family, "pack", project, join(work, "nupkg")], work);
  return { ...r, data: undefined };
}

/** tsc の出力 "file(3,23): error TS2769: 文\n  続き" を診断にする */
export function parseTsc(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^.*?\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (m) out.push({ level: "error", code: m[3], where: `${m[1]}:${m[2]}`, message: m[4] });
    else if (line.trim() && out.length) out[out.length - 1].message += ` ${line.trim()}`;
  }
  return out;
}

// ソースがどこにあっても SDK の型が見つかるように、paths を書いた tsconfig を成果物のフォルダに作る
function runTsc(input, dir) {
  const started = Date.now();
  const tsc = join(here, "node_modules", "typescript", "bin", "tsc");
  const dist = join(here, "node_modules", "@uipath", "maestro-builder-sdk", "dist");
  const config = join(dir, "tsconfig.json");
  writeFileSync(config, JSON.stringify({
    compilerOptions: {
      target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true, types: [],
      paths: {
        "@uipath/maestro-builder-sdk": [join(dist, "index.d.ts")],
        "@uipath/maestro-builder-sdk/bpmn": [join(dist, "bpmn", "bpmn-sdk.d.ts")],
        "@uipath/maestro-builder-sdk/case": [join(dist, "case", "case-sdk.d.ts")],
      },
    },
    files: [input],
  }), "utf8");
  const r = spawnSync(process.execPath, [tsc, "--project", config], { cwd: here, encoding: "utf8" });
  const diagnostics = parseTsc(r.stdout ?? "");
  if (r.status !== 0 && !diagnostics.length) diagnostics.push({ level: "error", code: "NO_RESULT", where: null, message: ((r.stderr ?? "") + (r.stdout ?? "")).trim().slice(0, 800) || "tsc の結果が読めない" });
  return { status: r.status === 0 ? "ok" : "ng", ms: Date.now() - started, diagnostics };
}

function versions(uipJs) {
  const sdk = join(here, "node_modules", "@uipath", "maestro-builder-sdk", "package.json");
  const cli = join(dirname(dirname(uipJs)), "package.json");
  const read = (p) => { try { return JSON.parse(readFileSync(p, "utf8")).version ?? null; } catch { return null; } };
  return { uip: read(cli), sdk: read(sdk) };
}

function render(report) {
  const lines = [];
  const mark = { ok: "OK  ", warn: "warn", ng: "NG  ", skip: "skip" };
  for (const f of report.files) {
    lines.push(`${f.ok ? "OK" : "NG"}  ${f.file}  （error ${f.errors}、warning ${f.warnings}）`);
    if (f.message) lines.push(`    ${f.message}`);
    for (const s of f.steps) {
      lines.push(`    ${mark[s.status]} ${s.name}${s.reason ? `（${s.reason}）` : ""}`);
      for (const d of s.diagnostics) {
        const head = [d.code, d.where].filter(Boolean).join(" @ ");
        lines.push(`         ${d.level}: ${head ? `[${head}] ` : ""}${d.message.replace(/\s+/g, " ").slice(0, 300)}${d.suggestion ? `（候補: ${d.suggestion}）` : ""}`);
      }
    }
  }
  const s = report.summary;
  lines.push(`${s.ok ? "すべて OK" : "NG あり"}：${s.files} ファイル、NG ${s.failed}、error ${s.errors}、warning ${s.warnings}（uip ${report.versions.uip}、SDK ${report.versions.sdk}）`);
  return lines.join("\n");
}

export function main(argv) {
  const opts = { strict: false, json: false, out: join(root, "out", "maestro-verify"), workspace: null };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") opts.strict = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--pack") opts.pack = true;
    else if (a === "--tenant") opts.tenant = true;
    else if (a === "--out") opts.out = resolve(argv[++i] ?? "");
    else if (a === "--workspace") opts.workspace = resolve(argv[++i] ?? "");
    else if (a.startsWith("--")) { console.error(`知らないオプション: ${a}`); return 2; }
    else files.push(a);
  }
  if (!files.length) { console.error("使い方: node tools/maestro/verify.mjs [--out <dir>] [--strict] [--json] [--pack] [--tenant] [--workspace <dir>] <ファイル>..."); return 2; }
  const uipJs = findUip();
  if (!uipJs) { console.error("uip が見つからない（環境変数 UIP_JS か、npm の全体インストール）"); return 2; }
  if (!existsSync(join(here, "node_modules", "@uipath", "maestro-builder-sdk"))) { console.error("SDK が無い。cd tools/maestro && npm install --ignore-scripts"); return 2; }
  mkdirSync(opts.out, { recursive: true });

  const reports = files.map((f) => verifyFile(uipJs, f, opts.out, opts));
  const failed = reports.filter((r) => !r.ok).length;
  const report = {
    versions: versions(uipJs),
    strict: opts.strict,
    summary: { ok: failed === 0, files: reports.length, failed, errors: reports.reduce((n, r) => n + r.errors, 0), warnings: reports.reduce((n, r) => n + r.warnings, 0) },
    files: reports,
  };
  writeFileSync(join(opts.out, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  if (opts.json) { console.error(render(report)); console.log(JSON.stringify(report, null, 2)); }
  else console.log(render(report));
  return failed ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(main(process.argv.slice(2)));
