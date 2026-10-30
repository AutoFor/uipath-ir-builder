// IR をカタログで検証する。Studio は使わない。ここで弾けるものは build まで持ち込まない。

import type { Catalog, Activity } from "./catalog.ts";
import { resolve, defaultSlot, isExpressionChild, delegateArgs, writable, listElementType, objectTypes } from "./catalog.ts";
import type { Workflow, Node, Issue, Value, VariableDecl } from "./types.ts";
import { toXamlType } from "./types-xaml.ts";
import { validateObjs, validateUiaTree } from "./uia.ts";
import { checkExcel } from "./excel.ts";

type Scope = Map<string, string>; // 名前 -> IR の型名

export function validate(wf: Workflow, cat: Catalog): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });

  if (!/^[A-Za-z_]\w*$/.test(wf.workflow)) add("workflow", "BAD_NAME", `ワークフロー名 "${wf.workflow}" は識別子にする`);

  const scope: Scope = new Map();
  for (const [i, a] of (wf.arguments ?? []).entries()) {
    checkType(a.type, `arguments[${i}]`, add);
    if (scope.has(a.name)) add(`arguments[${i}]`, "DUPLICATE_NAME", `"${a.name}" が重複している`);
    scope.set(a.name, a.type);
  }
  declare(wf.variables ?? [], "variables", scope, add);
  wf.body.forEach((n, i) => visit(n, `body[${i}]`, new Map(scope)));
  validateUiaTree(wf, cat, add);
  return issues;

  function visit(n: Node, path: string, scope: Scope) {
    const r = resolve(cat, n.act, n.typeArg !== undefined);
    if ("error" in r) {
      const hint = r.candidates.length ? `（候補: ${r.candidates.map((c) => c.clrType).join(", ")}）` : "";
      add(path, r.candidates.length ? "AMBIGUOUS_ACT" : "UNKNOWN_ACT", r.error + hint);
      return;
    }
    const a = r.activity;
    if (n.typeArg) checkType(n.typeArg, `${path}.typeArg`, add);
    if (n.variables) {
      if (!a.props.some((p) => p.name === "Variables")) add(`${path}.variables`, "NO_VARIABLES", `${a.className} は変数を持てない`);
      declare(n.variables, `${path}.variables`, scope, add);
    }

    const given = new Set<string>();
    for (const [k, v] of Object.entries(n.props ?? {})) {
      const p = a.props.find((p) => p.name === k);
      const at = `${path}.props.${k}`;
      if (!p) { add(at, "UNKNOWN_PROP", `${a.className} に "${k}" は無い`); continue; }
      if ((p.kind === "child" && !isExpressionChild(p)) || p.kind === "children" || p.kind === "delegate") {
        add(at, "SLOT_AS_PROP", `"${k}" は子アクティビティの置き場所。slots に書く`);
        continue;
      }
      given.add(k);
      const w = writable(a, p);
      if (!w.ok) { add(at, "UNSUPPORTED_PROP", `"${k}": ${w.reason}`); continue; }
      if (p.type === "System.Type") {
        if (typeof v !== "string") add(at, "BAD_TYPE_VALUE", `"${k}" は型名（"String" など）で書く`);
        else checkType(v, at, add);
        continue;
      }
      if (p.obsolete) add(at, "OBSOLETE_PROP", `"${k}" は非推奨`);
      if (p.enum && !(typeof v === "string" && p.enum.includes(v)))
        add(at, "BAD_ENUM", `"${k}" は ${p.enum.join(" / ")} のどれか`);
      if (p.kind === "out" || p.kind === "inout") checkLValue(v, at, scope);
      if (isUntypedArgument(p.type) && !argumentType(n, a, scope))
        add(at, "TYPE_UNKNOWN", `"${k}" の型が決まらない。typeArg を書くか、宣言済みの変数を代入先にする`);
    }

    // 要素で書くオブジェクト（UI のターゲットなど。uia.ts）
    for (const k of validateObjs(n, a, path, scope, add)) given.add(k);

    // Excel 固有の検査（excel.ts）
    checkExcel(n, a, scope, path, add);

    // 子の置き場所
    const slotProps = new Map<string, Node[]>();
    if (n.body) {
      const s = defaultSlot(a);
      if (!s) add(`${path}.body`, "NO_BODY", `${a.className} は子を持てない`);
      else slotProps.set(s.name, n.body);
    }
    if (n.then) slotProps.set("Then", n.then);
    if (n.else) slotProps.set("Else", n.else);
    for (const [k, v] of Object.entries(n.slots ?? {})) slotProps.set(k, v);
    for (const [k, nodes] of slotProps) {
      const p = a.props.find((p) => p.name === k);
      if (!p || !(p.kind === "child" || p.kind === "children" || p.kind === "delegate")) {
        add(`${path}.${k}`, "BAD_SLOT", `${a.className} に子の置き場所 "${k}" は無い`);
        continue;
      }
      given.add(k);
      const inner = new Map(scope);
      if (p.kind === "delegate") {
        const types = delegateArgs(p, n.typeArg);
        if (!types) { add(`${path}.${k}`, "UNSUPPORTED_SLOT", `"${k}"（${p.type}）はまだ書けない`); continue; }
        const names = itemNames(n, types.length);
        types.forEach((t, i) => inner.set(names[i], t));
      }
      nodes.forEach((c, i) => visit(c, `${path}.${k}[${i}]`, inner));
    }

    if (n.args) {
      if (a.className !== "InvokeWorkflowFile") add(`${path}.args`, "NO_ARGS", `args は InvokeWorkflowFile だけ`);
      n.args.forEach((x, i) => {
        checkType(x.type, `${path}.args[${i}]`, add);
        if (x.dir !== "In") checkLValue(x.value, `${path}.args[${i}]`, scope);
      });
    }

    for (const [k, list] of Object.entries(n.dicts ?? {})) {
      const p = a.props.find((p) => p.name === k);
      const at = `${path}.dicts.${k}`;
      if (!p || !isArgumentDict(p.type)) { add(at, "BAD_DICT", `${a.className} に引数の辞書のプロパティ "${k}" は無い`); continue; }
      given.add(k);
      const inOnly = /InArgument>$/.test(p.type);
      list.forEach((x, i) => {
        checkType(x.type, `${at}[${i}]`, add);
        if (inOnly && x.dir !== "In") add(`${at}[${i}]`, "BAD_DICT", `"${k}" には In の引数しか入らない`);
        if (x.dir !== "In") checkLValue(x.value, `${at}[${i}]`, scope);
      });
    }

    // List<T> 型のプロパティ（lists）。要素が InArgument なら式、オブジェクト型ならプロパティの辞書
    for (const [k, list] of Object.entries(n.lists ?? {})) {
      const p = a.props.find((p) => p.name === k);
      const at = `${path}.lists.${k}`;
      const el = p && listElementType(p.type);
      const t = el ? objectTypes.get(el) : undefined;
      if (!p || !el || (el !== "System.Activities.InArgument" && !t)) { add(at, "BAD_LIST", `${a.className} に lists で書ける List のプロパティ "${k}" は無い`); continue; }
      given.add(k);
      list.forEach((x, i) => {
        const iat = `${at}[${i}]`;
        if (!t) { if (!isValueItem(x)) add(iat, "BAD_LIST", `"${k}" の要素は式で書く`); return; }
        if (isValueItem(x)) { add(iat, "BAD_LIST", `"${k}" の要素は { "プロパティ名": 値 } のオブジェクトで書く（${t.className}）`); return; }
        for (const [pk, pv] of Object.entries(x)) {
          const q = t.props.find((q) => q.name === pk);
          if (!q) add(`${iat}.${pk}`, "UNKNOWN_PROP", `${t.className} に "${pk}" は無い`);
          else if (!isValueItem(pv)) add(`${iat}.${pk}`, "BAD_LIST", `"${pk}" は値（式・{ lit }・数値）で書く`);
          else if (q.enum && !(typeof pv === "string" && q.enum.includes(pv))) add(`${iat}.${pk}`, "BAD_ENUM", `"${pk}" は ${q.enum.join(" / ")} のどれか`);
        }
      });
    }

    if (n.cases) {
      if (!a.props.some((p) => p.name === "Cases")) add(`${path}.cases`, "BAD_SLOT", `cases は Switch だけ`);
      for (const [key, nodes] of Object.entries(n.cases)) nodes.forEach((c, i) => visit(c, `${path}.cases.${key}[${i}]`, new Map(scope)));
    }
    if (n.catches) {
      if (!a.props.some((p) => p.name === "Catches")) add(`${path}.catches`, "BAD_SLOT", `catches は TryCatch だけ`);
      n.catches.forEach((c, i) => {
        checkType(c.type, `${path}.catches[${i}].type`, add);
        const inner = new Map(scope).set(c.var ?? "exception", c.type);
        c.body.forEach((x, j) => visit(x, `${path}.catches[${i}].body[${j}]`, inner));
      });
    }
    if (n.assigns) {
      if (!a.props.some((p) => p.name === "AssignOperations")) add(`${path}.assigns`, "BAD_SLOT", `assigns は MultipleAssign だけ`);
      else given.add("AssignOperations");
      n.assigns.forEach((x, i) => {
        checkLValue(x.to, `${path}.assigns[${i}].to`, scope);
        if (scope.has(x.to.match(/^[A-Za-z_]\w*/)?.[0] ?? "") && !scope.has(x.to))
          add(`${path}.assigns[${i}].to`, "TYPE_UNKNOWN", `代入先の型が決まらない。変数名をそのまま書く`);
      });
    }

    // OverloadGroup（WriteTextFile の File / FileName など）は、どれか1つのグループがそろっていればよい
    const required = a.props.filter((p) => p.required);
    const groups = new Map<string, string[]>();
    for (const p of required) for (const g of p.overloadGroups ?? []) groups.set(g, [...(groups.get(g) ?? []), p.name]);
    const groupOk = [...groups.values()].some((names) => names.every((x) => given.has(x)));
    for (const p of required.filter((p) => !given.has(p.name) && !(p.overloadGroups?.length && groupOk)))
      add(path, "REQUIRED_MISSING", `${a.className} の必須プロパティ "${p.name}" が無い`);
  }

  // 代入先は宣言済みの名前で始まること（a.b(0) のような式は先頭の名前だけ見る）
  function checkLValue(v: Value, at: string, scope: Scope) {
    if (typeof v !== "string") { add(at, "OUT_NOT_LVALUE", "出力先は変数名（式）で書く"); return; }
    const head = v.match(/^[A-Za-z_]\w*/)?.[0];
    if (!head || !scope.has(head)) add(at, "UNDECLARED_NAME", `出力先 "${v}" が宣言されていない`);
  }
}

