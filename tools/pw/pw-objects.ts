// <P>/ir/repository.json（オブジェクトリポジトリの正本）から、Playwright 用の <P>/pw/objects/index.ts を作る（AUT-1219）。
// UiPath の .objects（objrepo.ts build）と並ぶもの。どちらも repository.json から作り、手で直さない。
//
//   node tools/pw/pw-objects.ts build --project <P> [--out <dir>]     既定の <dir> は <P>/pw
//
// <dir> に作るもの：
//   objects/index.ts   export default defineObjects({ アプリ: { 画面: { url, urlPattern, elements: { 要素: { "ja-JP": (p) => …, "*": (p) => … } } } } })
//   objects/index.md   変換できなかった要素の一覧（無ければ作らない）
//   lib/runtime.ts、lib/objects.ts   tools/pw の写し（スクリプトの import を ./lib/… と短くするため）
//   package.json       { "type": "module" }
//   node_modules       tools/pw/node_modules へのつなぎ（ジャンクション。playwright-core をここで読めるように）。あれば触らない
//
// 要素の locator は target のセレクターから作る（selector.ts）。repository.json の要素に locales（ロケールごとのセレクター）があれば、
// そのロケールでは言語ごとの値で探し、それ以外（"*"）は target（両方の言語に当たる正規表現）で探す。
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Repository } from "../ir/objrepo.ts";
import { selectorToLocator, targetToLocator, urlGlob } from "./selector.ts";

export type ObjectsUnconverted = { path: string; why: string };
const here = dirname(fileURLToPath(import.meta.url));
const litOf = (v: unknown): string | undefined => (typeof v === "object" && v && "lit" in v ? (v as { lit: string }).lit : undefined);
const js = (s: string) => JSON.stringify(s);

export function objectsSource(repo: Repository, opt: { libImport?: string } = {}): { code: string; unconverted: ObjectsUnconverted[] } {
  const unconverted: ObjectsUnconverted[] = [];
  const out: string[] = [
    "// tools/pw/pw-objects.ts で ir/repository.json から生成。手で直さず repository.json を直す（UiPath の .objects と同じ正本）",
    `import { defineObjects } from ${js(opt.libImport ?? "../lib/objects.ts")};`,
    "",
    "export default defineObjects({",
  ];
  for (const app of repo.apps) {
    out.push(`  ${js(app.name)}: {`);
    for (const sc of app.screens ?? []) {
      const t = sc.target as Record<string, unknown>;
      const url = litOf(t.Url);
      const pattern = litOf(t.Selector)?.match(/url='([^']*)'/)?.[1];
      out.push(`    ${js(sc.name)}: {`);
      if (url) out.push(`      url: ${js(url)},`);
      if (pattern) out.push(`      urlPattern: ${js(urlGlob(pattern))},`);
      out.push("      elements: {");
      for (const el of sc.elements ?? []) {
        const path = `${app.name}/${sc.name}/${el.name}`;
        const main = targetToLocator(el.target as Record<string, unknown>, "p");
        const fns: [string, string][] = [];
        for (const [loc, sel] of Object.entries(el.locales ?? {})) {
          const r = selectorToLocator(sel, "p");
          if ("ts" in r) fns.push([loc, r.ts]);
          else unconverted.push({ path: `${path}（${loc}）`, why: r.why });
        }
        if ("ts" in main) fns.push(["*", main.ts]);
        else {
          unconverted.push({ path, why: main.why });
          fns.push(["*", `(() => { throw new Error(${js(`変換できない要素 ${path}: ${main.why}`)}); })()`]);
        }
        if ("ts" in main) for (const n of main.notes) unconverted.push({ path, why: n });
        out.push(`        ${js(el.name)}: { ${fns.map(([k, v]) => `${js(k)}: (p) => ${v}`).join(", ")} },`);
      }
      out.push("      },", "    },");
    }
    out.push("  },");
  }
  out.push("});", "");
  return { code: out.join("\n"), unconverted };
}

// スクリプトを置くフォルダを用意する（lib の写し、package.json、node_modules のつなぎ）
export function setupPwDir(dir: string) {
  mkdirSync(join(dir, "lib"), { recursive: true });
  for (const f of ["runtime.ts", "objects.ts"]) {
    const src = readFileSync(join(here, f), "utf8");
    writeFileSync(join(dir, "lib", f), `// tools/pw/${f} の写し（tools/pw/pw-objects.ts が書く。手で直さない）\n${src}`);
  }
  const pkg = join(dir, "package.json");
  if (!existsSync(pkg)) writeFileSync(pkg, JSON.stringify({ private: true, type: "module", description: "tools/pw/pw-objects.ts が作った。Playwright のスクリプト（*.pw.ts）と objects" }, null, 2) + "\n");
  const nm = join(dir, "node_modules");
  const target = join(here, "node_modules");
  if (!existsSync(nm)) {
    if (!existsSync(target)) throw new Error(`${target} が無い。先に cd tools/pw && npm install`);
    symlinkSync(target, nm, "junction");
  }
}

export function buildPwObjects(project: string, outDir = join(project, "pw")) {
  const repoFile = join(project, "ir", "repository.json");
  if (!existsSync(repoFile)) throw new Error(`${repoFile} が無い`);
  const repo = JSON.parse(readFileSync(repoFile, "utf8").replace(/^﻿/, "")) as Repository;
  setupPwDir(outDir);
  const { code, unconverted } = objectsSource(repo);
  mkdirSync(join(outDir, "objects"), { recursive: true });
  writeFileSync(join(outDir, "objects", "index.ts"), code);
  const md = join(outDir, "objects", "index.md");
  if (unconverted.length) writeFileSync(md, ["# pw/objects：変換できなかった・意味が変わる要素", "", ...unconverted.map((u) => `- ${u.path}：${u.why}`), ""].join("\n"));
  else if (existsSync(md)) rmSync(md);
  return { file: join(outDir, "objects", "index.ts"), unconverted };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const val = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const project = val("--project");
  if (argv[0] !== "build" || !project) {
    console.error("使い方: node tools/pw/pw-objects.ts build --project <P> [--out <dir>]");
    process.exit(2);
  }
  const r = buildPwObjects(project, val("--out"));
  console.log(`OK ${r.file}${r.unconverted.length ? `（変換できなかった・意味が変わる要素 ${r.unconverted.length} 件 → index.md）` : ""}`);
  for (const u of r.unconverted) console.log(`  ${u.path}: ${u.why}`);
}
