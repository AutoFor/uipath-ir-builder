// IR をカタログで検証する。Studio は使わない。ここで弾けるものは build まで持ち込まない。

import type { Catalog, Activity } from "./catalog.ts";
import { funcInfo, funcArgName, resolve, defaultSlot, isExpressionChild, delegateArgs, writable, isArgumentList, argumentListElement, listElementType, objectTypes, plainListElement, literalMapValue, DAYS_OF_WEEK } from "./catalog.ts";
import type { Workflow, Node, Issue, Value, VariableDecl, FlowStepDecl, FlowDecisionDecl, FlowSwitchDecl, ObjValue } from "./types.ts";
import { processAllNodes, processBase, processFields, processLinks, processNodeType, processNodeTypes, processOwnedProps } from "./process.ts";
import { flowKind, flowLinks, stepNode, isGraphId } from "./graph.ts";
import { toXamlType } from "./types-xaml.ts";
import { validateObjs, validateUiaTree } from "./uia.ts";
import { checkExcel } from "./excel.ts";
import { checkPersistence } from "./persistence.ts";

type Scope = Map<string, string>; // 名前 -> IR の型名

// IR の file（XAML の置き場所）として書けるか：プロジェクトの中の相対パスの .xaml
export const isWorkflowFile = (f: string) => /\.xaml$/i.test(f) && !/^([\\/]|[A-Za-z]:)/.test(f) && !f.split(/[\\/]/).some((s) => s === ".." || s === "." || s === "");
// IR から書き出す XAML の、プロジェクトからの相対パス（区切りは /）
export const workflowFile = (wf: Pick<Workflow, "workflow" | "file">) => (wf.file ?? `${wf.workflow}.xaml`).replace(/\\/g, "/");

