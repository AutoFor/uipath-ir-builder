// 引数の既定値（arguments[].default）。XAML ではルートの this:<ワークフロー>.<引数>="値"、Coded では Execute の省略可能な引数（AUT-1219）
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCatalog } from "./catalog.ts";
import { generate } from "./generate.ts";
import { generateCoded } from "./generate-coded.ts";
import { CATALOG_FILES, importXaml, repoRoot as root } from "./import-xaml.ts";
import { loadMappings } from "./mapping.ts";
import type { Workflow } from "./types.ts";
import { validate } from "./validate.ts";

const cat = loadCatalog(root, CATALOG_FILES);
const { maps } = loadMappings(root);

const wf: Workflow = {
  workflow: "Main",
  arguments: [
    { name: "in_Url", dir: "In", type: "String", default: { lit: "https://example.test/?a=1&b=\"x\"" } },
    { name: "in_Retry", dir: "In", type: "Int32", default: 3 },
    { name: "in_Headless", dir: "In", type: "Boolean", default: false },
    { name: "out_Text", dir: "Out", type: "String" },
  ],
  body: [{ act: "LogMessage", props: { Level: "Info", Message: "in_Url" } }],
};

test("XAML：ルートの this:Main.<引数> に書き、読み戻すと同じ既定値になる", () => {
  assert.deepEqual(validate(wf, cat), []);
  const xaml = generate(wf, cat);
  assert.match(xaml, /this:Main\.in_Url="https:\/\/example\.test\/\?a=1&amp;b=&quot;x&quot;"/);
  assert.match(xaml, /this:Main\.in_Retry="3"/);
  assert.match(xaml, /this:Main\.in_Headless="False"/);
  assert.match(xaml, /xmlns:this="clr-namespace:"/);
  const back = importXaml(xaml, cat);
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.wf!.arguments, wf.arguments);
  assert.ok(!back.warnings.some((w) => w.code === "ARGUMENT_DEFAULT"), JSON.stringify(back.warnings));
});

test("既定値の無い XAML には this を書かない", () => {
  const xaml = generate({ ...wf, arguments: [{ name: "in_Url", dir: "In", type: "String" }] }, cat);
  assert.doesNotMatch(xaml, /xmlns:this|this:Main\./);
});

test("Coded：Execute の省略可能な引数にする", () => {
  const r = generateCoded(wf, cat, maps, { namespace: "N" });
  assert.deepEqual(r.issues, []);
  assert.match(r.code, /Execute\(String in_Url = "https:\/\/example\.test\/\?a=1&b=\\"x\\"", Int32 in_Retry = 3, Boolean in_Headless = false\)/);
});

test("Coded：既定値のある引数のあとに、既定値の無い引数があればエラー", () => {
  const w: Workflow = { ...wf, arguments: [{ name: "a", dir: "In", type: "String", default: { lit: "x" } }, { name: "b", dir: "In", type: "String" }] };
  assert.ok(generateCoded(w, cat, maps, { namespace: "N" }).issues.some((i) => i.code === "CODED_ARG_DEFAULT_ORDER"));
});

test("検証：In 以外の既定値、型に合わない既定値はエラー", () => {
  const codes = (args: Workflow["arguments"]) => validate({ ...wf, arguments: args }, cat).map((i) => i.code);
  assert.deepEqual(codes([{ name: "out_X", dir: "Out", type: "String", default: { lit: "x" } }]), ["BAD_ARG_DEFAULT"]);
  assert.deepEqual(codes([{ name: "in_N", dir: "In", type: "Int32", default: { lit: "3" } }]), ["BAD_ARG_DEFAULT"]);
  assert.deepEqual(codes([{ name: "in_B", dir: "In", type: "String", default: true }]), ["BAD_ARG_DEFAULT"]);
});

test("NApplicationCard の IsIncognito（シークレット ウィンドウ）は XAML と Coded に出る", () => {
  const w: Workflow = { workflow: "Main", body: [{ act: "NApplicationCard", objs: { TargetApp: { BrowserType: "Chrome", Selector: { lit: "<html app='chrome.exe' />" }, Url: { lit: "https://example.com/" } } },
    props: { OpenMode: "Always", IsIncognito: true }, body: [{ act: "LogMessage", props: { Level: "Info", Message: { lit: "x" } } }] }] };
  assert.deepEqual(validate(w, cat), []);
  assert.match(generate(w, cat), /IsIncognito="True"/);
  const r = generateCoded(w, cat, maps, { namespace: "N" });
  assert.deepEqual(r.issues, []);
  assert.match(r.code, /IsIncognito = true/);
});
