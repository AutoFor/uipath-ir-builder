// オブジェクトリポジトリ（.objects）のテスト。Studio 26.10 が書いた形（knowledge/object-repository.md）と比べる。

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { loadCatalog } from "./catalog.ts";
import { CATALOG_FILES, repoRoot as root } from "./import-xaml.ts";
import { generate } from "./generate.ts";
import { validate } from "./validate.ts";
import type { ObjValue, Workflow } from "./types.ts";
import {
  b64u, buildObjects, elementContent, elementSearchHash, expandRefs, findRef, netHash, readObjects, registerTargets, REPO_NOTICES, repositoryFile,
  rewriteRefs, screenSearchHash, staleness, type Repository,
} from "./objrepo.ts";

const cat = loadCatalog(root, CATALOG_FILES);

// Studio が作った要素（申請日）の中身。.objects/…/4QQs/.data/ObjectRepositoryTargetData/.content
const STUDIO_CONTENT = `<?xml version="1.0" encoding="utf-16"?>
<ObjectRepositoryTargetData ContentHash="eRJc20ww6k2ufWI3DMf-QA" xmlns="http://schemas.uipath.com/workflow/activities/uix" xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <ObjectRepositoryTargetData.Data>
    <TargetAnchorable x:Key="TargetAnchorable" BrowserURL="" DesignTimeRectangle="540, 712, 840, 51" ElementType="InputBox" ElementVisibilityArgument="Interactive" FuzzySelectorArgument="&lt;webctrl id='applyDate' tag='INPUT' type='date' class='' aaname='申請日' matching:id='fuzzy' fuzzylevel:id='0.0' matching:class='fuzzy' fuzzylevel:class='0.0' matching:aaname='fuzzy' fuzzylevel:aaname='0.0' /&gt;" Guid="74eae909-d24c-488f-b18a-d6fd0a91b8fc" IsResponsive="True" ScopeSelectorArgument="&lt;html app='chrome.exe' title='テスト用申請フォーム' /&gt;" SearchSteps="FuzzySelector" Version="V6" WaitForReadyArgument="Interactive">
      <TargetAnchorable.Anchors>
        <scg:List x:TypeArguments="ITarget" Capacity="4">
          <Target DesignTimeRectangle="540, 671, 840, 35" ElementType="Text" FuzzySelectorArgument="&lt;webctrl aaname='申請日' tag='LABEL' type='' class='' matching:aaname='fuzzy' fuzzylevel:aaname='0.0' matching:class='fuzzy' fuzzylevel:class='0.0' check:innerText='申請日' /&gt;" Guid="93acca6c-c0a4-4dc4-b87c-20cad181ea54" SearchSteps="FuzzySelector" />
        </scg:List>
      </TargetAnchorable.Anchors>
      <imageRef attrName="InformativeScreenshot" originalValue="4f039468ac392ce79f249cb9f0229ed5.jpg" xmlns="">0uJCIi8FL-UaPg2hyfAYoLg</imageRef>
    </TargetAnchorable>
    <x:String x:Key="ActivityType">Click</x:String>
  </ObjectRepositoryTargetData.Data>
</ObjectRepositoryTargetData>`;

const SCOPE = "<html app='chrome.exe' title='テスト用申請フォーム' />";
const 申請日: ObjValue = {
  BrowserURL: { lit: "" },
  DesignTimeRectangle: "540, 712, 840, 51",
  ElementType: "InputBox",
  ElementVisibilityArgument: "Interactive",
  FuzzySelectorArgument: { lit: "<webctrl id='applyDate' tag='INPUT' type='date' class='' aaname='申請日' matching:id='fuzzy' fuzzylevel:id='0.0' matching:class='fuzzy' fuzzylevel:class='0.0' matching:aaname='fuzzy' fuzzylevel:aaname='0.0' />" },
  IsResponsive: true,
  ScopeSelectorArgument: { lit: SCOPE },
  SearchSteps: "FuzzySelector",
  WaitForReadyArgument: "Interactive",
  Anchors: [{
    DesignTimeRectangle: "540, 671, 840, 35",
    ElementType: "Text",
    FuzzySelectorArgument: { lit: "<webctrl aaname='申請日' tag='LABEL' type='' class='' matching:aaname='fuzzy' fuzzylevel:aaname='0.0' matching:class='fuzzy' fuzzylevel:class='0.0' check:innerText='申請日' />" },
    SearchSteps: "FuzzySelector",
    Guid: "93acca6c-c0a4-4dc4-b87c-20cad181ea54",
  }],
  Guid: "74eae909-d24c-488f-b18a-d6fd0a91b8fc",
  InformativeScreenshot: "4f039468ac392ce79f249cb9f0229ed5.jpg",
};

