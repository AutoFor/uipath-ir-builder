// サンプルを使った自動テスト。npm の依存なしで動く。
//
//   node --test tools/ir/*.test.ts
//   スナップショットを作り直す: UPDATE_SNAPSHOTS=1 node --test tools/ir/*.test.ts（PowerShell は $env:UPDATE_SNAPSHOTS=1）
//
// - samples/ir/**/*.json        … 検証が通ること。XAML を samples/generated/、C# を samples/generated-coded/ のスナップショットと比べる。
//                                  生成した C# がチェッカーを通ること（対応表が「Coded API なし」のものは C# を作らない）
// - samples/ir/**/*.json と samples/ir-csharp/*.json … 式の言語が C# の XAML も作れること（VB の式を C# に直せること、[...] が残らないこと）。
//                                  一部（samples/ir/ 直下と samples/ir-csharp/）は samples/generated-csharp/ のスナップショットと比べる
// - samples/ir-unbuildable/**/*.json … 検証が通り XAML を生成できること（build を通らないので build しない。スナップショットもなし。理由は横の verify.json）
// - samples/ir-invalid/*.json   … 横の *.expected.json の codes と、検証のエラーコードが一致すること
// - samples/ir-invalid-coded/*.json … 検証は通り、C# の生成で expected.json の codes が出ること
// - samples/coded/**/*.cs       … チェッカーでエラーが無いこと
// - samples/coded-invalid/*.cs  … チェッカーの結果（エラーと警告）のコードが expected.json と一致すること
// - mappings/**/*.json          … 読めて、activity がカタログにあること

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog, type Catalog } from "./catalog.ts";
import { validate } from "./validate.ts";
import { hasSuspending } from "./persistence.ts";
import { generate, generateChecked } from "./generate.ts";
import { generateCoded } from "./generate-coded.ts";
import { loadMappings } from "./mapping.ts";
import { checkSource, loadContext } from "../coded/check.ts";
import { DEFAULT_CATALOG_FILES, noCodedApiPackages, sampleCatalogFiles } from "./versions.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const update = !!process.env.UPDATE_SNAPSHOTS;
// スナップショットは既定の版のもの。既定の版に無いパッケージのサンプル（samples/ir/<pkg>/）は、既定の版にそのパッケージの最新のカタログを足したもの。
// loadCatalog は UI のターゲットの型（objectTypes）を覚え直すので、足したカタログを先に読み、最後に既定の版を読み直す
const pkgCats = new Map<string, { cat: Catalog; noApi: string[] }>();
for (const base of ["ir", "ir-unbuildable"])
  for (const d of existsSync(join(root, "samples", base)) ? readdirSync(join(root, "samples", base)) : []) {
    const fs = sampleCatalogFiles(root, d);
    if (fs !== DEFAULT_CATALOG_FILES && !pkgCats.has(d)) pkgCats.set(d, { cat: loadCatalog(root, fs), noApi: noCodedApiPackages(root, fs) });
  }
const cat = loadCatalog(root, DEFAULT_CATALOG_FILES);
const noApi = noCodedApiPackages(root, DEFAULT_CATALOG_FILES);
const catOf = (f: string, base = "ir") => pkgCats.get(relative(join(root, "samples", base), f).split(/[\\/]/)[0]) ?? { cat, noApi };
// 対応表の無いアクティビティは XAML 経由（coded/_xaml/）。対応表のある既存のサンプルの C# は、これで変わらない
const viaXaml = (n: string[]) => ({ dir: "coded/_xaml", noApi: n });
const { maps, errors: mapErrors } = loadMappings(root);
const ctx = loadContext();
// 横に置く JSON も読めること（不正な JSON で verify.mjs が落ちるのを防ぐ）
const sidecarJson = (dir: string): string[] => {
  const d = join(root, dir);
  if (!existsSync(d)) return [];
  const out: string[] = [];
  const walk = (p: string) => {
    for (const e of readdirSync(p).sort()) {
      const q = join(p, e);
      if (statSync(q).isDirectory()) walk(q);
      else if (/\.(verify|expected)\.json$/i.test(e)) out.push(q);
    }
  };
  walk(d);
  return out;
};
const isSidecar = (f: string) => /\.(verify|expected|args)\.json$/i.test(f);
const read = (f: string) => readFileSync(f, "utf8").replace(/^﻿/, "");
const rel = (f: string) => relative(root, f).replaceAll("\\", "/");

