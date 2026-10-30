// XAML → Coded Workflow の置き換えの見積もり。Studio も build も使わない。
//
//   node tools/ir/migrate-report.ts <file.xaml>... [--json]
//   node tools/ir/migrate-report.ts --dropped-props   … 全対応表の ignore を knowledge/coded-dropped-props.md に書き出す
//
// 1つの XAML について、次を一覧にする:
// - どのアクティビティが Coded に置き換えられるか（C# の構文 / 対応表あり / coded: null / 対応表が無い）
// - 対応表の ignore で値が捨てられるプロパティ（XAML に値があるものだけ）
// - knowledge/coded-workflow.md の「XAML と C# で動きが違うもの」に当たるもの
// - generateCoded で実際に出た問題（直せない式、対応表が扱っていないプロパティなど）
// - XAML → IR の取り込みで捨てたもの
//
// 対応表の中身はコードに持たない（mappings/ と knowledge/coded-workflow.md を毎回読む）。

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalog, ObjType } from "./catalog.ts";
import { loadCatalog, objectTypes, objTypeFor, resolve } from "./catalog.ts";
import { generateCoded, isBuiltin } from "./generate-coded.ts";
import { CATALOG_FILES, droppedSummary, importAndCheck, repoRoot } from "./import-xaml.ts";
import type { FullImport, ImportIssue } from "./import-xaml.ts";
import type { Mapping, Variant } from "./mapping.ts";
import { loadMappings } from "./mapping.ts";
import type { Issue, Node, ObjValue, Value, Workflow } from "./types.ts";
import { codedModels } from "./uia.ts";

export type ActivityStatus = "syntax" | "mapped" | "null" | "partial" | "nomap" | "unknown";
export const STATUS_LABEL: Record<ActivityStatus, string> = {
  syntax: "C# の構文",
  mapped: "対応表あり",
  null: "Coded API なし（coded: null）",
  partial: "この形だけ Coded API なし",
  nomap: "対応表が無い",
  unknown: "カタログに無い",
};

export type ActivityRow = { path: string; act: string; status: ActivityStatus; call?: string; reason?: string; file?: string };
export type DroppedProp = { path: string; act: string; prop: string; value: string; where: "ignore" | "形の ignore" | "モデルに無い"; file?: string };
export type BehaviorWarning = { path: string; act: string; subject: string; text: string };
export type Report = {
  file: string;
  workflow?: string;
  importable: boolean;
  activities: ActivityRow[];
  dropped: DroppedProp[];
  behavior: BehaviorWarning[];
  coded: Issue[];
  codedOk: boolean;
  import: FullImport;
};

// ---- 「XAML と C# で動きが違うもの」----

