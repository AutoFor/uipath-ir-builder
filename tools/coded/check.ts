// Coded Workflow（.cs）のサービス呼び出しを、カタログの services で検証する。Studio は使わない。
//
// 使い方:
//   node tools/coded/check.ts samples/coded/CodedMain.cs [...] [--project <UiPathプロジェクト>] [--json]
//
// 見るもの:
//   - system.X(...) / uiAutomation.X(...) などのサービス呼び出しと、Log(...) / RunWorkflow(...) などの基底クラスの呼び出し
//     メソッドがあるか、引数の数・名前付き引数の名前・out/ref がどれかのオーバーロードに合うか、
//     リテラル（文字列・数値・真偽値）の型が引数の型に合うか
//   - 既知の落とし穴（LogLevel のあいまいさ、GetResourceForLocalPath、名前空間、[Workflow] の付け忘れなど）
// 見ないもの: 変数や式の型（リテラル以外）、サービスの戻り値に対する呼び出し（app.Click(...) など）、C# の文法そのもの。
//   それは uip rpa build で確かめる。

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mask, splitArgs } from "./scan.ts";
import { DEFAULT_SERVICE_FILES, VersionError, selectCatalogs } from "../ir/versions.ts";
import type { Arg } from "./scan.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const BASE = "UiPath.CodedWorkflows.CodedWorkflowBase";

// 変数名 → サービスの型。Studio は依存パッケージの API DLL の登録クラス（[assembly: CodedWorkflowsServiceRegistry]）を読んで
// .local/.codedworkflows/CodedWorkflow.cs（CodedWorkflow の部分クラス）を生成する。カタログの codedRegistries がその写し。
// 生成済みのプロジェクトを --project で渡したときは、そのファイルを読む（Studio が実際に作ったものが正）
//
// カタログの無いパッケージの変数。C:\Users\Public\uipath-ir-probe で Studio が生成したものと、登録クラスから読んだものが同じ
// （Mail 2.12.10）。呼び出しはメソッドを確かめられず、NO_CATALOG の警告だけになる
export const uncatalogedVars: Record<string, Record<string, string>> = {
  "UiPath.Mail.Activities": { mail: "UiPath.Mail.Activities.Api.IMailService" },
};
export const defaultNamespace = "CatalogProbeNet8";

// カタログの codedRegistries から変数名 → 型を集める
export function registryVars(files: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const f of files)
    for (const r of JSON.parse(readFileSync(join(root, f), "utf8")).codedRegistries ?? []) Object.assign(vars, r.vars);
  return vars;
}

// 既定（--project なし）はプローブのプロジェクトと同じ依存（System、UIAutomation、Excel、Mail、Testing）
export const defaultServiceVars: Record<string, string> = { ...registryVars(DEFAULT_SERVICE_FILES), ...Object.assign({}, ...Object.values(uncatalogedVars)) };

export type Param = { name: string; type: string; modifier?: string; optional: boolean; default?: string; params: boolean };
export type Method = { name: string; returns: string; params: Param[]; typeParams?: string[]; obsolete: boolean };
export type Service = { name: string; clrType: string; methods: Method[] };
export type Issue = { line: number; col: number; severity: "error" | "warning"; code: string; message: string };
export type FileResult = { file: string; calls: number; issues: Issue[] };
export type Context = { services: Map<string, Service>; vars: Record<string, string>; namespace: string; projectDir?: string };

export function loadServices(files = DEFAULT_SERVICE_FILES): Map<string, Service> {
  const m = new Map<string, Service>();
  for (const f of files) {
    const c = JSON.parse(readFileSync(join(root, f), "utf8"));
    for (const s of c.services ?? []) m.set(s.clrType, s);
  }
  return m;
}

