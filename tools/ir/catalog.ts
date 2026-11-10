// カタログ（catalog/**/*.json）と get-default-xaml の既定値（knowledge/default-xaml/*.json）を読む。

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type Prop = {
  name: string;
  kind: "in" | "out" | "inout" | "child" | "children" | "delegate" | "prop";
  type: string;
  required: boolean;
  enum?: string[];
  enumConverter?: string; // enum に独自の TypeConverter がある（XAML には {x:Static} で書く）
  enumAssembly?: string;
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
export type ObjType = { clrType: string; className: string; xmlns: string; assembly: string; genericArity?: number; props: Prop[] };
export const objectTypes = new Map<string, ObjType>(); // clrType -> 型

// インターフェース型のプロパティ（IFormatProvider など）に入れる、要素で書く実装。objs の中で "$type": "クラス名" で選ぶ（省略時は先頭）
export const objectImpls: Record<string, string[]> = {
  "UiPath.Excel.Activities.Business.ICellFormat": ["General","Text","Number","Currency","Percentage","Custom","Time","Date"].map((n) => `UiPath.Excel.Activities.Business.${n}Format`),
  "UiPath.Excel.Activities.Business.ICellFormat": ["UiPath.Excel.Activities.Business.GeneralFormat","UiPath.Excel.Activities.Business.TextFormat","UiPath.Excel.Activities.Business.NumberFormat","UiPath.Excel.Activities.Business.CurrencyFormat","UiPath.Excel.Activities.Business.PercentageFormat","UiPath.Excel.Activities.Business.CustomFormat","UiPath.Excel.Activities.Business.TimeFormat","UiPath.Excel.Activities.Business.DateFormat"],
  "UiPath.Activities.System.Collections.Filters.Operator": ["Equals", "NotEquals", "GreaterThan", "GreaterThanOrEqual", "LessThan", "LessThanOrEqual", "Contains", "ContainsIgnoreCase"].map((n) => `UiPath.Activities.System.Collections.Filters.${n}Operator`),
  "System.IFormatProvider": ["UiPath.Core.GeneralNumberFormatProvider", "UiPath.Core.CurrencyNumberFormatProvider", "UiPath.Core.PercentageNumberFormatProvider", "UiPath.Core.DateTimeFormatProvider"],
};
export function objTypeFor(type: string, v?: unknown): ObjType | undefined {
  const direct = objectTypes.get(type);
  if (direct) return direct;
  const impls = objectImpls[type];
  if (!impls) return undefined;
  const want = v && typeof v === "object" && "$type" in v ? String((v as Record<string, unknown>)["$type"]) : undefined;
  const clr = want === undefined ? impls[0] : impls.find((c) => c.endsWith("." + want));
  return clr ? objectTypes.get(clr) : undefined;
}

// 参照の型（Excel の IWorkbookQuickHandle など）。選んだ版のカタログの handles から読む
export const handleTypes = new Map<string, unknown>(); // clrType -> 型

export type Catalog = {
  activities: Activity[];
  defaults: Map<string, Record<string, string>>; // ClassName -> get-default-xaml に出た属性
  versions: Record<string, string>; // 読んだカタログ：パッケージ -> 版
  defaultSources: Record<string, { flat: boolean; versioned: number }>; // パッケージ -> 既定 XAML の出どころ（flat：版なしの置き場を使った、versioned：版ごとの置き場の件数）
};

// 同じ ClassName が複数パッケージにあるとき（ForEach など）は UiPath 側を優先する。Studio で普通に使う方だから。
const packageRank = (pkg: string) => (pkg.startsWith("UiPath.") ? 0 : 1);

export function loadCatalog(root: string, catalogFiles: string[]): Catalog {
  const activities: Activity[] = [];
  const versions: Record<string, string> = {};
  objectTypes.clear(); // 別の版を読んだときに、前の版の型が残らないようにする
  handleTypes.clear();
  for (const f of catalogFiles) {
    const c = JSON.parse(readFileSync(join(root, f), "utf8"));
    versions[c.package] = c.version;
    for (const h of c.handles ?? []) handleTypes.set(h.clrType, h);
    for (const a of c.activities) {
      // 型が ActivityDelegate のプロパティ（RetryScope.ActivityBody など）は、抽出器では prop になるが中身は引数なしの ActivityAction
      const props = a.props.map((p: Prop) => (p.kind === "prop" && p.type === "System.Activities.ActivityDelegate" ? { ...p, kind: "delegate" } : p));
      activities.push({ ...a, props, package: c.package });
    }
    const objFile = join(root, f.replace(/(\.portable)?\.json$/, ".objects.json")); // Portable も Windows の .objects.json を使う
    if (existsSync(objFile)) for (const o of JSON.parse(readFileSync(objFile, "utf8")).objects) objectTypes.set(o.clrType, o);
  }

  // 既定 XAML の置き場：
  //   knowledge/default-xaml/<ClassName>.json                        版なし。取った版は knowledge/default-xaml-versions.json に記録
  //   knowledge/default-xaml/<PackageId>/<version>/<ClassName>.json  その版のもの。あれば版なしより優先
  // 選んだ版が記録と違うパッケージには、版なしのファイルを使わない（推測で近い版を使わない）
  const defaults = new Map<string, Record<string, string>>();
  const dir = join(root, "knowledge", "default-xaml");
  const recordFile = join(root, "knowledge", "default-xaml-versions.json");
  const flatVersions: Record<string, string> = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, "utf8")).flat : {};
  const flatOk = (pkg: string) => flatVersions[pkg] === undefined || flatVersions[pkg] === versions[pkg];
  const ownerOf = new Map<string, string>(); // ClassName -> resolve が選ぶ方のパッケージ
  for (const a of activities) {
    const cur = ownerOf.get(a.className);
    if (cur === undefined || packageRank(a.package) < packageRank(cur)) ownerOf.set(a.className, a.package);
  }
  const readDefaults = (d: string, use: (cls: string) => boolean) => {
    let n = 0;
    if (!existsSync(d)) return n;
    for (const f of readdirSync(d).filter((f) => f.endsWith(".json"))) {
      const res = JSON.parse(readFileSync(join(d, f), "utf8").replace(/^﻿/, ""));
      if (res.Result !== "Success") continue;
      const m = (res.Data.message as string).match(/<Activity\b[^>]*>\s*<(?:\w+:)?(\w+)\b([^>]*?)\/?>/);
      if (!m || !use(m[1])) continue;
      const attrs: Record<string, string> = {};
      for (const [, k, v] of m[2].matchAll(/([\w.]+)="([^"]*)"/g)) {
        // {x:Null} は「値なし」、DisplayName はロケール依存なので既定値として使わない
        if (v !== "{x:Null}" && !v.startsWith("{x:Reference") && k !== "DisplayName" && k !== "IsDisplayNameAuto") attrs[k] = v.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#xD;/g, "\r").replace(/&#xA;/g, "\n").replace(/&amp;/g, "&"); // XML の実体参照を戻す（出力時にもう一度エスケープするため）
      }
      defaults.set(m[1], attrs);
      n++;
    }
    return n;
  };
  readDefaults(dir, (cls) => { const pkg = ownerOf.get(cls); return pkg === undefined || flatOk(pkg); });
  const defaultSources: Catalog["defaultSources"] = {};
  for (const [pkg, ver] of Object.entries(versions)) defaultSources[pkg] = { flat: flatOk(pkg), versioned: readDefaults(join(dir, pkg, ver), () => true) };
  return { activities, defaults, versions, defaultSources };
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
// カタログが引数の型を落とす ActivityDelegate（宣言元.プロパティ → 引数の型）。Studio の既定 XAML に合わせる
const delegateOverrides: Record<string, string[]> = {
  "TriggerScope.Action": ["UiPath.Platform.Triggers.TriggerArgs"],
};

