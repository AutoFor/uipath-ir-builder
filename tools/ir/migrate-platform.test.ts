// Windows ⇄ クロスプラットフォーム（targetFramework Portable）のカタログの選び方と、migrate-platform.ts のテスト。
// 作業用のプロジェクトは out/test-platform/ に作る。

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, refsForPlatform, templateRootImports } from "./generate.ts";
import { VersionError, catalogFile, loadSelected, projectRootImports, readRootImports, selectCatalogs } from "./versions.ts";
import { migratePlatform } from "./migrate-platform.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
mkdirSync(join(root, "out", "test-platform"), { recursive: true });
const work = mkdtempSync(join(root, "out", "test-platform", "t-"));
after(() => rmSync(work, { recursive: true, force: true }));

let n = 0;
function project(platform: "Windows" | "Portable", dependencies: Record<string, string> = { "UiPath.System.Activities": "[26.10.0]" }) {
  const d = join(work, `p${n++}`);
  mkdirSync(d);
  // Studio の project.json と同じく、targetFramework は終わりの近くにある
  writeFileSync(join(d, "project.json"), JSON.stringify({ name: "Proj", main: "Main.xaml", dependencies, runtimeOptions: { requiresUserInteraction: platform === "Windows" }, expressionLanguage: "VisualBasic", targetFramework: platform, dotNetVersion: "net10.0" }, null, 2));
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

test("Portable のカタログが無い版はエラー（作り方を出す）", () => {
  const p = project("Portable", { "UiPath.System.Activities": "[26.10.0]", "UiPath.UIAutomation.Activities": "[26.10.6]" });
  assert.throws(() => selectCatalogs(root, p), (e: unknown) => e instanceof VersionError && /extract-portable\.sh UiPath\.UIAutomation\.Activities 26\.10\.6/.test(e.message));
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
