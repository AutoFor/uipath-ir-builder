// オブジェクトリポジトリ（UiPath プロジェクトの .objects/）の読み書き。
//
// IR の正本は <プロジェクト>/ir/repository.json（Repository 型）。.objects はそこから作る（build）。
// ワークフローの IR は objs.Target / objs.TargetApp に { "$ref": "アプリ/画面/要素" } と書き、生成器（gen.ts）が .objects から
// 中身を写して Reference と ContentHash を付ける（Studio がリポジトリの要素をアクティビティに結びつけたときと同じ XAML）。
//
// .objects の形（Studio 26.10 で確かめた。knowledge/object-repository.md）:
//   .objects/.metadata, .type                         ライブラリ（Type "Library"）
//   <App の Id の先頭4文字>/                           アプリ（.data/ObjectSelectionName）
//     <AppVersion の Id の先頭4文字>/                  バージョン（Name "1.0.0"。中身なし）
//       <Screen の Id の先頭4文字>/                    画面（.data/ObjectRepositoryScreenData：TargetApp）
//         <Element の Id の先頭4文字>/                 要素（.data/ObjectRepositoryTargetData：TargetAnchorable）
//   .metadata は BOM 付き・CRLF・2 文字字下げの JSON。.content は utf-16 と書いてあるが中身は UTF-8（BOM なし、LF）
//   ContentHash は中身の要約ではなく「中身が変わるたびに新しくなる Id」。ここでは中身の SHA-1 から作る
//   SearchHash は UiPath.UIAutomationNext.Activities.dll の GetObjectLibraryHashCode と同じ計算（searchHash）

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalog, ObjType } from "./catalog.ts";
import { objectTypes, resolve } from "./catalog.ts";
import { importXaml, parseXml, type El } from "./import-xaml.ts";
import type { Node, ObjValue, Value, Workflow } from "./types.ts";
import { isValue, objDefaults } from "./uia.ts";

export const UIX = "http://schemas.uipath.com/workflow/activities/uix";
const XNS = "http://schemas.microsoft.com/winfx/2006/xaml";
const SCG = "clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib";
const TA = "UiPath.UIAutomationNext.TargetAnchorable";
const TAPP = "UiPath.UIAutomationNext.TargetApp";
const CARD = "UiPath.UIAutomationNext.Activities.NApplicationCard";

// ---- IR（repository.json）----

export type RepoElement = {
  name: string;
  id?: string; // 22 文字の Id。無ければ build が付けて repository.json に書き戻す
  taxonomy?: string; // .metadata の TaxonomyType（入力欄なら "Input"）
  activityType?: string; // 取り込んだアクティビティ（"Click" など。.content の ActivityType）
  target: ObjValue; // TargetAnchorable（objs.Target と同じ書き方。値はリテラルだけ）
};
export type RepoScreen = {
  name: string;
  id?: string;
  interactionMode?: string; // NInteractionMode（"DebuggerApi" など）
  target: ObjValue; // TargetApp（objs.TargetApp と同じ書き方）
  elements?: RepoElement[];
};
export type RepoApp = { name: string; id?: string; version?: string; versionId?: string; screens?: RepoScreen[] };
export type Repository = { libraryId?: string; apps: RepoApp[] };

export type RepoIssue = { path: string; code: string; message: string };

export const repositoryFile = (project: string) => join(project, "ir", "repository.json");

// ---- Id・時刻・ハッシュ ----

export const b64u = (b: Buffer) => b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
export const newId = () => b64u(randomBytes(16));
const hashId = (s: string | Buffer) => b64u(createHash("sha1").update(s).digest().subarray(0, 16));
// Studio の時刻（小数 7 桁）
export const studioTime = (d = new Date()) => d.toISOString().replace(/\.(\d{3})Z$/, ".$10000Z");

const i32 = (x: number) => x | 0;
// .NET Framework（x64）の String.GetHashCode。UiPath の StringExtensions.GetNonRandomizedHashCode
export function netHash(s: string | null | undefined): number {
  if (s == null) return 0;
  let h1 = 5381, h2 = 5381;
  for (let i = 0; i < s.length; i += 2) {
    h1 = i32(i32((h1 << 5) + h1) ^ s.charCodeAt(i));
    if (i + 1 >= s.length) break;
    h2 = i32(i32((h2 << 5) + h2) ^ s.charCodeAt(i + 1));
  }
  return i32(h1 + Math.imul(h2, 1566083941));
}
const combine = (a: number, b: number) => i32(i32((a << 5) + a) ^ b);
const STEPS: Record<string, number> = { None: 0, Selector: 1, FuzzySelector: 2, Image: 4, TextFindAll: 8, TextOcr: 16, TextNative: 32, CV: 64, Semantic: 128, SemanticSelector: 256 };
const litOf = (v: unknown): string | null => (v && typeof v === "object" && "lit" in v ? (v as { lit: string }).lit : typeof v === "string" ? v : null);
const stepsOf = (v: unknown) => String(litOf(v) ?? "").split(",").map((s) => s.trim()).filter(Boolean).reduce((a, s) => a | (STEPS[s] ?? 0), 0);

// 画像・CV・Semantic の探し方は、計算に入る値がまだ分かっていない（セレクターの分だけ入れる。Studio の値と違うことがある）
export const searchHashExact = (t: ObjValue) => (stepsOf(t.SearchSteps) & ~3) === 0 && (!Array.isArray(t.Anchors) || (t.Anchors as ObjValue[]).every((a) => (stepsOf(a.SearchSteps) & ~3) === 0));

function oneHash(t: ObjValue, scope: string | null): number {
  const st = stepsOf(t.SearchSteps);
  return combine(combine(netHash(scope), st), combine(netHash(st & 1 ? litOf(t.FullSelectorArgument) : null), netHash(st & 2 ? litOf(t.FuzzySelectorArgument) : null)));
}
// 要素（TargetAnchorable）の SearchHash
export function elementSearchHash(t: ObjValue): number {
  const self = oneHash(t, litOf(t.ScopeSelectorArgument));
  const anchors = Array.isArray(t.Anchors) ? (t.Anchors as ObjValue[]) : [];
  if (!anchors.length) return self;
  return [...anchors.map((a) => oneHash(a, null)).sort((a, b) => a - b), self].reduce((acc, v) => i32(Math.imul(acc, 31) + v), 17);
}
// 画面（TargetApp）の SearchHash
export const screenSearchHash = (t: ObjValue) => netHash(litOf(t.Selector) || litOf(t.FilePath) || "");

// ---- .content を書く ----

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attrText = (v: Value) => (typeof v === "boolean" ? (v ? "True" : "False") : typeof v === "number" ? String(v) : typeof v === "string" ? v : "lit" in v ? v.lit : v.vb);
const itemType = (t: string) => {
  const m = t.match(/^System\.Collections\.Generic\.(?:IEnumerable|List|IList|ICollection)<(.+)>$/);
  return m ? (m[1] === "UiPath.UIAutomationNext.Contracts.ITarget" ? "UiPath.UIAutomationNext.Target" : m[1]) : undefined;
};

