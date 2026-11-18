// IR から、書かなくても同じ意味になる props（既定値と同じもの）を落とす。
//
//   node tools/ir/slim.ts [--project <P>] [--coded] [--write] <ir.json>...
//     既定（XAML でも Coded でも同じ意味になるものだけ）：
//       - 既定 XAML の値と同じ（IR に無いときの意味。generate.ts / generate-coded.ts が同じ値を補う。import-xaml.ts も落としている）
//       - アクティビティの DefaultValue と同じ（XAML に属性が無いと、この値になる）
//     --coded（その IR を Coded にしか使わないとき）：上に加えて、1つずつ消してみて、gen-coded と同じ生成の C# がまったく変わらないもの。
//       カタログで既定値が分からない enum（InteractionMode=SameAsCard など）も、C# の出力で確かめて落とす。
//       XAML にすると意味が変わることがあるので、XAML も作る IR には使わない
//     --write  ファイルを書き換える（無ければ、落とせるものを出すだけ）
//
// 必須（required）の props は落とさない（import-xaml.ts と同じ）。props だけを見る（objs のターゲットの中身は見ない）。

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Activity, Catalog } from "./catalog.ts";
import { resolve } from "./catalog.ts";
import { xamlDefaultProps } from "./import-xaml.ts";
import type { Node, Value, Workflow } from "./types.ts";

export type SlimHit = { path: string; activity: string; prop: string; value: Value; why: "既定 XAML" | "DefaultValue" | "C# が同じ" };

const lit = (v: unknown) => (v !== null && typeof v === "object" && "lit" in (v as object) ? (v as { lit: unknown }).lit : v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b) || String(lit(a)).toLowerCase() === String(lit(b)).toLowerCase();

// アクティビティの DefaultValue を IR の値の形にする（enum の数値は名前に。カタログの enum は宣言の順）
export function defaultValueOf(a: Activity, prop: string): Value | undefined {
  const p = a.props.find((x) => x.name === prop);
  if (!p || p.default === undefined || p.default === null) return undefined;
  const d = String(p.default);
  if (p.enum) return /^\d+$/.test(d) ? p.enum[Number(d)] : d;
  if (/^(true|false)$/i.test(d)) return d.toLowerCase() === "true";
  if (/^-?\d+(\.\d+)?$/.test(d)) return Number(d);
  return undefined; // 文字列などは、IR の書き方（lit か式か）と比べにくいので扱わない
}

function activityOf(cat: Catalog, n: Node): Activity | undefined {
  const r = resolve(cat, n.act, n.typeArg !== undefined);
  return "activity" in r ? r.activity : undefined;
}

export function walkActivities(nodes: Node[] | undefined, f: (n: Node, path: string) => void, path: string) {
  (nodes ?? []).forEach((n, i) => {
    const at = `${path}[${i}]`;
    f(n, at);
    walkActivities(n.body, f, `${at}.body`);
    for (const [k, v] of Object.entries(n.slots ?? {})) walkActivities(v, f, `${at}.slots.${k}`);
  });
}

// 既定 XAML / DefaultValue と同じ props（XAML でも Coded でも同じ意味）
export function slimByDefaults(wf: Workflow, cat: Catalog): SlimHit[] {
  const hits: SlimHit[] = [];
  walkActivities(wf.body, (n, at) => {
    const a = activityOf(cat, n);
    if (!a || !n.props) return;
    const xd = xamlDefaultProps(cat, a);
    for (const [k, v] of Object.entries(n.props)) {
      const p = a.props.find((x) => x.name === k);
      if (!p || (p.required && !p.overloadGroups?.length)) continue;
      if (k in xd) { if (same(v, xd[k])) hits.push({ path: at, activity: n.name ?? n.act, prop: k, value: v, why: "既定 XAML" }); continue; }
      const dv = defaultValueOf(a, k);
      if (dv !== undefined && same(v, dv)) hits.push({ path: at, activity: n.name ?? n.act, prop: k, value: v, why: "DefaultValue" });
    }
  }, "body");
  return hits;
}

// 1つずつ消してみて、C# が変わらないもの（--coded）。gen は IR → C# の文字列（失敗なら undefined）
export function slimByCoded(wf: Workflow, cat: Catalog, gen: (wf: Workflow) => string | undefined): SlimHit[] {
  const base = gen(wf);
  if (base === undefined) return [];
  const hits: SlimHit[] = [];
  const nodes: [Node, string][] = [];
  walkActivities(wf.body, (n, at) => nodes.push([n, at]), "body");
  for (const [n, at] of nodes) {
    const a = activityOf(cat, n);
    for (const k of Object.keys(n.props ?? {})) {
      const p = a?.props.find((x) => x.name === k);
      if (p && p.required && !p.overloadGroups?.length) continue;
      const v = n.props![k];
      delete n.props![k];
      const out = gen(wf);
      if (out === base) hits.push({ path: at, activity: n.name ?? n.act, prop: k, value: v, why: "C# が同じ" });
      else n.props![k] = v; // 戻す
    }
    if (n.props && !Object.keys(n.props).length) delete n.props;
  }
  return hits;
}

// ---- CLI ----
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const project = val("--project");
  const coded = args.includes("--coded"), write = args.includes("--write");
  const files = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--project");
  if (!files.length) { console.error("使い方: node tools/ir/slim.ts [--project <P>] [--coded] [--write] <ir.json>..."); process.exit(2); }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const { loadSelected, runSelection } = await import("./versions.ts");
  const cat = runSelection(() => loadSelected(root, project, { coded: coded }).cat);
  let gen: ((wf: Workflow) => string | undefined) | undefined;
  if (coded) {
    const { generateCoded } = await import("./generate-coded.ts");
    const { loadMappings } = await import("./mapping.ts");
    const { expandRefs } = await import("./objrepo.ts");
    const { readDescriptors } = await import("./coded-descriptors.ts");
    const { maps } = loadMappings(root);
    const descriptors = project ? readDescriptors(project) : undefined;
    gen = (wf) => {
      const ex = expandRefs(structuredClone(wf), cat, project);
      if (ex.issues.length) return undefined;
      const r = generateCoded(ex.wf, cat, maps, { namespace: "Slim", descriptors });
      return r.issues.length ? undefined : r.code;
    };
  }
  let total = 0;
  for (const f of files) {
    const raw = readFileSync(f, "utf8").replace(/^﻿/, "");
    const wf = JSON.parse(raw) as Workflow;
    const hits = slimByDefaults(wf, cat);
    // 既定値のものを先に落とす（同じ位置のノードを引き直して消す）
    const nodes = new Map<string, Node>();
    walkActivities(wf.body, (n, at) => nodes.set(at, n), "body");
    for (const h of hits) { const n = nodes.get(h.path)!; delete n.props![h.prop]; if (!Object.keys(n.props!).length) delete n.props; }
    if (gen) hits.push(...slimByCoded(wf, cat, gen));
    for (const h of hits) console.log(`  ${f}: ${h.activity}（${h.path}）の ${h.prop}=${JSON.stringify(h.value)}（${h.why}）`);
    total += hits.length;
    if (write && hits.length) {
      let out = JSON.stringify(wf, null, 2) + "\n";
      if (raw.includes("\r\n")) out = out.replace(/\n/g, "\r\n");
      writeFileSync(f, out, "utf8");
    }
  }
  console.log(`${write ? "OK 落とした" : "落とせる"}：${total} 件${!write && total ? "（--write で書き換える）" : ""}`);
}
