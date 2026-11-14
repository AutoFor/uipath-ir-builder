// API ワークフローの Evaluations（evals/<scope>/eval-sets/*.json）を CLI で流し、Studio Web の Evaluations パネルと同じ判定をする。
//   - 1 件ずつ uip api-workflow run を流し、デバッグのログの「Response task evaluated successfully for …」から Response の生の値を取る
//     （CLI の Data はキーが PascalCase になるので比べない。uipath-exact-match はキーの大文字小文字まで見る）
//   - 評価器（evaluators/*.json。参照はファイル名）の targetOutputKey で、厳密に等しいかを見る（キーの順は見ない。真偽と数は区別）
//   - 値が配列や数だけのときは { result: 値 } として比べる
// 使い方:
//   node tools/apiwf/evals.mjs <プロジェクト> [--auth]     # --auth なしは --no-auth（コネクタとファイルは --auth）
// 終了コード: 0 = 全部 PASS、1 = FAIL か ERROR がある、2 = 使い方の間違い・評価の行が無い
// 出典：uipath-api-workflow スキルの references/testing-and-evals.md。knowledge/api-workflow.md

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");
const LINE = /Response task evaluated successfully for "[^"]*": (\{.*\})\s*$/;

/** lodash の isEqual と同じ考え方（JSON の値。キーの順は見ない、真偽と数は別） */
export function deepEqual(a, e) {
  if (typeof a === "boolean" || typeof e === "boolean") return typeof a === "boolean" && typeof e === "boolean" && a === e;
  if (Array.isArray(a) || Array.isArray(e)) return Array.isArray(a) && Array.isArray(e) && a.length === e.length && a.every((x, i) => deepEqual(x, e[i]));
  if (a && e && typeof a === "object" && typeof e === "object") {
    const ka = Object.keys(a).sort(), ke = Object.keys(e).sort();
    return ka.length === ke.length && ka.every((k, i) => k === ke[i] && deepEqual(a[k], e[k]));
  }
  return a === e;
}

const MISSING = Symbol("missing");
function at(v, path) {
  for (const seg of path.split(".").filter(Boolean)) {
    if (!v || typeof v !== "object" || !(seg in v)) return MISSING;
    v = v[seg];
  }
  return v;
}

/** targetOutputKey（"*"、"a.b"、配列）で比べる。両方に無い道は不合格 */
export function matches(actual, expected, target = "*") {
  if (Array.isArray(target)) return target.length > 0 && target.every((t) => matches(actual, expected, t));
  if (typeof target === "string" && target !== "" && target !== "*") {
    const a = at(actual, target), e = at(expected, target);
    return a !== MISSING && e !== MISSING && deepEqual(a, e);
  }
  return deepEqual(actual, expected);
}

/** デバッグのログから Response の生の値（最後のもの）を取る。オブジェクトでなければ { result } に包む */
export function rawResponse(logText) {
  let raw;
  for (const line of logText.split(/\r?\n/)) {
    const m = line.match(LINE);
    if (m) raw = JSON.parse(m[1]).response;
  }
  if (raw === undefined) return undefined;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : { result: raw };
}

function runRow(workflow, inputs, auth) {
  const log = join(mkdtempSync(join(tmpdir(), "apiwf-eval-")), "run.log");
  const args = [uipJs, "api-workflow", "run", workflow, "--input-arguments", JSON.stringify(inputs ?? {}), "--output", "json", "--log-level", "debug", "--log-file", log];
  if (!auth) args.push("--no-auth");
  const r = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 64 << 20, timeout: 180000 });
  const out = r.stdout ?? "";
  let env;
  try { env = JSON.parse(out.slice(out.lastIndexOf("\n{") + 1 || out.indexOf("{"))); } catch { return { error: `CLI の出力が JSON でない: ${out.slice(0, 200)}` }; }
  if (env.Result !== "Success") return { error: `run が失敗: ${env.Message ?? ""}` };
  const raw = existsSync(log) ? rawResponse(readFileSync(log, "utf8")) : undefined;
  return raw === undefined ? { error: "ログに Response の値が無い" } : { actual: raw };
}

function main() {
  const args = process.argv.slice(2);
  const auth = args.includes("--auth");
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) { console.error("使い方: node tools/apiwf/evals.mjs <プロジェクト> [--auth]"); process.exit(2); }
  const project = resolve(dir);
  const workflow = join(project, "Workflow.json");
  const evalsDir = join(project, "evals");
  if (!existsSync(evalsDir)) { console.error(`${evalsDir} が無い（Evaluations が使われていない）`); process.exit(2); }
  let n = 0, ok = true;
  for (const scope of readdirSync(evalsDir)) {
    const evDir = join(evalsDir, scope, "evaluators"), setDir = join(evalsDir, scope, "eval-sets");
    const evaluators = existsSync(evDir) ? Object.fromEntries(readdirSync(evDir).filter((f) => f.endsWith(".json")).map((f) => [basename(f, ".json"), JSON.parse(readFileSync(join(evDir, f), "utf8"))])) : {};
    for (const f of existsSync(setDir) ? readdirSync(setDir).filter((x) => x.endsWith(".json")).sort() : []) {
      const set = JSON.parse(readFileSync(join(setDir, f), "utf8"));
      for (const row of set.evaluations ?? []) {
        const run = runRow(workflow, row.inputs, auth);
        for (const ref of set.evaluatorRefs ?? []) {
          n++;
          const ev = evaluators[ref], crit = row.evaluationCriterias?.[ref];
          let verdict, detail;
          if (!ev || ev.evaluatorTypeId !== "uipath-exact-match") [verdict, detail] = ["ERROR", `評価器 ${ref} が無いか uipath-exact-match でない（参照はファイル名）`];
          else if (!crit || !("expectedOutput" in crit)) [verdict, detail] = ["ERROR", `evaluationCriterias["${ref}"].expectedOutput が無い`];
          else if (run.error) [verdict, detail] = ["ERROR", run.error];
          else {
            const exp = typeof crit.expectedOutput === "string" ? JSON.parse(crit.expectedOutput) : crit.expectedOutput;
            verdict = matches(run.actual, exp, ev.evaluatorConfig?.targetOutputKey ?? "*") ? "PASS" : "FAIL";
            detail = verdict === "PASS" ? JSON.stringify(run.actual) : `実際=${JSON.stringify(run.actual)} 期待=${JSON.stringify(exp)}`;
          }
          ok &&= verdict === "PASS";
          console.log(`[${verdict.padEnd(5)}] ${f} :: ${row.name ?? row.id}  ${detail}`);
        }
      }
    }
  }
  if (!n) { console.error("評価の行が無い"); process.exit(2); }
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]).endsWith("evals.mjs")) main();