// オブジェクトを、既定の名前空間が uix の XAML にする（リポジトリの .content の書き方）。image は InformativeScreenshot を imageRef にしたもの
function serObj(t: ObjType, v: ObjValue, depth: number, out: string[], first: string[] = [], image?: { name: string; id: string }) {
  const pad = "  ".repeat(depth);
  const attrs: [string, string][] = [];
  const elems: [string, ObjValue | ObjValue[]][] = [];
  for (const [k, x] of Object.entries(v)) {
    if (k === "$type" || k === "$typeArg") continue;
    if (k === "InformativeScreenshot" && image) continue;
    if (isValue(x)) attrs.push([k, attrText(x)]);
    else elems.push([k, x as ObjValue | ObjValue[]]);
  }
  for (const [k, d] of Object.entries(objDefaults[t.clrType] ?? {})) if (!(k in v) && d !== "guid") attrs.push([k, d]);
  attrs.sort(([x], [y]) => x.localeCompare(y));
  const head = `${pad}<${t.className}${first.map((f) => " " + f).join("")}${attrs.map(([k, x]) => ` ${k}="${escAttr(x)}"`).join("")}`;
  if (!elems.length && !image) { out.push(head + " />"); return; }
  out.push(head + ">");
  for (const [k, x] of elems) {
    const p = t.props.find((q) => q.name === k)!;
    out.push(`${pad}  <${t.className}.${k}>`);
    if (Array.isArray(x)) {
      const it = objectTypes.get(itemType(p.type)!)!;
      const iface = p.type.match(/<(.+)>$/)![1];
      out.push(`${pad}    <scg:List x:TypeArguments="${iface.slice(iface.lastIndexOf(".") + 1)}" Capacity="${Math.max(4, x.length)}">`);
      for (const e of x) serObj(it, e, depth + 3, out);
      out.push(`${pad}    </scg:List>`);
    } else serObj(objectTypes.get(p.type)!, x, depth + 2, out);
    out.push(`${pad}  </${t.className}.${k}>`);
  }
  if (image) out.push(`${pad}  <imageRef attrName="InformativeScreenshot" originalValue="${escAttr(image.name)}" xmlns="">${image.id}</imageRef>`);
  out.push(`${pad}</${t.className}>`);
}

// 要素の .content（ContentHash を除いた形。hash は "{HASH}" の所に入れる）
export function elementContent(e: RepoElement, image?: { name: string; id: string }): string {
  const out = [
    `<?xml version="1.0" encoding="utf-16"?>`,
    `<ObjectRepositoryTargetData ContentHash="{HASH}" xmlns="${UIX}" xmlns:scg="${SCG}" xmlns:x="${XNS}">`,
    `  <ObjectRepositoryTargetData.Data>`,
  ];
  serObj(objectTypes.get(TA)!, e.target, 2, out, [`x:Key="TargetAnchorable"`], image);
  if (e.activityType) out.push(`    <x:String x:Key="ActivityType">${escText(e.activityType)}</x:String>`);
  out.push(`  </ObjectRepositoryTargetData.Data>`, `</ObjectRepositoryTargetData>`);
  return out.join("\n");
}

export function screenContent(s: RepoScreen, image?: { name: string; id: string }): string {
  const out = [
    `<?xml version="1.0" encoding="utf-16"?>`,
    `<ObjectRepositoryScreenData ContentHash="{HASH}" xmlns="${UIX}" xmlns:x="${XNS}">`,
    `  <ObjectRepositoryScreenData.Data>`,
  ];
  serObj(objectTypes.get(TAPP)!, s.target, 2, out, [`x:Key="TargetApp"`], image);
  if (s.interactionMode) out.push(`    <NInteractionMode x:Key="InteractionMode">${escText(s.interactionMode)}</NInteractionMode>`);
  out.push(`  </ObjectRepositoryScreenData.Data>`, `</ObjectRepositoryScreenData>`);
  return out.join("\n");
}

// ---- .content を読む（import-xaml の取り込みを使う）----

type Parsed = { target: ObjValue; image?: { name: string; id: string }; keyed: Record<string, string>; contentHash?: string };

function parseContent(xml: string, kind: "element" | "screen", cat: Catalog, at: string, issues: RepoIssue[]): Parsed | undefined {
  const tag = kind === "element" ? "TargetAnchorable" : "TargetApp";
  let root: El;
  try { root = parseXml(xml); } catch (e) { issues.push({ path: at, code: "REPO_XML", message: (e as Error).message }); return undefined; }
  const contentHash = root.attrs.find((a) => a.local === "ContentHash")?.value;
  const data = root.kids.find((k) => k.local.endsWith(".Data"));
  const keyed: Record<string, string> = {};
  for (const k of data?.kids ?? []) {
    const key = k.attrs.find((a) => a.uri === XNS && a.local === "Key")?.value;
    if (key && key !== tag) keyed[key] = k.text;
  }
  const m = xml.match(new RegExp(`<${tag} [\\s\\S]*?</${tag}>|<${tag} [^>]*/>`));
  if (!m) { issues.push({ path: at, code: "REPO_XML", message: `<${tag}> が無い` }); return undefined; }
  let snippet = m[0];
  let image: Parsed["image"];
  snippet = snippet.replace(/\s*<imageRef ([^>]*)>([^<]*)<\/imageRef>/, (_, attrs: string, id: string) => {
    const name = attrs.match(/originalValue="([^"]*)"/)?.[1];
    if (name) image = { name: name.replace(/&amp;/g, "&"), id: id.trim() };
    return "";
  });
  snippet = snippet.replace(/ x:Key="[^"]*"/, "").replace(new RegExp(`^<${tag}`), `<${tag} xmlns="${UIX}"`);
  const [act, prop] = kind === "element" ? ["NClick", "Target"] : ["NApplicationCard", "TargetApp"];
  const wrapped = `<Activity x:Class="R" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="${XNS}" xmlns:scg="${SCG}" xmlns:uix="${UIX}"><uix:${act}><uix:${act}.${prop}>${snippet}</uix:${act}.${prop}></uix:${act}></Activity>`;
  const r = importXaml(wrapped, cat);
  for (const e of r.errors) if (e.code !== "BAD_ROOT") issues.push({ path: at, code: e.code, message: e.message });
  const target = r.wf?.body[0]?.objs?.[prop] as ObjValue | undefined;
  if (!target) { if (!r.errors.length) issues.push({ path: at, code: "REPO_XML", message: `<${tag}> が読めない` }); return undefined; }
  // 取り込みは生成器が足し直す GUID を捨てる。リポジトリとアクティビティで同じ値にしたいので戻す
  const el = parseXml(wrapped).kids[0].kids[0].kids[0];
  const guid = (e: El) => e.attrs.find((a) => a.local === "Guid" && !a.prefix)?.value;
  if (guid(el)) target.Guid = guid(el)!;
  const anchorsEl = el.kids.find((k) => k.local === `${tag}.Anchors`)?.kids[0];
  if (anchorsEl && Array.isArray(target.Anchors)) (target.Anchors as ObjValue[]).forEach((a, i) => { const g = guid(anchorsEl.kids[i]); if (g) a.Guid = g; });
  if (image) target.InformativeScreenshot = image.name;
  return { target, image, keyed, contentHash };
}

// ---- .objects を読む ----

