// UI 操作（UIAutomation）の IR。要素で書くオブジェクト（Target / TargetApp / CursorPosition など）の検証・XAML・C# を受け持つ。
// 共有の生成器（validate.ts / generate.ts / generate-coded.ts）からは、ここの関数を1行ずつ呼ぶだけにしている。
//
// IR の書き方（docs/worker-guide.md の 8. に例）:
//   { "act": "NClick",
//     "objs": { "Target": { "FullSelectorArgument": { "lit": "<webctrl id='greet' tag='BUTTON' />" }, "SearchSteps": "Selector" } } }
//
// - objs のキーはアクティビティのプロパティ名、中身のキーはそのオブジェクトの型のプロパティ名
//   （型とプロパティは catalog/UiPath.UIAutomation.Activities/<ver>.objects.json。抽出器の --types で作る）
// - 値は props と同じ（{ lit } は文字列リテラル、文字列は VB の式、enum はメンバー名。フラグの enum は "Selector, FuzzySelector"）
// - 入れ子のオブジェクト（TargetAnchorable.PointOffset など）はそのまま JSON のオブジェクトで書く
// - 生成器が足すもの: TargetAnchorable の Guid と Version="V6"、TargetApp の Version="V3"、Classic の Target の Id、
//   NApplicationCard の ScopeGuid と、その中のアクティビティの ScopeIdentifier
//
// 検証で弾くもの:
//   UNKNOWN_PROP / BAD_ENUM / BAD_OBJ（値の形が違う）/ UNDECLARED_NAME（Out の代入先）
//   UIA_TARGET_EMPTY   … Target にセレクタ（など探す手がかり）が無い
//   UIA_SEARCH_STEPS   … Modern の Target に SearchSteps が無い
//   UIA_NO_SCOPE       … Modern の Target を持つアクティビティが NApplicationCard の外にあり、InUiElement も無い
//   UIA_TARGET_MISSING … Modern の Target を持つアクティビティに Target も InUiElement も無い

import { randomUUID } from "node:crypto";
import type { Activity, Catalog, ObjType, Prop } from "./catalog.ts";
import { objectTypes, objTypeFor, resolve } from "./catalog.ts";
import type { Node, ObjValue, Value, Workflow } from "./types.ts";

type Add = (path: string, code: string, message: string) => void;

const TA = "UiPath.UIAutomationNext.TargetAnchorable";
const TAPP = "UiPath.UIAutomationNext.TargetApp";
const CLASSIC_TARGET = "UiPath.Core.Activities.Target";
const CARD = "UiPath.UIAutomationNext.Activities.NApplicationCard";

// 生成器が足す既定値（Studio が書く値）。"guid" は毎回新しい GUID
const objDefaults: Record<string, Record<string, string>> = {
  [TA]: { Guid: "guid", Version: "V6" },
  "UiPath.UIAutomationNext.Target": { Guid: "guid" }, // アンカー
  [TAPP]: { Version: "V3" },
  [CLASSIC_TARGET]: { Id: "guid" },
};

// ターゲットを探す手がかり（どれか1つは要る）
const findKeys: Record<string, string[]> = {
  [TA]: ["FullSelectorArgument", "FuzzySelectorArgument", "ImageBase64", "NativeTextArgument", "CvTextArgument", "SemanticSelectorArgument", "SemanticTextArgument"],
  [CLASSIC_TARGET]: ["Selector", "Element"],
  [TAPP]: ["Selector", "FilePath", "Url"],
};

export const isValue = (v: unknown): v is Value =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean" ||
  (typeof v === "object" && v !== null && !Array.isArray(v) && (Object.keys(v).join() === "lit" || Object.keys(v).sort().join() === "cs,vb"));

// IEnumerable<ITarget> などの要素の型。インターフェースのときは具体的な型を決め打つ
const itemTypeOf = (t: string) => {
  const m = t.match(/^System\.Collections\.Generic\.(?:IEnumerable|List|IList|ICollection)<(.+)>$/);
  if (!m) return undefined;
  return m[1] === "UiPath.UIAutomationNext.Contracts.ITarget" ? "UiPath.UIAutomationNext.Target" : m[1];
};

