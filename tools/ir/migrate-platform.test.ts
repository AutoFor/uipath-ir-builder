// Windows ⇄ クロスプラットフォーム（targetFramework Portable）のカタログの選び方と、migrate-platform.ts のテスト。
// 作業用のプロジェクトは out/test-platform/ に作る。

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, refsForPlatform, templateRootImports } from "./generate.ts";
import { VersionError, catalogFile, loadSelected, projectRootImports, readRootImports, selectCatalogs } from "./versions.ts";
import { migratePlatform, rewriteRootRefs } from "./migrate-platform.ts";
import { irFileFor, placeImported } from "./import-xaml.ts";
import { validate } from "./validate.ts";
import { checkSource, loadContext } from "../coded/check.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
mkdirSync(join(root, "out", "test-platform"), { recursive: true });
const work = mkdtempSync(join(root, "out", "test-platform", "t-"));
after(() => rmSync(work, { recursive: true, force: true }));

let n = 0;
function project(platform: "Windows" | "Portable", dependencies: Record<string, string> = { "UiPath.System.Activities": "[26.10.0]" }, expressionLanguage: "VisualBasic" | "CSharp" = "VisualBasic") {
  const d = join(work, `p${n++}`);
  mkdirSync(d);
  // Studio の project.json と同じく、targetFramework は終わりの近くにある
  writeFileSync(join(d, "project.json"), JSON.stringify({ name: "Proj", main: "Main.xaml", dependencies, runtimeOptions: { requiresUserInteraction: platform === "Windows" }, expressionLanguage, targetFramework: platform, dotNetVersion: "net10.0" }, null, 2));
  return d;
}
const ir = (p: string, wf: Workflow) => { mkdirSync(join(p, "ir"), { recursive: true }); writeFileSync(join(p, "ir", `${wf.workflow}.json`), JSON.stringify(wf, null, 2)); };
const hello: Workflow = { workflow: "Main", body: [{ act: "LogMessage", props: { Message: { lit: "こんにちは" } } }] };

// Studio 26.10 で作った空のプロセス（VB）の Main.xaml の AssemblyReference。テンプレートが持たない最後の 2 つ（System.ObjectModel など）は除く
const STUDIO_PORTABLE_REFS = [
  "System.Activities", "Microsoft.VisualBasic", "System.Private.CoreLib", "mscorlib", "System.Data", "System.Data.Common", "System", "System.Linq",
  "System.Drawing", "System.Drawing.Primitives", "System.Drawing.Common", "System.Core", "System.Xml", "System.Xml.Linq", "System.Xaml",
  "UiPath.System.Activities", "UiPath.UiAutomation.Activities", "System.Data.DataSetExtensions", "System.Net.Mail",
];

test("Portable の BlankTemplate の AssemblyReference は Studio と同じ並び（WPF の 3 つが無い）", () => {
  assert.deepEqual(templateRootImports("VisualBasic", "Portable").refs, STUDIO_PORTABLE_REFS);
  assert.deepEqual(templateRootImports("VisualBasic", "Portable").imports, templateRootImports("VisualBasic").imports);
  assert.ok(!templateRootImports("CSharp", "Portable").refs.includes("PresentationFramework"));
});

test("refsForPlatform：Portable は WPF を外し、Windows は System.Xml.Linq の後ろに足す（二度足さない）", () => {
  const win = templateRootImports("VisualBasic").refs;
  const p = refsForPlatform(win, "Portable");
  assert.ok(!p.includes("WindowsBase"));
  assert.deepEqual(refsForPlatform(p, "Windows"), win);
  assert.deepEqual(refsForPlatform(win, "Windows"), win);
});

