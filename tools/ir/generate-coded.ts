// 検証済みの IR から Coded Workflow（C#）を作る。XAML の generate.ts と同じ IR を入力にする。
//
// - 制御フロー（Sequence / If / ForEach / While / DoWhile / Switch / TryCatch / Assign / MultipleAssign / Break / Continue /
//   Throw / Rethrow / RetryScope）は C# の構文にする（下の builtin）
// - それ以外のアクティビティは mappings/<pkg>/<ClassName>.json の対応表でメソッド呼び出しにする。対応表が無ければエラー
// - VB の式は vb2cs.ts で C# に直す。直せない式はエラー（IR に { vb, cs } で書く）
//
// ワークフローの引数（uip rpa build の生成コードで確かめた形）:
//   In  → Execute の引数
//   Out → 戻り値。1つなら T を返し、引数名は "Output" になる。2つ以上なら名前付きタプル (T out_A, U out_B)
//   InOut → 未対応（Execute の ref / out 引数は Studio の生成コードがコンパイルできない）

import type { Catalog } from "./catalog.ts";
import { resolve, defaultSlot, delegateArgs } from "./catalog.ts";
import type { Workflow, Node, Value, Issue } from "./types.ts";
import type { Mapping, Variant, ObjArg } from "./mapping.ts";
import { refs, requiredRefs, scopeRefs, usingScope, UIA_APP_TYPE } from "./mapping.ts";
import { excelVbForCs } from "./excel.ts";
import { vbToCs, vbDefaultToCs, csType } from "./vb2cs.ts";
import { itemNames } from "./validate.ts";
import { objToCs } from "./uia.ts";

export type CodedOptions = {
  namespace: string;
  // InvokeWorkflowFile の WorkflowFileName（文字列リテラル）を書き換える。Coded 同士で呼ぶときに "Greet.xaml" → "coded/Greet.cs" にする
  invokePath?: (path: string) => string;
};

const baseUsings = ["System", "System.Collections.Generic", "System.Data", "System.IO", "System.Linq", "UiPath.CodedWorkflows", "UiPath.Platform.ResourceHandling"];

const builtin = new Set([
  "System.Activities.Statements.Sequence", "System.Activities.Statements.If", "System.Activities.Statements.ForEach",
  "UiPath.Core.Activities.ForEach", "UiPath.Core.Activities.ForEachRow", "System.Activities.Statements.While", "System.Activities.Statements.DoWhile",
  "System.Activities.Statements.Switch", "System.Activities.Statements.TryCatch", "System.Activities.Statements.Assign",
  "UiPath.Core.Activities.MultipleAssign", "UiPath.Core.Activities.Break", "UiPath.Core.Activities.Continue",
  "System.Activities.Statements.Throw", "System.Activities.Statements.Rethrow", "UiPath.Core.Activities.RetryScope",
]);
export const isBuiltin = (clrType: string) => builtin.has(clrType);