// 節の箇条書き（- `名前`：説明）を読む。名前はクラス名、プロパティ名、system.メソッド名
export function loadBehaviorNotes(root: string): { subject: string; text: string }[] {
  const f = join(root, "knowledge", "coded-workflow.md");
  if (!existsSync(f)) return [];
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => /^## XAML と C# で動きが違うもの/.test(l));
  if (start < 0) return [];
  const out: { subject: string; text: string }[] = [];
  for (const l of lines.slice(start + 1)) {
    if (l.startsWith("## ")) break;
    const m = l.match(/^- `([^`]+)`[：:]\s*(.+)$/);
    if (m) out.push({ subject: m[1], text: m[2] });
  }
  return out;
}

// ---- 木を歩く ----

function walk(nodes: Node[], path: string, visit: (n: Node, path: string) => void) {
  nodes.forEach((n, i) => {
    const at = `${path}[${i}]`;
    visit(n, at);
    if (n.body) walk(n.body, `${at}.body`, visit);
    if (n.then) walk(n.then, `${at}.then`, visit);
    if (n.else) walk(n.else, `${at}.else`, visit);
    for (const [k, v] of Object.entries(n.slots ?? {})) walk(v, `${at}.slots.${k}`, visit);
    for (const [k, v] of Object.entries(n.cases ?? {})) walk(v, `${at}.cases.${k}`, visit);
    (n.catches ?? []).forEach((c, j) => walk(c.body, `${at}.catches[${j}].body`, visit));
  });
}

const given = (n: Node) => [...Object.keys(n.props ?? {}), ...Object.keys(n.objs ?? {}), ...Object.keys(n.lists ?? {}), ...Object.keys(n.dicts ?? {})];

// generate-coded の mapped と同じ選び方（when がそろう最初の形）
function pickVariant(m: Mapping, n: Node): Variant | undefined {
  const g = given(n);
  const ok = (w: string) => {
    const eq = w.indexOf("=");
    return eq < 0 ? g.includes(w) : n.props?.[w.slice(0, eq)] !== undefined && String(n.props[w.slice(0, eq)]) === w.slice(eq + 1);
  };
  return (m.coded ?? []).find((v) => (v.when ?? []).every(ok));
}

const show = (v: unknown): string => {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (v && typeof v === "object" && "lit" in v) return JSON.stringify((v as { lit: string }).lit);
  const s = JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
};

const valueOf = (n: Node, k: string): unknown => n.props?.[k] ?? n.objs?.[k] ?? n.lists?.[k] ?? n.dicts?.[k];

// Coded のモデルに写さない（codedModels で null の）オブジェクトのプロパティ
function modelDropped(t: ObjType | undefined, v: ObjValue, prefix: string, push: (prop: string, value: unknown) => void) {
  if (!t) return;
  const model = codedModels[t.clrType];
  for (const [k, x] of Object.entries(v)) {
    if (k === "$type") continue;
    if (model && model.props[k] === null) { push(`${prefix}.${k}`, x); continue; }
    const p = t.props.find((q) => q.name === k);
    const sub = p && objectTypes.get(p.type);
    if (sub && x && typeof x === "object" && !Array.isArray(x)) modelDropped(sub, x as ObjValue, `${prefix}.${k}`, push);
  }
}

export function reportWorkflow(file: string, xml: string, cat: Catalog, maps: Map<string, Mapping>, notes: { subject: string; text: string }[]): Report {
  const imp = importAndCheck(xml, cat, maps);
  const wf: Workflow | undefined = imp.wf;
  const importable = !!wf && !imp.errors.length && !imp.validation.length;
  const r: Report = { file, workflow: wf?.workflow || undefined, importable, activities: [], dropped: [], behavior: [], coded: [], codedOk: false, import: imp };
  if (!wf) return r;

  walk(wf.body, "body", (n, path) => {
    const res = resolve(cat, n.act, n.typeArg !== undefined);
    if ("error" in res) { r.activities.push({ path, act: n.act, status: "unknown", reason: res.error }); return; }
    const a = res.activity;
    const m = maps.get(`${a.package}/${a.className}`);
    let v: Variant | undefined;
    if (isBuiltin(a.clrType)) r.activities.push({ path, act: a.className, status: "syntax" });
    else if (!m) r.activities.push({ path, act: a.className, status: "nomap", reason: `mappings/${a.package}/${a.className}.json が無い` });
    else if (m.coded === null) r.activities.push({ path, act: a.className, status: "null", reason: m.reason, file: m.file });
    else {
      v = pickVariant(m, n);
      if (!v) r.activities.push({ path, act: a.className, status: "partial", reason: `この props（${given(n).join(", ")}）に合う形が対応表に無い`, file: m.file });
      else if (v.reason && !v.call && !v.code && !v.special && !v.scope) r.activities.push({ path, act: a.className, status: "partial", reason: v.reason, file: m.file });
      else r.activities.push({ path, act: a.className, status: "mapped", call: v.call ?? (v.special ? `(${v.special})` : "(コード)"), file: m.file });
    }

    // 値が捨てられるもの。置き換えられないアクティビティ（coded: null）は、そもそも C# にならないので出さない
    if (m && m.coded !== null) {
      for (const k of given(n)) {
        const where = (m.ignore ?? []).includes(k) ? "ignore" : (v?.ignore ?? []).includes(k) ? "形の ignore" : undefined;
        if (where) r.dropped.push({ path, act: a.className, prop: k, value: show(valueOf(n, k)), where, file: m.file });
      }
    }
    if (isBuiltin(a.clrType) || m?.coded) {
      for (const [k, o] of Object.entries(n.objs ?? {})) {
        const p = a.props.find((q) => q.name === k);
        if (p) modelDropped(objTypeFor(p.type, o), o, k, (prop, value) => r.dropped.push({ path, act: a.className, prop, value: show(value), where: "モデルに無い" }));
      }
    }

    for (const note of notes) {
      const s = note.subject;
      // プロパティの名前で当たるものは、リテラルの False（既定の動きのまま）なら出さない
      const hit = s === a.className || (given(n).includes(s) && n.props?.[s] !== false) || (s.includes(".") && v?.call === s);
      if (hit) r.behavior.push({ path, act: a.className, subject: s, text: note.text });
    }
  });

  if (!imp.errors.length) {
    const g = generateCoded(wf, cat, maps, { namespace: "Migrated", invokePath: (p) => p.replace(/^(.*?)([^\\/]+)\.xaml$/i, "coded/$2.cs") });
    r.coded = g.issues;
    r.codedOk = !g.issues.length;
  }
  return r;
}

// ---- 文章にする ----

export function formatReport(r: Report): string {
  const out: string[] = [];
  const section = (t: string, n: number) => { if (n) out.push("", `## ${t}（${n} 件）`); };
  out.push(`# ${basename(r.file)}${r.workflow ? `（${r.workflow}）` : ""}`);
  const verdict = !r.importable ? "取り込めない（下の「取り込めない理由」）" : r.codedOk ? (r.dropped.length || r.behavior.length ? "C# を生成できる。ただし下の警告を確かめる" : "C# を生成できる") : "このままでは C# を生成できない（下の「C# の生成で出た問題」）";
  out.push(`判定: ${verdict}`);
  const counts = new Map<ActivityStatus, number>();
  for (const a of r.activities) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  out.push(`アクティビティ ${r.activities.length} 個: ${[...counts].map(([s, c]) => `${STATUS_LABEL[s]} ${c}`).join(" / ") || "なし"}`);

  section("取り込めない理由", r.import.errors.length + r.import.validation.length);
  for (const i of [...r.import.errors, ...r.import.validation]) out.push(`- ${i.code} ${i.path}: ${i.message}`);

  const by = (s: ActivityStatus) => {
    const group = new Map<string, ActivityRow[]>();
    for (const a of r.activities.filter((x) => x.status === s)) group.set(a.act, [...(group.get(a.act) ?? []), a]);
    return [...group];
  };
  for (const s of ["null", "partial", "nomap", "unknown"] as ActivityStatus[]) {
    const rows = r.activities.filter((x) => x.status === s);
    section(STATUS_LABEL[s], rows.length);
    for (const [act, list] of by(s)) out.push(`- ${act} × ${list.length}: ${list[0].reason ?? ""}${list[0].file ? `（${list[0].file}）` : ""}`);
  }
  section("値が捨てられるプロパティ", r.dropped.length);
  for (const d of r.dropped) out.push(`- ${d.act}.${d.prop} = ${d.value}（${d.where}${d.file ? `、${d.file}` : ""}）[${d.path}]`);
  section("XAML と C# で動きが違うもの", r.behavior.length);
  for (const b of r.behavior) out.push(`- ${b.act}（${b.subject}）: ${b.text} [${b.path}]`);
  section("C# の生成で出た問題", r.coded.length);
  for (const i of r.coded) out.push(`- ${i.code} ${i.path}: ${i.message}`);
  section("取り込みの警告", r.import.warnings.length);
  for (const i of r.import.warnings as ImportIssue[]) out.push(`- ${i.code} ${i.path}: ${i.message}`);
  const sum = droppedSummary(r.import.dropped);
  if (sum.length) {
    out.push("", "## 取り込みで捨てたもの");
    for (const s of sum) out.push(`- ${s.kind}: ${s.count} 件（${s.examples.join(", ")}）`);
  }
  const rows = by("mapped");
  if (rows.length) {
    out.push("", "## 対応表で置き換えるもの");
    for (const [act, list] of rows) out.push(`- ${act} × ${list.length} → ${list[0].call}`);
  }
  return out.join("\n");
}