test("Portable のプロジェクトは <版>.portable.json を読む。.NET と Coded の基底クラスは同じ", () => {
  const p = project("Portable");
  const s = selectCatalogs(root, p);
  assert.equal(s.platform, "Portable");
  assert.ok(s.files.includes("catalog/UiPath.System.Activities/26.10.0.portable.json"));
  assert.ok(s.files.includes("catalog/System.Activities/6.0.0.json"));
  assert.equal(catalogFile("UiPath.CodedWorkflows", "24.10.3", "Portable"), "catalog/UiPath.CodedWorkflows/24.10.3.json");
  const { cat } = loadSelected(root, p);
  assert.ok(!cat.activities.some((a) => a.className === "MultipleAssign"));
  assert.ok(cat.activities.some((a) => a.className === "LogMessage"));
  // Windows のプロジェクトは今までどおり
  assert.ok(loadSelected(root, project("Windows")).cat.activities.some((a) => a.className === "MultipleAssign"));
});

test("UI 操作：クロスプラットフォームはモダン（N〜）だけ。クラシックと CV は無い", () => {
  const p = project("Portable", { "UiPath.System.Activities": "[26.10.0]", "UiPath.UIAutomation.Activities": "[26.10.6]" });
  const { cat } = loadSelected(root, p);
  const has = (c: string) => cat.activities.some((a) => a.className === c && a.package === "UiPath.UIAutomation.Activities");
  assert.ok(has("NClick") && has("NApplicationCard") && has("NTypeInto"));
  assert.ok(!has("Click") && !has("CVClick") && !has("NSAPLogon"));
});

test("Portable のカタログが無い版はエラー（作り方を出す）", () => {
  const p = project("Portable", { "UiPath.System.Activities": "[26.10.0]", "UiPath.UIAutomation.Activities": "[26.10.3]" });
  assert.throws(() => selectCatalogs(root, p), (e: unknown) => e instanceof VersionError && /extract-portable\.sh UiPath\.UIAutomation\.Activities 26\.10\.3/.test(e.message));
  assert.throws(() => selectCatalogs(root, project("Legacy" as "Windows")), VersionError);
});

test("Portable のプロジェクトでは、既存の XAML のルートの参照から WPF を外す", () => {
  const p = project("Portable");
  writeFileSync(join(p, "Main.xaml"), generate(hello, loadSelected(root, project("Windows")).cat));
  const r = projectRootImports(p).imports!;
  assert.ok(!r.refs.includes("PresentationFramework"));
  assert.ok(projectRootImports(join(work, project("Portable").slice(work.length + 1))).imports); // XAML が無ければ Portable のテンプレート
});

test("移る先に無いアクティビティがあれば、場所を挙げて止め、何も書かない", () => {
  const p = project("Windows");
  ir(p, { workflow: "Main", variables: [{ name: "a", type: "String" }], body: [hello.body[0], { act: "MultipleAssign", assigns: [{ to: "a", value: "\"x\"" }] }] });
  const before = readFileSync(join(p, "project.json"), "utf8");
  const r = migratePlatform(p, "Portable");
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [`${join("ir", "Main.json")} body[1]: MultipleAssign（UiPath.System.Activities）はクロスプラットフォームに無い`]);
  assert.equal(readFileSync(join(p, "project.json"), "utf8"), before);
  assert.ok(!existsSync(join(p, "Main.xaml")));
});

test("Windows → Portable → Windows：project.json と XAML を書き換え、戻すと元の XAML になる", () => {
  const p = project("Windows");
  ir(p, hello);
  const winXaml = "﻿" + generate(hello, loadSelected(root, p).cat);
  writeFileSync(join(p, "Main.xaml"), winXaml);

  const dry = migratePlatform(p, "Portable", { dryRun: true });
  assert.ok(dry.ok);
  assert.deepEqual(dry.written, []);

  const r = migratePlatform(p, "Portable");
  assert.ok(r.ok, r.errors.join("\n"));
  assert.equal(JSON.parse(readFileSync(join(p, "project.json"), "utf8")).targetFramework, "Portable");
  const px = readFileSync(join(p, "Main.xaml"), "utf8");
  assert.ok(!readRootImports(px)!.refs.includes("PresentationFramework"));
  assert.ok(px.includes("こんにちは"));

  const back = migratePlatform(p, "Windows");
  assert.ok(back.ok, back.errors.join("\n"));
  assert.equal(JSON.parse(readFileSync(join(p, "project.json"), "utf8")).targetFramework, "Windows");
  assert.equal(readFileSync(join(p, "Main.xaml"), "utf8"), winXaml);
  assert.ok(migratePlatform(p, "Windows").notes.some((x) => x.includes("何もしない")));
});

