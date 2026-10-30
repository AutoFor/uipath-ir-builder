// サンプルを使った自動テスト。npm の依存なしで動く。
//
//   node --test tools/ir/*.test.ts
//   スナップショットを作り直す: UPDATE_SNAPSHOTS=1 node --test tools/ir/*.test.ts（PowerShell は $env:UPDATE_SNAPSHOTS=1）
//
// - samples/ir/**/*.json        … 検証が通ること。XAML を samples/generated/、C# を samples/generated-coded/ のスナップショットと比べる。
//                                  生成した C# がチェッカーを通ること（対応表が「Coded API なし」のものは C# を作らない）
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
import { loadCatalog } from "./catalog.ts";
import { validate } from "./validate.ts";
import { generate } from "./generate.ts";
import { generateCoded } from "./generate-coded.ts";
import { loadMappings } from "./mapping.ts";
import { checkSource, loadContext } from "../coded/check.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const update = !!process.env.UPDATE_SNAPSHOTS;
const cat = loadCatalog(root, [
  "catalog/System.Activities/6.0.0.json",
  "catalog/UiPath.System.Activities/26.10.0.json",
  "catalog/UiPath.UIAutomation.Activities/26.10.6.json",
]);
const { maps, errors: mapErrors } = loadMappings(root);
const ctx = loadContext();
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

// 実行ごとに変わる値（IdRef の番号は決まるが、get-default-xaml 由来の GUID は毎回変わる）
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

for (const f of files("samples/ir", ".json")) {
  const sub = dirname(relative(join(root, "samples", "ir"), f));
  test(`IR ${rel(f)}`, () => {
    const wf: Workflow = JSON.parse(read(f));
    assert.deepEqual(validate(wf, cat), [], "検証で弾かれた");
    snapshot(join(root, "samples", "generated", sub, `${wf.workflow}.xaml`), generate(wf, cat));

    const r = generateCoded(wf, cat, maps, { namespace: "CatalogProbeNet8", invokePath: (p) => p.replace(/^(.*?)([^\\/]+)\.xaml$/i, "coded/$2.cs") });
    if (r.issues.length && r.issues.every((i) => i.code === "NO_CODED_API")) return; // 「Coded API なし」
    assert.deepEqual(r.issues, [], "C# を生成できない");
    snapshot(join(root, "samples", "generated-coded", sub, `${wf.workflow}.cs`), r.code);
    const chk = checkSource(r.code, `${wf.workflow}.cs`, ctx);
    assert.deepEqual(chk.issues.filter((i) => i.severity === "error"), [], "生成した C# がチェッカーを通らない");
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
