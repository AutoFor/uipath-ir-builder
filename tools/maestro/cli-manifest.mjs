// uip の CLI（@uipath/maestro-tool）が持っている Flow のノードの定義（manifest）を取り出す（AUT-1211）。
// テナントの登録簿が出さないノード（「not enabled for this tenant」。キューのノードなど）を rawNode で書くときに使う。
// CLI はノードの定義を bundle の中の変数（<ノードの型の . と - を _ にしたもの>_exports）に持ち、外に出していない。
// bundle を一時フォルダに写し、その変数を export する 1 行を足し、相対の import を元の場所に向けて読み込む。
//
// 使い方:
//   node tools/maestro/cli-manifest.mjs <ノードの型> [--version <版>]     # 例: core.action.queue.delete-items
// 標準出力に定義の JSON を書く（--version が無ければ latest）。終了コード: 0 = 取れた、1 = 無い、2 = 使い方の間違い

import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** ノードの型から、bundle の中の変数の名前を作る */
export function exportsName(nodeType) {
  return `${nodeType.replace(/[.-]/g, "_")}_exports`;
}

/** bundle の相対の import を、元のフォルダの file URL に向ける */
export function rewriteImports(text, distUrl) {
  return text.replace(/(\bimport\s*|\bfrom\s*|\bimport\()(["'])\.\//g, (_, kw, q) => `${kw}${q}${distUrl}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const nodeType = argv.find((a) => !a.startsWith("--"));
  const vi = argv.indexOf("--version");
  const version = vi >= 0 ? argv[vi + 1] : undefined;
  if (!nodeType) { console.error("使い方: node tools/maestro/cli-manifest.mjs <ノードの型> [--version <版>]"); process.exit(2); }
  const dist = process.env.UIP_MAESTRO_TOOL_DIST ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "maestro-tool", "dist");
  const name = exportsName(nodeType);
  const file = readdirSync(dist).filter((f) => f.endsWith(".js")).find((f) => readFileSync(join(dist, f), "utf8").includes(`var ${name} = {}`));
  if (!file) { console.error(`${nodeType} の定義が CLI に無い（${dist}）`); process.exit(1); }
  const work = mkdtempSync(join(tmpdir(), "cli-manifest-"));
  const copy = join(work, "bundle.mjs");
  const distUrl = pathToFileURL(resolve(dist)).href + "/";
  writeFileSync(copy, rewriteImports(readFileSync(join(dist, file), "utf8"), distUrl) + `\nexport { ${name} as __manifest };\n`);
  const m = (await import(pathToFileURL(copy).href)).__manifest;
  const def = version ? m.allVersions.find((d) => d.version === version) : m.latest;
  if (!def) { console.error(`${nodeType} の版 ${version} が無い（${m.allVersions.map((d) => d.version).join(", ")}）`); process.exit(1); }
  console.log(JSON.stringify(def, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]).endsWith("cli-manifest.mjs")) main();
