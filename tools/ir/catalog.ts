// カタログ（catalog/**/*.json）と get-default-xaml の既定値（knowledge/default-xaml/*.json）を読む。

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type Prop = {
  name: string;
  kind: "in" | "out" | "inout" | "child" | "children" | "delegate" | "prop";
  type: string;
  required: boolean;
  enum?: string[];
  overloadGroups?: string[];
  obsolete: boolean;
};

export type Activity = {
  className: string;
  clrType: string;
  assembly: string;
  xmlns: string;
  genericArity: number;
  obsolete: boolean;
  browsable: boolean;
  props: Prop[];
  package: string;
};

export type Catalog = {
  activities: Activity[];
  defaults: Map<string, Record<string, string>>; // ClassName -> get-default-xaml に出た属性
};

// 同じ ClassName が複数パッケージにあるとき（ForEach など）は UiPath 側を優先する。Studio で普通に使う方だから。
const packageRank = (pkg: string) => (pkg.startsWith("UiPath.") ? 0 : 1);

export function loadCatalog(root: string, catalogFiles: string[]): Catalog {
  const activities: Activity[] = [];
  for (const f of catalogFiles) {
    const c = JSON.parse(readFileSync(join(root, f), "utf8"));
    for (const a of c.activities) {
      // 型が ActivityDelegate のプロパティ（RetryScope.ActivityBody など）は、抽出器では prop になるが中身は引数なしの ActivityAction
      const props = a.props.map((p: Prop) => (p.kind === "prop" && p.type === "System.Activities.ActivityDelegate" ? { ...p, kind: "delegate" } : p));
      activities.push({ ...a, props, package: c.package });
    }
  }

  const defaults = new Map<string, Record<string, string>>();
  const dir = join(root, "knowledge", "default-xaml");
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const res = JSON.parse(readFileSync(join(dir, f), "utf8").replace(/^﻿/, ""));
      if (res.Result !== "Success") continue;
      const m = (res.Data.message as string).match(/<Activity\b[^>]*>\s*<(?:\w+:)?(\w+)\b([^>]*?)\/?>/);
      if (!m) continue;
      const attrs: Record<string, string> = {};
      for (const [, k, v] of m[2].matchAll(/([\w.]+)="([^"]*)"/g)) {
        // {x:Null} は「値なし」、DisplayName はロケール依存なので既定値として使わない
        if (v !== "{x:Null}" && k !== "DisplayName" && k !== "IsDisplayNameAuto") attrs[k] = v;
      }
      defaults.set(m[1], attrs);
    }
  }
  return { activities, defaults };
}

export type Resolved = { activity: Activity } | { error: string; candidates: Activity[] };

export function resolve(cat: Catalog, act: string, hasTypeArg: boolean): Resolved {
  const byFull = cat.activities.filter((a) => a.clrType === act);
  let cands = byFull.length ? byFull : cat.activities.filter((a) => a.className === act);
  if (cands.length === 0) return { error: `未知のアクティビティ "${act}"`, candidates: [] };

  // ジェネリック版と非ジェネリック版がある（Assign / Assign<T>）ときは typeArg の有無で選ぶ
  const byArity = cands.filter((a) => (a.genericArity > 0) === hasTypeArg);
  if (byArity.length) cands = byArity;
  const usable = cands.filter((a) => !a.obsolete && a.browsable);
  if (usable.length) cands = usable;

  cands.sort((a, b) => packageRank(a.package) - packageRank(b.package));
  const best = cands.filter((a) => packageRank(a.package) === packageRank(cands[0].package));
  if (best.length > 1) return { error: `"${act}" が複数あって決められない。完全名で指定する`, candidates: best };
  return { activity: cands[0] };
}

// 子アクティビティを置く既定のプロパティ（IR の body が入る先）
export function defaultSlot(a: Activity): Prop | undefined {
  const slots = a.props.filter((p) => p.kind === "children" || p.kind === "delegate" || p.kind === "child");
  return (
    slots.find((p) => p.name === "Activities") ??
    slots.find((p) => p.name === "Body") ??
    slots.find((p) => p.name === "ActivityBody") ??
    slots.find((p) => p.name === "Try") ??
    slots.find((p) => p.kind === "children" || p.kind === "delegate")
  );
}

// While.Condition のような Activity<T> 型の子は、IR では式として props に書く
export const isExpressionChild = (p: Prop) => p.kind === "child" && p.type.startsWith("System.Activities.Activity<");

// delegate の引数の型（ActivityAction<A, B> なら [A, B]、引数なしなら []）。ジェネリックの仮引数（T）は typeArg で置き換える。
// ActivityFunc（戻り値のある delegate）はまだ書けないので undefined
export function delegateArgs(p: Prop, typeArg: string | undefined): string[] | undefined {
  if (p.type === "System.Activities.ActivityAction" || p.type === "System.Activities.ActivityDelegate") return [];
  const m = p.type.match(/^(?:System\.Activities\.)?ActivityAction<(.+)>$/);
  if (!m) return undefined;
  return m[1].split(",").map((s) => s.trim()).map((t) => (/^T\d*$/.test(t) ? typeArg ?? "Object" : t));
}
