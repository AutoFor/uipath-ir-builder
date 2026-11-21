// UiPath のプロジェクトのファイル（project.json など、ワークフロー以外）を IR から作る。npm の依存なし。
//
//   node tools/ir/project.ts import --project <P> [--out <P>/ir/project.ir.json]   既存のプロジェクトから IR を作る
//   node tools/ir/project.ts gen <project.ir.json> --out <dir>                       IR からファイルを書き出す
//   node tools/ir/project.ts check --project <P>                                     IR にして作り直し、元のファイルと比べる
//
// IR（project.ir.json）：
//   { "name", "description", "kind": "process" | "longRunning", "expressionLanguage", "targetFramework", "studioVersion",
//     "dependencies": { パッケージ: 版 }, "main", "projectId", "entryPoints": [{ "filePath", "uniqueId", "input"?, "output"? }],
//     "overrides": { project.json のうち、kind の雛形と違うところだけ（入れ子の辞書は差分、配列はまるごと） },
//     "rootImports"?: { "imports", "refs" }（main の XAML のルートの imports。XAML がまだ無いときに gen.ts --project が使う）,
//     "connectorKeys"?: [.project/design.json の ConnectorKeys], "uiproj"?: { project.uiproj の、project.json から決まる値と違うところ } }
//   projectId と uniqueId を省くと、name とファイルの名前から決まる GUID にする（何度作っても同じ）
//
// 作るもの：project.json、project.uiproj、entry-points.json、.project/design.json、.tmh/config.json、空の .entities/ .objects/ .templates/
// 作らないもの（Studio が開いたときや build のときに作り直すもの。比べない）：UNGENERATED を見る
//
// 雛形は Studio 26.10 の新規プロジェクトの project.json（「Process」と「Long Running Automation」）。kind の違いは runtimeOptions の
// requiresUserInteraction と supportsPersistence だけ（LongRunningAutomation と 空のプロセス を比べた。2026-11-21）

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readRootImports } from "./versions.ts";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

export type ProjectIr = {
  name: string;
  description?: string;
  kind?: "process" | "longRunning";
  expressionLanguage?: "VisualBasic" | "CSharp";
  targetFramework?: "Windows" | "Portable";
  studioVersion?: string;
  dependencies: Record<string, string>;
  main?: string;
  projectId?: string;
  entryPoints?: { filePath: string; uniqueId?: string; input?: Json[]; output?: Json[] }[];
  overrides?: Obj;
  connectorKeys?: string[]; // .project/design.json の ConnectorKeys（Integration Service のコネクタ。uipath-mail-mail など）
  rootImports?: { imports: string[]; refs: string[] }; // XAML のルートの imports / AssemblyReference（main の XAML から取る）。XAML がまだ無いとき gen.ts --project が使う（versions.ts）
  uiproj?: Obj; // project.uiproj のうち、project.json から決まる値と違うところ（名前を変えたプロジェクトで古い Name が残るなど）
};

// Studio が作り直すので、IR に持たないファイル（理由つき）
export const UNGENERATED: { path: string; why: string }[] = [
  { path: ".project/PackageBindingsMetadata.json", why: "依存のパッケージから Studio が作る（アクティビティと Orchestrator の資源の結びつけの一覧）。依存を復元すると作り直される" },
  { path: ".settings/", why: "プロジェクト設定（アクティビティの既定値）。Studio が開いたときに既定の値で作る。ファイル名の settings-<ハッシュ>.json の決まり方が分からない。値を変えたいときだけ写す（tools/ir/project-settings.ts が読む）" },
  { path: ".local/", why: "Studio と build の作業用（依存の一覧、NuGet のキャッシュ）。管理しない" },
  { path: "AGENTS.md / CLAUDE.md", why: "Studio 26.10 が書く、公式の uipath-rpa スキル向けの案内。この道具で作るプロジェクトには、道具の AGENTS.md の「プロジェクト側に置く AGENTS.md」を置く" },
];

const designJson = (ir: ProjectIr): Obj => ({ Tags: [], SeparateRuntimeDependencies: true, IncludeSources: true, ConnectorKeys: ir.connectorKeys ?? [] });
const fixedFiles: Record<string, Json> = {
  ".tmh/config.json": { issueKeyTestcaseValues: {} },
};
const emptyDirs = [".entities", ".objects", ".templates"];

