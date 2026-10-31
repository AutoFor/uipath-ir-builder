// Excel（UiPath.Excel.Activities）だけに要る処理。共通のファイル（generate.ts / validate.ts / generate-coded.ts / types-xaml.ts）
// からは、ここの関数を1行ずつ呼ぶだけにしている。
//
// IR の書き方（詳しくは docs/worker-guide.md の「8. UI 操作（UIAutomation）と Excel」）:
//   モダン: { "act": "ExcelApplicationCard", "item": "Excel", "props": { "WorkbookPath": { "lit": "data.xlsx" } },
//            "body": [ { "act": "ReadRangeX", "props": { "Range": "Excel.Sheet(\"Sheet1\").Range(\"A1:B3\")", "SaveTo": "dt" } } ] }
//     スコープの参照（IReadRangeRef など）は VB の式で書く。先頭はスコープの item（Studio の既定は "Excel"）
//   クラシック: { "act": "ExcelApplicationScope", "item": "ExcelWorkbookScope", "props": { "WorkbookPath": ... },
//            "body": [ { "act": "ExcelReadRange", "props": { "SheetName": { "lit": "Sheet1" }, "DataTable": "dt" } } ] }
//     中のアクティビティはスコープの変数を参照しない（親のスコープを実行時に探す）
//
// Coded: スコープは using ブロックになる（mappings/UiPath.Excel.Activities/ExcelApplicationCard.json の "scope": "using"）。
//   VB の Excel.Sheet("Sheet1").Range("A1") は、C# では Excel.Sheet["Sheet1"].Range["A1"]（インデクサー）になる。
//   どのプロパティがインデクサーかは、カタログの handles（抽出器の --follow-returns）で決める。

import { handleTypes } from "./catalog.ts";
import type { Activity, Prop } from "./catalog.ts";
import type { Node, ObjValue, Value } from "./types.ts";

export const EXCEL_PACKAGE = "UiPath.Excel.Activities";

// ---- XAML の型と xmlns ----

const UE = "clr-namespace:UiPath.Excel;assembly=UiPath.Excel.Activities";
const UI = "http://schemas.uipath.com/workflow/activities";
const SDR = "clr-namespace:System.Drawing;assembly=System.Drawing.Primitives";
const SSE = "clr-namespace:System.Security;assembly=System.Private.CoreLib";

// Studio の既定 XAML と同じ接頭辞（knowledge/default-xaml/ExcelApplicationCard.json など）
export const excelPrefixes: Record<string, string> = {
  "clr-namespace:UiPath.Excel.Activities.Business;assembly=UiPath.Excel.Activities": "ueab",
  [UE]: "ue",
};

// IR の型名 → XAML の型表記（types-xaml.ts の表に足す）。短い名前と完全名の両方で引ける
const ueTypes = [
  "IWorkbookQuickHandle", "WorksheetQuickHandle", "CurrentRowQuickHandle", "ExcelValue", "RangeValue", "ChartQuickHandle",
  "IReadRangeRef", "IReadWriteRangeRef", "IReadCellRef", "IReadWriteCellRef", "ISheetRef", "IChartRef", "IPivotTableRef",
  "IWellDefinedReadRangeRef", "IWellDefinedReadWriteRangeRef",
];
// UiPath.Excel 名前空間でも、UiPath.Excel.dll にある型は Studio が ui: で書く（ExcelProcessScopeX の IExcelProcess）
const uiTypes = ["IExcelProcess", "WorkbookApplication", "Workbook", "IExcelLabelObject"];

export const excelXamlTypes: Record<string, [string, Record<string, string>]> = Object.fromEntries([
  ...ueTypes.flatMap((t) => [[t, [`ue:${t}`, { ue: UE }]], [`UiPath.Excel.${t}`, [`ue:${t}`, { ue: UE }]]]),
  ...uiTypes.flatMap((t) => [[t, [`ui:${t}`, { ui: UI }]], [`UiPath.Excel.${t}`, [`ui:${t}`, { ui: UI }]]]),
  ["Color", ["sdr:Color", { sdr: SDR }]], ["System.Drawing.Color", ["sdr:Color", { sdr: SDR }]],
  ["SecureString", ["sse:SecureString", { sse: SSE }]], ["System.Security.SecureString", ["sse:SecureString", { sse: SSE }]],
]);

// ---- カタログの handles（Coded の戻り値の型）----

type HandleProp = { name: string; type: string; canWrite: boolean };
type Handle = { clrType: string; bases: string[]; properties?: HandleProp[]; methods: { name: string }[] };
const handles = () => handleTypes as Map<string, Handle>; // 選んだ版のカタログの handles（loadCatalog が読む）

const full = (t: string) => (t.includes(".") ? t : `UiPath.Excel.${t}`);

// t（とその基底）のプロパティ name の型。インデクサーなら「インデクサーの型」を返す
function propType(t: string, name: string): string | undefined {
  const seen = new Set<string>();
  const walk = (x: string): string | undefined => {
    if (seen.has(x)) return undefined;
    seen.add(x);
    const h = handles().get(x);
    if (!h) return undefined;
    const p = h.properties?.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (p) return p.type;
    for (const b of h.bases) { const r = walk(b); if (r) return r; }
    return undefined;
  };
  return walk(full(t));
}