export function generateCoded(wf: Workflow, cat: Catalog, maps: Map<string, Mapping>, opt: CodedOptions): { code: string; issues: Issue[] } {
  const issues: Issue[] = [];
  const usings = new Set(baseUsings);
  const lines: string[] = [];
  let tmp = 0;
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  const emit = (depth: number, s: string) => lines.push("    ".repeat(depth) + s);

  const ins = (wf.arguments ?? []).filter((a) => a.dir === "In");
  const outs = (wf.arguments ?? []).filter((a) => a.dir === "Out");
  (wf.arguments ?? []).filter((a) => a.dir === "InOut").forEach((a) =>
    add(`arguments.${a.name}`, "CODED_INOUT", `InOut 引数 "${a.name}" は Coded では書けない（In と Out に分ける）`));
  const ret = outs.length === 0 ? "void" : outs.length === 1 ? csType(outs[0].type) : `(${outs.map((a) => `${csType(a.type)} ${a.name}`).join(", ")})`;

  const scope = new Map((wf.arguments ?? []).map((a) => [a.name, a.type] as [string, string]));
  const d = 3;
  for (const a of outs) emit(d, `${csType(a.type)} ${a.name} = default;`);
  for (const [i, v] of (wf.variables ?? []).entries()) declare(v.name, v.type, v.default, d, `variables[${i}]`, scope);
  wf.body.forEach((n, i) => node(n, d, `body[${i}]`, scope));
  if (outs.length === 1) emit(d, `return ${outs[0].name};`);
  else if (outs.length > 1) emit(d, `return (${outs.map((a) => a.name).join(", ")});`);
  const body = lines.splice(0);

  const out = [
    ...[...usings].map((u) => `using ${u};`),
    "",
    `namespace ${opt.namespace}`,
    "{",
    `    // tools/ir/gen-coded.ts で IR（${wf.workflow}）から生成。手で直さず IR を直す`,
    `    public class ${wf.workflow} : CodedWorkflow`,
    "    {",
    "        [Workflow]",
    `        public ${ret} Execute(${ins.map((a) => `${csType(a.type)} ${a.name}`).join(", ")})`,
    "        {",
    ...body,
    "        }",
    "    }",
    "}",
    "",
  ];
  return { code: out.join("\r\n"), issues };

  // ---- 式 ----
  function expr(v: Value, at: string, sc: Map<string, string>): string {
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "object") {
      if ("lit" in v) return csLit(v.lit);
      return v.cs;
    }
    const r = vbToCs(excelVbForCs(v, sc), sc);
    if ("error" in r) { add(at, "CODED_EXPR", `式 ${JSON.stringify(v)} を C# に直せない: ${r.error}`); return "/* ? */ default"; }
    return r.cs;
  }
  function lvalue(v: Value, at: string, sc: Map<string, string>): string {
    if (typeof v !== "string") { add(at, "CODED_EXPR", "代入先は変数名で書く"); return "_"; }
    return expr(v, at, sc);
  }
  // 文字列にする。文字列だと分かるもの（リテラル、String の変数、文字列の連結）はそのまま
  function str(v: Value, at: string, sc: Map<string, string>): string {
    const e = expr(v, at, sc);
    if (typeof v === "object" && "lit" in v) return e;
    if (typeof v === "string") {
      const t = sc.get(v.trim()) ?? [...sc].find(([k]) => k.toLowerCase() === v.trim().toLowerCase())?.[1];
      if (t && /^(System\.)?String$/i.test(t)) return e;
      if (/^\s*"/.test(v) || /^\s*[\w.]+\s*&/.test(v) || /&/.test(v)) return e;
      if (/\.ToString\s*$/.test(v)) return e;
    }
    return `Convert.ToString(${e})`;
  }

  function declare(name: string, type: string, def: string | undefined, depth: number, at: string, sc: Map<string, string>) {
    let init = "default";
    if (def !== undefined) {
      const r = vbDefaultToCs(def, type, sc);
      if ("error" in r) add(at, "CODED_EXPR", `既定値 ${JSON.stringify(def)} を C# に直せない: ${r.error}`);
      else init = r.cs;
    }
    emit(depth, `${csType(type)} ${name} = ${init};`);
    sc.set(name, type);
  }

  // ---- 文 ----
  function block(nodes: Node[] | undefined, depth: number, at: string, sc: Map<string, string>) {
    (nodes ?? []).forEach((c, i) => node(c, depth, `${at}[${i}]`, new Map(sc)));
  }

  function node(n: Node, depth: number, at: string, sc: Map<string, string>) {
    const r = resolve(cat, n.act, n.typeArg !== undefined);
    if ("error" in r) { add(at, "UNKNOWN_ACT", r.error); return; }
    const a = r.activity;
    const p = n.props ?? {};
    if (n.name) emit(depth, `// ${n.name.replace(/\r?\n/g, " ")}`);
    if (!builtin.has(a.clrType)) return mapped(n, a.className, a.package, depth, at, sc);

    switch (a.className) {
      case "Sequence": {
        const own = n.variables?.length;
        if (own) emit(depth, "{");
        const inner = new Map(sc);
        (n.variables ?? []).forEach((v, i) => declare(v.name, v.type, v.default, depth + (own ? 1 : 0), `${at}.variables[${i}]`, inner));
        (n.body ?? []).forEach((c, i) => node(c, depth + (own ? 1 : 0), `${at}.body[${i}]`, new Map(inner)));
        if (own) emit(depth, "}");
        return;
      }
      case "If":
        emit(depth, `if (${expr(p.Condition, `${at}.props.Condition`, sc)})`);
        braces(depth, () => block(n.then, depth + 1, `${at}.then`, sc));
        if (n.else?.length) { emit(depth, "else"); braces(depth, () => block(n.else, depth + 1, `${at}.else`, sc)); }
        return;
      case "ForEach": {
        const [item] = itemNames(n, 1);
        const t = n.typeArg ? csType(n.typeArg) : "var";
        const inner = new Map(sc).set(item, n.typeArg ?? "Object");
        const idx = p.CurrentIndex !== undefined ? lvalue(p.CurrentIndex, `${at}.props.CurrentIndex`, sc) : undefined;
        if (p.MaxIterations !== undefined) add(`${at}.props.MaxIterations`, "CODED_UNSUPPORTED", "ForEach.MaxIterations はまだ Coded に直せない");
        if (idx) emit(depth, `${idx} = -1;`);
        emit(depth, `foreach (${t} ${item} in ${expr(p.Values, `${at}.props.Values`, sc)})`);
        braces(depth, () => { if (idx) emit(depth + 1, `${idx}++;`); block(n.body, depth + 1, `${at}.body`, inner); });
        return;
      }
      case "ForEachRow": {
        // DataTable の行を foreach で回す。CurrentIndex は 0 始まりの行番号。MaxIterations は先頭から数えて打ち切る。
        // Condition / Values / ColumnNames など、行の選び方を変えるものはまだ Coded に直せない
        const [item] = itemNames(n, 1);
        const inner = new Map(sc).set(item, "DataRow");
        const idx = p.CurrentIndex !== undefined ? lvalue(p.CurrentIndex, `${at}.props.CurrentIndex`, sc) : undefined;
        for (const k of Object.keys(p)) if (!["DataTable", "CurrentIndex", "MaxIterations"].includes(k)) add(`${at}.props.${k}`, "CODED_UNSUPPORTED", `ForEachRow.${k} はまだ Coded に直せない`);
        const i = `__row${++tmp}`;
        if (idx) emit(depth, `${idx} = -1;`);
        emit(depth, `var ${i} = 0;`);
        emit(depth, `foreach (DataRow ${item} in ${expr(p.DataTable, `${at}.props.DataTable`, sc)}.Rows)`);
        braces(depth, () => {
          if (p.MaxIterations !== undefined) { emit(depth + 1, `if (${i} >= ${expr(p.MaxIterations, `${at}.props.MaxIterations`, sc)}) break;`); }
          emit(depth + 1, `${i}++;`);
          if (idx) emit(depth + 1, `${idx}++;`);
          block(n.body, depth + 1, `${at}.body`, inner);
        });
        return;
      }
      case "While":
        emit(depth, `while (${expr(p.Condition, `${at}.props.Condition`, sc)})`);
        braces(depth, () => block(n.body, depth + 1, `${at}.body`, sc));
        return;
      case "DoWhile":
        emit(depth, "do");
        braces(depth, () => block(n.body, depth + 1, `${at}.body`, sc), `while (${expr(p.Condition, `${at}.props.Condition`, sc)});`);
        return;
      case "Switch": {
        // C# の switch にすると、中の break がループではなく switch を抜けてしまう。if / else if にする
        const v = `__switch${++tmp}`;
        emit(depth, `var ${v} = ${expr(p.Expression, `${at}.props.Expression`, sc)};`);
        const t = (n.typeArg ?? "String").replace(/^System\./, "");
        let first = true;
        for (const [key, nodes] of Object.entries(n.cases ?? {})) {
          const k = t === "String" ? csLit(key) : /^(Int\d+|Double|Decimal|Int|Integer|Long)$/.test(t) ? key : `${csType(n.typeArg!)}.${key}`;
          emit(depth, `${first ? "" : "else "}if (Equals(${v}, ${k}))`);
          braces(depth, () => block(nodes, depth + 1, `${at}.cases.${key}`, sc));
          first = false;
        }
        const def = n.slots?.Default;
        if (def?.length) {
          if (!first) emit(depth, "else");
          braces(depth, () => block(def, depth + 1, `${at}.slots.Default`, sc));
        }
        return;
      }
      case "TryCatch":
        emit(depth, "try");
        braces(depth, () => block(n.body, depth + 1, `${at}.body`, sc));
        (n.catches ?? []).forEach((c, i) => {
          const name = c.var ?? "exception";
          emit(depth, `catch (${csType(c.type)} ${name})`);
          braces(depth, () => block(c.body, depth + 1, `${at}.catches[${i}].body`, new Map(sc).set(name, c.type)));
        });
        if (n.slots?.Finally?.length) { emit(depth, "finally"); braces(depth, () => block(n.slots!.Finally, depth + 1, `${at}.slots.Finally`, sc)); }
        return;
      case "Assign":
        emit(depth, `${lvalue(p.To, `${at}.props.To`, sc)} = ${expr(p.Value, `${at}.props.Value`, sc)};`);
        return;
      case "MultipleAssign":
        (n.assigns ?? []).forEach((x, i) => emit(depth, `${lvalue(x.to, `${at}.assigns[${i}].to`, sc)} = ${expr(x.value, `${at}.assigns[${i}].value`, sc)};`));
        return;
      case "Break": emit(depth, "break;"); return;
      case "Continue": emit(depth, "continue;"); return;
      case "Throw": emit(depth, `throw ${expr(p.Exception, `${at}.props.Exception`, sc)};`); return;
      case "Rethrow": emit(depth, "throw;"); return;
      case "RetryScope": {
        // 例外が出たら RetryInterval 待って、合計 NumberOfRetries 回まで繰り返す。Condition（ActivityFunc）は未対応
        if (n.slots?.Condition) add(`${at}.slots.Condition`, "CODED_UNSUPPORTED", "RetryScope.Condition はまだ Coded に直せない");
        for (const k of Object.keys(p)) if (!["NumberOfRetries", "RetryInterval"].includes(k)) add(`${at}.props.${k}`, "CODED_UNSUPPORTED", `RetryScope.${k} はまだ Coded に直せない`);
        const i = `__retry${++tmp}`;
        const count = p.NumberOfRetries !== undefined ? expr(p.NumberOfRetries, `${at}.props.NumberOfRetries`, sc) : "3";
        const wait = p.RetryInterval !== undefined ? expr(p.RetryInterval, `${at}.props.RetryInterval`, sc) : "TimeSpan.FromSeconds(5)";
        emit(depth, `for (var ${i} = 1; ; ${i}++)`);
        braces(depth, () => {
          emit(depth + 1, "try");
          braces(depth + 1, () => { block(n.body, depth + 2, `${at}.body`, sc); emit(depth + 2, "break;"); });
          emit(depth + 1, `catch (Exception) when (${i} < ${count})`);
          braces(depth + 1, () => emit(depth + 2, `Delay(${wait});`));
        });
        return;
      }
    }
  }

  function braces(depth: number, inner: () => void, closeSuffix?: string) {
    emit(depth, "{");
    inner();
    emit(depth, closeSuffix ? `} ${closeSuffix}` : "}");
  }

  // ---- 対応表 ----
  function mapped(n: Node, className: string, pkg: string, depth: number, at: string, sc: Map<string, string>) {
    const m = maps.get(`${pkg}/${className}`);
    if (!m) { add(at, "NO_MAPPING", `${className} の対応表が無い（mappings/${pkg}/${className}.json を作る）`); return; }
    if (m.coded === null) { add(at, "NO_CODED_API", `${className} は Coded で書けない: ${m.reason}（${m.file}）`); return; }
    const given = [...Object.keys(n.props ?? {}), ...Object.keys(n.objs ?? {})];
    const v = m.coded.find((x) => (x.when ?? []).every((w) => given.includes(w)));
    if (!v) { add(at, "NO_MAPPING", `${className} の対応表に、この props（${given.join(", ")}）に合う形が無い（${m.file}）`); return; }
    // 引数の辞書（dicts）は、対応表が {Arguments|dict} で受けるか、ignore に書いたものだけ許す
    const tplRefs = new Set([...(v.code ? refs(v.code) : []), ...(v.call ? refs(v.call) : []), ...Object.values(v.init?.props ?? {}).flat().flatMap(refs), ...Object.values(v.args ?? {}).flatMap((t) => (typeof t === "string" ? refs(t) : Object.values(t.set).flatMap(refs)))]);
    for (const k of Object.keys(n.dicts ?? {})) if (!(m.ignore ?? []).concat(v.ignore ?? []).includes(k) && !tplRefs.has(k))
      add(`${at}.dicts.${k}`, "CODED_UNSUPPORTED", `${className}.${k}（引数の辞書）はまだ Coded に直せない`);
    for (const u of v.usings ?? []) usings.add(u);
    // この形だけ Coded API が無い（{ "when": ["ExistingWorkbook"], "reason": "..." }）
    if (v.reason && !v.call && !v.code && !v.special && !v.scope) { add(at, "NO_CODED_API", `${className} は Coded で書けない: ${v.reason}（${m.file}）`); return; }

    if (v.special === "invokeWorkflow") return invoke(n, v, m, depth, at, sc);

    const act = resolve(cat, n.act, n.typeArg !== undefined);
    const adef = "activity" in act ? act.activity : undefined;
    // どの props を使ったか（使わなかった props は意味が落ちるのでエラー）
    const used = new Set<string>((m.ignore ?? []).concat(v.ignore ?? []));
    // IR の props に、対応表の defaults（IR に無いときの値）を足したもの
    const props: Record<string, Value> = { ...(v.defaults ?? {}), ...(n.props ?? {}) };
    const has = (r: string) => props[r] !== undefined || n.objs?.[r] !== undefined || n.dicts?.[r] !== undefined;
    // 外側のスコープ（"scope": "using"）の変数。内側のものほど後ろにある
    const scopeVar = (t: string) => [...sc].reverse().find(([, ty]) => ty === t || ty.endsWith("." + t))?.[0];
    // テンプレートを使えるか（既定の無い参照が IR にそろい、{@型名} のスコープが外側にある）。使えなければその引数・行ごと省く
    const avail = (tpl: string) => requiredRefs(tpl).every(has) && scopeRefs(tpl).every((t) => scopeVar(t) !== undefined);
    const fill = (tpl: string) => {
      for (const r of refs(tpl)) used.add(r);
      for (const t of scopeRefs(tpl)) if (!scopeVar(t)) add(at, "CODED_SCOPE", `${className} は ${t} のスコープの中に置く（${m.file}）`);
      return tpl.replace(/\{@([\w.]+)\}/g, (_, t: string) => scopeVar(t) ?? "_").replace(/\{(\w+)(?:\|(\w+))?(?::-([^}]*))?\}/g, (_, name: string, filter?: string, dflt?: string) => {
        if (name === "typeArg") return n.typeArg ? csType(n.typeArg) : "object";
        if (name === "app") {
          // {app} は、いちばん内側の NApplicationCard（"special": "scope"）の変数。{@UiTargetApp} と同じ
          const app = scopeVar(UIA_APP_TYPE);
          if (!app) { add(at, "CODED_NO_SCOPE", `${className} の対応表は {app} を使うが、NApplicationCard の中に無い`); return "/* ? */ null"; }
          return app;
        }
        if (filter === "dict") {
          // 引数の辞書 → new Dictionary<string, object> { ["名前"] = 値, ... }（In だけ。Out / InOut は Coded に直せない）
          const d = n.dicts?.[name];
          if (!d) return dflt ?? "";
          for (const x of d) if (x.dir !== "In") add(`${at}.dicts.${name}.${x.name}`, "CODED_UNSUPPORTED", `${className}.${name} の ${x.dir} 引数は Coded に直せない`);
          const items = d.filter((x) => x.dir === "In").map((x) => `[${csLit(x.name)}] = ${expr(x.value, `${at}.dicts.${name}.${x.name}`, sc)}`);
          return `new Dictionary<string, object> { ${items.join(", ")} }`;
        }
        const pat = `${at}.props.${name}`;
        if (n.objs?.[name] !== undefined && adef) return objToCs(adef, name, n.objs[name], `${at}.objs.${name}`, { expr: (x, xat) => expr(x, xat, sc), add });
        const val = props[name];
        if (val === undefined) return dflt ?? "";
        // {Prop|type} … out の代入先の変数の型（C# の型名）
        if (filter === "type") {
          const t = typeof val === "string" ? (sc.get(val.trim()) ?? [...sc].find(([k]) => k.toLowerCase() === val.trim().toLowerCase())?.[1]) : undefined;
          return t ? csType(t) : "object";
        }
        // {Prop|is_Member} … enum の値が Member かどうか（"true" / "false"）
        if (filter?.startsWith("is_")) return String(val === filter.slice(3));
        const pdef = adef?.props.find((x) => x.name === name);
        if (pdef?.enum && typeof val === "string")
          return filter === "enum" ? val.split(",").map((x) => `${pdef.type}.${x.trim()}`).join(" | ") : val;
        if (pdef && (pdef.kind === "out" || pdef.kind === "inout")) return lvalue(val, pat, sc);
        return filter === "str" ? str(val, pat, sc) : expr(val, pat, sc);
      });
    };
    // args の値（文字列のテンプレートか、オプションのオブジェクト { new, set }）。使えないなら undefined（引数ごと省く）
    const argText = (tpl: string | ObjArg): string | undefined => {
      if (typeof tpl === "string") return avail(tpl) ? fill(tpl) : undefined;
      const sets = Object.entries(tpl.set).filter(([, t]) => refs(t).length > 0 && avail(t)).map(([k, t]) => `${k} = ${fill(t)}`);
      if (!sets.length) return tpl.always ? `new ${tpl.new}()` : undefined;
      return `new ${tpl.new} { ${sets.join(", ")} }`;
    };

    // ContinueOnError は、どのアクティビティでも try / catch で包む（式が真のときだけ例外を握りつぶす）
    const coe = n.props?.ContinueOnError;
    if (coe !== undefined) used.add("ContinueOnError");
    const cond = coe === undefined ? "false" : expr(coe, `${at}.props.ContinueOnError`, sc);
    const wrap = cond !== "false";
    const d = wrap ? depth + 1 : depth;
    if (wrap) { emit(depth, "try"); emit(depth, "{"); }

    // 子（body / slots）は scope と branches だけが使う。それ以外で書かれていたら意味が落ちる
    const slotsUsed = new Set<string>();
    if (v.code) for (const l of fill(v.code).split(/\r?\n/)) emit(d, l);
    else if (v.call) {
      const args = Object.entries(v.args ?? {}).map(([param, tpl]) => [param, argText(tpl)] as const).filter(([, t]) => t !== undefined).map(([param, t]) => `${param}: ${t}`);
      if (v.init) {
        // 引数 param に new Type { ... } を渡す。値が配列なら、使える最初のもの（Password と SecurePassword のどちらか、など）
        const members = Object.entries(v.init.props).map(([k, t]) => [k, (Array.isArray(t) ? t : [t]).find(avail)] as const)
          .filter(([, tpl]) => tpl !== undefined).map(([k, tpl]) => `${k} = ${fill(tpl!)}`);
        args.push(`${v.init.param}: new ${v.init.type} { ${members.join(", ")} }`);
      }
      const call = `${fill(v.call)}(${args.join(", ")})`;
      if (v.returns) used.add(v.returns);
      const target = v.returns && n.props?.[v.returns] !== undefined ? lvalue(n.props[v.returns], `${at}.props.${v.returns}`, sc) : undefined;
      const us = usingScope(v);
      if (us) {
        // スコープ: using (var <変数> = call) { body }。子からは {@scopeType の末尾}（NApplicationCard なら {app}）で参照する
        //   変数名は、varPrefix があれば <varPrefix><連番>（NApplicationCard の app1）、無ければ IR の item（Excel の Use Excel File など）
        //   CloseMode などは Dispose で効く
        const slot = adef ? defaultSlot(adef) : undefined;
        const name = us.varPrefix ? `${us.varPrefix}${++tmp}` : itemNames(n, 1)[0];
        const type = us.type ?? (slot ? delegateArgs(slot, n.typeArg)?.[0] : undefined) ?? "Object";
        emit(d, `using (var ${name} = ${call})`);
        braces(d, () => block(n.body, d + 1, `${at}.body`, new Map(sc).set(name, type)));
        slotsUsed.add("body");
      } else if (v.branches) {
        const r = `__state${++tmp}`;
        emit(d, `var ${r} = ${call};`);
        if (target) emit(d, `${target} = ${r};`);
        const t = v.branches.true, f = v.branches.false;
        emit(d, `if (${r})`);
        braces(d, () => block(t ? n.slots?.[t] : undefined, d + 1, `${at}.slots.${t}`, sc));
        if (f && n.slots?.[f]?.length) { emit(d, "else"); braces(d, () => block(n.slots![f], d + 1, `${at}.slots.${f}`, sc)); }
        if (t) slotsUsed.add(t);
        if (f) slotsUsed.add(f);
      } else emit(d, target ? `${target} = ${call};` : `${call};`);
    } else add(at, "BAD_MAPPING", `${m.file}: call か code が要る`);
    if (n.body?.length && !slotsUsed.has("body")) add(`${at}.body`, "CODED_UNSUPPORTED", `${className} の body を対応表（${m.file}）が扱っていない`);
    for (const k of Object.keys(n.slots ?? {})) if (!slotsUsed.has(k) && !(m.ignore ?? []).includes(k))
      add(`${at}.slots.${k}`, "CODED_UNSUPPORTED", `${className}.${k}（子）を対応表（${m.file}）が扱っていない`);
    for (const k of given) if (!used.has(k) && k !== "DisplayName")
      add(`${at}.props.${k}`, "MAPPING_UNUSED_PROP", `${className}.${k} を対応表（${m.file}）が扱っていない。args${v.init ? " か init" : ""} に足すか、意味がなければ ignore に書く`);
    if (!wrap) return;
    emit(depth, "}");
    emit(depth, cond === "true" ? "catch (Exception)" : `catch (Exception) when (${cond})`);
    braces(depth, () => emit(depth + 1, `// ContinueOnError: ${className} の例外を無視する`));
  }

  function invoke(n: Node, _v: Variant, m: Mapping, depth: number, at: string, sc: Map<string, string>) {
    const p = n.props ?? {};
    const fileV = p.WorkflowFileName;
    let file = expr(fileV, `${at}.props.WorkflowFileName`, sc);
    if (typeof fileV === "object" && "lit" in fileV && opt.invokePath) file = csLit(opt.invokePath(fileV.lit));
    const toCoded = /\.cs"$/.test(file);
    const known = new Set(["WorkflowFileName", "Timeout", "DisplayName", ...(m.ignore ?? [])]);
    for (const k of Object.keys(p)) if (!known.has(k)) add(`${at}.props.${k}`, "MAPPING_UNUSED_PROP", `InvokeWorkflowFile.${k} はまだ Coded に直せない`);
    const inArgs = (n.args ?? []).filter((x) => x.dir === "In").map((x) => `["${x.name}"] = ${expr(x.value, `${at}.args.${x.name}`, sc)}`);
    const outArgs = (n.args ?? []).filter((x) => x.dir !== "In");
    if ((n.args ?? []).some((x) => x.dir === "InOut")) add(`${at}.args`, "CODED_INOUT", "InOut 引数の受け渡しはまだ Coded に直せない");
    const dict = inArgs.length ? `new Dictionary<string, object> { ${inArgs.join(", ")} }` : "null";
    const timeout = p.Timeout !== undefined ? `, timeout: ${expr(p.Timeout, `${at}.props.Timeout`, sc)}` : "";
    if (!outArgs.length) { emit(depth, `RunWorkflow(${file}, ${dict}${timeout});`); return; }
    const r = `__result${++tmp}`;
    emit(depth, `var ${r} = RunWorkflow(${file}, ${dict}${timeout});`);
    // Coded のワークフローは、Out が1つだと引数名が "Output" になる
    for (const x of outArgs) {
      const key = toCoded && outArgs.length === 1 ? "Output" : x.name;
      emit(depth, `${lvalue(x.value, `${at}.args.${x.name}`, sc)} = (${csType(x.type)})${r}["${key}"];`);
    }
  }
}

function csLit(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
}
