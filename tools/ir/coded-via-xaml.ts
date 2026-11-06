// Coded（C#）で対応表の無いアクティビティを、XAML を経由して呼ぶための部品（knowledge/coded-via-xaml.md）。
//
// generate-coded.ts は、対応表の無いノード（子があれば子も含めた部分木）を1つの XAML のワークフローにし、
// C# からは基底クラスの RunWorkflow("<相対パス>.xaml", 引数の辞書) で呼ぶ。ここではその XAML のワークフローの IR を作る。
//
// 引数の決め方（アクティビティ名では分岐しない）:
//   - 部分木の式に出てくる名前のうち、その位置で見えている変数・引数（sc）を、宣言の型で引数にする
//   - 書き込まれるもの（out / inout のプロパティ、Assign の To、MultipleAssign の to、Out / InOut の引数の辞書）は InOut、読むだけなら In
//   - 部分木の中で宣言された名前（Sequence の変数、ForEach などの item、Catch の変数）は数えない
//   - 式の中の文字列リテラルの中は数えない（$"...{式}..." の {} の中は数える）。.名前（メンバー）と 名前:=（名前付き引数）も数えない
//   - VB と同じく大文字小文字を区別しない（宣言の名前で引数にする）
//   - 型が XAML に書けないもの（types-xaml.ts に無い）は CODED_VIA_XAML_TYPE

import type { Catalog, Prop } from "./catalog.ts";
import { resolve, defaultSlot, funcInfo, funcArgName } from "./catalog.ts";
import type { Node, Value, Workflow, ArgumentDecl, Issue } from "./types.ts";
import { toXamlType } from "./types-xaml.ts";

export type ViaXamlArg = { name: string; type: string; dir: "In" | "InOut" };

// 式（VB か C#）に出てくる名前。文字列リテラルの中は除く。write は代入先（先頭の名前）
export function exprNames(text: string, lang: "vb" | "cs" = "vb"): string[] {
  const out: string[] = [];
  scan(text, lang, out);
  return out;
}

function scan(s: string, lang: "vb" | "cs", out: string[]) {
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    // VB の ' はコメント（式には普通出ない）。C# の 'a' は文字リテラル
    if (c === "'") {
      if (lang === "vb") return;
      i++;
      while (i < s.length && s[i] !== "'") i += s[i] === "\\" ? 2 : 1;
      i++;
      continue;
    }
    // 文字列: "..."、$"..."、@"..."、$@"..."
    const pre = s.slice(i, i + 3);
    const m = /^(\$@|@\$|\$|@)?"/.exec(pre);
    if (m) {
      const interp = (m[1] ?? "").includes("$");
      const verbatim = lang === "vb" || (m[1] ?? "").includes("@");
      i += m[0].length;
      while (i < s.length) {
        const d = s[i];
        if (d === '"') {
          if (verbatim && s[i + 1] === '"') { i += 2; continue; }
          i++;
          break;
        }
        if (!verbatim && d === "\\") { i += 2; continue; }
        if (interp && d === "{") {
          if (s[i + 1] === "{") { i += 2; continue; }
          // {式} の中身。入れ子の {} と文字列は数えて閉じを探す
          let depth = 1, j = i + 1;
          while (j < s.length && depth > 0) {
            if (s[j] === "{") depth++;
            else if (s[j] === "}") depth--;
            else if (s[j] === '"') { j++; while (j < s.length && s[j] !== '"') j++; }
            if (depth > 0) j++;
          }
          scan(s.slice(i + 1, j), lang, out);
          i = j + 1;
          continue;
        }
        i++;
      }
      // VB の文字リテラル "a"c の c は名前ではない
      if (lang === "vb" && /[cC]/.test(s[i] ?? "") && !/\w/.test(s[i + 1] ?? "")) i++;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /\w/.test(s[j])) j++;
      const name = s.slice(i, j);
      const before = s.slice(0, i).trimEnd();
      const after = s.slice(j).trimStart();
      const member = /[.!]$/.test(before) && !/\.\.$/.test(before);
      const named = after.startsWith(":=");
      if (!member && !named) out.push(name);
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)) { while (i < s.length && /[\w.]/.test(s[i])) i++; continue; }
    i++;
  }
}

// 値の式の文字列（{ lit } と数値・真偽値は式ではない）
function texts(v: Value): [string, "vb" | "cs"][] {
  if (typeof v === "string") return [[v, "vb"]];
  if (typeof v === "object" && v && "vb" in v) return [[v.vb, "vb"], [v.cs, "cs"]];
  return [];
}