// t（とその基底）のプロパティとメソッドの名前
function memberNames(t: string): string[] {
  const out = new Set<string>();
  const seen = new Set<string>();
  const walk = (x: string) => {
    if (seen.has(x)) return;
    seen.add(x);
    const h = handles().get(x);
    if (!h) return;
    for (const p of h.properties ?? []) if (!p.name.startsWith("this[")) out.add(p.name);
    for (const m of h.methods) out.add(m.name);
    h.bases.forEach(walk);
  };
  walk(full(t));
  return [...out];
}

// 参照の式の「.名前」の連なりが handles にあるか。Excel.Sheet("Sheet1").Rangee("A1") のような打ち間違いを build の前に見つける。
// 型が分からなくなったところ（handles に無い型）から先は見ない
function badMember(expr: string, headType: string): string | undefined {
  let t: string | undefined = full(headType);
  let i = expr.match(/^\s*[A-Za-z_]\w*/)?.[0].length ?? 0;
  for (;;) {
    while (/\s/.test(expr[i] ?? "")) i++;
    if (expr[i] === "(") i = skipParens(expr, i);
    const mm = /^\.([A-Za-z_]\w*)/.exec(expr.slice(i));
    if (!mm || !t || !handles().has(t)) return undefined;
    const pt = propType(t, mm[1]);
    if (!pt) {
      const names = memberNames(t);
      return names.some((n) => n.toLowerCase() === mm[1].toLowerCase()) ? undefined : `${t.replace(/^.*\./, "")} に ${mm[1]} は無い（あるもの: ${names.join(", ")}）`;
    }
    i += mm[0].length;
    const ix = indexerResult(pt);
    if (ix && expr[i] === "(") { i = skipParens(expr, i); t = ix; } else t = pt;
  }
}

// インデクサー型（this[...] を持つ）なら、その戻り値の型
function indexerResult(t: string): string | undefined {
  return handles().get(t)?.properties?.find((p) => p.name.startsWith("this["))?.type;
}

// ---- VB → C# の前処理（generate-coded.ts の expr から呼ぶ）----

// Excel.Sheet("Sheet1").Range("A1") → Excel.Sheet.Item("Sheet1").Range.Item("A1")。
// vb2cs.ts が .Item(k) を [k] に直すので、C# では Excel.Sheet["Sheet1"].Range["A1"] になる。
// 先頭の名前の型（scope の値）が handles にあるときだけ、プロパティの型をたどって直す
export function excelVbForCs(vb: string, scope: Map<string, string>): string {
  if (!handles().size || !/\(/.test(vb)) return vb;
  let out = "";
  let i = 0;
  while (i < vb.length) {
    const c = vb[i];
    if (c === '"') { const j = skipString(vb, i); out += vb.slice(i, j); i = j; continue; }
    const m = /^[A-Za-z_]\w*/.exec(vb.slice(i));
    if (!m || (i > 0 && /[\w.]/.test(vb[i - 1]))) { out += c; i++; continue; }
    const name = m[0];
    const declared = [...scope].find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
    out += name;
    i += name.length;
    if (!declared || !handles().has(full(declared))) continue;
    // メンバーの連なりをたどる
    let t: string | undefined = full(declared);
    // 変数そのものがインデクサーを持つ（CurrentRow("Name") → CurrentRow.Item("Name")）
    const headIx = indexerResult(t);
    if (headIx && vb[i] === "(") {
      const j = skipParens(vb, i);
      out += ".Item" + vb.slice(i, j);
      i = j;
      t = headIx;
    }
    for (;;) {
      const mm = /^\.([A-Za-z_]\w*)/.exec(vb.slice(i));
      if (!mm || !t) break;
      const pt = propType(t, mm[1]);
      out += mm[0];
      i += mm[0].length;
      if (!pt) { t = undefined; break; }
      const ix = indexerResult(pt);
      if (ix && vb[i] === "(") {
        const j = skipParens(vb, i);
        out += ".Item" + vb.slice(i, j);
        i = j;
        t = ix;
      } else t = pt;
    }
  }
  return out;
}

function skipString(s: string, i: number): number {
  let j = i + 1;
  while (j < s.length) { if (s[j] === '"') { if (s[j + 1] === '"') { j += 2; continue; } return j + 1; } j++; }
  return j;
}
function skipParens(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '"') { j = skipString(s, j) - 1; continue; }
    if (s[j] === "(") depth++;
    if (s[j] === ")" && --depth === 0) return j + 1;
  }
  return s.length;
}

// ---- FilterX / FilterPivotTableX の FilterArgument → Coded の API ----
// objToCs の表（プロパティ名の読み替え）では直せない形（Condition1.Operator → Condition1 など）なので、ここで作る

type FilterCtx = { expr: (v: Value, at: string) => string; add: (p: string, c: string, m: string) => void };