test("SearchHash は Studio の値と同じ（要素・アンカーあり、画面）", () => {
  assert.equal(netHash("abc"), netHash("abc"));
  assert.equal(netHash(null), 0);
  assert.equal(elementSearchHash(申請日), 933164501);
  assert.equal(screenSearchHash({ Selector: { lit: SCOPE } }), -1983528708);
});

test("要素の .content は Studio と同じ文字（ContentHash を除く）", () => {
  const ours = elementContent({ name: "申請日", activityType: "Click", target: 申請日 }, { name: "4f039468ac392ce79f249cb9f0229ed5.jpg", id: "0uJCIi8FL-UaPg2hyfAYoLg" });
  assert.equal(ours.replace("{HASH}", "eRJc20ww6k2ufWI3DMf-QA"), STUDIO_CONTENT);
});

const tmpProject = () => {
  const p = mkdtempSync(join(tmpdir(), "objrepo-"));
  mkdirSync(join(p, ".screenshots"), { recursive: true });
  writeFileSync(join(p, ".screenshots", "4f039468ac392ce79f249cb9f0229ed5.jpg"), Buffer.from([0xff, 0xd8, 1, 2, 3]));
  return p;
};
let seq = 0;
// 決まった並びの Id（先頭 4 文字が重ならない）
const ids = () => b64u(createHash("sha1").update(String(++seq)).digest().subarray(0, 16));
const sample = (): Repository => ({
  apps: [{
    name: "Chrome テスト用申請フォーム",
    screens: [
      { name: "申請フォーム1", interactionMode: "DebuggerApi", target: { BrowserType: "Chrome", Selector: { lit: SCOPE }, Url: { lit: "file:///C:/form/index.html" } }, elements: [{ name: "申請日", taxonomy: "Input", activityType: "Click", target: structuredClone(申請日) }] },
      { name: "申請フォーム2", target: { BrowserType: "Chrome", Selector: { lit: "<html app='chrome.exe' title='別の画面' />" } } },
    ],
  }],
});
const tree = (p: string): string[] => {
  const out: string[] = [];
  const walk = (d: string, rel: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(join(d, e.name), r); else out.push(r); } };
  walk(join(p, ".objects"), "");
  return out.sort();
};