// 部分木の中で使われる、外の名前（sc）を集める
export function viaXamlArgs(root: Node, cat: Catalog, sc: Map<string, string>): { args: ViaXamlArg[]; issues: Issue[] } {
  const lower = new Map([...sc].map(([k, t]) => [k.toLowerCase(), [k, t] as [string, string]]));
  const found = new Map<string, ViaXamlArg>(); // 小文字の名前 → 引数（出てきた順）
  const use = (name: string, local: Set<string>, write: boolean) => {
    const k = name.toLowerCase();
    if (local.has(k)) return;
    const hit = lower.get(k);
    if (!hit) return; // その位置で見えていない名前（型名、メソッド名など）
    const cur = found.get(k) ?? { name: hit[0], type: hit[1], dir: "In" as const };
    found.set(k, write ? { ...cur, dir: "InOut" } : cur);
  };
  const value = (v: Value, local: Set<string>, write = false) => {
    for (const [t, lang] of texts(v)) {
      const names = exprNames(t, lang);
      names.forEach((n, i) => use(n, local, write && i === 0));
    }
  };
  const objValue = (v: unknown, local: Set<string>) => {
    if (Array.isArray(v)) v.forEach((x) => objValue(x, local));
    else if (v && typeof v === "object" && !("lit" in v) && !("vb" in v)) Object.values(v).forEach((x) => objValue(x, local));
    else value(v as Value, local);
  };
  // 式として読まないプロパティ（属性に書く値、型、enum のメンバー名）
  const literalOnly = (p: Prop | undefined, v: Value) =>
    !!p && (p.kind === "prop" || p.type === "System.Type" || (typeof v === "string" && !!p.enum && v.split(",").every((x) => p.enum!.includes(x.trim()))));

  const walk = (n: Node, outer: Set<string>) => {
    const local = new Set(outer);
    const r = resolve(cat, n.act, n.typeArg !== undefined);
    const a = "activity" in r ? r.activity : undefined;
    for (const v of n.variables ?? []) local.add(v.name.toLowerCase());
    for (const v of n.variables ?? []) if (v.default !== undefined) value(v.default, local);
    // delegate の引数（item）。書いていなければ既定の "item"
    const slot = a ? defaultSlot(a) : undefined;
    if (n.item !== undefined) (Array.isArray(n.item) ? n.item : [n.item]).forEach((x) => local.add(x.toLowerCase()));
    else if (slot?.kind === "delegate") local.add("item");
    for (const p of a?.props ?? []) { const fi = p.kind === "delegate" ? funcInfo(p) : undefined; fi?.args.forEach((t) => local.add(funcArgName(t).toLowerCase())); }
    for (const [k, v] of Object.entries(n.props ?? {})) {
      const p = a?.props.find((x) => x.name === k);
      if (literalOnly(p, v)) continue;
      value(v, local, p?.kind === "out" || p?.kind === "inout");
    }
    for (const x of n.args ?? []) value(x.value, local, x.dir !== "In");
    for (const list of Object.values(n.dicts ?? {})) for (const x of list) value(x.value, local, x.dir !== undefined && x.dir !== "In");
    for (const list of Object.values(n.lists ?? {})) for (const x of list) objValue(x, local);
    for (const v of Object.values(n.objs ?? {})) objValue(v, local);
    for (const x of n.assigns ?? []) { value(x.to, local, true); value(x.value, local); }
    const kids = [...(n.body ?? []), ...(n.then ?? []), ...(n.else ?? []), ...Object.values(n.slots ?? {}).flat(), ...Object.values(n.cases ?? {}).flat()];
    kids.forEach((c) => walk(c, local));
    for (const c of n.catches ?? []) {
      const inner = new Set(local).add((c.var ?? "exception").toLowerCase());
      c.body.forEach((x) => walk(x, inner));
    }
  };
  walk(root, new Set());

  const issues: Issue[] = [];
  const args = [...found.values()];
  for (const x of args) {
    const t = toXamlType(x.type);
    if ("error" in t) issues.push({ path: "", code: "CODED_VIA_XAML_TYPE", message: `XAML 経由の引数 ${x.name} の型 "${x.type}" を XAML に書けない（${t.error}）` });
  }
  return { args, issues };
}

// 部分木だけを置いた XAML のワークフローの IR
export function viaXamlWorkflow(n: Node, name: string, args: ViaXamlArg[]): Workflow {
  const decl: ArgumentDecl[] = args.map((a) => ({ name: a.name, dir: a.dir, type: a.type }));
  return { workflow: name, ...(decl.length ? { arguments: decl } : {}), body: [n] };
}