export function validate(wf: Workflow, cat: Catalog): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  const graphIds = new Set<string>(); // 図の id（x:Name）。ワークフローの中で1つ

  if (!IDENT.test(wf.workflow)) add("workflow", "BAD_NAME", `ワークフロー名 "${wf.workflow}" は識別子にする`);
  if (wf.file !== undefined && !isWorkflowFile(wf.file)) add("file", "BAD_FILE", `file "${wf.file}" は、プロジェクトからの相対パスの .xaml にする（例 "Sub/Foo.xaml"。".." や絶対パスは書けない）`);

  const scope: Scope = new Map();
  for (const [i, a] of (wf.arguments ?? []).entries()) {
    checkType(a.type, `arguments[${i}]`, add);
    if (scope.has(a.name)) add(`arguments[${i}]`, "DUPLICATE_NAME", `"${a.name}" が重複している`);
    scope.set(a.name, a.type);
    if (a.default !== undefined) {
      const d = a.default as unknown;
      const okLit = (typeof d === "object" && d !== null && typeof (d as { lit?: unknown }).lit === "string" && a.type === "String")
        || (typeof d === "boolean" && a.type === "Boolean") || (typeof d === "number" && /^(Int32|Int64|Double|Decimal)$/.test(a.type));
      if (a.dir !== "In") add(`arguments[${i}].default`, "BAD_ARG_DEFAULT", `既定値は In の引数にだけ書ける（${a.name} は ${a.dir}）`);
      else if (!okLit) add(`arguments[${i}].default`, "BAD_ARG_DEFAULT", `${a.name}（${a.type}）の既定値は、String なら { "lit": "..." }、Boolean なら true / false、数値なら数で書く`);
    }
  }
  declare(wf.variables ?? [], "variables", scope, add);
  wf.body.forEach((n, i) => visit(n, `body[${i}]`, new Map(scope)));
  validateUiaTree(wf, cat, add);
  checkPersistence(wf, add);
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
      if (isArgumentList(p.type)) { add(at, "LIST_AS_PROP", `"${k}" は式の一覧。lists に書く`); continue; }
      given.add(k);
      const w = writable(a, p);
      if (!w.ok) { add(at, "UNSUPPORTED_PROP", `"${k}": ${w.reason}`); continue; }
      if (w.how === "lists" || w.how === "dicts" || /^(flowchart|stateMachine|branches)(.|$)/.test(w.how)) { add(at, "UNSUPPORTED_PROP", `"${k}" は props ではなく ${w.how} に書く`); continue; }
      if (p.type === "System.Type") {
        if (typeof v !== "string") add(at, "BAD_TYPE_VALUE", `"${k}" は型名（"String" など）で書く`);
        else checkType(v, at, add);
        continue;
      }
      if (p.obsolete) add(at, "OBSOLETE_PROP", `"${k}" は非推奨`);
      if (p.enum && p.kind !== "out" && p.kind !== "inout" && !(typeof v === "string" && v.split(",").every((x) => p.enum!.includes(x.trim()))))
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
        const fi = funcInfo(p);
        if (fi) {
          for (const t of [...fi.args, fi.result]) checkType(t, `${path}.${k}`, add);
          fi.args.forEach((t) => inner.set(funcArgName(t), t));
          nodes.forEach((c, i) => visit(c, `${path}.${k}[${i}]`, inner));
          continue;
        }
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
      const mapValue = p && literalMapValue(p.type);
      if (mapValue) {
        given.add(k);
        (list as { name?: unknown; value?: unknown }[]).forEach((x, i) => {
          if (typeof x.name !== "string") add(`${at}[${i}]`, "BAD_DICT", `"${k}" の要素は { "name": キー, "value": 値 } で書く`);
          if (!isValueItem(x.value) || (mapValue === "String" && !(typeof x.value === "object" && "lit" in x.value)))
            add(`${at}[${i}]`, "BAD_DICT", `"${k}" の値は ${mapValue === "String" ? "{ lit }（式は書けない）" : "式か { lit }"} で書く`);
        });
        continue;
      }
      if (!p || !isArgumentDict(p.type)) { add(at, "BAD_DICT", `${a.className} に引数の辞書のプロパティ "${k}" は無い`); continue; }
      given.add(k);
      const inOnly = /InArgument>$/.test(p.type);
      const outOnly = /OutArgument>$/.test(p.type);
      list.forEach((x, i) => {
        checkType(x.type, `${at}[${i}]`, add);
        if (inOnly && x.dir !== "In") add(`${at}[${i}]`, "BAD_DICT", `"${k}" には In の引数しか入らない`);
        if (outOnly && x.dir !== "Out") add(`${at}[${i}]`, "BAD_DICT", `"${k}" には Out の引数しか入らない`);
        if (x.dir !== "In") checkLValue(x.value, `${at}[${i}]`, scope);
      });
    }

    // lists。InArgument の一覧（型付きの InArgument<T> と素の InArgument）は式の配列、オブジェクト型の List はプロパティの辞書の配列
    for (const [k, list] of Object.entries(n.lists ?? {})) {
      const p = a.props.find((p) => p.name === k);
      const at = `${path}.lists.${k}`;
      const plain = p && plainListElement(p.type);
      if (plain) {
        given.add(k);
        if (!Array.isArray(list)) { add(at, "BAD_LIST", `"${k}" は配列で書く`); continue; }
        list.forEach((x, i) => {
          if (plain === "System.String" ? !(typeof x === "object" && x !== null && Object.keys(x).join() === "lit") : !(typeof x === "string" && DAYS_OF_WEEK.includes(x)))
            add(`${at}[${i}]`, "BAD_LIST", plain === "System.String" ? `"${k}" は List<String> なので式を持てない。要素は { "lit": "..." } で書く` : `"${k}" の要素は ${DAYS_OF_WEEK.join(" / ")} のどれか`);
        });
        continue;
      }
      const typed = !!p && isArgumentList(p.type);
      const el = p && listElementType(p.type);
      const t = el ? objectTypes.get(el) : undefined;
      if (!p || (!typed && (!el || (el !== "System.Activities.InArgument" && !t)))) { add(at, "BAD_LIST", `${a.className} に lists で書ける一覧のプロパティ "${k}" は無い`); continue; }
      given.add(k);
      if (typed && !argumentListElement(p.type, n.typeArg)) add(at, "TYPE_UNKNOWN", `"${k}" の要素の型が決まらない。typeArg を書く`);
      if (!Array.isArray(list)) { add(at, "BAD_LIST", `"${k}" は配列で書く`); continue; }
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
        if (scope.has(x.to.match(IDENT_HEAD)?.[0] ?? "") && !scope.has(x.to))
          add(`${path}.assigns[${i}].to`, "TYPE_UNKNOWN", `代入先の型が決まらない。変数名をそのまま書く`);
      });
    }

    // 図（Flowchart・StateMachine・Pick。graph.ts）
    if (n.flowchart || n.stateMachine || n.branches || n.process) for (const k of checkGraph(n, a, path, scope)) given.add(k);

    // OverloadGroup（WriteTextFile の File / FileName など）は、どれか1つのグループがそろっていればよい
    const required = a.props.filter((p) => p.required);
    const groups = new Map<string, string[]>();
    for (const p of a.props) for (const g of p.overloadGroups ?? []) groups.set(g, [...(groups.get(g) ?? []), p.name]);
    // グループがそろう：そのグループの必須のものが全部あること。必須の無いグループ（SAP BAPI の SapApplicationScope の Connection など）は、どれか1つあること
    const isReq = new Set(required.map((p) => p.name));
    const groupOk = [...groups.values()].some((names) => names.filter((x) => isReq.has(x)).every((x) => given.has(x)) && (names.some((x) => isReq.has(x)) || names.some((x) => given.has(x))));
    for (const p of required.filter((p) => !given.has(p.name) && !(p.overloadGroups?.length && groupOk)))
      add(path, "REQUIRED_MISSING", `${a.className} の必須プロパティ "${p.name}" が無い`);

    // Data Service の範囲（BaseEntityActivity、26.10.0 で GA。AUT-1194）：フォルダの表は、ソリューションの資源の key と名前で指す
    // （スキル uipath-rpa の UiPath.DataService.Activities/overview.md の Solution Context）
    if (a.props.some((p) => p.name === "ScopeValue") && a.props.some((p) => p.name === "SolutionEntityKey")) {
      const sv = n.props?.ScopeValue;
      const text = typeof sv === "string" ? sv : sv && typeof sv === "object" && "lit" in sv ? String((sv as { lit: unknown }).lit) : "";
      const folder = /folder|フォルダー/i.test(text);
      if (folder && !(given.has("SolutionEntityKey") && given.has("SolutionEntityName")))
        add(path, "DS_SCOPE", `ScopeValue が Folder のときは SolutionEntityKey（ソリューションの表の資源の key）と SolutionEntityName が要る`);
      if (!folder && (given.has("SolutionEntityKey") || given.has("SolutionEntityName")))
        add(path, "DS_SCOPE", `SolutionEntityKey / SolutionEntityName はフォルダの表（ScopeValue が "Folder"）のときだけ書く`);
    }
  }

  // 図の検査。書いたプロパティ名（given に足す）を返す。
  // id は x:Name になるので、ワークフローの中で重ならないこと（ids）。矢印の行き先があること、start / initial から全部たどれること
  function checkGraph(n: Node, a: Activity, path: string, scope: Scope): string[] {
    const has = (p: string) => a.props.some((q) => q.name === p);
    const given: string[] = [];
    const checkIds = (list: { id: unknown }[], at: (i: number) => string) => {
      const seen = new Set<string>();
      list.forEach((x, i) => {
        if (!isGraphId(x.id)) { add(`${at(i)}.id`, "GRAPH_BAD_ID", `id ${JSON.stringify(x.id)} は文字か _ で始まり、文字・数字・_ だけにする（XAML の x:Name になる）`); return; }
        if (seen.has(x.id) || graphIds.has(x.id)) add(`${at(i)}.id`, "GRAPH_DUPLICATE_ID", `id "${x.id}" が重複している（ワークフローの中で1つにする）`);
        seen.add(x.id);
      });
      for (const id of seen) graphIds.add(id);
      return seen;
    };
    const reach = (start: string, links: (id: string) => string[]) => {
      const seen = new Set<string>([start]);
      const q = [start];
      while (q.length) for (const to of links(q.shift()!)) if (!seen.has(to)) { seen.add(to); q.push(to); }
      return seen;
    };
    const visitAll = (nodes: Node[], at: string, sc: Scope) => nodes.forEach((c, i) => visit(c, `${at}[${i}]`, sc));
    // 図の中のオブジェクトに書けるキー（書き間違い・無いプロパティを弾く）
    const keys = (o: object, allowed: string[], at: string) => { for (const k of Object.keys(o)) if (!allowed.includes(k)) add(`${at}.${k}`, "GRAPH_UNKNOWN_KEY", `"${k}" は書けない（書けるのは ${allowed.join(", ")}）`); };
    const withVars = (vars: VariableDecl[] | undefined, at: string) => { const sc = new Map(scope); if (vars) declare(vars, at, sc, add); return sc; };

    if (n.flowchart) {
      const at = `${path}.flowchart`;
      const fc = n.flowchart;
      if (!has("Nodes") || !has("StartNode")) add(at, "BAD_SLOT", `flowchart は Flowchart だけ`);
      given.push("Nodes", "StartNode");
      if (!Array.isArray(fc.nodes) || !fc.nodes.length) { add(`${at}.nodes`, "GRAPH_EMPTY", "nodes に1つ以上のノードを書く"); return given; }
      const ids = checkIds(fc.nodes, (i) => `${at}.nodes[${i}]`);
      const byId = new Map(fc.nodes.map((f) => [f.id, f]));
      if (!ids.has(fc.start)) add(`${at}.start`, "GRAPH_NO_START", `start "${fc.start ?? ""}" のノードが無い`);
      fc.nodes.forEach((f, i) => {
        const nat = `${at}.nodes[${i}]`;
        const k = flowKind(f);
        if (!k) { add(nat, "GRAPH_BAD_NODE", "ノードは act（FlowStep）・decision（FlowDecision）・switch（FlowSwitch）のどれか1つを書く"); return; }
        for (const l of flowLinks(f)) if (!ids.has(l.to)) add(`${nat}.${l.label}`, "GRAPH_BAD_REF", `行き先 "${l.to}" のノードが無い`);
        if (k === "step") {
          const extra = ["decision", "switch", "true", "false", "cases", "default"].filter((x) => x in f);
          if (extra.length) add(nat, "GRAPH_BAD_NODE", `FlowStep（act）に ${extra.join(", ")} は書けない`);
          visit(stepNode(f as FlowStepDecl), nat, new Map(scope));
        } else if (k === "decision") {
          keys(f, ["id", "decision", "name", "true", "false"], nat);
          if ("next" in f) add(`${nat}.next`, "GRAPH_BAD_NODE", "FlowDecision は next ではなく true / false で書く");
          if (!isValueItem((f as FlowDecisionDecl).decision)) add(`${nat}.decision`, "GRAPH_BAD_NODE", "decision は真偽の式で書く");
        } else {
          const s = f as FlowSwitchDecl;
          keys(f, ["id", "switch", "typeArg", "name", "cases", "default"], nat);
          if ("next" in f) add(`${nat}.next`, "GRAPH_BAD_NODE", "FlowSwitch は next ではなく cases / default で書く");
          if (!isValueItem(s.switch)) add(`${nat}.switch`, "GRAPH_BAD_NODE", "switch は式で書く");
          if (s.typeArg !== undefined) checkType(s.typeArg, `${nat}.typeArg`, add);
        }
      });
      if (ids.has(fc.start)) {
        const r = reach(fc.start, (id) => (byId.has(id) ? flowLinks(byId.get(id)!).map((l) => l.to) : []));
        fc.nodes.forEach((f, i) => { if (isGraphId(f.id) && !r.has(f.id)) add(`${at}.nodes[${i}]`, "GRAPH_UNREACHABLE", `ノード "${f.id}" に start からたどり着けない`); });
      }
    }

    if (n.stateMachine) {
      const at = `${path}.stateMachine`;
      const sm = n.stateMachine;
      if (!has("States") || !has("InitialState")) add(at, "BAD_SLOT", `stateMachine は StateMachine だけ`);
      given.push("States", "InitialState");
      if (!Array.isArray(sm.states) || !sm.states.length) { add(`${at}.states`, "GRAPH_EMPTY", "states に1つ以上の状態を書く"); return given; }
      const ids = checkIds(sm.states, (i) => `${at}.states[${i}]`);
      if (!ids.has(sm.initial)) add(`${at}.initial`, "GRAPH_NO_START", `initial "${sm.initial ?? ""}" の状態が無い`);
      if (!sm.states.some((s) => s.final)) add(`${at}.states`, "SM_NO_FINAL", "終わりの状態（final: true）が1つも無い");
      sm.states.forEach((s, i) => {
        const sat = `${at}.states[${i}]`;
        const sc = withVars(s.variables, `${sat}.variables`);
        keys(s, ["id", "name", "final", "variables", "entry", "exit", "transitions"], sat);
        if (s.final && s.transitions?.length) add(`${sat}.transitions`, "SM_FINAL_TRANSITION", "終わりの状態は遷移を持てない");
        if (s.final && s.exit?.length) add(`${sat}.exit`, "SM_FINAL_TRANSITION", "終わりの状態は exit を持てない");
        if (!s.final && !s.transitions?.length) add(sat, "SM_NO_TRANSITION", `状態 "${s.id}" に遷移が無い（終わりの状態なら final: true）`);
        if (s.entry) visitAll(s.entry, `${sat}.entry`, new Map(sc));
        if (s.exit) visitAll(s.exit, `${sat}.exit`, new Map(sc));
        s.transitions?.forEach((t, j) => {
          const tat = `${sat}.transitions[${j}]`;
          keys(t, ["to", "name", "trigger", "condition", "action"], tat);
          if (!ids.has(t.to)) add(`${tat}.to`, "GRAPH_BAD_REF", `行き先 "${t.to}" の状態が無い`);
          if (t.condition !== undefined && !isValueItem(t.condition)) add(`${tat}.condition`, "GRAPH_BAD_NODE", "condition は真偽の式で書く");
          if (t.trigger) visitAll(t.trigger, `${tat}.trigger`, new Map(sc));
          if (t.action) visitAll(t.action, `${tat}.action`, new Map(sc));
        });
      });
      if (ids.has(sm.initial)) {
        const r = reach(sm.initial, (id) => (sm.states.find((s) => s.id === id)?.transitions ?? []).map((t) => t.to));
        sm.states.forEach((s, i) => { if (isGraphId(s.id) && !r.has(s.id)) add(`${at}.states[${i}]`, "GRAPH_UNREACHABLE", `状態 "${s.id}" に initial からたどり着けない`); });
      }
    }

    if (n.process) {
      const at = `${path}.process`;
      const pd = n.process;
      const base = processBase(a);
      if (!base) { add(at, "BAD_SLOT", `process は長時間実行の図（ProcessDiagram）だけ`); return given; }
      const owned = processOwnedProps(a, base);
      given.push("Nodes", "StartNode", ...owned.map((o) => o.prop.name));
      keys(pd, ["start", "nodes", ...owned.map((o) => o.key)], at);
      if (!Array.isArray(pd.nodes) || !pd.nodes.length) { add(`${at}.nodes`, "GRAPH_EMPTY", "nodes に1つ以上のノードを書く"); return given; }
      const all = processAllNodes(base, pd);
      const ids = checkIds(all.map((x) => x.node), (i) => all[i].path.replace(/^process/, at));
      if (!ids.has(pd.start)) add(`${at}.start`, "GRAPH_NO_START", `start "${pd.start ?? ""}" のノードが無い`);
      const types = processNodeTypes(base);
      for (const { path: p0, node: x } of all) {
        const nat = p0.replace(/^process/, at);
        const t = processNodeType(base, x.node);
        if (!t) { add(`${nat}.node`, "GRAPH_BAD_NODE", `node "${x.node ?? ""}" は無い（書けるのは ${types.map((y) => y.className).join(", ")}）`); continue; }
        const fields = processFields(base, t);
        keys(x, ["id", "node", ...(t.genericArity ? ["typeArg"] : []), ...fields.map((f) => f.key)], nat);
        if (t.genericArity && x.typeArg !== undefined) checkType(x.typeArg, `${nat}.typeArg`, add);
        for (const f of fields) {
          const v = x[f.key];
          if (v === undefined) continue;
          const fat = `${nat}.${f.key}`;
          if (f.how === "name" && typeof v !== "string") add(fat, "GRAPH_BAD_NODE", "name は文字列で書く");
          if (f.how === "link" && (typeof v !== "string" || !ids.has(v))) add(fat, "GRAPH_BAD_REF", `行き先 ${JSON.stringify(v)} のノードが無い`);
          if (f.how === "links") { if (!Array.isArray(v)) add(fat, "GRAPH_BAD_NODE", `${f.key} は行き先の id の配列で書く`); else (v as unknown[]).forEach((to, i) => { if (typeof to !== "string" || !ids.has(to)) add(`${fat}[${i}]`, "GRAPH_BAD_REF", `行き先 ${JSON.stringify(to)} のノードが無い`); }); }
          if (f.how === "cases") { if (typeof v !== "object" || v === null || Array.isArray(v)) add(fat, "GRAPH_BAD_NODE", `${f.key} は { 値: 行き先の id } で書く`); else for (const [k, to] of Object.entries(v)) if (typeof to !== "string" || !ids.has(to)) add(`${fat}.${k}`, "GRAPH_BAD_REF", `行き先 ${JSON.stringify(to)} のノードが無い`); }
          if (f.how === "expr" && !isValueItem(v as Value)) add(fat, "GRAPH_BAD_NODE", `${f.key} は式で書く`);
          if (f.how === "value" && !isValueItem(v as Value)) add(fat, "GRAPH_BAD_NODE", `${f.key} は値で書く`);
          if (f.how === "action") { if (!Array.isArray(v)) add(fat, "GRAPH_BAD_NODE", "action はアクティビティの配列で書く"); else visitAll(v as Node[], fat, new Map(scope)); }
          if (f.how === "owned" && !Array.isArray(v)) add(fat, "GRAPH_BAD_NODE", `${f.key} はノードの配列で書く`);
          if (f.how === "obj") validateObjs({ act: t.className, objs: { [f.prop.name]: v as ObjValue } }, { ...t, props: [f.prop] } as unknown as Activity, nat, scope, add);
        }
      }
      if (ids.has(pd.start)) {
        // start と、中に持つノード（イベントのサブプロセス、境界のイベント）から始めて、nodes の全部にたどり着けること
        const byId = new Map(all.map((x) => [x.node.id, x.node]));
        const inner = all.filter((x) => !pd.nodes.includes(x.node)).map((x) => x.node.id);
        const r = new Set<string>();
        for (const s of [pd.start, ...inner]) for (const id of reach(s, (id) => (byId.has(id) ? processLinks(base, byId.get(id)!).map((l) => l.to) : []))) r.add(id);
        pd.nodes.forEach((x, i) => { if (isGraphId(x.id) && !r.has(x.id)) add(`${at}.nodes[${i}]`, "GRAPH_UNREACHABLE", `ノード "${x.id}" に start からたどり着けない`); });
      }
    }

    if (n.branches) {
      const at = `${path}.branches`;
      if (!has("Branches")) add(at, "BAD_SLOT", `branches は Pick だけ`);
      given.push("Branches");
      if (!Array.isArray(n.branches) || !n.branches.length) { add(at, "GRAPH_EMPTY", "branches に1つ以上の分岐を書く"); return given; }
      n.branches.forEach((b, i) => {
        const bat = `${at}[${i}]`;
        const sc = withVars(b.variables, `${bat}.variables`);
        keys(b, ["name", "variables", "trigger", "action"], bat);
        if (!b.trigger?.length) add(`${bat}.trigger`, "PICK_NO_TRIGGER", "分岐には trigger が要る");
        else visitAll(b.trigger, `${bat}.trigger`, new Map(sc));
        if (b.action) visitAll(b.action, `${bat}.action`, new Map(sc));
      });
    }
    return given;
  }

  // 代入先は宣言済みの名前で始まること（a.b(0) のような式は先頭の名前だけ見る）
  function checkLValue(v: Value, at: string, scope: Scope) {
    // { vb, cs } / { cs }（C# の XAML から取り込んだ dt.Rows(0).Item などの出力先）も、先頭の名前を見る
    const text = typeof v === "string" ? v : typeof v === "object" && "cs" in v ? v.vb ?? v.cs : undefined;
    if (text === undefined) { add(at, "OUT_NOT_LVALUE", "出力先は変数名（式）で書く"); return; }
    const head = text.match(IDENT_HEAD)?.[0];
    if (!head || !scope.has(head)) add(at, "UNDECLARED_NAME", `出力先 "${text}" が宣言されていない`);
  }
}

function declare(vars: VariableDecl[], path: string, scope: Scope, add: (p: string, c: string, m: string) => void) {
  vars.forEach((v, i) => {
    if (!IDENT.test(v.name)) add(`${path}[${i}]`, "BAD_NAME", `"${v.name}" は識別子にする`);
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
export const isArgumentDict = (t: string) => /^System\.Collections\.Generic\.I?Dictionary<System\.String, System\.Activities\.(In|Out)?Argument>$/.test(t);

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
// 識別子（VB と C# のどちらでも書ける名前）。日本語などの Unicode の文字も使える（Studio の変数名、ワークフロー名）
export const IDENT = /^[\p{L}_][\p{L}\p{N}_]*$/u;
export const IDENT_HEAD = /^[\p{L}_][\p{L}\p{N}_]*/u;

export function isValueItem(v: unknown): v is Value {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return true;
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const k = Object.keys(v).sort().join();
  return k === "lit" || k === "cs,vb" || k === "cs";
}
