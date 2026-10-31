// プロパティの網羅レポート。カタログの全アクティビティの全プロパティを「IR で書ける / 書けない（理由）」に分け、
// サンプル IR（samples/ir/**）で実際に使ったプロパティと、Coded の対応表の有無も数える。
//
// 使い方:
//   node tools/ir/coverage.ts                     knowledge/coverage.md を書き直す
//   node tools/ir/coverage.ts --activity NClick   1アクティビティの内訳を表示する（ワーカー向け）
//   node tools/ir/coverage.ts --check             knowledge/coverage.md が最新か確かめる（違えば終了コード 1）
//   node tools/ir/coverage.ts --project <dir> [--activity NClick]
//                                                 そのプロジェクトの dependencies の版のカタログで見る。
//                                                 knowledge/coverage.md は既定の版のものなので書かず、標準出力に出す

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve, defaultSlot, writable, READ_ONLY } from "./catalog.ts";
import type { Activity } from "./catalog.ts";
import { loadMappings } from "./mapping.ts";
import { isBuiltin } from "./generate-coded.ts";
import { loadSelected, runSelection } from "./versions.ts";
import type { Node, Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const projectIdx = process.argv.indexOf("--project");
const project = projectIdx >= 0 ? process.argv[projectIdx + 1] : undefined;
const cat = runSelection(() => {
  const { cat, warnings } = loadSelected(root, project);
  for (const w of warnings) console.error(`注意: ${w}`);
  return cat;
});
const { maps } = loadMappings(root);

// ---- サンプルで使ったプロパティ ----
const used = new Map<string, Set<string>>(); // clrType -> props
const usedBy = new Map<string, Set<string>>(); // clrType -> サンプルのファイル
function walkIr(dir: string) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walkIr(p); continue; }
    if (!e.endsWith(".json") || /\.(verify|expected|args)\.json$/i.test(e)) continue;
    const wf = JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) as Workflow;
    const rel = p.slice(root.length + 1).replaceAll("\\", "/");
    wf.body.forEach((n) => visit(n, rel));
  }
}
function visit(n: Node, file: string) {
  const r = resolve(cat, n.act, n.typeArg !== undefined);
  const kids = [...(n.body ?? []), ...(n.then ?? []), ...(n.else ?? []), ...Object.values(n.slots ?? {}).flat(), ...Object.values(n.cases ?? {}).flat(), ...(n.catches ?? []).flatMap((c) => c.body)];
  if ("activity" in r) {
    const a = r.activity;
    const s = used.get(a.clrType) ?? new Set<string>();
    for (const k of Object.keys(n.props ?? {})) s.add(k);
    for (const k of Object.keys(n.slots ?? {})) s.add(k);
    for (const k of Object.keys(n.dicts ?? {})) s.add(k);
    for (const k of Object.keys(n.lists ?? {})) s.add(k);
    for (const k of Object.keys(n.objs ?? {})) s.add(k);
    if (n.body) { const d = defaultSlot(a); if (d) s.add(d.name); }
    if (n.then) s.add("Then");
    if (n.else) s.add("Else");
    if (n.args) s.add("Arguments");
    if (n.variables) s.add("Variables");
    if (n.name) s.add("DisplayName");
    if (n.cases) s.add("Cases");
    if (n.catches) s.add("Catches");
    if (n.assigns) s.add("AssignOperations");
    used.set(a.clrType, s);
    usedBy.set(a.clrType, (usedBy.get(a.clrType) ?? new Set()).add(file));
  }
  kids.forEach((k) => visit(k, file));
}
walkIr(join(root, "samples", "ir"));
walkIr(join(root, "samples", "ir-unbuildable"));

// ---- 集計 ----
type Row = { a: Activity; ok: string[]; ng: { name: string; reason: string; group: string }[]; used: string[]; coded: string };
const rows: Row[] = cat.activities
  .filter((a) => a.browsable && !a.obsolete)
  .map((a) => {
    const ok: string[] = [], ng: Row["ng"] = [];
    for (const p of a.props.filter((p) => !p.obsolete && !p.readOnly)) {
      const w = writable(a, p);
      if (w.ok) ok.push(p.name); else ng.push({ name: p.name, reason: w.reason, group: w.group });
    }
    const m = maps.get(`${a.package}/${a.className}`);
    const coded = isBuiltin(a.clrType) ? "C# の構文" : !m ? "未作成" : m.coded === null ? `なし（${m.reason}）` : "あり";
    return { a, ok, ng, used: [...(used.get(a.clrType) ?? [])].sort(), coded };
  });

const args = process.argv.slice(2);
const ai = args.indexOf("--activity");
if (ai >= 0) {
  const name = args[ai + 1];
  const hits = rows.filter((r) => r.a.className === name || r.a.clrType === name);
  if (!hits.length) { console.error(`カタログに ${name} が無い`); process.exit(2); }
  for (const r of hits) {
    console.log(`${r.a.clrType}（${r.a.package}）  Coded の対応表: ${r.coded}`);
    console.log(`サンプル: ${[...(usedBy.get(r.a.clrType) ?? [])].join(", ") || "なし"}`);
    for (const p of r.a.props.filter((p) => !p.obsolete)) {
      const w = writable(r.a, p);
      const u = r.used.includes(p.name) ? "使用" : "    ";
      console.log(`  ${w.ok ? "書ける  " : "書けない"} ${u} ${p.name.padEnd(28)} ${p.kind.padEnd(8)} ${p.required ? "必須 " : "     "}${w.ok ? w.how : w.reason}`);
    }
  }
  process.exit(0);
}