const enumOk = (p: Prop, v: Value) => typeof v === "string" && v.split(",").map((s) => s.trim()).every((s) => p.enum!.includes(s));

// ---- 検証 ----

// validate.ts の visit から呼ぶ。objs の中身を型で確かめる
export function validateObjs(n: Node, a: Activity, path: string, scope: Map<string, string>, add: Add): string[] {
  const given: string[] = [];
  for (const [k, v] of Object.entries(n.objs ?? {})) {
    const at = `${path}.objs.${k}`;
    const p = a.props.find((x) => x.name === k);
    if (!p) { add(at, "UNKNOWN_PROP", `${a.className} に "${k}" は無い`); continue; }
    const t = objTypeFor(p.type, v);
    if (!t) { add(at, "BAD_OBJ", `"${k}"（${p.type}）はオブジェクトとして書けない。props に書く`); continue; }
    given.push(k);
    obj(t, v, at);
  }
  return given;

  function obj(t: ObjType, v: unknown, at: string) {
    if (typeof v !== "object" || v === null || Array.isArray(v) || isValue(v)) { add(at, "BAD_OBJ", `${t.className} はオブジェクト（{ "プロパティ": 値 }）で書く`); return; }
    for (const [k, x] of Object.entries(v as ObjValue)) {
      if (k === "$type") continue; // インターフェース型のプロパティで実装を選ぶ印
      const kat = `${at}.${k}`;
      const p = t.props.find((q) => q.name === k);
      if (!p) { add(kat, "UNKNOWN_PROP", `${t.className} に "${k}" は無い（${hint(t)}）`); continue; }
      const sub = objectTypes.get(p.type);
      const item = itemTypeOf(p.type);
      if (sub) { obj(sub, x, kat); continue; }
      if (item && objectTypes.get(item)) {
        if (!Array.isArray(x)) { add(kat, "BAD_OBJ", `"${k}" は配列で書く`); continue; }
        x.forEach((e, i) => obj(objectTypes.get(item)!, e, `${kat}[${i}]`));
        continue;
      }
      if (!isValue(x)) { add(kat, "BAD_OBJ", `"${k}"（${p.type}）は値（式・{ lit }・数値・真偽値）で書く`); continue; }
      if (p.enum && !enumOk(p, x)) add(kat, "BAD_ENUM", `"${k}" は ${p.enum.join(" / ")} のどれか（フラグは "A, B"）`);
      if (p.kind === "out") {
        const head = typeof x === "string" ? x.match(/^[A-Za-z_]\w*/)?.[0] : undefined;
        if (!head || !scope.has(head)) add(kat, "UNDECLARED_NAME", `出力先 "${String(x)}" が宣言されていない`);
      }
      if (p.kind === "prop" && !p.enum && typeof x === "string" && !/^(System\.(String|Guid|Double|Int32|Boolean))$/.test(p.type))
        add(kat, "BAD_OBJ", `"${k}"（${p.type}）はまだ書けない`);
    }
    const keys = Object.keys(v as ObjValue);
    const need = findKeys[t.clrType];
    if (need && !need.some((x) => keys.includes(x))) add(at, "UIA_TARGET_EMPTY", `${t.className} に ${need.join(" / ")} のどれかが要る`);
    if (t.clrType === TA && !keys.includes("SearchSteps")) add(at, "UIA_SEARCH_STEPS", `TargetAnchorable には SearchSteps（"Selector" など）が要る`);
  }
}

const hint = (t: ObjType) => {
  const ps = t.props.filter((p) => p.browsable !== false).map((p) => p.name);
  return ps.length ? `書けるもの: ${ps.slice(0, 12).join(", ")}${ps.length > 12 ? " ほか" : ""}` : "";
};

// Modern の Target（TargetAnchorable）を持つアクティビティ。NApplicationCard の中か、InUiElement が要る
const modernTargetProp = (a: Activity) => a.clrType !== CARD && a.props.find((p) => p.name === "Target" && p.type === TA);

