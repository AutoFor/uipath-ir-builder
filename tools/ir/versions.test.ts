// カタログの版の選択、版ごとの既定 XAML、ルートの imports のテスト（AUT-612）。
// 作業用のプロジェクトは out/test-versions/ に作る。

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.ts";
import { generate } from "./generate.ts";
import { CATALOG_FILES } from "./import-xaml.ts";
import { DEFAULT_CATALOG_FILES, DEFAULT_SERVICE_FILES, DEFAULT_VERSIONS, VersionError, loadSelected, parseDependencyVersion, projectRootImports, readRootImports, selectCatalogs } from "./versions.ts";
import { loadContext } from "../coded/check.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
mkdirSync(join(root, "out", "test-versions"), { recursive: true });
const work = mkdtempSync(join(root, "out", "test-versions", "t-"));
after(() => rmSync(work, { recursive: true, force: true }));

let n = 0;
function project(dependencies: Record<string, string>, extra: Record<string, unknown> = {}) {
  const d = join(work, `p${n++}`);
  mkdirSync(d);
  writeFileSync(join(d, "project.json"), JSON.stringify({ name: "My Proj", main: "Main.xaml", dependencies, ...extra }));
  return d;
}
const current = { "UiPath.System.Activities": "[26.10.0]", "UiPath.UIAutomation.Activities": "[26.10.6]", "UiPath.Excel.Activities": "[3.6.1]", "UiPath.Persistence.Activities": "[1.13.0]" };
const greet = join(root, "samples", "ir", "Greet.json");
const node = (...args: string[]) => spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
const gen = join(root, "tools", "ir", "gen.ts");
const genCoded = join(root, "tools", "ir", "gen-coded.ts");

test("一覧は1か所：import-xaml.ts の一覧も既定と同じ", () => {
  assert.deepEqual(CATALOG_FILES, DEFAULT_CATALOG_FILES);
});

test("版の書き方：[x] と x は読み、範囲はエラー", () => {
  assert.equal(parseDependencyVersion("P", "[26.10.0]"), "26.10.0");
  assert.equal(parseDependencyVersion("P", "26.10.0"), "26.10.0");
  assert.equal(parseDependencyVersion("P", "[26.10.0-preview]"), "26.10.0-preview");
  for (const s of ["[1.0,2.0)", "[1.0,2.0]", "(1.0,)", "[1.0"]) assert.throws(() => parseDependencyVersion("P", s), VersionError, s);
});

test("指定がなければ既定の版", () => {
  const s = selectCatalogs(root);
  assert.deepEqual(s.files, DEFAULT_CATALOG_FILES);
  assert.deepEqual(s.serviceFiles, DEFAULT_SERVICE_FILES);
  assert.deepEqual(s.warnings, []);
});

test("既定と同じ版のプロジェクトなら、既定と同じカタログで警告なし", () => {
  const s = selectCatalogs(root, project(current));
  assert.deepEqual(s.files, DEFAULT_CATALOG_FILES);
  assert.deepEqual([...s.serviceFiles].sort(), [...DEFAULT_SERVICE_FILES].sort());
  assert.deepEqual(s.warnings, []);
});

test("カタログに無い版はエラーで、近い版を使わない", () => {
  const p = project({ ...current, "UiPath.System.Activities": "[26.10.1]", "UiPath.Excel.Activities": "[9.9.9]" });
  assert.throws(() => selectCatalogs(root, p), (e: Error) => {
    assert.ok(e instanceof VersionError);
    assert.match(e.message, /UiPath\.System\.Activities 26\.10\.1 のカタログが無い/);
    assert.match(e.message, /26\.10\.0/); // 手元の版を示す
    assert.match(e.message, /UiPath\.Excel\.Activities 9\.9\.9/); // 全部まとめて出す
    return true;
  });
  const r = node(gen, greet, "--check", "--project", p);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /のカタログが無い/);
});