type Meta = { Name?: string; Type: string; TaxonomyType?: string; Id: string; Reference?: string; ParentRef?: string; Created: string; Updated: string; CreatedBy: string[]; UpdatedBy?: string[] };

export type NodeState = { id: string; type: string; dir: string; meta: Meta; contentHash?: string; content?: string; images: Map<string, Buffer> };
export type RepoState = { libraryId?: string; libraryMeta?: Meta; repo: Repository; nodes: Map<string, NodeState>; issues: RepoIssue[] };

const readMeta = (dir: string): Meta | undefined => {
  const f = join(dir, ".metadata");
  if (!existsSync(f)) return undefined;
  return JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""));
};
const subdirs = (dir: string) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => join(dir, d.name)) : []);

function readData(dir: string, kind: string): { content?: string; hash?: string; images: Map<string, Buffer> } {
  const d = join(dir, ".data", kind);
  const images = new Map<string, Buffer>();
  const imgDir = join(d, ".images", ".design");
  if (existsSync(imgDir)) for (const f of readdirSync(imgDir)) images.set(f, readFileSync(join(imgDir, f)));
  return {
    content: existsSync(join(d, ".content")) ? readFileSync(join(d, ".content"), "utf8") : undefined,
    hash: existsSync(join(d, ".hash")) ? readFileSync(join(d, ".hash"), "utf8").trim() : undefined,
    images,
  };
}

// .objects を読んで Repository（IR）にする。nodes は Id ごとの今のファイルの状態
export function readObjects(project: string, cat: Catalog): RepoState {
  const base = join(project, ".objects");
  const issues: RepoIssue[] = [];
  const nodes = new Map<string, NodeState>();
  const libraryMeta = readMeta(base);
  const repo: Repository = { libraryId: libraryMeta?.Id, apps: [] };
  const add = (dir: string, meta: Meta, kind?: string) => {
    const d = kind ? readData(dir, kind) : { images: new Map<string, Buffer>() };
    const s: NodeState = { id: meta.Id, type: meta.Type, dir, meta, contentHash: d.hash, content: d.content, images: d.images };
    nodes.set(meta.Id, s);
    return s;
  };
  for (const appDir of subdirs(base)) {
    const am = readMeta(appDir);
    if (!am || am.Type !== "App") continue;
    add(appDir, am, "ObjectSelectionName");
    const app: RepoApp = { name: am.Name ?? "", id: am.Id, screens: [] };
    const versions = subdirs(appDir).map((d) => [d, readMeta(d)] as const).filter(([, m]) => m?.Type === "AppVersion");
    if (versions.length > 1) issues.push({ path: am.Name ?? am.Id, code: "REPO_VERSIONS", message: `アプリ "${am.Name}" にバージョンが ${versions.length} 個ある（1 つだけ扱える）` });
    for (const [vDir, vm] of versions.slice(0, 1)) {
      add(vDir, vm!);
      app.version = vm!.Name;
      app.versionId = vm!.Id;
      for (const sDir of subdirs(vDir)) {
        const sm = readMeta(sDir);
        if (!sm || sm.Type !== "Screen") continue;
        const ss = add(sDir, sm, "ObjectRepositoryScreenData");
        const at = `${am.Name}/${sm.Name}`;
        const p = ss.content ? parseContent(ss.content, "screen", cat, at, issues) : undefined;
        if (!p) continue;
        const screen: RepoScreen = { name: sm.Name ?? "", id: sm.Id, ...(p.keyed.InteractionMode ? { interactionMode: p.keyed.InteractionMode.trim() } : {}), target: p.target, elements: [] };
        for (const eDir of subdirs(sDir)) {
          const em = readMeta(eDir);
          if (!em || em.Type !== "Element") continue;
          const es = add(eDir, em, "ObjectRepositoryTargetData");
          const pe = es.content ? parseContent(es.content, "element", cat, `${at}/${em.Name}`, issues) : undefined;
          if (!pe) continue;
          screen.elements!.push({ name: em.Name ?? "", id: em.Id, ...(em.TaxonomyType ? { taxonomy: em.TaxonomyType } : {}), ...(pe.keyed.ActivityType ? { activityType: pe.keyed.ActivityType.trim() } : {}), target: pe.target });
        }
        if (!screen.elements!.length) delete screen.elements;
        app.screens!.push(screen);
      }
    }
    if (!app.screens!.length) delete app.screens;
    repo.apps.push(app);
  }
  return { libraryId: libraryMeta?.Id, libraryMeta, repo, nodes, issues };
}

// ---- 名前で引く ----

export type Found = { app: RepoApp; screen?: RepoScreen; element?: RepoElement };

export const refParts = (ref: string | string[]) => (Array.isArray(ref) ? ref : ref.split("/").map((s) => s.trim()));

// "アプリ/画面/要素"、"画面/要素"、"要素"（後ろから合わせる。1 つに決まらなければエラー）
export function findRef(repo: Repository, ref: string | string[], kind: "screen" | "element"): Found | string {
  const parts = refParts(ref);
  const hits: Found[] = [];
  for (const app of repo.apps) for (const screen of app.screens ?? []) {
    if (kind === "screen") {
      const path = [app.name, screen.name];
      if (parts.length <= 2 && parts.every((p, i) => p === path[path.length - parts.length + i])) hits.push({ app, screen });
      continue;
    }
    for (const element of screen.elements ?? []) {
      const path = [app.name, screen.name, element.name];
      if (parts.length <= 3 && parts.every((p, i) => p === path[path.length - parts.length + i])) hits.push({ app, screen, element });
    }
  }
  const what = kind === "screen" ? "画面" : "要素";
  if (!hits.length) return `リポジトリに${what} "${parts.join("/")}" が無い`;
  if (hits.length > 1) return `"${parts.join("/")}" に合う${what}が ${hits.length} 個ある。アプリ名・画面名から書く: ${hits.map(pathOf).join(", ")}`;
  return hits[0];
}
export const pathOf = (f: Found) => [f.app.name, f.screen?.name, f.element?.name].filter((x) => x !== undefined).join("/");

// ---- 検証 ----

/** build を止めない注意（それ以外のコードはエラー） */
export const REPO_NOTICES = new Set(["REPO_SCREENSHOT", "REPO_SEARCH_HASH", "REPO_NO_SCREENSHOT"]);
const NO_SHOT = "InformativeScreenshot が無い（Studio のプレビューに「プレビューを利用できません」と出る。Studio で要素を指定し直すと撮られる）";