// validate.ts の最後に呼ぶ。スコープ（NApplicationCard の中か）を見る
export function validateUiaTree(wf: Workflow, cat: Catalog, add: Add) {
  const walk = (n: Node, path: string, inCard: boolean) => {
    const r = resolve(cat, n.act, n.typeArg !== undefined);
    let card = inCard;
    if ("activity" in r) {
      const a = r.activity;
      if (a.clrType === CARD) {
        card = true;
        if (!n.objs?.TargetApp && n.props?.InUiElement === undefined) add(path, "UIA_TARGET_MISSING", `NApplicationCard には objs.TargetApp（Selector / FilePath / Url）か props.InUiElement が要る`);
      } else if (modernTargetProp(a)) {
        const byElement = n.props?.InUiElement !== undefined;
        if (!n.objs?.Target && !byElement) add(path, "UIA_TARGET_MISSING", `${a.className} には objs.Target か props.InUiElement が要る`);
        if (!inCard && !byElement) add(path, "UIA_NO_SCOPE", `${a.className} は NApplicationCard（Use Application/Browser）の body の中に置く（または props.InUiElement を使う）`);
      }
    }
    for (const [k, list] of children(n)) list.forEach((c, i) => walk(c, `${path}.${k}[${i}]`, card));
  };
  wf.body.forEach((n, i) => walk(n, `body[${i}]`, false));
}

function children(n: Node): [string, Node[]][] {
  return [
    ["body", n.body ?? []], ["then", n.then ?? []], ["else", n.else ?? []],
    ...Object.entries(n.slots ?? {}).map(([k, v]) => [`slots.${k}`, v] as [string, Node[]]),
    ...Object.entries(n.cases ?? {}).map(([k, v]) => [`cases.${k}`, v] as [string, Node[]]),
    ...(n.catches ?? []).map((c, i) => [`catches[${i}].body`, c.body] as [string, Node[]]),
  ];
}

// ---- XAML ----

// generate.ts から呼ぶ前処理。NApplicationCard に ScopeGuid、その中のアクティビティに同じ値の ScopeIdentifier を付ける（Studio と同じ）
export function prepareUia(root: Node, cat: Catalog): Node {
  const copy = (n: Node, scopeId: string | undefined): Node => {
    const r = resolve(cat, n.act, n.typeArg !== undefined);
    const out: Node = { ...n };
    let inner = scopeId;
    if ("activity" in r) {
      const a = r.activity;
      if (a.clrType === CARD) {
        const g = n.props?.ScopeGuid;
        inner = typeof g === "object" && "lit" in g ? g.lit : typeof g === "string" ? g : randomUUID();
        out.props = { ...n.props, ScopeGuid: inner };
      } else if (scopeId && n.props?.ScopeIdentifier === undefined && a.props.some((p) => p.name === "ScopeIdentifier" && p.type === "System.String" && !p.obsolete)) {
        out.props = { ...n.props, ScopeIdentifier: scopeId };
      }
    }
    const map = (list?: Node[]) => list?.map((c) => copy(c, inner));
    if (n.body) out.body = map(n.body);
    if (n.then) out.then = map(n.then);
    if (n.else) out.else = map(n.else);
    if (n.slots) out.slots = Object.fromEntries(Object.entries(n.slots).map(([k, v]) => [k, map(v)!]));
    if (n.cases) out.cases = Object.fromEntries(Object.entries(n.cases).map(([k, v]) => [k, map(v)!]));
    if (n.catches) out.catches = n.catches.map((c) => ({ ...c, body: map(c.body)! }));
    return out;
  };
  return copy(root, undefined);
}

export type XamlCtx = {
  prefixFor: (uri: string) => string; // "uix:" のような接頭辞（xmlns も登録する）
  attrValue: (v: Value, p: Prop) => string;
  esc: (s: string) => string;
  emit: (depth: number, s: string) => void;
};

// <tag.Prop><uix:Type ... /></tag.Prop> を書く
export function emitObjs(n: Node, a: Activity, tag: string, depth: number, ctx: XamlCtx) {
  for (const [k, v] of Object.entries(n.objs ?? {})) {
    const p = a.props.find((x) => x.name === k)!;
    ctx.emit(depth, `<${tag}.${k}>`);
    emitObj(objTypeFor(p.type, v)!, v, depth + 1, ctx);
    ctx.emit(depth, `</${tag}.${k}>`);
  }
}