const md = render();
if (project) {
  if (args.includes("--check")) { console.error("--check は既定の版の knowledge/coverage.md を見るので、--project と一緒に使えない"); process.exit(2); }
  process.stdout.write(md);
  process.exit(0);
}
const out = join(root, "knowledge", "coverage.md");
if (args.includes("--check")) {
  const cur = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (cur.replace(/\r\n/g, "\n") !== md) { console.error("knowledge/coverage.md が古い。node tools/ir/coverage.ts で作り直す"); process.exit(1); }
  console.log("knowledge/coverage.md は最新");
  process.exit(0);
}
writeFileSync(out, md, "utf8");
console.log(`→ knowledge/coverage.md（${rows.length} アクティビティ）`);

function render(): string {
  const L: string[] = [];
  L.push("# プロパティの網羅", "", "`node tools/ir/coverage.ts` が生成する。手で直さない。", "");
  L.push("カタログ（非推奨・非表示を除く）の全プロパティを、IR で書けるかで分けた。「サンプルで使用」は `samples/ir/**` の IR で実際に書いたプロパティ。「Coded」は `mappings/` の対応表の状態。", "");
  L.push("| パッケージ | アクティビティ | プロパティ | 書ける | 書けない | サンプルで使用 | Coded 対応表あり / C# の構文 / API なし / 未作成 |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const pkg of [...new Set(rows.map((r) => r.a.package))].sort()) {
    const rs = rows.filter((r) => r.a.package === pkg);
    const total = rs.reduce((n, r) => n + r.ok.length + r.ng.length, 0);
    const ok = rs.reduce((n, r) => n + r.ok.length, 0);
    const u = rs.reduce((n, r) => n + r.used.length, 0);
    const c = (k: string) => rs.filter((r) => r.coded.startsWith(k)).length;
    L.push(`| ${pkg} | ${rs.length} | ${total} | ${ok} | ${total - ok} | ${u} | ${c("あり")} / ${c("C#")} / ${c("なし")} / ${c("未作成")} |`);
  }
  const ro = rows.reduce((n, r) => n + r.a.props.filter((p) => !p.obsolete && p.readOnly).length, 0);
  L.push("", `読み取り専用（public の setter が無い）のプロパティ ${ro} 件は、そもそも XAML に書けないので上の数に入れていない（${READ_ONLY}。\`--activity\` では「書けない」と出る）。`);
  L.push("", "## 書けないプロパティ（理由別）", "");
  const groups = new Map<string, number>();
  for (const r of rows) for (const n of r.ng) groups.set(n.group, (groups.get(n.group) ?? 0) + 1);
  L.push("| 理由 | 数 | 方針 |", "| --- | --- | --- |");
  const policy: Record<string, string> = {
    "UI のターゲット": "Target / TargetAnchorable / ClickOffset など。UIAutomation の設計を担当するワーカーが IR の形を決める（後で追記）",
    "コレクション": "List / Collection / 配列の値。要素構文（`<Prop><scg:List>…</scg:List></Prop>`）が要る。IR では JSON の配列で書き、生成器が要素構文にする方針。必要になったアクティビティのイシューで対応する",
    "オブジェクト": "CultureInfo、フィルター設定などの複合型。型ごとに XAML の書き方を get-default-xaml で確かめてから対応する",
    "ActivityFunc": "戻り値のある delegate（RetryScope.Condition など）。IR に `func` の書き方を足す必要がある",
    "Nullable": "Nullable<T> は属性に書ける。ここに残るのは T が分からないもの",
  };
  for (const [g, n] of [...groups].sort((a, b) => b[1] - a[1])) L.push(`| ${g} | ${n} | ${policy[g] ?? ""} |`);
  L.push("", "理由と、対応しないものの判断は [coverage-gaps.md](coverage-gaps.md)。");
  L.push("", "対応済みの書き方: Dictionary<String, Argument> は IR の `dicts`、System.Type は型名の文字列（`{x:Type}` で出す）、Nullable<T> は属性。", "");
  L.push("## アクティビティごと", "");
  for (const pkg of [...new Set(rows.map((r) => r.a.package))].sort()) {
    L.push(`### ${pkg}`, "", "| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |", "| --- | --- | --- | --- | --- |");
    for (const r of rows.filter((r) => r.a.package === pkg).sort((x, y) => x.a.className.localeCompare(y.a.className) || x.a.clrType.localeCompare(y.a.clrType))) {
      const ng = r.ng.map((n) => `${n.name}（${n.group}）`).join(", ");
      const name = rows.filter((x) => x.a.className === r.a.className).length > 1 ? `${r.a.className}${r.a.genericArity ? "`" + r.a.genericArity : ""}` : r.a.className;
      L.push(`| ${name} | ${r.ok.length}/${r.ok.length + r.ng.length} | ${ng || "-"} | ${r.used.length ? r.used.join(", ") : "-"} | ${r.coded.replace(/\|/g, "\\|")} |`);
    }
    L.push("");
  }
  return L.join("\n");
}