function filterValues(fa: ObjValue): Value[] {
  return ((fa.BasicFiltersArgument as ObjValue | undefined)?.BasicFilters ?? []) as unknown as Value[];
}

// {FilterArgument|excelFilter} → new BasicFilter { ... } か new AdvancedFilter { ... }（FilterOptions.Filter）
export function excelFilterToCs(fa: ObjValue, at: string, ctx: FilterCtx): string {
  if (fa.Mode !== "Advanced") {
    const vals = filterValues(fa).map((x, i) => ctx.expr(x, `${at}.BasicFiltersArgument.BasicFilters[${i}]`));
    return `new BasicFilter { Values = new List<string> { ${vals.join(", ")} } }`;
  }
  const adv = (fa.AdvancedFiltersArgument ?? {}) as ObjValue;
  const sets: string[] = [];
  if (adv.LogicalOperator !== undefined) sets.push(`Operator = UiPath.Excel.LogicalOperator.${adv.LogicalOperator}`);
  for (const k of ["1", "2"]) {
    const c = adv[`Condition${k}`] as ObjValue | undefined;
    if (!c) continue;
    if (c.Operator !== undefined) sets.push(`Condition${k} = UiPath.Excel.ExcelFilterOperator.${c.Operator}`);
    if (c.Value !== undefined) sets.push(`Value${k} = ${ctx.expr(c.Value as Value, `${at}.AdvancedFiltersArgument.Condition${k}.Value`)}`);
  }
  return `new AdvancedFilter { ${sets.join(", ")} }`;
}

// {FilterArgument|excelFilterValues} → new List<string> { ... }（FilterPivotTable の values。値の一覧しか渡せない）
export function excelFilterValuesToCs(fa: ObjValue, at: string, ctx: FilterCtx): string {
  if (fa.Mode === "Advanced") ctx.add(at, "NO_CODED_API", "FilterPivotTable の API は値の一覧だけを取るので、Advanced のフィルターは Coded で書けない");
  const vals = filterValues(fa).map((x, i) => ctx.expr(x, `${at}.BasicFiltersArgument.BasicFilters[${i}]`));
  return `new List<string> { ${vals.join(", ")} }`;
}

// ---- 検証（validate.ts から呼ぶ）----

const isRefType = (t: string) => /^UiPath\.Excel\.I(Read|ReadWrite|WellDefinedRead|WellDefinedReadWrite)?(Range|Cell)Ref$|^UiPath\.Excel\.I(Sheet|Chart|PivotTable)Ref$/.test(t);
const isHandleType = (t: string | undefined) => !!t && handles().has(full(t));

// モダン: 参照（IReadRangeRef など）の式の先頭が、宣言済みの名前（スコープの item か、参照を入れた変数）であること。
//   item の書き忘れ（既定は "item"）で "Excel" が宣言されていないのを、build の前に見つける
// クラシック: ExcelInteropActivity（ExcelReadRange など）は ExcelApplicationScope の中に置くこと
export function checkExcel(n: Node, a: Activity, scope: Map<string, string>, path: string, add: (p: string, c: string, m: string) => void) {
  if (a.package !== EXCEL_PACKAGE) return;
  for (const [k, v] of Object.entries(n.props ?? {})) {
    const p: Prop | undefined = a.props.find((p) => p.name === k);
    if (!p || p.kind !== "in" || !(isRefType(p.type) || p.type === "UiPath.Excel.IWorkbookQuickHandle")) continue;
    const at = `${path}.props.${k}`;
    const s = typeof v === "string" ? v : typeof v === "object" && "vb" in v ? v.vb : undefined;
    if (s === undefined) { add(at, "EXCEL_REF", `"${k}" は Excel の参照。Excel.Sheet("Sheet1").Range("A1") のような VB の式で書く`); continue; }
    const head = s.match(/^\s*([A-Za-z_]\w*)/)?.[1];
    const t = head && [...scope].find(([x]) => x.toLowerCase() === head.toLowerCase())?.[1];
    if (!t) add(at, "EXCEL_REF", `"${k}" の先頭 "${head ?? s}" が宣言されていない。Use Excel File（ExcelApplicationCard）の中に置き、その item（例 "Excel"）で始める`);
    else if (!isHandleType(t) && !/Ref$|QuickHandle$|^(UiPath\.Excel\.)?(ExcelValue|RangeValue|Object)$/.test(t))
      add(at, "EXCEL_REF", `"${k}" の先頭 "${head}" の型 ${t} は Excel の参照ではない`);
    else { const bad = badMember(s, t); if (bad) add(at, "EXCEL_REF", `"${k}": ${bad}`); }
  }
  const base = (a as Activity & { baseType?: string }).baseType ?? "";
  if (/ExcelInteropActivity/.test(base) && ![...scope.values()].some((t) => /(^|\.)WorkbookApplication$/.test(t)))
    add(path, "EXCEL_SCOPE", `${a.className} は Excel Application Scope（ExcelApplicationScope）の中に置く`);
}