function declare(vars: VariableDecl[], path: string, scope: Scope, add: (p: string, c: string, m: string) => void) {
  vars.forEach((v, i) => {
    if (!/^[A-Za-z_]\w*$/.test(v.name)) add(`${path}[${i}]`, "BAD_NAME", `"${v.name}" は識別子にする`);
    checkType(v.type, `${path}[${i}]`, add);
    scope.set(v.name, v.type);
  });
}

function checkType(t: string, path: string, add: (p: string, c: string, m: string) => void) {
  const r = toXamlType(t);
  if ("error" in r) add(path, "UNKNOWN_TYPE", r.error);
}

// delegate の引数名。足りない分は item, item2, ... で埋める
export function itemNames(n: Node, count: number): string[] {
  const given = n.item === undefined ? [] : Array.isArray(n.item) ? n.item : [n.item];
  return Array.from({ length: count }, (_, i) => given[i] ?? (i === 0 ? "item" : `item${i + 1}`));
}

// Dictionary<String, Argument> / Dictionary<String, InArgument>（IDictionary も）
export const isArgumentDict = (t: string) => /^System\.Collections\.Generic\.I?Dictionary<System\.String, System\.Activities\.(In)?Argument>$/.test(t);

// 非ジェネリックの InArgument / OutArgument（Assign.To など）は、要素形式で型を書く必要がある
export const isUntypedArgument = (t: string) => t === "System.Activities.InArgument" || t === "System.Activities.OutArgument";

// 型は typeArg、なければ代入先の変数の宣言から取る
export function argumentType(n: Node, a: Activity, scope: Map<string, string>): string | undefined {
  if (n.typeArg) return n.typeArg;
  const out = a.props.find((p) => p.kind === "out" && isUntypedArgument(p.type));
  const v = out && n.props?.[out.name];
  return typeof v === "string" ? scope.get(v) : undefined;
}

// 値（式・{ lit }・{ vb, cs }・数値・真偽値）か。lists の要素がオブジェクト（プロパティの辞書）かの見分けに使う
export function isValueItem(v: unknown): v is Value {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return true;
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const k = Object.keys(v).sort().join();
  return k === "lit" || k === "cs,vb";
}