function emitObj(t: ObjType, v: ObjValue, depth: number, ctx: XamlCtx) {
  const tag = ctx.prefixFor(t.xmlns) + t.className;
  const attrs: [string, string][] = [];
  const elems: [Prop, ObjValue | ObjValue[]][] = [];
  for (const [k, x] of Object.entries(v)) {
    if (k === "$type") continue;
    const p = t.props.find((q) => q.name === k)!;
    if (isValue(x)) attrs.push([k, ctx.attrValue(x, p)]);
    else elems.push([p, x as ObjValue | ObjValue[]]);
  }
  for (const [k, d] of Object.entries(objDefaults[t.clrType] ?? {}))
    if (!(k in v)) attrs.push([k, d === "guid" ? randomUUID() : d]);
  attrs.sort(([x], [y]) => x.localeCompare(y));
  const attrText = attrs.map(([k, x]) => ` ${k}="${ctx.esc(x)}"`).join("");
  if (!elems.length) { ctx.emit(depth, `<${tag}${attrText} />`); return; }
  ctx.emit(depth, `<${tag}${attrText}>`);
  for (const [p, x] of elems) {
    ctx.emit(depth + 1, `<${tag}.${p.name}>`);
    if (Array.isArray(x)) {
      const item = objectTypes.get(itemTypeOf(p.type)!)!;
      const iface = p.type.match(/<(.+)>$/)![1];
      const ifaceTag = ctx.prefixFor(t.xmlns) + iface.slice(iface.lastIndexOf(".") + 1);
      ctx.emit(depth + 2, `<${ctx.prefixFor("clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib")}List x:TypeArguments="${ifaceTag}" Capacity="${Math.max(4, x.length)}">`);
      for (const e of x) emitObj(item, e, depth + 3, ctx);
      ctx.emit(depth + 2, `</${ctx.prefixFor("clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib")}List>`);
    } else emitObj(objectTypes.get(p.type)!, x, depth + 2, ctx);
    ctx.emit(depth + 1, `</${tag}.${p.name}>`);
  }
  ctx.emit(depth, `</${tag}>`);
}

