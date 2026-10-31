// 対応表の既定値（{Prop:-既定} と defaults）を、アクティビティの既定値と比べる。置き換えで黙って意味が変わるのを防ぐ。
//
// IR に無い props の意味は「既定 XAML の値」（generate.ts が XAML に足し、generate-coded.ts が C# に補う）。
// 既定 XAML に無いときは、カタログの DefaultValue 属性（XAML に属性が出ず、実行時にこの値になる）。どちらにも無いと「比べられない」。
//
//   差あり（mismatch）   … 対応表の値がアクティビティの既定値と違う
//   比べられない（unknown）… アクティビティの既定値が分からず、対応表の値が「無し」（null、false、0、""、_）でもない
//   どちらも knowledge/coded-default-allow.json に理由を書いたものだけ許す（tools/ir/coded-defaults.test.ts）
//
// node tools/ir/coded-defaults.ts で一覧を出す。

import { readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalog } from "./catalog.ts";
import { loadCatalog } from "./catalog.ts";
import { CATALOG_FILES, repoRoot, xamlDefaultProps } from "./import-xaml.ts";
import type { Mapping, Variant } from "./mapping.ts";
import { loadMappings } from "./mapping.ts";

export type DefaultRow = {
  activity: string;
  prop: string;
  where: "テンプレート" | "defaults";
  mapping: string; // 対応表の値
  base?: string; // アクティビティの既定値
  source?: "既定 XAML" | "DefaultValue";
  status: "ok" | "mismatch" | "unknown";
};

const text = (v: unknown) => (typeof v === "object" && v !== null && "lit" in v ? String((v as { lit: unknown }).lit) : String(v));
// C# の書き方と XAML の書き方をそろえる（true / True、"a" / a、Enum.Member / Member）
const norm = (s: string) => {
  const t = s.trim().replace(/^\\?"(.*?)\\?"$/, "$1");
  return /^(true|false)$/i.test(t) ? t.toLowerCase() : /^[\w.]+$/.test(t) && !/^-?\d/.test(t) ? t.slice(t.lastIndexOf(".") + 1) : t;
};
const EMPTY = new Set(["null", "false", "0", "", "_", "Nothing", "default"]);

function templates(v: Variant): string[] {
  const out: string[] = [];
  const add = (x: unknown) => {
    if (typeof x === "string") out.push(x);
    else if (Array.isArray(x)) x.forEach(add);
    else if (x && typeof x === "object") Object.values(x).forEach(add);
  };
  add([v.code, v.call, v.collectInit, v.args, v.init?.props]);
  return out;
}

export function compareMapping(cat: Catalog, m: Mapping): DefaultRow[] {
  if (!m.coded) return [];
  const a = cat.activities.find((x) => x.className === m.activity && x.package === m.package);
  if (!a) return [];
  const xaml = xamlDefaultProps(cat, a);
  const baseOf = (prop: string): { base?: string; source?: DefaultRow["source"] } => {
    if (xaml[prop] !== undefined) return { base: text(xaml[prop]), source: "既定 XAML" };
    const p = a.props.find((q) => q.name === prop);
    const d = p?.default;
    if (d === undefined || d === null) return {};
    // enum の DefaultValue は番号で入っていることがある（0 → IndividualColumns）
    return { base: p!.enum && /^\d+$/.test(String(d)) ? (p!.enum[Number(d)] ?? String(d)) : String(d), source: "DefaultValue" };
  };
  const rows = new Map<string, DefaultRow>();
  const row = (prop: string, where: DefaultRow["where"], mapping: string, filter?: string) => {
    const p = a.props.find((q) => q.name === prop);
    if (p && (p.kind === "out" || p.kind === "inout")) return; // 出力の捨て先（out {Prop:-_}）。既定値ではない
    const { base, source } = baseOf(prop);
    // {Prop|is_Member:-true} は、既定値が Member かどうかと比べる
    const cmp = base === undefined ? undefined : filter?.startsWith("is_") ? String(norm(base) === filter.slice(3)) : norm(base);
    const status: DefaultRow["status"] = cmp === undefined ? (EMPTY.has(norm(mapping)) ? "ok" : "unknown") : cmp === norm(mapping) ? "ok" : "mismatch";
    rows.set(`${prop}|${where}|${mapping}|${filter ?? ""}`, { activity: m.activity, prop, where, mapping, base, source, status });
  };
  for (const v of m.coded) {
    for (const [k, d] of Object.entries(v.defaults ?? {})) row(k, "defaults", text(d));
    for (const t of templates(v)) for (const r of t.matchAll(/\{(\w+)(?:\|(\w+))?:-([^}]*)\}/g)) row(r[1], "テンプレート", r[3], r[2]);
  }
  return [...rows.values()];
}

export function compareAll(cat: Catalog, maps: Map<string, Mapping>): DefaultRow[] {
  return [...maps.values()].flatMap((m) => compareMapping(cat, m));
}

export const rowKey = (r: DefaultRow) => `${r.activity}.${r.prop}=${r.mapping}`;

export function loadAllow(root: string): Record<string, string> {
  return JSON.parse(readFileSync(join(root, "knowledge", "coded-default-allow.json"), "utf8")).allow;
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = compareAll(loadCatalog(repoRoot, CATALOG_FILES), loadMappings(repoRoot).maps);
  const allow = loadAllow(repoRoot);
  console.log(`比べた ${rows.length} 件：一致 ${rows.filter((r) => r.status === "ok").length}、差あり ${rows.filter((r) => r.status === "mismatch").length}、比べられない ${rows.filter((r) => r.status === "unknown").length}`);
  for (const r of rows.filter((x) => x.status !== "ok"))
    console.log(`${r.status === "mismatch" ? "差あり" : "不明  "} ${rowKey(r)}（${r.where}） 既定: ${r.base ?? "?"}（${r.source ?? "-"}）${allow[rowKey(r)] ? ` … 許可: ${allow[rowKey(r)]}` : ""}`);
}