test("IR の無い XAML（Studio で作ったもの）は、移る前のカタログで IR に取り込んでから移す", () => {
  const p = project("Portable");
  writeFileSync(join(p, "Main.xaml"), "﻿" + generate(hello, loadSelected(root, p).cat, { rootImports: templateRootImports("VisualBasic", "Portable") }));
  const r = migratePlatform(p, "Windows");
  assert.ok(r.ok, r.errors.join("\n"));
  assert.deepEqual(r.imported, ["Main.xaml"]);
  assert.equal(JSON.parse(readFileSync(join(p, "ir", "Main.json"), "utf8")).body[0].act, "LogMessage");
  assert.ok(readRootImports(readFileSync(join(p, "Main.xaml"), "utf8"))!.refs.includes("PresentationFramework"));
});

// ---- C# のプロジェクト ----

const csHello: Workflow = {
  workflow: "Main",
  variables: [{ name: "names", type: "String[]", default: "{\"a\", \"b\"}" }],
  body: [{ act: "LogMessage", props: { Message: "String.Join(\",\", names) & \" です\"" } }],
};
const csXaml = (wf: Workflow, platform: "Windows" | "Portable") =>
  "\uFEFF" + generate(wf, loadSelected(root, project(platform)).cat, { language: "CSharp", rootImports: templateRootImports("CSharp", platform) });

test("C# のプロジェクト（IR あり）：C# の XAML のまま Windows → Portable → Windows と移せ、戻すと元の XAML になる", () => {
  const p = project("Windows", undefined, "CSharp");
  ir(p, csHello);
  const winXaml = csXaml(csHello, "Windows");
  writeFileSync(join(p, "Main.xaml"), winXaml);
  const r = migratePlatform(p, "Portable");
  assert.ok(r.ok, r.errors.join("\n"));
  const px = readFileSync(join(p, "Main.xaml"), "utf8");
  assert.match(px, /ExpressionActivityEditor="C#"/);
  assert.match(px, /CSharpValue/);
  assert.ok(!readRootImports(px)!.refs.includes("PresentationFramework"));
  const back = migratePlatform(p, "Windows");
  assert.ok(back.ok, back.errors.join("\n"));
  assert.equal(readFileSync(join(p, "Main.xaml"), "utf8"), winXaml);
});

test("C# の XAML（IR なし）は取り込めないので、そのまま移す：ルートの参照だけ書き換え、戻すと元と同じ", () => {
  const p = project("Windows", undefined, "CSharp");
  const winXaml = csXaml(csHello, "Windows");
  writeFileSync(join(p, "Main.xaml"), winXaml);
  const r = migratePlatform(p, "Portable");
  assert.ok(r.ok, r.errors.join("\n"));
  assert.deepEqual(r.asIs, ["Main.xaml"]);
  assert.deepEqual(r.imported, []);
  assert.ok(!existsSync(join(p, "ir")));
  const px = readFileSync(join(p, "Main.xaml"), "utf8");
  assert.deepEqual(readRootImports(px)!.refs, refsForPlatform(readRootImports(winXaml)!.refs, "Portable"));
  // 参照の行のほかは 1 文字も変えない
  const strip = (s: string) => s.split(/\r?\n/).filter((l) => !/AssemblyReference>/.test(l)).join("\n");
  assert.equal(strip(px), strip(winXaml));
  const back = migratePlatform(p, "Windows");
  assert.ok(back.ok, back.errors.join("\n"));
  assert.equal(readFileSync(join(p, "Main.xaml"), "utf8"), winXaml);
});