test("カタログの無いパッケージは注意、project.json が無ければエラー", () => {
  const s = selectCatalogs(root, project({ ...current, "UiPath.Mail.Activities": "[2.12.10]" }));
  assert.equal(s.warnings.length, 1);
  assert.match(s.warnings[0], /UiPath\.Mail\.Activities のカタログが無い/);
  assert.throws(() => selectCatalogs(root, join(work, "none")), VersionError);
});

test("依存に無いパッケージのカタログは読まない", () => {
  const s = selectCatalogs(root, project({ "UiPath.System.Activities": "[26.10.0]" }));
  assert.deepEqual(s.files, ["catalog/System.Activities/6.0.0.json", "catalog/UiPath.System.Activities/26.10.0.json"]);
});

test("古い版：XAML は注意付きで作れ、C# ははっきりエラー", () => {
  const p = project({ "UiPath.System.Activities": "[26.2.6]" });
  const r = node(gen, greet, "--check", "--project", p);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /readOnly/);
  assert.match(r.stderr, /objects\.json が無い/);
  assert.match(r.stderr, /既定 XAML は \d+ 件/);
  const c = node(genCoded, greet, "--check", "--project", p);
  assert.equal(c.status, 2);
  assert.match(c.stderr, /services（Coded API）が無く/);
  assert.throws(() => loadContext(p), VersionError); // チェッカーも同じ
});

test("古い版の UI：objs のターゲットは検証で弾かれ、例外で落ちない", () => {
  const p = project({ "UiPath.System.Activities": "[26.10.0]", "UiPath.UIAutomation.Activities": "[25.10.33]" });
  const r = node(gen, join(root, "samples", "ir", "UiPath.UIAutomation.Activities", "NTypeInto.min.json"), "--check", "--project", p);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^NG /m);
  assert.doesNotMatch(r.stderr, /at .*\.ts:/);
});

test("services が無くても readOnly があれば古い形式にしない（Persistence は API の無いパッケージ）", () => {
  assert.deepEqual(selectCatalogs(root, project(current)).legacy, []);
});

test("既定 XAML：既定の版では版なしのファイルを使い、別の版では使わない", () => {
  const cur = loadCatalog(root, DEFAULT_CATALOG_FILES);
  const cls = "NClick";
  assert.ok(cur.defaults.has(cls));
  assert.deepEqual(cur.defaultSources["UiPath.UIAutomation.Activities"], { flat: true, versioned: 0 });
  const old = loadCatalog(root, DEFAULT_CATALOG_FILES.map((f) => f.replace("UIAutomation.Activities/26.10.6", "UIAutomation.Activities/25.10.33")));
  assert.equal(old.defaults.has(cls), false);
  assert.equal(old.defaultSources["UiPath.UIAutomation.Activities"].flat, false);
  assert.ok(old.defaults.has("LogMessage"), "ほかのパッケージの既定値はそのまま");
  loadCatalog(root, DEFAULT_CATALOG_FILES); // 以降のテストのために戻す
});

test("既定 XAML：版ごとの置き場が、版なしより優先される", () => {
  const r = join(work, "root");
  const pkg = "UiPath.System.Activities";
  mkdirSync(join(r, "catalog", pkg), { recursive: true });
  cpSync(join(root, "catalog", pkg), join(r, "catalog", pkg), { recursive: true });
  const dx = join(r, "knowledge", "default-xaml");
  const file = (v: string) => JSON.stringify({ Result: "Success", Data: { message: `<Activity xmlns="a"><ui:LogMessage Version="${v}" /></Activity>` } });
  mkdirSync(join(dx, pkg, "26.2.6"), { recursive: true });
  writeFileSync(join(dx, "LogMessage.json"), file("flat"));
  writeFileSync(join(dx, pkg, "26.2.6", "LogMessage.json"), file("old"));
  writeFileSync(join(r, "knowledge", "default-xaml-versions.json"), JSON.stringify({ flat: { [pkg]: "26.10.0" } }));
  const load = (v: string) => loadCatalog(r, [`catalog/${pkg}/${v}.json`]);
  assert.equal(load("26.10.0").defaults.get("LogMessage")!.Version, "flat");
  const old = load("26.2.6");
  assert.equal(old.defaults.get("LogMessage")!.Version, "old");
  assert.deepEqual(old.defaultSources[pkg], { flat: false, versioned: 1 });
  loadCatalog(root, DEFAULT_CATALOG_FILES);
});