// 雛形（kind ごと）。キーの順は Studio の project.json の順
function template(kind: "process" | "longRunning"): Obj {
  return {
    name: "",
    projectId: "",
    description: "",
    main: "Main.xaml",
    dependencies: {},
    webServices: [],
    entitiesStores: [],
    schemaVersion: "4.1",
    studioVersion: "",
    projectVersion: "1.0.0",
    runtimeOptions: {
      autoDispose: false,
      netFrameworkLazyLoading: false,
      isPausable: true,
      isAttended: false,
      requiresUserInteraction: kind !== "longRunning",
      supportsPersistence: kind === "longRunning",
      workflowSerialization: "NewtonsoftJson",
      excludedLoggedData: ["Private:*", "*password*"],
      executionType: "Workflow",
      readyForPiP: false,
      startsInPiP: false,
      mustRestoreAllDependencies: true,
      pipType: "ChildSession",
    },
    designOptions: {
      projectProfile: "Developement",
      outputType: "Process",
      libraryOptions: { privateWorkflows: [] },
      processOptions: { ignoredFiles: [] },
      fileInfoCollection: [],
      saveToCloud: false,
    },
    expressionLanguage: "VisualBasic",
    entryPoints: [],
    isTemplate: false,
    templateProjectData: {},
    publishData: {},
    targetFramework: "Windows",
  };
}

const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: Json | undefined, b: Json | undefined) => JSON.stringify(a) === JSON.stringify(b);

// b のうち a と違うところ（辞書は入れ子に、配列と値はまるごと）。消えたキーは null
function diff(a: Obj, b: Obj): Obj | undefined {
  const out: Obj = {};
  for (const [k, v] of Object.entries(b)) {
    if (same(a[k], v)) continue;
    if (isObj(a[k]) && isObj(v)) { const d = diff(a[k] as Obj, v); if (d) out[k] = d; } else out[k] = v;
  }
  for (const k of Object.keys(a)) if (!(k in b)) out[k] = null;
  return Object.keys(out).length ? out : undefined;
}
// a に d を重ねる（a のキーの順を保ち、新しいキーは後ろに足す。null は消す）
function merge(a: Obj, d: Obj | undefined): Obj {
  if (!d) return a;
  const out: Obj = {};
  for (const [k, v] of Object.entries(a)) {
    if (!(k in d)) { out[k] = v; continue; }
    const x = d[k];
    if (x === null) continue;
    out[k] = isObj(v) && isObj(x) ? merge(v, x) : x;
  }
  for (const [k, x] of Object.entries(d)) if (!(k in a) && x !== null) out[k] = x;
  return out;
}