// プロジェクトから変数名 → 型と名前空間を読む。まだ一度もビルドしていないプロジェクトには生成コードが無いので、既定値を使う。
// サービスの API は project.json の dependencies の版のカタログから読む（カタログに無い版、services の無い古い版は VersionError）
export function loadContext(projectDir?: string): Context {
  const hasProject = !!projectDir && existsSync(join(projectDir, "project.json"));
  const files = hasProject ? selectCatalogs(root, projectDir!, { coded: true }).serviceFiles : DEFAULT_SERVICE_FILES;
  const ctx: Context = { services: loadServices(files), vars: { ...defaultServiceVars }, namespace: defaultNamespace, projectDir };
  if (!projectDir) return ctx;
  if (hasProject) {
    // まだ生成コードが無いときの値：依存パッケージのカタログの登録クラスと、カタログの無いパッケージの既知の変数
    const deps = Object.keys(JSON.parse(readFileSync(join(projectDir, "project.json"), "utf8").replace(/^﻿/, "")).dependencies ?? {}).map((d) => d.toLowerCase());
    ctx.vars = registryVars(files);
    for (const [pkg, vars] of Object.entries(uncatalogedVars)) if (deps.includes(pkg.toLowerCase())) Object.assign(ctx.vars, vars);
  }
  const gen = join(projectDir, ".local", ".codedworkflows", "CodedWorkflow.cs");
  if (existsSync(gen)) {
    const src = readFileSync(gen, "utf8");
    const vars: Record<string, string> = {};
    for (const m of src.matchAll(/protected\s+([\w.:]+)\s+(\w+)\s*\{\s*get\s*=>\s*serviceContainer\.Resolve</g)) vars[m[2]] = m[1].replace(/^global::/, "");
    if (Object.keys(vars).length) ctx.vars = vars;
    const ns = src.match(/\bnamespace\s+([\w.]+)/);
    if (ns) ctx.namespace = ns[1];
  } else if (existsSync(join(projectDir, "project.json"))) {
    const pj = JSON.parse(readFileSync(join(projectDir, "project.json"), "utf8").replace(/^\uFEFF/, ""));
    // Studio は名前に使えない文字を消す（"uipath-ir-probe-v24" → uipathirprobev24。.local/.codedworkflows/CodedWorkflow.cs で確かめた）
    ctx.namespace = String(pj.name).replace(/[^\w]/g, "").replace(/^(\d)/, "_$1");
  }
  return ctx;
}

const csKeywords = new Set(["return", "await", "else", "throw", "yield", "case", "in", "is", "as", "when", "and", "or", "not", "new"]);

export function checkSource(src: string, file: string, ctx: Context): FileResult {
  const issues: Issue[] = [];
  const code = mask(src);
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineStarts.push(i + 1);
  const pos = (i: number) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= i) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, col: i - lineStarts[lo] + 1 };
  };
  const add = (i: number, severity: Issue["severity"], c: string, message: string) => issues.push({ ...pos(i), severity, code: c, message });

  const usings = new Set([...code.matchAll(/^\s*using\s+(?:static\s+)?([\w.]+)\s*;/gm)].map((m) => m[1]));
  let calls = 0;
  const warnedNoCatalog = new Set<string>();

  // ---- サービス呼び出し（system.X(...)）と基底クラスの呼び出し（Log(...)）----
  const varNames = Object.keys(ctx.vars);
  const base = ctx.services.get(BASE);
  const baseNames = new Set(base?.methods.map((m) => m.name) ?? []);
  const ident = /[A-Za-z_]\w*/g;
  for (let m: RegExpExecArray | null; (m = ident.exec(code)); ) {
    const first = m[0];
    const before = code.slice(0, m.index).trimEnd();
    // a.system.X のようなメンバーの先は対象外（this. は可）
    if (before.endsWith(".") && !/(?<![\w.])this\s*\.$/.test(before)) continue;
    let svcType: string, method: string, nameAt: number, after: number;
    const dot = /^\s*\.\s*([A-Za-z_]\w*)/.exec(code.slice(m.index + first.length));
    if (varNames.includes(first) && dot) {
      svcType = ctx.vars[first];
      method = dot[1];
      after = m.index + first.length + dot[0].length;
      nameAt = after - method.length;
    } else if (baseNames.has(first) && !dot) {
      // メソッドの宣言（void Log(...)）は除く。直前が識別子（キーワード以外）・">"・"]" なら宣言とみなす
      const prev = before.match(/([\w>\]?]+)$/)?.[1];
      if (prev && !csKeywords.has(prev) && !before.endsWith(".")) continue;
      svcType = BASE;
      method = first;
      nameAt = m.index;
      after = m.index + first.length;
    } else continue;
    const whole = first;
    void whole;
    // 型引数 X<T>(...)
    const ta = /^\s*<([^<>()]*(?:<[^<>()]*>[^<>()]*)*)>/.exec(code.slice(after));
    if (ta) after += ta[0].length;
    const open = /^\s*\(/.exec(code.slice(after));
    const label = svcType === BASE ? method : `${first}.${method}`;
    const svc = ctx.services.get(svcType);
    if (!svc) {
      if (!warnedNoCatalog.has(svcType)) {
        warnedNoCatalog.add(svcType);
        add(nameAt, "warning", "NO_CATALOG", `${first}（${svcType}）はカタログに無いので検証していない`);
      }
      continue;
    }
    const overloads = svc.methods.filter((x) => x.name === method);
    if (!overloads.length) {
      const hint = similar(method, [...new Set(svc.methods.map((x) => x.name))]);
      add(nameAt, "error", "UNKNOWN_METHOD", `${label} は ${svc.name} に無い${hint.length ? `（似た名前: ${hint.join(", ")}）` : ""}`);
      continue;
    }
    if (!open) continue; // メソッドグループとしての参照
    calls++;
    const parenAt = after + open[0].length - 1;
    const { args, end } = splitArgs(code, parenAt);
    if (end < 0) { add(nameAt, "error", "PARSE", `${label} の ")" が見つからない`); continue; }
    checkCall(label, overloads, args, nameAt, src, add);
    ident.lastIndex = parenAt + 1;
    if (method.endsWith("Async")) {
      const before = code.slice(Math.max(0, m.index - 20), m.index);
      if (!/\bawait\s*(\(\s*)?$/.test(before) && !/=\s*$/.test(before))
        add(nameAt, "warning", "ASYNC_NOT_AWAITED", `${label} は Task を返す。await する${svc.methods.some((x) => x.name === method.slice(0, -5)) ? `か、同期版（${method.slice(0, -5)}）を使う` : ""}`);
    }
  }

  // ---- 落とし穴 ----
  for (const m of code.matchAll(/(?<![\w.])LogLevel\s*\./g)) {
    if (usings.has("UiPath.CodedWorkflows") && usings.has("UiPath.Core.Activities"))
      add(m.index!, "error", "LOGLEVEL_AMBIGUOUS", "LogLevel が UiPath.CodedWorkflows と UiPath.Core.Activities の両方にあってあいまい。UiPath.CodedWorkflows.LogLevel.X と完全名で書く");
    else add(m.index!, "warning", "LOGLEVEL_SHORT", "LogLevel は UiPath.CodedWorkflows.LogLevel.X と完全名で書く（using を足したときにあいまいになる）");
  }
  for (const m of code.matchAll(/\bGetResourceForLocalPath\b/g))
    add(m.index!, "warning", "LOCAL_RESOURCE", "GetResourceForLocalPath の結果を渡すと、build は通るが run で「どのオーバーロード グループでも…」で落ちる。LocalResource.FromPath(\"...\") を使う");
  if (!usings.has("UiPath.Platform.ResourceHandling"))
    for (const m of code.matchAll(/(?<![\w.])(LocalResource|ILocalResource|IResource)\b/g))
      add(m.index!, "error", "MISSING_USING", `${m[1]} を使うには using UiPath.Platform.ResourceHandling; が要る`);
  for (const m of code.matchAll(/\bConsole\s*\.\s*Write(Line)?\b/g))
    add(m.index!, "warning", "CONSOLE", "Console.Write はロボットのログに出ない。Log(...) を使う");
  for (const m of code.matchAll(/\bThread\s*\.\s*Sleep\b/g))
    add(m.index!, "warning", "THREAD_SLEEP", "Thread.Sleep より基底クラスの Delay(...) を使う（キャンセルが効く）");

  const ns = code.match(/\bnamespace\s+([\w.]+)/);
  if (!ns) add(0, "error", "NAMESPACE", `namespace が無い。${ctx.namespace} にする`);
  else if (ns[1] !== ctx.namespace && !ns[1].startsWith(ctx.namespace + "."))
    add(ns.index!, "error", "NAMESPACE", `namespace ${ns[1]} はプロジェクトの名前空間 ${ctx.namespace} と違う（CodedWorkflow が見つからなくなる）`);

  const classes = [...code.matchAll(/\bclass\s+(\w+)\s*(?::\s*([\w.<>, ]+?))?\s*(?:\{|where\b)/g)];
  const wf = classes.find((c) => /(?:^|[\s,.])CodedWorkflow\b/.test(c[2] ?? ""));
  if (!wf) add(classes[0]?.index ?? 0, "warning", "NOT_CODED_WORKFLOW", "CodedWorkflow を継承するクラスが無い（ワークフローとして実行できない）");
  else {
    const stem = basename(file, extname(file));
    if (wf[1] !== stem) add(wf.index!, "warning", "CLASS_NAME", `クラス名 ${wf[1]} がファイル名 ${stem} と違う`);
    if (!/\[\s*(Workflow|TestCase)\s*[\]\(]/.test(code)) add(wf.index!, "warning", "NO_ENTRY", "[Workflow] か [TestCase] の付いたメソッドが無い");
  }

  // RunWorkflow("x.xaml") の先がプロジェクトにあるか（--project のとき）
  if (ctx.projectDir) {
    for (const m of code.matchAll(/\bRunWorkflow(?:Async)?\s*\(\s*(@?")/g)) {
      const s = m.index! + m[0].length - m[1].length;
      const lit = /^@?"([^"]*)"/.exec(src.slice(s))?.[1];
      if (lit && !existsSync(join(ctx.projectDir, lit)) && !existsSync(join(dirname(file), lit)))
        add(s, "warning", "WORKFLOW_NOT_FOUND", `RunWorkflow の "${lit}" がプロジェクトに無い`);
    }
  }

  issues.sort((a, b) => a.line - b.line || a.col - b.col);
  return { file, calls, issues };
}

// ---- 呼び出しとオーバーロードの突き合わせ ----

type Lit = "string" | "int" | "real" | "bool" | "null" | undefined;

function literalKind(maskedValue: string, rawValue: string): Lit {
  const v = maskedValue.trim();
  if (/^\$?@?"[^"]*"$/.test(v) || /^@?\$"[^"]*"$/.test(v)) return "string";
  if (/^-?\d+[lLuU]*$/.test(v)) return "int";
  if (/^-?\d*\.\d+[dDfFmM]?$|^-?\d+[dDfFmM]$/.test(v)) return "real";
  if (/^(true|false)$/.test(v)) return "bool";
  if (v === "null") return "null";
  void rawValue;
  return undefined;
}

const numeric = /^System\.(Int16|Int32|Int64|UInt16|UInt32|UInt64|Byte|SByte|Double|Single|Decimal)$/;
const valueTypes = /^System\.(Int16|Int32|Int64|UInt16|UInt32|UInt64|Byte|SByte|Double|Single|Decimal|Boolean|DateTime|TimeSpan|Char|Guid)$/;

// 0: 合う、1: たぶん合わない（暗黙の変換があるかもしれない）、2: 合わない
function mismatch(lit: Lit, type: string): 0 | 1 | 2 {
  if (!lit) return 0;
  const t = type.replace(/^System\.Nullable<(.+)>$/, "$1");
  if (!t.includes(".") || t === "System.Object" || t === "System.IConvertible" || t === "System.IComparable") return 0; // T など
  const iface = /(^|\.)I[A-Z]\w*(<.*>)?$/.test(t);
  switch (lit) {
    case "string":
      if (t === "System.String" || t === "System.Collections.Generic.IEnumerable<System.Char>") return 0;
      return iface || valueTypes.test(t) ? 2 : 1;
    case "int":
      if (numeric.test(t)) return 0;
      return t === "System.String" || t === "System.Boolean" || iface ? 2 : 1;
    case "real":
      if (/^System\.(Double|Single|Decimal)$/.test(t)) return 0;
      return t === "System.String" || t === "System.Boolean" || numeric.test(t) || iface ? 2 : 1;
    case "bool":
      if (t === "System.Boolean") return 0;
      return t === "System.String" || numeric.test(t) || iface ? 2 : 1;
    case "null":
      return type.startsWith("System.Nullable<") ? 0 : valueTypes.test(t) ? 2 : 0;
  }
}

function checkCall(label: string, overloads: Method[], args: Arg[], at: number, src: string, add: (i: number, s: Issue["severity"], c: string, m: string) => void) {
  const positional = args.filter((a) => !a.name);
  const named = args.filter((a) => a.name);
  const firstNamed = args.findIndex((a) => a.name);
  void firstNamed;

  type Fit = { m: Method; problems: { sev: 1 | 2; arg: Arg; msg: string }[] };
  const fits: Fit[] = [];
  const reasons: string[] = [];
  for (const m of overloads) {
    const ps = m.params;
    const last = ps[ps.length - 1];
    const hasParams = !!last?.params;
    const fixed = hasParams ? ps.length - 1 : ps.length;
    if (positional.length > fixed && !hasParams) { reasons.push(`${sig(m)}: 引数が多い`); continue; }
    const covered = new Map<string, Arg>();
    positional.forEach((a, i) => covered.set(ps[Math.min(i, ps.length - 1)].name, a));
    let bad = "";
    for (const a of named) {
      const p = ps.find((p) => p.name === a.name);
      if (!p) { bad = `"${a.name}" という引数は無い`; break; }
      if (covered.has(p.name)) { bad = `"${a.name}" が位置引数と重なる`; break; }
      covered.set(p.name, a);
    }
    if (bad) { reasons.push(`${sig(m)}: ${bad}`); continue; }
    const missing = ps.filter((p) => !p.optional && !p.params && !covered.has(p.name));
    if (missing.length) { reasons.push(`${sig(m)}: ${missing.map((p) => p.name).join(", ")} が無い`); continue; }
    const problems: Fit["problems"] = [];
    for (const [pn, a] of covered) {
      const p = ps.find((x) => x.name === pn)!;
      const want = p.modifier ?? undefined;
      if ((a.modifier ?? undefined) !== want && !(want === "in" && !a.modifier))
        problems.push({ sev: 2, arg: a, msg: `"${p.name}" は ${want ? want + " を付けて渡す" : "out/ref を付けない"}` });
      const elem = p.params ? p.type.replace(/\[\]$/, "") : p.type;
      const s = mismatch(literalKind(a.value, src.slice(a.valueStart, a.valueStart + a.value.length)), elem);
      if (s) problems.push({ sev: s, arg: a, msg: `"${p.name}" は ${short(p.type)} 型。リテラル ${src.slice(a.valueStart, a.valueStart + a.value.length).trim().slice(0, 40)} は${s === 2 ? "渡せない" : "合わないかもしれない"}` });
    }
    fits.push({ m, problems });
  }
  if (!fits.length) {
    add(at, "error", "NO_OVERLOAD", `${label}(${args.map((a) => (a.name ? a.name + ": …" : "…")).join(", ")}) に合うオーバーロードが無い。候補: ${reasons.join(" / ")}`);
    return;
  }
  const clean = fits.filter((f) => !f.problems.length);
  if (clean.length) {
    if (clean.every((f) => f.m.obsolete)) add(at, "warning", "OBSOLETE", `${label} は非推奨`);
    return;
  }
  const soft = fits.filter((f) => f.problems.every((p) => p.sev === 1));
  const best = (soft.length ? soft : fits)[0];
  for (const p of best.problems) add(p.arg.start, p.sev === 2 && !soft.length ? "error" : "warning", "ARG_TYPE", `${label}: ${p.msg}`);
}

export function short(t: string): string {
  return t.replace(/[\w.]+\.(\w+)/g, "$1").replace(/\+/g, ".");
}
export function sig(m: Method): string {
  return `${m.name}(${m.params.map((p) => `${p.modifier ? p.modifier + " " : ""}${p.params ? "params " : ""}${short(p.type)} ${p.name}${p.optional ? "?" : ""}`).join(", ")})`;
}

function similar(name: string, names: string[]): string[] {
  const lc = name.toLowerCase();
  const d = (a: string, b: string) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  };
  return names.filter((n) => n.toLowerCase().includes(lc) || lc.includes(n.toLowerCase()) || d(n.toLowerCase(), lc) <= 2).slice(0, 5);
}

// ---- CLI ----
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const pi = args.indexOf("--project");
  const projectDir = pi >= 0 ? args[pi + 1] : undefined;
  const json = args.includes("--json");
  const files = args.filter((a, i) => !a.startsWith("--") && !(pi >= 0 && i === pi + 1));
  if (!files.length) {
    console.error("使い方: node tools/coded/check.ts <file.cs>... [--project <dir>] [--json]");
    process.exit(2);
  }
  let ctx: Context;
  try { ctx = loadContext(projectDir); }
  catch (e) {
    if (!(e instanceof VersionError)) throw e;
    console.error(e.message);
    process.exit(2);
  }
  const results = files.map((f) => checkSource(readFileSync(f, "utf8").replace(/^\uFEFF/, ""), f, ctx));
  const failed = results.some((r) => r.issues.some((i) => i.severity === "error"));
  if (json) console.log(JSON.stringify({ ok: !failed, files: results }, null, 2));
  else {
    for (const r of results) {
      const errs = r.issues.filter((i) => i.severity === "error").length;
      console.log(`${errs ? "NG" : "OK"} ${r.file}（呼び出し ${r.calls} 件を検証${r.issues.length ? `、エラー ${errs} 件・警告 ${r.issues.length - errs} 件` : ""}）`);
      for (const i of r.issues) console.log(`  ${`${i.line}:${i.col}`.padEnd(7)} ${i.severity === "error" ? "error  " : "warning"} ${i.code.padEnd(18)} ${i.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