export function checkRepository(repo: Repository): RepoIssue[] {
  const issues: RepoIssue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  const ids = new Set<string>();
  const id = (x: { id?: string }, at: string) => {
    if (x.id === undefined) return;
    if (!/^[A-Za-z0-9_-]{22}$/.test(x.id)) add(at, "REPO_ID", `id "${x.id}" は 22 文字の base64url`);
    if (ids.has(x.id)) add(at, "REPO_ID", `id "${x.id}" が重なっている`);
    ids.add(x.id);
  };
  const names = (list: { name: string }[], at: string) => {
    const seen = new Set<string>();
    for (const x of list) {
      if (!x.name) add(at, "REPO_NAME", "名前が無い");
      else if (seen.has(x.name)) add(`${at}/${x.name}`, "REPO_NAME", `同じ名前 "${x.name}" が 2 つある（Studio と同じく "${x.name}(1)" のように変える）`);
      seen.add(x.name);
    }
  };
  if (!Array.isArray(repo.apps)) { add("", "REPO_SHAPE", "apps（配列）が要る"); return issues; }
  names(repo.apps, "apps");
  for (const app of repo.apps) {
    id(app, app.name);
    if (app.versionId !== undefined) id({ id: app.versionId }, `${app.name}(version)`);
    names(app.screens ?? [], app.name);
    for (const s of app.screens ?? []) {
      const at = `${app.name}/${s.name}`;
      id(s, at);
      if (!s.target || typeof s.target !== "object") add(at, "REPO_SHAPE", "target（TargetApp）が要る");
      else {
        literalOnly(s.target, objectTypes.get(TAPP)!, `${at}.target`, add);
        if (!s.target.InformativeScreenshot) add(at, "REPO_NO_SCREENSHOT", NO_SHOT);
      }
      names(s.elements ?? [], at);
      for (const e of s.elements ?? []) {
        const eat = `${at}/${e.name}`;
        id(e, eat);
        if (!e.target || typeof e.target !== "object") { add(eat, "REPO_SHAPE", "target（TargetAnchorable）が要る"); continue; }
        literalOnly(e.target, objectTypes.get(TA)!, `${eat}.target`, add);
        if (!e.target.InformativeScreenshot) add(eat, "REPO_NO_SCREENSHOT", NO_SHOT);
        if (!searchHashExact(e.target)) add(eat, "REPO_SEARCH_HASH", "画像・CV・Semantic の探し方の SearchHash はまだ Studio と同じ値にならない（Studio の「リポジトリを再利用」で同じ要素と見なされないことがある）");
      }
    }
  }
  return issues;
}

// リポジトリの値はリテラルだけ（式は書けない）。InArgument の文字列は { lit }
function literalOnly(v: ObjValue, t: ObjType | undefined, at: string, add: (p: string, c: string, m: string) => void) {
  if (!t) return;
  for (const [k, x] of Object.entries(v)) {
    if (k.startsWith("$")) continue;
    const p = t.props.find((q) => q.name === k);
    if (!p) { add(`${at}.${k}`, "UNKNOWN_PROP", `${t.className} に "${k}" は無い`); continue; }
    if (k === "Reference" || k === "ContentHash") { add(`${at}.${k}`, "REPO_SHAPE", `${k} はリポジトリが付ける。書かない`); continue; }
    if (Array.isArray(x)) { const it = objectTypes.get(itemType(p.type) ?? ""); x.forEach((e, i) => typeof e === "object" && !isValue(e) && literalOnly(e as ObjValue, it, `${at}.${k}[${i}]`, add)); continue; }
    if (!isValue(x)) { literalOnly(x as ObjValue, objectTypes.get(p.type), `${at}.${k}`, add); continue; }
    if (typeof x === "object" && "vb" in x) add(`${at}.${k}`, "REPO_EXPR", `リポジトリには式を書けない。{ "lit": ... } で書く`);
    if (typeof x === "string" && p.kind !== "prop" && !p.enum) add(`${at}.${k}`, "REPO_EXPR", `"${k}" に式 "${x}" は書けない。文字列なら { "lit": ... } で書く`);
  }
}

// ---- build：Repository → .objects ----

const CREATED_BY_PLATFORM = "UiPath.Platform, Version=26.9.0.0, Culture=neutral, PublicKeyToken=null";
const CREATED_BY_UIA = "UiPath.UIAutomationCore, Version=26.10.6.0, Culture=neutral, PublicKeyToken=null";

export type BuildOptions = { now?: () => string; newId?: () => string; dryRun?: boolean };
export type BuildResult = { issues: RepoIssue[]; changes: string[]; idsAdded: boolean };

type Want = { id: string; type: string; dir: string; name?: string; parentId?: string; taxonomy?: string; files: Map<string, Buffer | string>; changedContent: boolean };

const sameJson = (a: unknown, b: unknown) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, sortKeys(x)]));
  return v;
}
// Version など、書かなくても生成器が足す既定値を足して比べる
function withDefaults(v: ObjValue, clr: string): ObjValue {
  const t = objectTypes.get(clr);
  const out: ObjValue = { ...v };
  for (const [k, d] of Object.entries(objDefaults[clr] ?? {})) if (!(k in out) && d !== "guid") out[k] = d;
  if (t) for (const [k, x] of Object.entries(out)) {
    const p = t.props.find((q) => q.name === k);
    if (!p) continue;
    if (Array.isArray(x)) { const it = itemType(p.type); out[k] = (x as ObjValue[]).map((e) => (it && typeof e === "object" && !isValue(e) ? withDefaults(e, it) : e)); }
    else if (!isValue(x) && objectTypes.get(p.type)) out[k] = withDefaults(x as ObjValue, p.type);
  }
  return out;
}