function files(dir: string, ext: string): string[] {
  const d = join(root, dir);
  if (!existsSync(d)) return [];
  const out: string[] = [];
  const walk = (p: string) => {
    for (const e of readdirSync(p).sort()) {
      const q = join(p, e);
      if (statSync(q).isDirectory()) walk(q);
      else if (e.endsWith(ext) && !isSidecar(e)) out.push(q);
    }
  };
  walk(d);
  return out;
}

// GUID は決定的に作る（ワークフロー名と通し番号）。ほかのブランチの古いスナップショットとも比べられるよう、比較では GUID を無視する
const normalize = (s: string) => s.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<guid>");

function snapshot(path: string, actual: string) {
  if (update || !existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, (path.endsWith(".xaml") ? "﻿" : "") + actual, "utf8");
    return;
  }
  assert.equal(normalize(actual), normalize(read(path)), `${rel(path)} とスナップショットが違う。意図した変更なら UPDATE_SNAPSHOTS=1 で作り直す`);
}

const codes = (expectedJson: string) => (JSON.parse(read(expectedJson)).codes as string[]).slice().sort();

test("対応表が読めて、カタログにあるアクティビティを指している", () => {
  assert.deepEqual(mapErrors, []);
  for (const m of maps.values())
    assert.ok(cat.activities.some((a) => a.className === m.activity && a.package === m.package), `${m.file}: ${m.package} に ${m.activity} が無い`);
});

for (const dir of ["samples/ir", "samples/ir-csharp", "samples/ir-unbuildable", "samples/ir-invalid", "samples/ir-invalid-coded", "samples/coded-invalid"])
  for (const f of sidecarJson(dir))
    test(`JSON ${rel(f)}`, () => { JSON.parse(read(f)); });

for (const f of files("samples/ir", ".json")) {
  const sub = dirname(relative(join(root, "samples", "ir"), f));
  test(`IR ${rel(f)}`, () => {
    const wf: Workflow = JSON.parse(read(f));
    const { cat, noApi } = catOf(f);
    assert.deepEqual(validate(wf, cat), [], "検証で弾かれた");
    if (hasSuspending(wf)) {
      const side = f.replace(/\.json$/, ".verify.json");
      assert.ok(existsSync(side) && JSON.parse(read(side)).entryPoint === true, "中断するアクティビティがあるので verify.json に entryPoint: true が要る（ST-DBP-024）");
    }
    snapshot(join(root, "samples", "generated", sub, `${wf.workflow}.xaml`), generate(wf, cat));

    const r = generateCoded(wf, cat, maps, { namespace: "CatalogProbeNet8", invokePath: (p) => p.replace(/^(.*?)([^\\/]+)\.xaml$/i, "coded/$2.cs"), viaXaml: viaXaml(noApi) });
    if (r.issues.length && r.issues.every((i) => i.code === "NO_CODED_API")) return; // 「Coded API なし」
    assert.deepEqual(r.issues, [], "C# を生成できない");
    assert.equal(r.warnings.filter((w) => w.code === "CODED_VIA_XAML").length, r.xamls.length, "XAML 経由のものは、1つずつ注意を出す");
    snapshot(join(root, "samples", "generated-coded", sub, `${wf.workflow}.cs`), r.code);
    // XAML 経由の XAML も、C# の横の _xaml/ にスナップショットを置く
    for (const x of r.xamls) snapshot(join(root, "samples", "generated-coded", sub, "_xaml", `${x.wf.workflow}.xaml`), generate(x.wf, cat));
    const chk = checkSource(r.code, `${wf.workflow}.cs`, ctx);
    assert.deepEqual(chk.issues.filter((i) => i.severity === "error"), [], "生成した C# がチェッカーを通らない");
  });
}