// ActivityFunc<引数..., 戻り値>（CVScope.OCREngine、RetryScope.Condition など）。引数の型と戻り値の型。引数は0か1つだけ扱う。
// IR では body に Activity<戻り値> の子を1つ書く。引数名は型の短い名前（Image）、戻り値の DelegateOutArgument は書かない
export function funcInfo(p: Prop): { args: string[]; result: string } | undefined {
  const m = p.type.match(/^(?:System.Activities.)?ActivityFunc<(.+)>$/);
  if (!m) return undefined;
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of m[1]) {
    if (ch === "<") depth++;
    if (ch === ">") depth--;
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; } else cur += ch;
  }
  parts.push(cur.trim());
  const result = parts.pop()!;
  return parts.length <= 1 ? { args: parts, result } : undefined;
}
export const funcArgName = (t: string) => t.replace(/<.*$/, "").split(".").pop()!;

export function delegateArgs(p: Prop, typeArg: string | undefined): string[] | undefined {
  const ov = delegateOverrides[`${p.declaredOn}.${p.name}`];
  if (ov) return ov;
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
const attrTypes = new Set(["System.String", "System.Boolean", "System.Byte", "System.Guid", "System.Int32", "System.Int64", "System.Double", "System.Decimal", "System.TimeSpan", "System.Globalization.CultureInfo", "System.Drawing.Color"]);

// List<InArgument<T>> / IEnumerable<InArgument<T>>（IR では lists に式の配列で書く）
export const isArgumentList = (t: string) => /^(System\.Collections\.Generic\.)?(List|IEnumerable)<(System\.Activities\.)?InArgument<[^<>]+>>$/.test(t);

// InArgument の一覧の要素の型。ジェネリックの T なら typeArg、決まった型（RemoveLogFields.Fields の String など）ならその型
export const argumentListElement = (propType: string, typeArg: string | undefined) => {
  const t = propType.match(/InArgument<([^<>]+)>>$/)?.[1];
  return t === undefined || /^T\d?$/.test(t) ? typeArg : t;
};

// 素の値の一覧（List<String> / IEnumerable<String> / List<DayOfWeek>）。要素は式を持てないリテラル。要素の型を返す
export function plainListElement(t: string): string | undefined {
  return t.match(/^System\.Collections\.Generic\.(?:List|IEnumerable)<(System\.String|System\.DayOfWeek)>$/)?.[1];
}
export const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// 文字列キーの辞書で、値が String（リテラル）か InArgument<String>（式）のもの。"String" / "InArgument" を返す
export function literalMapValue(t: string): "String" | "InArgument" | undefined {
  const m = t.match(/^System\.Collections\.Generic\.I?Dictionary<System\.String, (System\.String|System\.Activities\.InArgument<System\.String>)>$/);
  return m ? (m[1] === "System.String" ? "String" : "InArgument") : undefined;
}

export const READ_ONLY = "読み取り専用";

export type Writable = { ok: true; how: string } | { ok: false; reason: string; group: string };

export function writable(a: Activity, p: Prop): Writable {
  const sp = specialProps[`${a.className}.${p.name}`] ?? specialProps[`*.${p.name}`];
  if (sp) return { ok: true, how: sp };
  // setter が無いものは XAML に書くと build が「Cannot set unknown member」で落ちる（BindingsKey、FilterFiles、AllowedItemType など）
  if (p.readOnly) return { ok: false, group: READ_ONLY, reason: "読み取り専用（public の setter が無い）。XAML に書けない" };
  if (isArgumentList(p.type)) return { ok: true, how: "lists" };
  switch (p.kind) {
    case "in": case "out": case "inout": return { ok: true, how: "式" };
    case "child": return { ok: true, how: isExpressionChild(p) ? "式" : "slots" };
    case "children": return { ok: true, how: "slots" };
    case "delegate":
      return delegateArgs(p, "T") || funcInfo(p) ? { ok: true, how: "slots" } : { ok: false, group: "ActivityFunc", reason: `${p.type}（戻り値のある delegate）はまだ書けない` };
  }
  // 素のプロパティ（XAML の属性に書く）
  if (p.enum || attrTypes.has(p.type)) return { ok: true, how: "属性" };
  const nullable = p.type.match(/^System\.Nullable<(.+)>$/);
  if (nullable) return attrTypes.has(nullable[1]) || nullable[1].includes(".") ? { ok: true, how: "属性（Nullable）" } : { ok: false, group: "Nullable", reason: `${p.type} は未対応` };
  if (p.type === "System.Type") return { ok: true, how: "型名（{x:Type}）" };
  if (/^System\.Collections\.Generic\.I?Dictionary<System\.String, System\.Activities\.(In)?Argument>$/.test(p.type)) return { ok: true, how: "dicts" };
  if (literalMapValue(p.type)) return { ok: true, how: "dicts" };
  if (plainListElement(p.type)) return { ok: true, how: "lists" };
  const listOf = listElementType(p.type);
  if (listOf && (listOf === "System.Activities.InArgument" || objectTypes.has(listOf))) return { ok: true, how: "lists" };
  if (/^System\.Collections\.(Generic|ObjectModel)\.(Dictionary|IDictionary|List|Collection|IEnumerable)<|^(List|IEnumerable|IDictionary)</.test(p.type) || p.type.endsWith("[]"))
    return { ok: false, group: "コレクション", reason: `${p.type} は要素構文が要るのでまだ書けない` };
  if (objectTypes.has(p.type) || objectImpls[p.type]) return { ok: true, how: "objs" };
  if (/^UiPath\.(Core\.Activities\.(Target|ImageTarget|CursorPosition)|UIAutomationNext\.(TargetAnchorable|TargetApp|ClickOffset|PointOffset)|CV\.|Core\.Region)/.test(p.type))
    return { ok: false, group: "UI のターゲット", reason: `${p.type} はまだ書けない（catalog/UiPath.UIAutomation.Activities/*.objects.json に型が無い。docs/worker-guide.md の 8. で足す）` };
  return { ok: false, group: "オブジェクト", reason: `${p.type} は要素構文が要るのでまだ書けない` };
}

// List<T> の T（List でなければ undefined）
export function listElementType(t: string): string | undefined {
  return t.match(/^System\.Collections\.Generic\.List<(.+)>$/)?.[1];
}