export function buildObjects(project: string, repo: Repository, cat: Catalog, opts: BuildOptions = {}): BuildResult {
  const now = opts.now ?? (() => studioTime());
  const mkId = opts.newId ?? newId;
  const changes: string[] = [];
  const issues = checkRepository(repo);
  if (issues.some((i) => !REPO_NOTICES.has(i.code))) return { issues, changes, idsAdded: false };
  const state = readObjects(project, cat);
  // 読めないものがあっても build は進める（読めなかった中身は書き直す）
  let idsAdded = false;
  const ensure = <T extends { id?: string }>(x: T) => { if (!x.id) { x.id = mkId(); idsAdded = true; } return x.id; };
  const libraryId = repo.libraryId ?? state.libraryId ?? mkId();
  if (repo.libraryId !== libraryId) { repo.libraryId = libraryId; idsAdded = true; }
  const base = join(project, ".objects");
  const shots = join(project, ".screenshots");
  const wants: Want[] = [];
  const oldContent = new Map<string, { target?: ObjValue; keyed?: Record<string, string> }>();
  const parsedOld = (id: string, kind: "element" | "screen") => {
    if (oldContent.has(id)) return oldContent.get(id)!;
    const n = state.nodes.get(id);
    const p = n?.content ? parseContent(n.content, kind, cat, id, []) : undefined;
    const r = { target: p?.target, keyed: p?.keyed };
    oldContent.set(id, r);
    return r;
  };

  // 画像。.screenshots に無ければ、前の .objects にあった同じ名前の画像を使う
  const imageBytes = (name: string | undefined, old: NodeState | undefined): Buffer | undefined => {
    if (!name) return undefined;
    if (existsSync(join(shots, name))) return readFileSync(join(shots, name));
    const oldId = old?.content?.match(new RegExp(`originalValue="${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([^<]*)<`))?.[1];
    return oldId ? old!.images.get(oldId) : undefined;
  };

  const data = (w: Want, kind: "element" | "screen", content: (img?: { name: string; id: string }) => string, target: ObjValue, keyed: Record<string, string>, hash: number) => {
    const old = state.nodes.get(w.id);
    const prev = old && old.type === w.type ? parsedOld(w.id, kind) : undefined;
    const sameContent = !!prev?.target && sameJson(withDefaults(prev.target, kind === "element" ? TA : TAPP), withDefaults(target, kind === "element" ? TA : TAPP)) && sameJson(prev.keyed ?? {}, keyed);
    const d = kind === "element" ? ".data/ObjectRepositoryTargetData/" : ".data/ObjectRepositoryScreenData/";
    if (sameContent && old) {
      // 中身が同じなら、ContentHash も画像もそのまま（Studio で作った XAML と食い違わないように）
      w.files.set(d + ".content", old.content!);
      w.files.set(d + ".hash", old.contentHash ?? "");
      for (const [f, b] of old.images) w.files.set(d + ".images/.design/" + f, b);
      w.files.set(d + ".attributes/SearchHash", String(hash));
      return;
    }
    w.changedContent = true;
    const shot = litOf(target.InformativeScreenshot) ?? undefined;
    const bytes = imageBytes(shot, old);
    if (shot && !bytes) issues.push({ path: w.name ?? w.id, code: "REPO_SCREENSHOT", message: `画像 .screenshots/${shot} が無い（imageRef は書かない）` });
    const img = shot && bytes ? { name: shot, id: "0" + hashId(Buffer.concat([Buffer.from(w.id), bytes])) } : undefined;
    let text = content(img);
    const ch = hashId(text);
    text = text.replace("{HASH}", ch);
    w.files.set(d + ".content", text);
    w.files.set(d + ".hash", ch);
    w.files.set(d + ".attributes/SearchHash", String(hash));
    if (img) w.files.set(d + ".images/.design/" + img.id, bytes!);
  };

  for (const app of repo.apps) {
    const appId = ensure(app);
    const appDir = appId.slice(0, 4);
    const aw: Want = { id: appId, type: "App", dir: appDir, name: app.name, files: new Map(), changedContent: false };
    const oldApp = state.nodes.get(appId);
    aw.files.set(".data/ObjectSelectionName/.content", "UnifiedTarget");
    aw.files.set(".data/ObjectSelectionName/.hash", oldApp?.type === "App" && oldApp.contentHash ? oldApp.contentHash : hashId(appId + "UnifiedTarget"));
    wants.push(aw);
    if (!app.versionId) { app.versionId = mkId(); idsAdded = true; }
    const vDir = `${appDir}/${app.versionId.slice(0, 4)}`;
    wants.push({ id: app.versionId, type: "AppVersion", dir: vDir, name: app.version ?? "1.0.0", parentId: appId, files: new Map(), changedContent: false });
    for (const s of app.screens ?? []) {
      const sid = ensure(s);
      const sw: Want = { id: sid, type: "Screen", dir: `${vDir}/${sid.slice(0, 4)}`, name: s.name, parentId: app.versionId, files: new Map(), changedContent: false };
      const keyed = s.interactionMode ? { InteractionMode: s.interactionMode } : {};
      data(sw, "screen", (img) => screenContent(s, img), s.target, keyed, screenSearchHash(s.target));
      wants.push(sw);
      for (const e of s.elements ?? []) {
        const eid = ensure(e);
        if (!e.target.Guid) { e.target.Guid = guidOf(eid); idsAdded = true; }
        if (Array.isArray(e.target.Anchors)) (e.target.Anchors as ObjValue[]).forEach((a, i) => { if (!a.Guid) { a.Guid = guidOf(`${eid}#${i}`); idsAdded = true; } });
        const ew: Want = { id: eid, type: "Element", dir: `${sw.dir}/${eid.slice(0, 4)}`, name: e.name, parentId: sid, taxonomy: e.taxonomy, files: new Map(), changedContent: false };
        const keyed2 = e.activityType ? { ActivityType: e.activityType } : {};
        data(ew, "element", (img) => elementContent(e, img), e.target, keyed2, elementSearchHash(e.target));
        wants.push(ew);
      }
    }
  }
  // 同じ親の下でフォルダ名（Id の先頭 4 文字）が重なると書けない
  const dirs = new Map<string, string>();
  for (const w of wants) { if (dirs.has(w.dir)) issues.push({ path: w.name ?? w.id, code: "REPO_ID", message: `フォルダ ${w.dir} が "${dirs.get(w.dir)}" と重なる（Id の先頭 4 文字が同じ）` }); dirs.set(w.dir, w.name ?? w.id); }
  if (issues.some((i) => !REPO_NOTICES.has(i.code))) return { issues, changes, idsAdded };

  // メタデータ
  const t = now();
  const metas = new Map<string, Meta>();
  for (const w of wants) {
    const old = state.nodes.get(w.id)?.meta;
    const meta: Meta = {
      ...(w.name !== undefined ? { Name: w.name } : {}),
      Type: w.type,
      ...(w.taxonomy ? { TaxonomyType: w.taxonomy } : {}),
      Id: w.id,
      Reference: `${libraryId}/${w.id}`,
      ...(w.parentId ? { ParentRef: `${libraryId}/${w.parentId}` } : {}),
      Created: old?.Created ?? t,
      Updated: old?.Updated ?? t,
      CreatedBy: old?.CreatedBy ?? (w.type === "Element" ? [CREATED_BY_UIA, CREATED_BY_PLATFORM] : [CREATED_BY_PLATFORM]),
      ...(old?.UpdatedBy ? { UpdatedBy: old.UpdatedBy } : {}),
    };
    const changed = !old ? false : old.Name !== meta.Name || old.ParentRef !== meta.ParentRef || old.TaxonomyType !== meta.TaxonomyType || w.changedContent;
    if (changed) { meta.Updated = t; meta.UpdatedBy = [CREATED_BY_PLATFORM]; }
    if (!old) changes.push(`追加 ${w.type} ${w.name ?? w.id}`);
    else if (old.ParentRef !== meta.ParentRef) changes.push(`移動 ${w.type} ${w.name}`);
    else if (old.Name !== meta.Name) changes.push(`名前 ${w.type} ${old.Name} → ${w.name}`);
    if (old && w.changedContent) changes.push(`中身 ${w.type} ${w.name}`);
    metas.set(w.id, meta);
  }
  const wantIds = new Set(wants.map((w) => w.id));
  for (const n of state.nodes.values()) if (!wantIds.has(n.id)) changes.push(`削除 ${n.type} ${n.meta.Name ?? n.id}`);
  if (opts.dryRun) return { issues, changes, idsAdded };

  // 書く。消えたもの・場所が変わったものの古いフォルダを先に消す（中のファイルは上で読んである）
  const wantDir = new Map(wants.map((w) => [w.id, join(base, w.dir)]));
  for (const n of state.nodes.values()) if (wantDir.get(n.id) !== n.dir && existsSync(n.dir)) rmSync(n.dir, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  if (!state.libraryMeta) {
    writeIfChanged(join(base, ".metadata"), metaText({ Type: "Library", Id: libraryId, Created: t, Updated: t, CreatedBy: [CREATED_BY_PLATFORM] } as Meta));
    writeIfChanged(join(base, ".type"), "Library");
  }
  for (const w of wants) {
    const dir = join(base, w.dir);
    mkdirSync(dir, { recursive: true });
    writeIfChanged(join(dir, ".metadata"), metaText(metas.get(w.id)!));
    writeIfChanged(join(dir, ".type"), w.type);
    // .data の中の、要らなくなったファイル（古い画像など）を消す
    const dataDir = join(dir, ".data");
    if (existsSync(dataDir)) for (const f of walkFiles(dataDir)) if (!w.files.has(f.slice(dir.length + 1).replace(/\\/g, "/"))) rmSync(f);
    for (const [rel, body] of w.files) { mkdirSync(join(dir, rel, ".."), { recursive: true }); writeIfChanged(join(dir, rel), body); }
  }
  return { issues, changes, idsAdded };
}

const guidOf = (s: string) => {
  const h = createHash("sha1").update("objrepo:" + s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

function metaText(m: Meta): string {
  return "﻿" + JSON.stringify(m, null, 2).replace(/\n/g, "\r\n");
}
function writeIfChanged(f: string, body: string | Buffer) {
  const b = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  if (existsSync(f) && readFileSync(f).equals(b)) return;
  writeFileSync(f, b);
}
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

// repository.json と .objects が同じか（gen.ts が古い .objects を使わないように）
export function staleness(project: string, cat: Catalog): string | undefined {
  const f = repositoryFile(project);
  if (!existsSync(f)) return undefined;
  const repo: Repository = JSON.parse(readFileSync(f, "utf8"));
  const r = buildObjects(project, structuredClone(repo), cat, { dryRun: true, now: () => "" });
  if (r.idsAdded) return `${f} に id の無いものがある。先に node tools/ir/objrepo.ts build --project ${project}`;
  const ch = r.changes;
  return ch.length ? `${f} と .objects が違う（${ch.slice(0, 3).join("、")}${ch.length > 3 ? " ほか" : ""}）。先に node tools/ir/objrepo.ts build --project ${project}` : undefined;
}

// ---- ワークフローの $ref ----

const isRef = (v: unknown): v is { $ref: string | string[] } => !!v && typeof v === "object" && !Array.isArray(v) && "$ref" in v;

export function hasRefs(wf: Workflow): boolean {
  let found = false;
  walkNodes(wf.body, (n) => { if (Object.values(n.objs ?? {}).some(isRef)) found = true; });
  return found;
}

// objs の { "$ref": ... } を、リポジトリの中身 ＋ Reference ＋ ContentHash にする（Studio が要素を結びつけたときと同じ）
export function resolveRefs(wf: Workflow, state: RepoState, cat: Catalog): { wf: Workflow; issues: RepoIssue[] } {
  const issues: RepoIssue[] = [];
  const copy: Workflow = structuredClone(wf);
  walkNodes(copy.body, (n, path) => {
    for (const [k, v] of Object.entries(n.objs ?? {})) {
      if (!isRef(v)) continue;
      const at = `${path}.objs.${k}`;
      const extra = Object.keys(v).filter((x) => x !== "$ref");
      if (extra.length) { issues.push({ path: at, code: "REPO_REF", message: `$ref と一緒に ${extra.join(", ")} は書けない（中身はリポジトリで直す）` }); continue; }
      const r = resolve(cat, n.act, n.typeArg !== undefined);
      const p = "activity" in r ? r.activity.props.find((x) => x.name === k) : undefined;
      const kind = p?.type === TAPP ? "screen" : p?.type === TA ? "element" : undefined;
      if (!kind) { issues.push({ path: at, code: "REPO_REF", message: `${n.act}.${k} はリポジトリから引けない（TargetApp と TargetAnchorable だけ）` }); continue; }
      const f = findRef(state.repo, v.$ref, kind);
      if (typeof f === "string") { issues.push({ path: at, code: "REPO_REF", message: f }); continue; }
      const node = kind === "screen" ? f.screen! : f.element!;
      const ns = state.nodes.get(node.id!);
      n.objs![k] = { ...structuredClone(node.target), Reference: `${state.libraryId}/${node.id}`, ContentHash: ns?.contentHash ?? "" };
    }
  });
  return { wf: copy, issues };
}

export function walkNodes(list: Node[] | undefined, f: (n: Node, path: string) => void, path = "body") {
  (list ?? []).forEach((n, i) => {
    const at = `${path}[${i}]`;
    f(n, at);
    walkNodes(n.body, f, `${at}.body`);
    walkNodes(n.then, f, `${at}.then`);
    walkNodes(n.else, f, `${at}.else`);
    for (const [k, v] of Object.entries(n.slots ?? {})) walkNodes(v, f, `${at}.slots.${k}`);
    for (const [k, v] of Object.entries(n.cases ?? {})) walkNodes(v, f, `${at}.cases.${k}`);
    (n.catches ?? []).forEach((c, j) => walkNodes(c.body, f, `${at}.catches[${j}].body`));
  });
}

// ---- 登録：IR のその場のターゲットをリポジトリに入れ、$ref にする ----

export type RegisterOptions = { reuse: boolean };
export type RegisterResult = { linked: string[]; created: string[]; skipped: RepoIssue[] };

const selectorAttr = (sel: string | null, names: string[]) => {
  if (!sel) return undefined;
  for (const n of names) { const m = sel.match(new RegExp(`\\s${n}='([^']+)'`)); if (m) return m[1]; }
  return undefined;
};
const uniqueName = (base: string, taken: string[]) => {
  if (!taken.includes(base)) return base;
  for (let i = 1; ; i++) if (!taken.includes(`${base}(${i})`)) return `${base}(${i})`;
};
const findKeys = ["FullSelectorArgument", "FuzzySelectorArgument", "ScopeSelectorArgument", "SearchSteps", "ImageBase64", "NativeTextArgument", "CvTextArgument", "SemanticSelectorArgument"];
const sameFind = (a: ObjValue, b: ObjValue) => findKeys.every((k) => sameJson(a[k] ?? null, b[k] ?? null));

export function registerTargets(wf: Workflow, repo: Repository, cat: Catalog, opts: RegisterOptions): RegisterResult {
  const res: RegisterResult = { linked: [], created: [], skipped: [] };
  const visit = (list: Node[] | undefined, path: string, screen: Found | undefined) => {
    (list ?? []).forEach((n, i) => {
      const at = `${path}[${i}]`;
      const r = resolve(cat, n.act, n.typeArg !== undefined);
      const a = "activity" in r ? r.activity : undefined;
      let inner = screen;
      if (a?.clrType === CARD) {
        const v = n.objs?.TargetApp;
        if (isRef(v)) { const f = findRef(repo, v.$ref, "screen"); inner = typeof f === "string" ? undefined : f; }
        else if (v && !Array.isArray(v) && !isValue(v)) {
          inner = literalIssue(v as ObjValue, TAPP, `${at}.objs.TargetApp`) ? undefined : registerScreen(v as ObjValue);
          if (inner) n.objs!.TargetApp = { $ref: pathOf(inner) } as unknown as ObjValue;
        }
      } else if (a) {
        for (const [k, v] of Object.entries(n.objs ?? {})) {
          const p = a.props.find((x) => x.name === k);
          if (p?.type !== TA || isRef(v) || !v || Array.isArray(v) || isValue(v)) continue;
          if (!inner) { res.skipped.push({ path: `${at}.objs.${k}`, code: "REPO_NO_SCREEN", message: "リポジトリの画面につながった NApplicationCard の中に無いので登録しない" }); continue; }
          if (literalIssue(v as ObjValue, TA, `${at}.objs.${k}`)) continue;
          const f = registerElement(inner, v as ObjValue, n, a.className);
          n.objs![k] = { $ref: pathOf(f) } as unknown as ObjValue;
        }
      }
      visit(n.body, `${at}.body`, inner); visit(n.then, `${at}.then`, inner); visit(n.else, `${at}.else`, inner);
      for (const [k, v] of Object.entries(n.slots ?? {})) visit(v, `${at}.slots.${k}`, inner);
      for (const [k, v] of Object.entries(n.cases ?? {})) visit(v, `${at}.cases.${k}`, inner);
      (n.catches ?? []).forEach((c, j) => visit(c.body, `${at}.catches[${j}].body`, inner));
    });
  };

  // すでにリポジトリにつながっている（Reference がある）ものは、その Id の画面・要素の $ref にする
  function byReference(target: ObjValue): Found | undefined {
    const id = litOf(target.Reference)?.split("/")[1];
    if (!id) return undefined;
    for (const app of repo.apps) for (const screen of app.screens ?? []) {
      if (screen.id === id) return { app, screen };
      for (const element of screen.elements ?? []) if (element.id === id) return { app, screen, element };
    }
    return undefined;
  }

  function registerScreen(target: ObjValue): Found {
    const linked = byReference(target);
    if (linked?.screen && !linked.element) { res.linked.push(pathOf(linked)); return linked; }
    const clean = stripLink(target);
    if (opts.reuse) {
      const h = screenSearchHash(clean);
      for (const app of repo.apps) for (const s of app.screens ?? [])
        if (screenSearchHash(s.target) === h && sameJson(litOf(s.target.Selector), litOf(clean.Selector)) && sameJson(litOf(s.target.FilePath), litOf(clean.FilePath))) {
          const f = { app, screen: s };
          res.linked.push(pathOf(f));
          return f;
        }
    }
    const sel = litOf(clean.Selector);
    const title = selectorAttr(sel, ["title"]) ?? litOf(clean.Url) ?? litOf(clean.FilePath) ?? "Screen";
    const exe = litOf(clean.BrowserType) ?? selectorAttr(sel, ["app"])?.replace(/\.exe$/i, "") ?? "";
    const appName = `${exe} ${title.replace(/\*$/, "")}`.trim();
    let app = repo.apps.find((x) => x.name === appName);
    if (!app) { app = { name: appName, version: "1.0.0", screens: [] }; repo.apps.push(app); }
    app.screens ??= [];
    const screen: RepoScreen = { name: uniqueName(title.replace(/\*$/, ""), app.screens.map((s) => s.name)), target: clean };
    app.screens.push(screen);
    const f = { app, screen };
    res.created.push(pathOf(f));
    return f;
  }

  function registerElement(scr: Found, target: ObjValue, n: Node, className: string): Found {
    const linked = byReference(target);
    if (linked?.element) { res.linked.push(pathOf(linked)); return linked; }
    const clean = stripLink(target);
    const s = scr.screen!;
    s.elements ??= [];
    if (opts.reuse) {
      const h = elementSearchHash(clean);
      const hit = s.elements.find((e) => elementSearchHash(e.target) === h && sameFind(e.target, clean));
      if (hit) { const f = { ...scr, element: hit }; res.linked.push(pathOf(f)); return f; }
    }
    const sel = litOf(clean.FullSelectorArgument) ?? litOf(clean.FuzzySelectorArgument);
    const base = litOf(clean.FriendlyName) ?? selectorAttr(sel, ["aaname", "name", "id", "innertext"]) ?? n.name ?? className.replace(/^N/, "");
    const e: RepoElement = {
      name: uniqueName(base, s.elements.map((x) => x.name)),
      ...(litOf(clean.ElementType) === "InputBox" ? { taxonomy: "Input" } : {}),
      activityType: className.replace(/^N/, ""),
      target: clean,
    };
    s.elements.push(e);
    const f = { ...scr, element: e };
    res.created.push(pathOf(f));
    return f;
  }

  // 式の入ったターゲットはリポジトリに入れられない（その場に残す）
  function literalIssue(v: ObjValue, clr: string, at: string): boolean {
    const found: RepoIssue[] = [];
    literalOnly(stripLink(v), objectTypes.get(clr), at, (path, code, message) => found.push({ path, code, message }));
    for (const i of found) res.skipped.push({ ...i, message: `${i.message}（登録しないで、その場に残す）` });
    return found.length > 0;
  }

  visit(wf.body, "body", undefined);
  return res;
}

const stripLink = (t: ObjValue): ObjValue => { const c = structuredClone(t); delete c.Reference; delete c.ContentHash; return c; };

// ---- 名前の変更・移動のあと、IR の $ref を書き直す ----

// before のリポジトリで引いた要素・画面を、after のリポジトリの完全な名前に書き換える。書き換えた数を返す
export function rewriteRefs(wf: Workflow, before: Repository, after: Repository, cat: Catalog): number {
  let count = 0;
  const byId = (repo: Repository, id: string): Found | undefined => {
    for (const app of repo.apps) for (const screen of app.screens ?? []) {
      if (screen.id === id) return { app, screen };
      for (const element of screen.elements ?? []) if (element.id === id) return { app, screen, element };
    }
    return undefined;
  };
  walkNodes(wf.body, (n) => {
    for (const [k, v] of Object.entries(n.objs ?? {})) {
      if (!isRef(v)) continue;
      const r = resolve(cat, n.act, n.typeArg !== undefined);
      const p = "activity" in r ? r.activity.props.find((x) => x.name === k) : undefined;
      const kind = p?.type === TAPP ? "screen" : "element";
      const f = findRef(before, v.$ref, kind);
      if (typeof f === "string") continue;
      const id = (kind === "screen" ? f.screen : f.element)!.id;
      const g = id ? byId(after, id) : undefined;
      if (!g) continue;
      const path = pathOf(g);
      if (refParts(v.$ref).join("/") !== path) { (n.objs![k] as unknown as { $ref: string }).$ref = path; count++; }
    }
  });
  return count;
}

export const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

// ---- CLI ----
//
//   node tools/ir/objrepo.ts import   --project <P>            .objects を読んで <P>/ir/repository.json を作る（Studio で直したあとも）
//   node tools/ir/objrepo.ts build    --project <P> [--dry-run] repository.json から .objects を作る。id の無いものには付けて書き戻す
//   node tools/ir/objrepo.ts list     --project <P>            アプリ / 画面 / 要素の木
//   node tools/ir/objrepo.ts register --project <P> <ir.json>... [--no-reuse]
//        IR のその場のターゲット（NApplicationCard の TargetApp と、中のアクティビティの Target）をリポジトリに入れ、$ref にする。
//        既定は Studio の「リポジトリを再利用」と同じ（同じ探し方の要素があればそれを使う）。--no-reuse は名前に (1) を付けて別に作る
//   node tools/ir/objrepo.ts rename   --project <P> <アプリ/画面[/要素]> <新しい名前>
//   node tools/ir/objrepo.ts move     --project <P> <アプリ/画面/要素> <アプリ/画面>
//   register / rename / move は repository.json と <P>/ir/*.json の $ref を書き換え、build までする（--no-build で build しない）

async function main() {
  const { readdirSync: rd } = await import("node:fs");
  const { dirname, resolve: resolvePath } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { loadSelected, runSelection } = await import("./versions.ts");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const args = process.argv.slice(2);
  const cmd = args[0];
  const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const project = val("--project");
  const rest = args.slice(1).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--project");
  const usage = () => { console.error("使い方: node tools/ir/objrepo.ts <import|build|list|register|rename|move> --project <P> ...（tools/ir/objrepo.ts の先頭）"); process.exit(2); };
  if (!cmd || !project) usage();
  const P = resolvePath(project!);
  const { cat } = runSelection(() => loadSelected(root, P));
  const file = repositoryFile(P);
  const show = (list: RepoIssue[], head: string) => { for (const i of list) console.log(`  ${head} ${i.code.padEnd(18)} ${i.path}: ${i.message}`); };
  const loadRepo = (): Repository => {
    if (!existsSync(file)) { console.error(`${file} が無い。先に node tools/ir/objrepo.ts import --project ${project}`); process.exit(1); }
    return JSON.parse(readFileSync(file, "utf8"));
  };
  const saveRepo = (r: Repository) => { mkdirSync(join(P, "ir"), { recursive: true }); writeFileSync(file, JSON.stringify(r, null, 2) + "\n", "utf8"); };
  const build = (repo: Repository, dry = false) => {
    const r = buildObjects(P, repo, cat, { dryRun: dry });
    const bad = r.issues.filter((i) => !REPO_NOTICES.has(i.code));
    console.log(bad.length ? `NG build ${file}` : `OK build${dry ? "（--dry-run）" : ""} ${join(P, ".objects")}`);
    show(bad, "エラー");
    show(r.issues.filter((i) => !bad.includes(i)), "注意");
    for (const c of r.changes) console.log(`  ${c}`);
    if (!bad.length && r.idsAdded && !dry) { saveRepo(repo); console.log(`  id を ${file} に書き戻した`); }
    return !bad.length;
  };
  const irFiles = () => (existsSync(join(P, "ir")) ? rd(join(P, "ir")).filter((f) => f.endsWith(".json") && f !== "repository.json" && !/\.(verify|expected|args)\.json$/i.test(f)).map((f) => join(P, "ir", f)) : []);
  const rewriteAll = (before: Repository, after: Repository) => {
    for (const f of irFiles()) {
      const wf: Workflow = JSON.parse(readFileSync(f, "utf8"));
      if (!wf.body) continue;
      const n = rewriteRefs(wf, before, after, cat);
      if (n) { writeFileSync(f, JSON.stringify(wf, null, 2) + "\n", "utf8"); console.log(`  ${f} の $ref を ${n} か所書き換えた`); }
    }
  };
  const finish = (repo: Repository) => { saveRepo(repo); if (!args.includes("--no-build")) process.exit(build(repo) ? 0 : 1); console.log(`  ${file} を書いた（build はまだ）`); };

  if (cmd === "import") {
    const s = readObjects(P, cat);
    show(s.issues, "エラー");
    if (s.issues.length) { console.log(`NG import ${join(P, ".objects")}`); process.exit(1); }
    saveRepo(s.repo);
    console.log(`OK import -> ${file}`);
    return;
  }
  if (cmd === "build") process.exit(build(loadRepo(), args.includes("--dry-run")) ? 0 : 1);
  if (cmd === "list") {
    const repo = loadRepo();
    for (const a of repo.apps) {
      console.log(`${a.name}  ${a.version ?? "1.0.0"}`);
      for (const s of a.screens ?? []) {
        const noShot = (t: Record<string, unknown> | undefined) => (t?.InformativeScreenshot ? "" : "  （画像なし）");
        console.log(`  ${s.name}${noShot(s.target)}`);
        for (const e of s.elements ?? []) console.log(`    ${e.name}${noShot(e.target)}`);
      }
    }
    return;
  }
  if (cmd === "register") {
    if (!rest.length) usage();
    const repo = existsSync(file) ? loadRepo() : readObjects(P, cat).repo;
    for (const f of rest) {
      const wf: Workflow = JSON.parse(readFileSync(f, "utf8"));
      const r = registerTargets(wf, repo, cat, { reuse: !args.includes("--no-reuse") });
      writeFileSync(f, JSON.stringify(wf, null, 2) + "\n", "utf8");
      console.log(`OK register ${f}`);
      for (const x of r.created) console.log(`  作った ${x}`);
      for (const x of r.linked) console.log(`  使った ${x}（同じものがあった）`);
      show(r.skipped, "飛ばした");
    }
    finish(repo);
    return;
  }
  if (cmd === "rename" || cmd === "move") {
    if (rest.length !== 2) usage();
    const repo = loadRepo();
    const before = structuredClone(repo);
    const parts = refParts(rest[0]);
    if (cmd === "rename") {
      // 要素として探し、無ければ画面として探す
      const asEl = findRef(repo, parts, "element");
      const f = typeof asEl !== "string" || parts.length >= 3 ? asEl : findRef(repo, parts, "screen");
      if (typeof f === "string") { console.error(typeof asEl === "string" && /が無い/.test(f) && !/が無い/.test(asEl) ? asEl : f); process.exit(1); }
      (f.element ?? f.screen)!.name = rest[1];
    } else {
      const f = findRef(repo, parts, "element");
      const to = findRef(repo, rest[1], "screen");
      if (typeof f === "string" || typeof to === "string") { console.error(typeof f === "string" ? f : to); process.exit(1); }
      f.screen!.elements = f.screen!.elements!.filter((e) => e !== f.element);
      (to.screen!.elements ??= []).push(f.element!);
    }
    const issues = checkRepository(repo).filter((i) => !REPO_NOTICES.has(i.code));
    if (issues.length) { show(issues, "エラー"); process.exit(1); }
    rewriteAll(before, repo);
    finish(repo);
    return;
  }
  usage();
}

if (process.argv[1] && /objrepo\.ts$/.test(process.argv[1])) main();

// gen.ts / gen-coded.ts から呼ぶ。$ref が無ければそのまま返す
const stateCache = new Map<string, RepoState | string>();
export function expandRefs(wf: Workflow, cat: Catalog, project: string | undefined): { wf: Workflow; issues: RepoIssue[] } {
  if (!hasRefs(wf)) return { wf, issues: [] };
  if (!project) return { wf, issues: [{ path: "", code: "REPO_REF", message: "$ref（オブジェクトリポジトリ）を使うには --project が要る" }] };
  let st = stateCache.get(project);
  if (st === undefined) {
    const stale = staleness(project, cat);
    if (stale) st = stale;
    else {
      const s = readObjects(project, cat);
      st = s.issues.length ? `${join(project, ".objects")} が読めない: ${s.issues.map((i) => `${i.path}: ${i.message}`).join(" / ")}` : s;
    }
    stateCache.set(project, st);
  }
  if (typeof st === "string") return { wf, issues: [{ path: "", code: "REPO_STALE", message: st }] };
  return resolveRefs(wf, st, cat);
}