// 式の言語が C# の XAML。直せない式（名前付き引数など）があるものは CS_EXPR、C# の予約語の変数名は CS_NAME になる。そのうち C# でも試すものは、両方を書いた版を samples/ir-csharp/ に置く
const csExprErrors: Record<string, string[]> = {
  "samples/ir/VbExpressions.json": ["CS_EXPR"], // 名前付き引数
  // 変数名 out（C# の予約語）
  "samples/ir/UiPath.System.Activities/ModifyText.full.json": ["CS_EXPR", "CS_NAME"],
  "samples/ir/UiPath.System.Activities/ModifyText.min.json": ["CS_EXPR", "CS_NAME"],
  "samples/ir/UiPath.System.Activities/ToUpperLowerTextModification.min.json": ["CS_EXPR", "CS_NAME"],
};
const csSnapshot = (f: string) => /^samples\/ir\/[^/]+$/.test(rel(f)) || rel(f).startsWith("samples/ir-csharp/");
for (const f of [...files("samples/ir", ".json"), ...files("samples/ir-csharp", ".json")]) {
  test(`C# の XAML ${rel(f)}`, () => {
    const wf: Workflow = JSON.parse(read(f));
    const { cat } = catOf(f);
    if (rel(f).startsWith("samples/ir-csharp/")) assert.deepEqual(validate(wf, cat), [], "検証で弾かれた");
    const r = generateChecked(wf, cat, { language: "CSharp" });
    assert.deepEqual(r.issues.map((i) => i.code).sort(), csExprErrors[rel(f)] ?? [], "C# の式に直せない");
    if (r.issues.length) return;
    assert.match(r.xaml, /^<Activity mc:Ignorable="sap sap2010" x:Class="\w+" sap2010:ExpressionActivityEditor\.ExpressionActivityEditor="C#"\r\n/, "ルートに ExpressionActivityEditor=\"C#\" が無い");
    assert.doesNotMatch(r.xaml, /mva:|VisualBasic\.Settings|VisualBasicValue|VisualBasicReference/, "VB の設定や式が残っている");
    assert.doesNotMatch(r.xaml, /="\[[^"]*\]"|>\[[^<]*\]</, "[式]（VB の略記）が残っている");
    if (csSnapshot(f)) snapshot(join(root, "samples", "generated-csharp", `${wf.workflow}.xaml`), r.xaml);
  });
}

for (const f of files("samples/ir-unbuildable", ".json")) {
  test(`IR（build できない）${rel(f)}`, () => {
    const wf: Workflow = JSON.parse(read(f));
    const { cat } = catOf(f, "ir-unbuildable");
    assert.deepEqual(validate(wf, cat), [], "検証で弾かれた");
    assert.ok(generate(wf, cat).includes(`x:Class="${wf.workflow}"`));
    const side = f.replace(/\.json$/, ".verify.json");
    assert.ok(existsSync(side) && JSON.parse(read(side)).unbuildable, "verify.json の unbuildable に理由を書く");
  });
}

for (const f of files("samples/ir-invalid", ".json")) {
  test(`IR（不正）${rel(f)}`, () => {
    const exp = f.replace(/\.json$/, ".expected.json");
    assert.ok(existsSync(exp), `${rel(exp)} が無い`);
    const got = validate(JSON.parse(read(f)), cat).map((i) => i.code).sort();
    assert.deepEqual(got, codes(exp));
  });
}

for (const f of files("samples/ir-invalid-coded", ".json")) {
  test(`IR（C# にできない）${rel(f)}`, () => {
    const exp = f.replace(/\.json$/, ".expected.json");
    assert.ok(existsSync(exp), `${rel(exp)} が無い`);
    const wf: Workflow = JSON.parse(read(f));
    assert.deepEqual(validate(wf, cat), [], "XAML 側の検証は通るはず");
    const got = generateCoded(wf, cat, maps, { namespace: "CatalogProbeNet8" }).issues.map((i) => i.code).sort();
    assert.deepEqual(got, codes(exp));
  });
}

for (const f of files("samples/coded", ".cs")) {
  test(`Coded ${rel(f)}`, () => {
    const r = checkSource(read(f), f, ctx);
    assert.deepEqual(r.issues.filter((i) => i.severity === "error"), []);
  });
}

for (const f of files("samples/coded-invalid", ".cs")) {
  test(`Coded（不正）${rel(f)}`, () => {
    const exp = f.replace(/\.cs$/, ".expected.json");
    assert.ok(existsSync(exp), `${rel(exp)} が無い`);
    const got = checkSource(read(f), basename(f), ctx).issues.map((i) => i.code).sort();
    assert.deepEqual(got, codes(exp));
  });
}