test("そのまま移す XAML に移る先に無いアクティビティがあれば、場所を挙げて止める", () => {
  const p = project("Windows", undefined, "CSharp");
  const wf: Workflow = { workflow: "Main", variables: [{ name: "a", type: "String" }], body: [hello.body[0], { act: "MultipleAssign", props: { DisplayName: { lit: "まとめて代入" } }, assigns: [{ to: "a", value: "\"x\"" }] }] };
  writeFileSync(join(p, "Main.xaml"), csXaml(wf, "Windows"));
  const before = readFileSync(join(p, "Main.xaml"), "utf8");
  const r = migratePlatform(p, "Portable");
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1, r.errors.join("\n"));
  assert.match(r.errors[0], /^Main\.xaml Activity\/Sequence\/MultipleAssign「まとめて代入」: MultipleAssign（UiPath\.System\.Activities）はクロスプラットフォームに無い$/);
  assert.equal(readFileSync(join(p, "Main.xaml"), "utf8"), before);
});

test("rewriteRootRefs：参照の並びが無い・変わらないなら、そのまま返す", () => {
  const x = "<Activity><Sequence /></Activity>";
  assert.equal(rewriteRootRefs(x, "Portable").xaml, x);
  const px = generate(hello, loadSelected(root, project("Portable")).cat, { rootImports: templateRootImports("VisualBasic", "Portable") });
  assert.equal(rewriteRootRefs(px, "Portable").xaml, px);
});

// ---- サブフォルダの XAML ----

const greet: Workflow = { workflow: "Greet", arguments: [{ name: "in_Name", dir: "In", type: "String" }], body: [{ act: "LogMessage", props: { Message: "\"こんにちは \" & in_Name" } }] };
const callGreet = (path: string): Workflow => ({ workflow: "Main", body: [{ act: "InvokeWorkflowFile", props: { WorkflowFileName: { lit: path } }, args: [{ name: "in_Name", dir: "In", type: "String", value: "\"太郎\"" }] }] });

test("サブフォルダの XAML（IR なし）は ir/Sub/Greet.json に取り込み（file 付き）、同じ場所に作り直す。呼び出しのパスはそのまま", () => {
  const p = project("Windows");
  const cat = loadSelected(root, p).cat;
  mkdirSync(join(p, "Sub"));
  const subXaml = "\uFEFF" + generate(greet, cat);
  writeFileSync(join(p, "Sub", "Greet.xaml"), subXaml);
  writeFileSync(join(p, "Main.xaml"), "\uFEFF" + generate(callGreet("Sub\\Greet.xaml"), cat));
  const r = migratePlatform(p, "Portable");
  assert.ok(r.ok, r.errors.join("\n"));
  assert.deepEqual(r.imported.sort(), ["Main.xaml", "Sub/Greet.xaml"]);
  const sub = JSON.parse(readFileSync(join(p, "ir", "Sub", "Greet.json"), "utf8"));
  assert.equal(sub.workflow, "Greet");
  assert.equal(sub.file, "Sub/Greet.xaml");
  assert.equal(JSON.parse(readFileSync(join(p, "ir", "Main.json"), "utf8")).file, undefined);
  assert.ok(!existsSync(join(p, "Greet.xaml")));
  assert.ok(!readRootImports(readFileSync(join(p, "Sub", "Greet.xaml"), "utf8"))!.refs.includes("PresentationFramework"));
  assert.match(readFileSync(join(p, "Main.xaml"), "utf8"), /WorkflowFileName="Sub\\Greet\.xaml"/);
  assert.ok(!r.notes.some((x) => x.includes("呼び先")), r.notes.join("\n"));
  // 戻す：今度は IR（ir/Sub/Greet.json）から作り直し、元の XAML になる
  const back = migratePlatform(p, "Windows");
  assert.ok(back.ok, back.errors.join("\n"));
  assert.deepEqual(back.imported, []);
  assert.equal(readFileSync(join(p, "Sub", "Greet.xaml"), "utf8"), subXaml);
});

