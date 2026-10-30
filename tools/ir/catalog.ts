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

// 要素で書くオブジェクトの型（UI のターゲットなど）。catalog/<pkg>/<ver>.objects.json（抽出器の --types）から読む
export type ObjType = { clrType: string; className: string; xmlns: string; assembly: string; props: Prop[] };
export const objectTypes = new Map<string, ObjType>(); // clrType -> 型

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
      // 戻り値のある基底（BaseStorageActivity<String> など。最後の型引数 T が決まっているもの）の Result は、リフレクションでは
      // 取れない（Activity<T>.Result）が、XAML では Result="[変数]" の属性で書ける。out のプロパティとして足す
      const res = typeof a.baseType === "string" && a.genericArity === 0 && !props.some((p: Prop) => p.name === "Result") ? resultType(a.baseType) : undefined;
      if (res) props.push({ name: "Result", kind: "out", type: res, required: false, obsolete: false });
      activities.push({ ...a, props, package: c.package });
    }
    const objFile = join(root, f.replace(/\.json$/, ".objects.json"));
    if (existsSync(objFile)) for (const o of JSON.parse(readFileSync(objFile, "utf8")).objects) objectTypes.set(o.clrType, o);
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

// 基底クラスの型引数から Result の型を取る。Activity<T> 系（CodeActivity<T>、NativeActivity<T>、AsyncTaskCodeActivity<T>、
// Base…Activity<T> など）で、T が決まっている（T、T1 のような仮引数でない）ときだけ
function resultType(baseType: string): string | undefined {
  const m = baseType.match(/(?:^|\.)(\w*Activity)<(.+)>$/);
  if (!m) return undefined;
  const t = m[2];
  if (/(^|[<, ])T\d?(?=[>, ]|$)/.test(t)) return undefined;
  return t;
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

// ---- プロパティを IR で書けるか（validate と coverage が使う）----

// IR の専用の書き方があるプロパティ（ClassName.Prop）
const specialProps: Record<string, string> = {
  "*.Variables": "variables",
  "*.DisplayName": "name",
  "InvokeWorkflowFile.Arguments": "args",
  "Switch.Cases": "cases",
  "TryCatch.Catches": "catches",
  "MultipleAssign.AssignOperations": "assigns",
};
const attrTypes = new Set(["System.String", "System.Boolean", "System.Int32", "System.Int64", "System.Double", "System.Decimal", "System.TimeSpan"]);

export type Writable = { ok: true; how: string } | { ok: false; reason: string; group: string };

export function writable(a: Activity, p: Prop): Writable {
  const sp = specialProps[`${a.className}.${p.name}`] ?? specialProps[`*.${p.name}`];
  if (sp) return { ok: true, how: sp };
  // BindingsKey は Studio が実行時のバインド用に内部で持つ。XAML の属性に書くと「unknown member」で build が落ちる（storage / RunJob / StartJob で確認）
  if (p.name === "BindingsKey") return { ok: false, group: "Studio の内部", reason: "XAML に書けない（書くと build が「unknown member」で落ちる。Studio がバインド用に内部で持つ）" };
  switch (p.kind) {
    case "in": case "out": case "inout": return { ok: true, how: "式" };
    case "child": return { ok: true, how: isExpressionChild(p) ? "式" : "slots" };
    case "children": return { ok: true, how: "slots" };
    case "delegate":
      return delegateArgs(p, "T") ? { ok: true, how: "slots" } : { ok: false, group: "ActivityFunc", reason: `${p.type}（戻り値のある delegate）はまだ書けない` };
  }
  // 素のプロパティ（XAML の属性に書く）
  if (p.enum || attrTypes.has(p.type)) return { ok: true, how: "属性" };
  const nullable = p.type.match(/^System\.Nullable<(.+)>$/);
  if (nullable) return attrTypes.has(nullable[1]) || nullable[1].includes(".") ? { ok: true, how: "属性（Nullable）" } : { ok: false, group: "Nullable", reason: `${p.type} は未対応` };
  if (p.type === "System.Type") return { ok: true, how: "型名（{x:Type}）" };
  if (/^System\.Collections\.Generic\.I?Dictionary<System\.String, System\.Activities\.(In)?Argument>$/.test(p.type)) return { ok: true, how: "dicts" };
  if (/^System\.Collections\.(Generic|ObjectModel)\.(Dictionary|IDictionary|List|Collection|IEnumerable)<|^(List|IEnumerable|IDictionary)</.test(p.type) || p.type.endsWith("[]"))
    return { ok: false, group: "コレクション", reason: `${p.type} は要素構文が要るのでまだ書けない` };
  if (objectTypes.has(p.type)) return { ok: true, how: "objs" };
  if (/^UiPath\.(Core\.Activities\.(Target|ImageTarget|CursorPosition)|UIAutomationNext\.(TargetAnchorable|TargetApp|ClickOffset|PointOffset)|CV\.|Core\.Region)/.test(p.type))
    return { ok: false, group: "UI のターゲット", reason: `${p.type} はまだ書けない（catalog/UiPath.UIAutomation.Activities/*.objects.json に型が無い。docs/worker-guide.md の 8. で足す）` };
  return { ok: false, group: "オブジェクト", reason: `${p.type} は要素構文が要るのでまだ書けない` };
}