// 名前から決まる GUID（UUID v5 の形。何度作っても同じ）
export function stableGuid(seed: string): string {
  const h = createHash("sha1").update(`uipath-ir-builder/project/${seed}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

// IR の値から project.json の値を作る（overrides を重ねる前）
function base(ir: ProjectIr): Obj {
  const t = template(ir.kind ?? "process");
  const main = ir.main ?? "Main.xaml";
  const eps = ir.entryPoints ?? [{ filePath: main }];
  return {
    ...t,
    name: ir.name,
    projectId: ir.projectId ?? stableGuid(ir.name),
    description: ir.description ?? "",
    main,
    dependencies: ir.dependencies,
    studioVersion: ir.studioVersion ?? "26.10.0.0",
    expressionLanguage: ir.expressionLanguage ?? "VisualBasic",
    entryPoints: eps.map((e) => ({ filePath: e.filePath, uniqueId: e.uniqueId ?? stableGuid(`${ir.name}/${e.filePath}`), input: e.input ?? [], output: e.output ?? [] })),
    targetFramework: ir.targetFramework ?? "Windows",
  };
}

export function projectJson(ir: ProjectIr): Obj { return merge(base(ir), ir.overrides); }

const uiprojOf = (pj: Obj): Obj => ({ Name: pj.name, ProjectType: (isObj(pj.designOptions) ? pj.designOptions.outputType : undefined) ?? "Process", Description: pj.description, MainFile: pj.main });

// project.json（と、あれば .project/design.json・project.uiproj）の中身から IR を作る（generate の逆。作り直すと同じものになる）
export function importProject(pj: Obj, more: { design?: Obj; uiproj?: Obj } = {}): ProjectIr {
  const rt = isObj(pj.runtimeOptions) ? pj.runtimeOptions : {};
  const kind: "process" | "longRunning" = rt.supportsPersistence === true && rt.requiresUserInteraction === false ? "longRunning" : "process";
  const ir: ProjectIr = { name: String(pj.name), kind, dependencies: (pj.dependencies ?? {}) as Record<string, string> };
  if (pj.description !== undefined) ir.description = String(pj.description);
  if (pj.expressionLanguage !== undefined) ir.expressionLanguage = pj.expressionLanguage as ProjectIr["expressionLanguage"];
  if (pj.targetFramework !== undefined) ir.targetFramework = pj.targetFramework as ProjectIr["targetFramework"];
  if (pj.studioVersion !== undefined) ir.studioVersion = String(pj.studioVersion);
  if (pj.main !== undefined) ir.main = String(pj.main);
  if (pj.projectId !== undefined) ir.projectId = String(pj.projectId);
  if (Array.isArray(pj.entryPoints)) ir.entryPoints = (pj.entryPoints as Obj[]).map((e) => ({
    filePath: String(e.filePath),
    ...(e.uniqueId !== undefined ? { uniqueId: String(e.uniqueId) } : {}),
    ...(Array.isArray(e.input) && e.input.length ? { input: e.input } : {}),
    ...(Array.isArray(e.output) && e.output.length ? { output: e.output } : {}),
  }));
  const d = diff(base(ir), pj);
  if (d) ir.overrides = d;
  if (Array.isArray(more.design?.ConnectorKeys) && more.design.ConnectorKeys.length) ir.connectorKeys = more.design.ConnectorKeys.map(String);
  if (more.uiproj) { const u = diff(uiprojOf(projectJson(ir)), more.uiproj); if (u) ir.uiproj = u; }
  return ir;
}

const text = (v: Json) => JSON.stringify(v, null, 2);

// IR から作るファイル（プロジェクトからの相対パス → 中身）。空のフォルダは "" の代わりに null
export function projectFiles(ir: ProjectIr): Map<string, string | null> {
  const pj = projectJson(ir);
  const out = new Map<string, string | null>();
  out.set("project.json", text(pj));
  const design = isObj(pj.designOptions) ? pj.designOptions : {};
  out.set("project.uiproj", text(merge(uiprojOf(pj), ir.uiproj)));
  const type = String(design.outputType ?? "Process").toLowerCase();
  out.set("entry-points.json", text({ $schema: "https://cloud.uipath.com/draft/2024-12/entry-point", entryPoints: (pj.entryPoints as Obj[]).map((e) => ({ filePath: e.filePath, uniqueId: e.uniqueId, type })) }));
  out.set(".project/design.json", text(designJson(ir)));
  for (const [p, v] of Object.entries(fixedFiles)) out.set(p, text(v));
  for (const d of emptyDirs) out.set(d, null);
  return out;
}

const readJson = (p: string): Obj => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
export function importProjectDir(dir: string): ProjectIr {
  const opt = (f: string) => (existsSync(join(dir, f)) ? readJson(join(dir, f)) : undefined);
  const ir = importProject(readJson(join(dir, "project.json")), { design: opt(".project/design.json"), uiproj: opt("project.uiproj") });
  const main = join(dir, ir.main ?? "Main.xaml");
  const ri = existsSync(main) ? readRootImports(readFileSync(main, "utf8")) : undefined;
  if (ri) ir.rootImports = ri;
  return ir;
}
const norm = (s: string) => s.replace(/^﻿/, "").replace(/\r\n/g, "\n").trimEnd();

// 作り直したものと、プロジェクトにあるものを比べる。違うファイルの一覧（JSON は中身で比べる）
export function compareProject(dir: string, ir: ProjectIr): { path: string; problem: string }[] {
  const out: { path: string; problem: string }[] = [];
  for (const [p, body] of projectFiles(ir)) {
    const f = join(dir, p);
    if (body === null) { if (!existsSync(f)) out.push({ path: p, problem: "フォルダが無い" }); continue; }
    if (!existsSync(f)) { out.push({ path: p, problem: "ファイルが無い" }); continue; }
    const have = norm(readFileSync(f, "utf8"));
    if (have === norm(body)) continue;
    let sameJson = false;
    try { sameJson = same(JSON.parse(have), JSON.parse(body)); } catch { /* JSON でない */ }
    if (!sameJson) out.push({ path: p, problem: "中身が違う" });
    else if (have.replace(/\s+/g, "") !== body.replace(/\s+/g, "")) out.push({ path: p, problem: "キーの順が違う（中身は同じ）" });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const cmd = args[0];
  const usage = "使い方: node tools/ir/project.ts import --project <P> [--out <file>] | gen <project.ir.json> --out <dir> | check --project <P>";
  if (cmd === "import" || cmd === "check") {
    const p = val("--project");
    if (!p) { console.error(usage); process.exit(2); }
    const ir = importProjectDir(p);
    if (cmd === "import") {
      const out = val("--out") ?? join(p, "ir", "project.ir.json");
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, text(ir as unknown as Json) + "\n", "utf8");
      console.log(`OK ${join(p, "project.json")} -> ${out}`);
      return;
    }
    const probs = compareProject(p, ir);
    for (const x of probs) console.log(`  違い ${x.path}: ${x.problem}`);
    for (const u of UNGENERATED) console.log(`  作らない ${u.path}: ${u.why}`);
    console.log(probs.length ? `NG ${p}（${probs.length} 件の違い）` : `OK ${p}（IR から作り直したものと同じ）`);
    process.exit(probs.length ? 1 : 0);
  }
  if (cmd === "gen") {
    const f = args[1], out = val("--out");
    if (!f || !out) { console.error(usage); process.exit(2); }
    const ir = readJson(f) as unknown as ProjectIr;
    for (const [p, body] of projectFiles(ir)) {
      const t = join(out, p);
      if (body === null) { mkdirSync(t, { recursive: true }); continue; }
      mkdirSync(dirname(t), { recursive: true });
      writeFileSync(t, body, "utf8");
    }
    console.log(`OK ${f} -> ${resolve(out)}`);
    return;
  }
  console.error(usage);
  process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