// ---- 全対応表の ignore ----

const cell = (s: string) => s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");

export function droppedPropsMarkdown(maps: Map<string, Mapping>): string {
  const rows = [...maps.values()].sort((a, b) => `${a.package}/${a.activity}`.localeCompare(`${b.package}/${b.activity}`, "en"));
  const withIgnore = rows.filter((m) => (m.ignore?.length ?? 0) > 0 || (m.coded ?? []).some((v) => v.ignore?.length));
  const props = withIgnore.reduce((n, m) => n + (m.ignore?.length ?? 0) + (m.coded ?? []).reduce((x, v) => x + (v.ignore?.length ?? 0), 0), 0);
  const out: string[] = [
    "# Coded に置き換えると値が捨てられるプロパティ",
    "",
    "`node tools/ir/migrate-report.ts --dropped-props` が `mappings/**/*.json` から作る。手で直さない（対応表を直して作り直す）。",
    "",
    "XAML にこのプロパティの値があると、C# には反映されない。実際の XAML でどれに当たるかは `node tools/ir/migrate-report.ts <file.xaml>` で見る。",
    "",
    `対応表 ${rows.length} 件のうち ${withIgnore.length} 件に ${props} 個（形ごとの指定を含む）。`,
  ];
  const pkgs = [...new Set(withIgnore.map((m) => m.package))];
  for (const pkg of pkgs) {
    out.push("", `## ${pkg}`, "", "| アクティビティ | 捨てられるプロパティ | 形ごとの指定 | 対応表のメモ |", "| --- | --- | --- | --- |");
    for (const m of withIgnore.filter((x) => x.package === pkg)) {
      const forms = (m.coded ?? []).filter((v) => v.ignore?.length).map((v) => `${v.when?.length ? `when ${v.when.join(", ")}` : "全部"}: ${v.ignore!.join(", ")}`);
      out.push(`| ${m.activity} | ${(m.ignore ?? []).join(", ")} | ${cell(forms.join(" / "))} | ${cell(m.notes ?? "")} |`);
    }
  }
  out.push("", "## UI のオブジェクト（tools/ir/uia.ts の codedModels で null のもの）", "", "| 型 | 捨てられるプロパティ |", "| --- | --- |");
  for (const [t, m] of Object.entries(codedModels).sort(([a], [b]) => a.localeCompare(b, "en"))) {
    const dropped = Object.entries(m.props).filter(([k, v]) => v === null && k !== "$type").map(([k]) => k);
    if (dropped.length) out.push(`| ${t} | ${dropped.join(", ")} |`);
  }
  const unsupported = Object.entries(codedModels).flatMap(([t, m]) => Object.entries(m.props).filter(([, v]) => typeof v === "string" && v.startsWith("!")).map(([k, v]) => `| ${t}.${k} | ${cell((v as string).slice(1))} |`));
  if (unsupported.length) out.push("", "## UI のオブジェクト：書くと C# を作れないもの（CODED_UNSUPPORTED）", "", "| プロパティ | 理由 |", "| --- | --- |", ...unsupported);
  out.push("");
  return out.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const { maps, errors } = loadMappings(repoRoot);
  if (errors.length) console.error(errors.join("\n"));
  if (args.includes("--dropped-props")) {
    const path = join(repoRoot, "knowledge", "coded-dropped-props.md");
    writeFileSync(path, droppedPropsMarkdown(maps), "utf8");
    console.log(`-> ${path}`);
    return;
  }
  const json = args.includes("--json");
  const files = args.filter((a) => !a.startsWith("--"));
  if (!files.length) { console.error("使い方: node tools/ir/migrate-report.ts <file.xaml>... [--json] | --dropped-props"); process.exit(2); }
  const cat = loadCatalog(repoRoot, CATALOG_FILES);
  const notes = loadBehaviorNotes(repoRoot);
  const reports = files.map((f) => reportWorkflow(f, readFileSync(f, "utf8"), cat, maps, notes));
  if (json) console.log(JSON.stringify(reports.map(({ import: imp, ...x }) => ({ ...x, importErrors: imp.errors, importWarnings: imp.warnings, validation: imp.validation, droppedByImport: droppedSummary(imp.dropped) })), null, 2));
  else console.log(reports.map(formatReport).join("\n\n"));
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();