test("build：Repository から .objects を作り、読み戻すと同じ。もう一度 build しても何も変わらない", () => {
  const p = tmpProject();
  try {
    const repo = sample();
    const r = buildObjects(p, repo, cat, { newId: ids, now: () => "2026-11-10T00:00:00.0000000Z" });
    assert.deepEqual(r.issues.filter((i) => i.code !== "REPO_NO_SCREENSHOT"), []); // sample() の画面には画像が無い
    assert.equal(r.idsAdded, true);
    const app = repo.apps[0], s1 = app.screens![0], e = s1.elements![0];
    const eDir = `${app.id!.slice(0, 4)}/${app.versionId!.slice(0, 4)}/${s1.id!.slice(0, 4)}/${e.id!.slice(0, 4)}`;
    const files = tree(p);
    for (const f of [".metadata", ".type", `${eDir}/.metadata`, `${eDir}/.type`, `${eDir}/.data/ObjectRepositoryTargetData/.content`, `${eDir}/.data/ObjectRepositoryTargetData/.hash`, `${eDir}/.data/ObjectRepositoryTargetData/.attributes/SearchHash`])
      assert.ok(files.includes(f), f);
    assert.ok(files.some((f) => f.startsWith(`${eDir}/.data/ObjectRepositoryTargetData/.images/.design/0`)));
    const meta = readFileSync(join(p, ".objects", eDir, ".metadata"), "utf8");
    assert.ok(meta.startsWith("\uFEFF{\r\n"));
    const m = JSON.parse(meta.slice(1));
    assert.equal(m.Type, "Element");
    assert.equal(m.TaxonomyType, "Input");
    assert.equal(m.ParentRef, `${repo.libraryId}/${s1.id}`);
    assert.equal(readFileSync(join(p, ".objects", eDir, ".data/ObjectRepositoryTargetData/.attributes/SearchHash"), "utf8"), "933164501");

    const back = readObjects(p, cat);
    assert.deepEqual(back.issues, []);
    assert.deepEqual(JSON.parse(JSON.stringify(back.repo)), JSON.parse(JSON.stringify({ ...repo, apps: repo.apps.map((a) => ({ ...a, version: "1.0.0" })) })));

    const again = buildObjects(p, structuredClone(repo), cat, { now: () => "2027-01-01T00:00:00.0000000Z" });
    assert.deepEqual(again.changes, []);
    assert.equal(again.idsAdded, false);
    assert.equal(JSON.parse(readFileSync(join(p, ".objects", eDir, ".metadata"), "utf8").slice(1)).Updated, "2026-11-10T00:00:00.0000000Z");
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test("名前の変更は .metadata だけ、中身の変更は ContentHash が変わる、移動はフォルダごと移る（Studio と同じ）", () => {
  const p = tmpProject();
  try {
    const repo = sample();
    buildObjects(p, repo, cat, { newId: ids });
    const app = repo.apps[0], [s1, s2] = app.screens!, e = s1.elements![0];
    const dir = (s: { id?: string }) => join(p, ".objects", app.id!.slice(0, 4), app.versionId!.slice(0, 4), s.id!.slice(0, 4), e.id!.slice(0, 4));
    const hash = (s: { id?: string }) => readFileSync(join(dir(s), ".data/ObjectRepositoryTargetData/.hash"), "utf8");
    const h0 = hash(s1);

    e.name = "申請日2";
    let r = buildObjects(p, repo, cat, { now: () => "2027-01-01T00:00:00.0000000Z" });
    assert.deepEqual(r.changes, ["名前 Element 申請日 → 申請日2"]);
    const m = JSON.parse(readFileSync(join(dir(s1), ".metadata"), "utf8").slice(1));
    assert.equal(m.Name, "申請日2");
    assert.equal(m.Updated, "2027-01-01T00:00:00.0000000Z");
    assert.ok(m.UpdatedBy);
    assert.equal(hash(s1), h0);

    (e.target.FuzzySelectorArgument as { lit: string }).lit = (e.target.FuzzySelectorArgument as { lit: string }).lit.replace("fuzzylevel:aaname='0.0'", "fuzzylevel:aaname='0.5'");
    r = buildObjects(p, repo, cat);
    assert.deepEqual(r.changes, ["中身 Element 申請日2"]);
    assert.notEqual(hash(s1), h0);

    s1.elements = [];
    s2.elements = [e];
    r = buildObjects(p, repo, cat);
    assert.deepEqual(r.changes, ["移動 Element 申請日2"]);
    assert.ok(!existsSync(dir(s1)));
    assert.equal(JSON.parse(readFileSync(join(dir(s2), ".metadata"), "utf8").slice(1)).ParentRef, `${repo.libraryId}/${s2.id}`);
    assert.ok(existsSync(join(dir(s2), ".data/ObjectRepositoryTargetData/.content")));
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test("検証：同じ名前、式、Reference を書いたらエラー", () => {
  const p = tmpProject();
  try {
    const repo = sample();
    repo.apps[0].screens![0].elements!.push({ name: "申請日", target: { FullSelectorArgument: "sel", SearchSteps: "Selector", Reference: "x" } });
    const r = buildObjects(p, repo, cat);
    assert.deepEqual(r.issues.map((i) => i.code).filter((c) => !REPO_NOTICES.has(c)).sort(), ["REPO_EXPR", "REPO_NAME", "REPO_SHAPE"]);
    assert.ok(!existsSync(join(p, ".objects")));
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test("画像の無い画面・要素は注意だけ出して build する", () => {
  const p = tmpProject();
  try {
    const repo = sample();
    repo.apps[0].screens![0].elements!.push({ name: "送信", target: { FullSelectorArgument: { lit: "<webctrl tag='BUTTON' />" }, SearchSteps: "Selector" } });
    const r = buildObjects(p, repo, cat);
    assert.ok(r.issues.every((i) => REPO_NOTICES.has(i.code)));
    assert.ok(r.issues.some((i) => i.code === "REPO_NO_SCREENSHOT" && i.path.endsWith("/送信")));
    assert.ok(existsSync(join(p, ".objects")));
  } finally { rmSync(p, { recursive: true, force: true }); }
});

const card = (targets: ObjValue[], app: ObjValue = { BrowserType: "Chrome", Selector: { lit: SCOPE } }): Workflow => ({
  workflow: "Main",
  body: [{ act: "NApplicationCard", objs: { TargetApp: app }, body: targets.map((t) => ({ act: "NClick", objs: { Target: t } })) }],
});
const btn = (): ObjValue => ({ FullSelectorArgument: { lit: "<webctrl tag='BUTTON' innertext='送信' />" }, SearchSteps: "Selector" });

test("register：リポジトリを再利用するなら同じものに、しないなら (1) を付けて作る。式のあるものは残す", () => {
  const repo: Repository = { apps: [] };
  const wf = card([btn(), btn()]);
  const r = registerTargets(wf, repo, cat, { reuse: true });
  assert.deepEqual(r.created, ["Chrome テスト用申請フォーム/テスト用申請フォーム", "Chrome テスト用申請フォーム/テスト用申請フォーム/送信"]);
  assert.deepEqual(r.linked, ["Chrome テスト用申請フォーム/テスト用申請フォーム/送信"]);
  assert.deepEqual(wf.body[0].objs!.TargetApp, { $ref: "Chrome テスト用申請フォーム/テスト用申請フォーム" });
  assert.deepEqual(wf.body[0].body![1].objs!.Target, { $ref: "Chrome テスト用申請フォーム/テスト用申請フォーム/送信" });

  const wf2 = card([btn()]);
  const r2 = registerTargets(wf2, repo, cat, { reuse: false });
  assert.deepEqual(r2.created, ["Chrome テスト用申請フォーム/テスト用申請フォーム(1)", "Chrome テスト用申請フォーム/テスト用申請フォーム(1)/送信"]);

  const wf3 = card([btn()], { Url: "New Uri(path).AbsoluteUri", Selector: { lit: SCOPE } });
  const r3 = registerTargets(wf3, repo, cat, { reuse: true });
  assert.deepEqual(r3.skipped.map((i) => i.code), ["REPO_EXPR", "REPO_NO_SCREEN"]);
  assert.equal((wf3.body[0].objs!.TargetApp as ObjValue).Url, "New Uri(path).AbsoluteUri");
});

test("register：Reference のあるもの（Studio で結びつけたもの）は、その Id の $ref にする", () => {
  const repo = sample();
  repo.libraryId = "eRrDs_Jr9UuH8YiG90Uadg";
  repo.apps[0].screens![0].id = "T1SvUsNiY0mZEkdcaCcnQw";
  repo.apps[0].screens![0].elements![0].id = "4QQsHSrvoE2bLPoZAMBNpA";
  const wf = card([{ ...structuredClone(申請日), FuzzySelectorArgument: { lit: "<webctrl 古いセレクター />" }, Reference: "eRrDs_Jr9UuH8YiG90Uadg/4QQsHSrvoE2bLPoZAMBNpA", ContentHash: "old" }],
    { Selector: { lit: SCOPE }, Reference: "eRrDs_Jr9UuH8YiG90Uadg/T1SvUsNiY0mZEkdcaCcnQw" });
  const r = registerTargets(wf, repo, cat, { reuse: false });
  assert.deepEqual(r.created, []);
  assert.deepEqual(wf.body[0].body![0].objs!.Target, { $ref: "Chrome テスト用申請フォーム/申請フォーム1/申請日" });
});

test("$ref：生成器はリポジトリの中身に Reference と ContentHash を足す。repository.json が新しければ止める", () => {
  const p = tmpProject();
  try {
    const repo = sample();
    buildObjects(p, repo, cat, { newId: ids });
    mkdirSync(join(p, "ir"), { recursive: true });
    writeFileSync(repositoryFile(p), JSON.stringify(repo));
    const e = repo.apps[0].screens![0].elements![0];
    const wf: Workflow = { workflow: "Main", body: [{ act: "NApplicationCard", objs: { TargetApp: { $ref: "申請フォーム1" } as unknown as ObjValue }, body: [{ act: "NClick", objs: { Target: { $ref: "申請日" } as unknown as ObjValue } }] }] };
    const ex = expandRefs(wf, cat, p);
    assert.deepEqual(ex.issues, []);
    const t = ex.wf.body[0].body![0].objs!.Target as ObjValue;
    const ch = readFileSync(join(p, ".objects", repo.apps[0].id!.slice(0, 4), repo.apps[0].versionId!.slice(0, 4), repo.apps[0].screens![0].id!.slice(0, 4), e.id!.slice(0, 4), ".data/ObjectRepositoryTargetData/.hash"), "utf8");
    assert.equal(t.Reference, `${repo.libraryId}/${e.id}`);
    assert.equal(t.ContentHash, ch);
    assert.deepEqual(validate(ex.wf, cat), []);
    const xaml = generate(ex.wf, cat);
    assert.match(xaml, new RegExp(`ContentHash="${ch}"`));
    assert.match(xaml, /Guid="74eae909-d24c-488f-b18a-d6fd0a91b8fc"/);
    assert.match(xaml, /<uix:SAPElementInfo|Reference="[^"]+\/[^"]+"/);

    assert.deepEqual(expandRefs(wf, cat, undefined).issues.map((i) => i.code), ["REPO_REF"]);
    e.name = "変えた";
    writeFileSync(repositoryFile(p), JSON.stringify(repo));
    assert.match(staleness(p, cat) ?? "", /違う/);
    assert.equal(findRef(repo, "申請日", "element"), "リポジトリに要素 \"申請日\" が無い");
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test("rewriteRefs：名前の変更・移動のあと、IR の $ref を新しい完全な名前にする", () => {
  const before = sample();
  let n = 0;
  for (const a of before.apps) { a.id = `app${n}AAAAAAAAAAAAAAAAAA`.slice(0, 22); for (const s of a.screens ?? []) { s.id = `scr${n++}AAAAAAAAAAAAAAAAAA`.slice(0, 22); for (const e of s.elements ?? []) e.id = `el${n++}AAAAAAAAAAAAAAAAAAA`.slice(0, 22); } }
  const after = structuredClone(before);
  const e = after.apps[0].screens![0].elements!.pop()!;
  e.name = "申請日2";
  after.apps[0].screens![1].elements = [e];
  const wf: Workflow = { workflow: "Main", body: [{ act: "NClick", objs: { Target: { $ref: "申請日" } as unknown as ObjValue } }] };
  assert.equal(rewriteRefs(wf, before, after, cat), 1);
  assert.deepEqual(wf.body[0].objs!.Target, { $ref: "Chrome テスト用申請フォーム/申請フォーム2/申請日2" });
});