test("Invoke Workflow File の呼び先がプロジェクトに無ければ注意を出す（止めない）", () => {
  const p = project("Windows");
  ir(p, callGreet("Sub\\Missing.xaml"));
  const r = migratePlatform(p, "Portable", { dryRun: true });
  assert.ok(r.ok, r.errors.join("\n"));
  assert.ok(r.notes.some((x) => x.includes(`"Sub\\Missing.xaml" がプロジェクトに無い`)), r.notes.join("\n"));
});

test("IR の file：検証（相対パスの .xaml だけ）と、取り込んだ IR への付け方", () => {
  const cat = loadSelected(root, project("Windows")).cat;
  for (const f of ["Sub/Greet.xaml", "Sub\\Greet.xaml", "A/B/C.xaml"]) assert.deepEqual(validate({ ...greet, file: f }, cat), [], f);
  for (const f of ["../Greet.xaml", "C:\\x\\Greet.xaml", "/Greet.xaml", "Sub/Greet.json", "Sub//Greet.xaml"])
    assert.deepEqual(validate({ ...greet, file: f }, cat).map((i) => i.code), ["BAD_FILE"], f);
  assert.equal(placeImported(greet, "Greet.xaml").file, undefined);
  assert.deepEqual(Object.keys(placeImported(greet, "Sub\\Greet.xaml")).slice(0, 2), ["workflow", "file"]);
  assert.equal(placeImported(greet, "Sub\\Greet.xaml").file, "Sub/Greet.xaml");
  assert.equal(placeImported(greet, "Hello.xaml").file, "Hello.xaml"); // x:Class とファイル名が違う
  assert.equal(irFileFor("Sub\\Greet.xaml"), "Sub/Greet.json");
});

test("gen.ts は IR の file のサブフォルダに書き、テストケースもそのパスで project.json に載せる", () => {
  const p = project("Windows");
  ir(p, { workflow: "Greet", file: "Sub/Greet.xaml", testCase: true, arguments: greet.arguments, given: [], when: [], then: greet.body } as Workflow);
  const r = spawnSync(process.execPath, [join(root, "tools", "ir", "gen.ts"), join(p, "ir", "Greet.json"), "--project", p, "--out", p], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(join(p, "Sub", "Greet.xaml")));
  assert.ok(!existsSync(join(p, "Greet.xaml")));
  const tc = JSON.parse(readFileSync(join(p, "project.json"), "utf8")).designOptions.fileInfoCollection;
  assert.equal(tc.length, 1);
  assert.match(tc[0].fileName, /^Sub[\\/]Greet\.xaml$/);
});

test("Coded の名前空間は project.uiproj の Name を先に見る（Studio 26.10 が CodedWorkflow を作る名前）", () => {
  const p = project("Portable");
  assert.equal(loadContext(p).namespace, "Proj");
  writeFileSync(join(p, "project.uiproj"), JSON.stringify({ Name: "my-proj 2", ProjectType: "Process" }));
  assert.equal(loadContext(p).namespace, "myproj2");
});

test("チェッカー：RunWorkflow のサブフォルダの XAML（普通の文字列の \\ と @ の文字列）を、プロジェクトの中で見つける", () => {
  const p = project("Portable");
  mkdirSync(join(p, "Sub"));
  writeFileSync(join(p, "Sub", "Greet.xaml"), "<Activity />");
  const ctx = loadContext(p);
  const src = (path: string) => `using UiPath.CodedWorkflows;\nnamespace Proj\n{\n    public class A : CodedWorkflow\n    {\n        [Workflow]\n        public void Execute()\n        {\n            RunWorkflow(${path});\n        }\n    }\n}\n`;
  const warns = (path: string) => checkSource(src(path), join(p, "A.cs"), ctx).issues.filter((i) => i.code === "WORKFLOW_NOT_FOUND").length;
  assert.equal(warns(`"Sub${"\\\\"}Greet.xaml"`), 0);
  assert.equal(warns(`@"Sub${"\\"}Greet.xaml"`), 0);
  assert.equal(warns(`"Sub/Greet.xaml"`), 0);
  assert.equal(warns(`"Sub${"\\\\"}Missing.xaml"`), 1);
});
