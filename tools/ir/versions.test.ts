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
import { DEFAULT_CATALOG_FILES, DEFAULT_SERVICE_FILES, DEFAULT_VERSIONS, VersionError, loadSelected, parseDependencyVersion, projectLanguage, projectRootImports, readRootImports, selectCatalogs } from "./versions.ts";
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
const current = { "UiPath.System.Activities": "[26.10.0]", "UiPath.UIAutomation.Activities": "[26.10.6]", "UiPath.Excel.Activities": "[3.6.1]", "UiPath.Persistence.Activities": "[1.13.0]", "UiPath.Testing.Activities": "[25.10.1]" };
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
  // Mail は 1.21.1 のカタログができたので、カタログの無いパッケージの例は Word にする
  const s = selectCatalogs(root, project({ ...current, "UiPath.Word.Activities": "[2.5.0]" }));
  assert.equal(s.warnings.length, 1);
  assert.match(s.warnings[0], /UiPath\.Word\.Activities のカタログが無い/);
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

test("Coded のサービス変数：生成コードが無ければ依存パッケージの登録クラスから決める", () => {
  const sysOnly = loadContext(project({ "UiPath.System.Activities": "[26.10.0]" }));
  assert.deepEqual(sysOnly.vars, { system: "UiPath.Core.Activities.API.ISystemService" });
  // Mail 1.21.1 のカタログには登録クラスが無い（Coded API なし）。mail の変数は既知の名前（uncatalogedVars）から足す
  const withMail = loadContext(project({ ...current, "UiPath.Mail.Activities": "[1.21.1]" }));
  assert.deepEqual(Object.keys(withMail.vars).sort(), ["excel", "mail", "system", "testing", "uiAutomation"]);
  // プローブで Studio が生成した CodedWorkflow.cs と同じ（System、UIAutomation、Excel、Mail、Testing）
  assert.deepEqual(loadContext().vars, {
    system: "UiPath.Core.Activities.API.ISystemService",
    uiAutomation: "UiPath.UIAutomationNext.API.Contracts.IUiAutomationAppService",
    excel: "UiPath.Excel.Activities.API.IExcelService",
    mail: "UiPath.Mail.Activities.Api.IMailService",
    testing: "UiPath.Testing.API.ITestingService",
  });
});

test("Coded API の無いパッケージ（WebAPI）：対応表が無ければ C# はエラーにせず、XAML 経由で書き出す", () => {
  const p = project({ "UiPath.System.Activities": "[26.10.0]", "UiPath.WebAPI.Activities": "[1.20.1]" });
  // WebAPI 1.20.1 は readOnly のプロパティがたまたま無く、古い形式に見える。対応表が無いので C# では API を呼ばない
  assert.deepEqual(selectCatalogs(root, p).legacy, ["UiPath.WebAPI.Activities 1.20.1"]);
  const s = selectCatalogs(root, p, { coded: true });
  assert.ok(s.warnings.some((w) => /WebAPI.*XAML 経由/.test(w)), s.warnings.join("\n"));
  const out = join(p, "coded");
  const c = node(genCoded, join(root, "samples", "ir", "UiPath.WebAPI.Activities", "DeserializeJson.min.json"), "--project", p, "--out", out);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.match(c.stdout, /CODED_VIA_XAML/);
  // --out がプロジェクトの中なら、RunWorkflow のパスはプロジェクトからの相対パス（coded/_xaml/...）
  assert.match(readFileSync(join(out, "DeserializeJson_Min.cs"), "utf8"), /RunWorkflow\("coded\/_xaml\/DeserializeJson_Min_1\.xaml"/);
  assert.match(readFileSync(join(out, "_xaml", "DeserializeJson_Min_1.xaml"), "utf8"), /x:Class="DeserializeJson_Min_1"/);
  // --no-via-xaml なら、これまでどおり NO_MAPPING
  const d = node(genCoded, join(root, "samples", "ir", "UiPath.WebAPI.Activities", "DeserializeJson.min.json"), "--project", p, "--check", "--no-via-xaml");
  assert.equal(d.status, 1);
  assert.match(d.stdout, /NO_MAPPING/);
});

test("XAML 経由の XAML は project.json の式の言語に従う", () => {
  const p = project({ "UiPath.System.Activities": "[26.10.0]", "UiPath.WebAPI.Activities": "[1.20.1]" }, { expressionLanguage: "CSharp" });
  const c = node(genCoded, join(root, "samples", "ir", "UiPath.WebAPI.Activities", "DeserializeJson.min.json"), "--project", p, "--out", p);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.match(readFileSync(join(p, "_xaml", "DeserializeJson_Min_1.xaml"), "utf8"), /ExpressionActivityEditor="C#"/);
  assert.match(readFileSync(join(p, "DeserializeJson_Min.cs"), "utf8"), /RunWorkflow\("_xaml\/DeserializeJson_Min_1\.xaml"/);
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

test("式の言語：--language、--project の expressionLanguage に従う。食い違いと知らない値はエラー", () => {
  const out = join(work, "out-lang");
  mkdirSync(out);
  const isCs = () => /ExpressionActivityEditor\.ExpressionActivityEditor="C#"/.test(readFileSync(join(out, "Greet.xaml"), "utf8"));
  assert.equal(node(gen, greet, "--out", out).status, 0);
  assert.equal(isCs(), false, "既定は VB");
  assert.equal(node(gen, greet, "--out", out, "--language", "CSharp").status, 0);
  assert.equal(isCs(), true);

  const cs = project(current, { expressionLanguage: "CSharp" });
  const r = node(gen, greet, "--out", out, "--project", cs);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(isCs(), true, "--project の expressionLanguage に従う");
  assert.doesNotMatch(r.stderr, /式の言語/, "C# のプロジェクトでも注意を出さない");
  assert.equal(projectLanguage(project(current)), "VisualBasic", "書いていなければ VB");

  const conflict = node(gen, greet, "--check", "--project", cs, "--language", "VisualBasic");
  assert.equal(conflict.status, 2);
  assert.match(conflict.stderr, /expressionLanguage/);
  assert.equal(node(gen, greet, "--check", "--project", project(current, { expressionLanguage: "Python" })).status, 2);
  assert.equal(node(gen, greet, "--check", "--language", "Ruby").status, 2);
});

test("式の言語：C# に直せない式は検証エラー（CS_EXPR）。--check でも出る", () => {
  const f = join(work, "Named.json");
  writeFileSync(f, JSON.stringify({ workflow: "Named", variables: [{ name: "s", type: "String" }], body: [{ act: "LogMessage", props: { Message: 's.Split({","c}, count:=1)(0)' } }] }));
  assert.equal(node(gen, f, "--check").status, 0, "VB なら通る");
  const r = node(gen, f, "--check", "--language", "CSharp");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /CS_EXPR\s+body\[0\]\.props\.Message: .*名前付き引数/);
});

test("gen-coded：--project のプロジェクト名が名前空間の既定になる", () => {
  const p = project(current);
  const r = node(genCoded, greet, "--check", "--print", "--project", p);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // Studio は名前に使えない文字を消す（"uipath-ir-probe-v24" → uipathirprobev24。生成された CodedWorkflow.cs で確かめた）
  assert.match(r.stdout, /namespace MyProj/);
  assert.match(node(genCoded, greet, "--check", "--print").stdout, /namespace CatalogProbeNet8/);
});

test("loadSelected：既定なら注意なし", () => {
  assert.deepEqual(loadSelected(root).warnings, []);
});