// ---- Coded（C#）----
//
// オブジェクト → Coded のモデル（UiPath.UIAutomationNext.API.Models）。値は「モデルのプロパティ名」、null は Coded では意味がないので捨てる、
// "!理由" は Coded に直せない（CODED_UNSUPPORTED）
type ModelMap = { type: string; props: Record<string, string | null> };
const codedModels: Record<string, ModelMap> = {
  [TA]: {
    type: "TargetAnchorableModel",
    props: {
      FullSelectorArgument: "PartialSelector", FuzzySelectorArgument: "FuzzyPartialSelector", ScopeSelectorArgument: "ScopeSelector",
      SearchSteps: "SearchSteps", WaitForReadyArgument: "WaitForReady", ElementVisibilityArgument: "Visibility",
      ImageBase64: "ImageBase64", ImageAccuracyArgument: "Accuracy", ImageOccurrenceArgument: "ImageOccurrence", ImageFindModeArgument: "ImageFindMode",
      NativeTextArgument: "NativeText", NativeTextOccurrenceArgument: "NativeTextOccurrence", IsNativeTextCaseSensitive: "IsNativeTextCaseSensitive",
      CvType: "CvType", CvTextArgument: "CvText", CvTextOccurrenceArgument: "CvTextOccurrence", CvTextAccuracyArgument: "CvTextAccuracy",
      SemanticSelectorArgument: "SemanticSelector", SemanticSelectorFindMethod: "SemanticSelectorFindMethod", SemanticElementType: "SemanticElementType",
      ElementType: "ElementType", FriendlyName: "FriendlyName", Guid: "Guid", Reference: "Reference",
      PointOffset: "PointOffset", RegionOffset: "RegionOffset",
      Version: null, DesignTimeRectangle: null, DesignTimeScaleFactor: null, InformativeScreenshot: null, ContentHash: null, BrowserURL: null, IsResponsive: null,
      Anchors: "!アンカーは Coded のモデル（TargetAnchorableModel）に無い",
      SemanticTextArgument: "!SemanticTexts（配列）への変換はまだ無い",
    },
  },
  [TAPP]: {
    type: "TargetAppModel",
    props: {
      Selector: "Selector", FilePath: "FilePath", Arguments: "Arguments", Url: "Url", BrowserType: "BrowserType", IsExactTitleEnabled: "IsExactTitleEnabled",
      Title: "Title", Reference: "Reference", Version: null, Area: null, IconBase64: null, InformativeScreenshot: null, ContentHash: null,
      WorkingDirectory: "!Coded では TargetAppOptions.WorkingDirectory。NApplicationCard の対応表ではまだ扱っていない",
    },
  },
  "UiPath.UIAutomationNext.ClickOffset": { type: "PointOffsetModel", props: { OffsetPosition: "Position", OffsetX: "X", OffsetY: "Y" } },
  "UiPath.UIAutomationNext.PointOffset": { type: "PointOffsetModel", props: { Position: "Position", X: "X", Y: "Y" } },
  "UiPath.UIAutomationNext.RegionOffset": { type: "RegionOffsetModel", props: { Position: "Position", X: "X", Y: "Y", Width: "Width", Height: "Height", Area: null, IsAreaResolved: null } },
  "UiPath.UIAutomationNext.Activities.VerifyExecutionOptions": {
    type: "VerifyOptions", props: { Target: "Target", Mode: "Mode", Retry: "Retry", Timeout: "Timeout", DelayBefore: "DelayBefore", IsLoose: "IsLoose", DisplayName: null },
  },
  "UiPath.UIAutomationNext.Activities.VerifyExecutionTypeIntoOptions": {
    type: "VerifyOptions", props: { Target: "Target", Mode: "Mode", Retry: "Retry", Timeout: "Timeout", DelayBefore: "DelayBefore", IsLoose: "IsLoose", ExpectedText: "ExpectedText", DisplayName: null },
  },
  "UiPath.UIAutomationNext.DialogHandling": {
    type: "DialogHandlingOptions",
    props: { DismissAlerts: "DismissAlerts", DismissConfirms: "DismissConfirms", DismissPrompts: "DismissPrompts", ConfirmDialogResponse: "ConfirmDialogResponse", PromptDialogResponse: "PromptDialogResponse", PromptDialogResponseText: "PromptDialogResponseText" },
  },
};

export type CodedCtx = { expr: (v: Value, at: string) => string; add: Add };

export const UIA_USINGS = ["UiPath.UIAutomationNext.API.Models", "UiPath.UIAutomationNext.Enums"];

// objs.<prop> を C# の式（new TargetAnchorableModel { ... }）にする。直せないときは undefined（エラーは ctx.add 済み）
export function objToCs(a: Activity, prop: string, v: ObjValue, at: string, ctx: CodedCtx): string {
  const p = a.props.find((x) => x.name === prop)!;
  return model(objectTypes.get(p.type)!, v, at, ctx);
}

function model(t: ObjType, v: ObjValue, at: string, ctx: CodedCtx): string {
  const m = codedModels[t.clrType];
  if (!m) { ctx.add(at, "CODED_UNSUPPORTED", `${t.className} を Coded のモデルに直す表が無い（tools/ir/uia.ts の codedModels に足す）`); return "null"; }
  const sets: string[] = [];
  for (const [k, x] of Object.entries(v)) {
    const kat = `${at}.${k}`;
    const to = m.props[k];
    if (to === null) continue;
    if (to === undefined) { ctx.add(kat, "CODED_UNSUPPORTED", `${t.className}.${k} を ${m.type} に直す表が無い（tools/ir/uia.ts の codedModels に足す）`); continue; }
    if (to.startsWith("!")) { ctx.add(kat, "CODED_UNSUPPORTED", `${t.className}.${k}: ${to.slice(1)}`); continue; }
    const p = t.props.find((q) => q.name === k)!;
    const sub = objectTypes.get(p.type);
    let cs: string;
    if (sub) cs = model(sub, x as ObjValue, kat, ctx);
    else if (p.enum && typeof x === "string") cs = x.split(",").map((s) => `${p.type}.${s.trim()}`).join(" | ");
    else cs = ctx.expr(x as Value, kat);
    sets.push(`${to} = ${cs}`);
  }
  return `new ${m.type} { ${sets.join(", ")} }`;
}