test("記録は既定の版と合っている（版を上げたら既定 XAML の扱いも決める）", () => {
  const rec = JSON.parse(readFileSync(join(root, "knowledge", "default-xaml-versions.json"), "utf8")).flat;
  assert.deepEqual(rec, DEFAULT_VERSIONS);
});

const xamlWith = (imports: string[], refs: string[]) => `<Activity xmlns:x="x">
  <TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
${imports.map((i) => `      <x:String>${i}</x:String>`).join("\r\n")}
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
${refs.map((i) => `      <AssemblyReference>${i}</AssemblyReference>`).join("\r\n")}
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>
  <Sequence><Variable x:TypeArguments="x:String">NotAnImport</Variable></Sequence>
</Activity>`;

test("ルートの imports：既存の XAML から読み、足りないものは生成器が足す", () => {
  const cat = loadCatalog(root, DEFAULT_CATALOG_FILES);
  const wf: Workflow = JSON.parse(readFileSync(greet, "utf8"));
  const plain = generate(wf, cat);
  assert.equal(generate(wf, cat, {}), plain, "指定がなければ今と同じ");
  const rootImports = readRootImports(xamlWith(["My.Ns", "A&amp;B"], ["My.Asm"]))!;
  assert.deepEqual(rootImports, { imports: ["My.Ns", "A&B"], refs: ["My.Asm"] });
  const x = generate(wf, cat, { rootImports });
  assert.ok(x.indexOf("<x:String>My.Ns</x:String>") > 0);
  assert.ok(x.includes("<x:String>A&amp;B</x:String>"));
  assert.ok(x.includes("<AssemblyReference>My.Asm</AssemblyReference>"));
  assert.ok(!x.includes("<x:String>System.Xml.Linq</x:String>"), "テンプレートの並びは混ぜない");
  assert.ok(x.includes("<x:String>System.Activities.Statements</x:String>"), "使うアクティビティの名前空間は足す");
  assert.equal(readRootImports("<Activity />"), undefined);
});

test("ルートの imports：--project は main の XAML から、無ければテンプレート。--imports-from は無ければエラー", () => {
  const p = project({ "UiPath.System.Activities": "[26.10.0]" });
  const none = projectRootImports(p);
  assert.equal(none.imports, undefined);
  assert.match(none.notes[0], /BlankTemplate/);

  writeFileSync(join(p, "A.xaml"), xamlWith(["From.A"], ["Asm.A"]));
  assert.deepEqual(projectRootImports(p).imports!.imports, ["From.A"]);
  writeFileSync(join(p, "Main.xaml"), "﻿" + xamlWith(["From.Main"], ["Asm.Main"]));
  assert.deepEqual(projectRootImports(p).imports!.imports, ["From.Main"]);

  const out = join(work, "out1");
  mkdirSync(out);
  assert.equal(node(gen, greet, "--out", out, "--project", p).status, 0);
  assert.match(readFileSync(join(out, "Greet.xaml"), "utf8"), /From\.Main/);

  const bad = node(gen, greet, "--check", "--imports-from", join(work, "nothing.xaml"));
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--imports-from の XAML が無い/);
  writeFileSync(join(work, "empty.xaml"), "<Activity />");
  assert.equal(node(gen, greet, "--check", "--imports-from", join(work, "empty.xaml")).status, 2);
});

test("gen-coded：--project のプロジェクト名が名前空間の既定になる", () => {
  const p = project(current);
  const r = node(genCoded, greet, "--check", "--print", "--project", p);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /namespace My_Proj/);
  assert.match(node(genCoded, greet, "--check", "--print").stdout, /namespace CatalogProbeNet8/);
});

test("loadSelected：既定なら注意なし", () => {
  assert.deepEqual(loadSelected(root).warnings, []);
});
