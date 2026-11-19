// IR（XAML・Coded と行き来できるもの）の Web の画面操作を、Playwright（TypeScript）のスクリプトにする（AUT-1219）。
// XAML は import-xaml.ts で IR にしてから、これに渡す。XAML や Coded から直接は変換しない。
//
//   node tools/pw/ir-to-pw.ts --project <P> <P>/ir/Main.json [--out <dir>]
//     --project  <P>/ir/repository.json（オブジェクトリポジトリ）で { "$ref" } を引く
//     --out      <dir>/<ワークフロー>.pw.ts と <ワークフロー>.pw.md（変換できなかったものの一覧）を書く。既定は <P>/pw
//   できたスクリプトは node <dir>/Main.pw.ts [引数の JSON ファイル] [--headed] [--locale ja-JP] で動く
//
// 対応するアクティビティ：Sequence、NApplicationCard（開く・つなぐ）、NGoToUrl、NClick、NTypeInto、NGetText、NCheckState、
//   LogMessage、If、Throw、Assign、Delay。それ以外は、スクリプトにコメントを残し、一覧に出す（黙って捨てない）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRef, type Repository } from "../ir/objrepo.ts";
import type { Node, ObjValue, Value, Workflow } from "../ir/types.ts";
import { exprToTs } from "./expr.ts";
import { selectorToLocator } from "./selector.ts";

export type PwUnconverted = { path: string; what: string; why: string };
export type PwResult = { code: string; unconverted: PwUnconverted[] };
export type PwOptions = { runtimeImport: string };

const TS_TYPES: Record<string, string> = { String: "string", Boolean: "boolean", Int32: "number", Int64: "number", Double: "number", Decimal: "number" };
const DEFAULTS: Record<string, string> = { string: '""', boolean: "false", number: "0" };

// 開くときの URL の UiPath のワイルドカード（*）を、Playwright の URL の glob（**）にする
const urlGlob = (u: string) => u.replace(/\*+/g, "**");

export function irToPlaywright(wf: Workflow, repo: Repository | undefined, opt: PwOptions): PwResult {
  const unconverted: PwUnconverted[] = [];
  const lines: string[] = [];
  const names = new Map<string, string>();
  for (const a of wf.arguments ?? []) names.set(a.name.toLowerCase(), a.name);
  const bad = (path: string, what: string, why: string) => unconverted.push({ path, what, why });
  const emit = (d: number, s: string) => lines.push("  ".repeat(d) + s);

  const expr = (v: Value | undefined, path: string, what: string): string | undefined => {
    if (v === undefined) return undefined;
    const r = exprToTs(v, names);
    if ("why" in r) { bad(path, what, r.why); return undefined; }
    return r.ts;
  };

  // objs.Target / objs.TargetApp の中身（$ref はリポジトリから引く）
  const objOf = (o: ObjValue | undefined, kind: "screen" | "element", path: string): ObjValue | undefined => {
    if (!o) return undefined;
    const ref = o.$ref as unknown as string | string[] | undefined;
    if (ref === undefined) return o;
    if (!repo) { bad(path, String(ref), "repository.json が無いので $ref を引けない（--project を付ける）"); return undefined; }
    const f = findRef(repo, ref, kind);
    if (typeof f === "string") { bad(path, String(ref), f); return undefined; }
    return (kind === "screen" ? f.screen!.target : f.element!.target) as ObjValue;
  };
  const litOf = (v: unknown): string | undefined => (typeof v === "object" && v && "lit" in v ? (v as { lit: string }).lit : undefined);

  const locator = (n: Node, path: string): string | undefined => {
    const t = objOf(n.objs?.Target, "element", `${path}.objs.Target`);
    if (!t) { if (!n.objs?.Target) bad(path, n.act, "Target が無い"); return undefined; }
    const steps = String(t.SearchSteps ?? "Selector");
    if (/Image|CV|Semantic/i.test(steps) && !/(^|,\s*)Selector/.test(steps)) { bad(path, n.name ?? n.act, `画像・CV・意味で探すターゲット（SearchSteps=${steps}）は Playwright に無い`); return undefined; }
    if (Array.isArray(t.Anchors) && t.Anchors.length) bad(path, n.name ?? n.act, "アンカーは使わない（セレクターだけで探す）");
    let selVal = t.FullSelectorArgument ?? t.PartialSelector;
    if (!/(^|,\s*)Selector/.test(steps) && /Fuzzy/.test(steps)) {
      selVal = t.FuzzySelectorArgument;
      bad(path, n.name ?? n.act, "あいまい一致のセレクター（FuzzySelector）を、厳密な一致で探す");
    }
    const sel = litOf(selVal);
    if (sel === undefined) { bad(path, n.name ?? n.act, "セレクターがリテラルではない（式で組み立てるセレクターは直せない）"); return undefined; }
    const r = selectorToLocator(sel);
    if ("why" in r) { bad(path, n.name ?? n.act, `${r.why}（${sel}）`); return undefined; }
    return r.ts;
  };

  const timeoutMs = (v: Value | undefined, path: string, what: string, def = 30000): string => {
    if (v === undefined) return String(def);
    const s = typeof v === "number" ? String(v) : typeof v === "string" ? v : undefined;
    if (s !== undefined && /^\d+(\.\d+)?$/.test(s)) return String(Math.round(Number(s) * 1000));
    const e = expr(v, path, what);
    return e ? `(${e}) * 1000` : String(def);
  };

  // 変換しないプロパティを一覧に出す（known は扱ったもの）
  const rest = (n: Node, path: string, known: string[]) => {
    for (const k of Object.keys(n.props ?? {})) if (!known.includes(k)) bad(`${path}.props.${k}`, `${n.name ?? n.act} の ${k}`, `${n.act} の ${k} は変換していない`);
  };

  const block = (nodes: Node[] | undefined, d: number, path: string) => (nodes ?? []).forEach((n, i) => node(n, d, `${path}[${i}]`));

  const node = (n: Node, d: number, path: string) => {
    const p = n.props ?? {};
    if (n.variables?.length) declare(n.variables, d);
    switch (n.act) {
      case "Sequence":
        if (n.name) emit(d, `// ${n.name}`);
        block(n.body, d, `${path}.body`);
        return;
      case "NApplicationCard": {
        const app = objOf(n.objs?.TargetApp, "screen", `${path}.objs.TargetApp`);
        const sel = litOf(app?.Selector);
        const url = litOf(app?.Url);
        const pattern = sel?.match(/url='([^']*)'/)?.[1];
        const mode = String(p.OpenMode ?? "IfNotOpen");
        emit(d, `// ${n.name ?? "画面"}`);
        if (app?.BrowserType && !/Chrome|Edge|Chromium/i.test(String(app.BrowserType))) bad(path, n.name ?? n.act, `ブラウザー ${app.BrowserType} は Chrome で動かす`);
        if (mode === "Always" && url) emit(d, `await page.goto(${JSON.stringify(url)});`);
        else if (mode === "IfNotOpen" && url) emit(d, `if (page.url() === "about:blank") await page.goto(${JSON.stringify(url)});`);
        if (pattern) emit(d, `await page.waitForURL(${JSON.stringify(urlGlob(pattern))});`);
        else if (app) bad(path, n.name ?? n.act, "画面のセレクターに url が無い（ブラウザーの画面ではないかもしれない）");
        rest(n, path, ["OpenMode", "CloseMode", "AttachMode", "InteractionMode", "ScopeGuid", "WindowResize"]);
        block(n.body, d, `${path}.body`);
        return;
      }
      case "NGoToUrl": {
        const u = expr(p.Url, `${path}.props.Url`, "URL");
        if (u) emit(d, `await page.goto(${u});`);
        rest(n, path, ["Url"]);
        return;
      }
      case "NClick": {
        const l = locator(n, path);
        if (!l) { emit(d, `// 変換できない: ${n.name ?? n.act}`); return; }
        const o: string[] = [];
        if (p.ClickType === "Double") { emit(d, `await ${l}.dblclick(${p.MouseButton === "Right" ? "{ button: \"right\" }" : ""});`); }
        else {
          if (p.MouseButton === "Right") o.push('button: "right"');
          else if (p.MouseButton === "Middle") o.push('button: "middle"');
          emit(d, `await ${l}.click(${o.length ? `{ ${o.join(", ")} }` : ""});`);
        }
        rest(n, path, ["ClickType", "MouseButton", "InteractionMode", "ScopeIdentifier"]);
        return;
      }
      case "NTypeInto": {
        const l = locator(n, path);
        const t = expr(p.Text, `${path}.props.Text`, "入れる文字");
        if (!l || t === undefined) { emit(d, `// 変換できない: ${n.name ?? n.act}`); return; }
        if (p.EmptyFieldMode === "None") emit(d, `await ${l}.pressSequentially(${t});`);
        else emit(d, `await ${l}.fill(${t});`);
        rest(n, path, ["Text", "EmptyFieldMode", "InteractionMode", "ScopeIdentifier"]);
        return;
      }
      case "NGetText": {
        const l = locator(n, path);
        const to = typeof p.TextString === "string" ? names.get(p.TextString.toLowerCase()) : undefined;
        if (!l || !to) { if (!to) bad(path, n.name ?? n.act, "結果の変数が無い"); emit(d, `// 変換できない: ${n.name ?? n.act}`); return; }
        emit(d, `${to} = await getText(${l});`);
        rest(n, path, ["TextString", "InteractionMode", "ScopeIdentifier"]);
        return;
      }
      case "NCheckState": {
        const l = locator(n, path);
        if (!l) { emit(d, `// 変換できない: ${n.name ?? n.act}`); return; }
        const state = p.Mode === "WaitDisappear" ? "hidden" : "visible";
        const ms = timeoutMs(p.Timeout, `${path}.props.Timeout`, "待つ時間");
        const to = typeof p.Exists === "string" ? names.get(p.Exists.toLowerCase()) : undefined;
        // 出た・出ないの子は slots.IfExists / IfNotExists（XAML の Check State の 2 つの枠）
        const yes = n.slots?.IfExists ?? [], no = n.slots?.IfNotExists ?? [];
        if (!yes.length && !no.length) emit(d, `${to ? `${to} = ` : ""}await waitState(${l}, "${state}", ${ms});`);
        else {
          const v = to ?? "__exists";
          emit(d, `${to ? "" : "const "}${v} = await waitState(${l}, "${state}", ${ms});`);
          emit(d, `if (${v}) {`); block(yes, d + 1, `${path}.slots.IfExists`);
          if (no.length) { emit(d, "} else {"); block(no, d + 1, `${path}.slots.IfNotExists`); }
          emit(d, "}");
        }
        rest(n, path, ["Mode", "Timeout", "Exists", "ScopeIdentifier"]);
        return;
      }
      case "LogMessage": {
        const m = expr(p.Message, `${path}.props.Message`, "ログの文");
        const lv = typeof p.Level === "string" ? p.Level : "Info";
        if (m !== undefined) emit(d, `log(${JSON.stringify(lv)}, ${m});`);
        return;
      }
      case "If": {
        const c = expr(p.Condition, `${path}.props.Condition`, "条件");
        emit(d, `if (${c ?? "false /* 変換できない条件 */"}) {`);
        block(n.then, d + 1, `${path}.then`);
        if (n.else?.length) { emit(d, "} else {"); block(n.else, d + 1, `${path}.else`); }
        emit(d, "}");
        return;
      }
      case "Throw": {
        const e = expr(p.Exception, `${path}.props.Exception`, "例外");
        emit(d, e ? `throw ${e};` : `throw new Error("変換できない例外");`);
        return;
      }
      case "Assign": {
        const to = typeof p.To === "string" ? names.get(p.To.toLowerCase()) : undefined;
        const v = expr(p.Value, `${path}.props.Value`, "代入する値");
        if (!to) bad(path, n.name ?? n.act, `代入先 ${String(p.To)} は変数の名前ではない`);
        if (to && v !== undefined) emit(d, `${to} = ${v};`);
        return;
      }
      case "Delay": {
        // Duration は TimeSpan の式（TimeSpan.FromSeconds(5) など）か、"hh:mm:ss" のリテラル
        const dv = p.Duration as unknown;
        const raw = typeof dv === "string" ? dv : dv && typeof dv === "object" ? String((dv as { lit?: string; cs?: string }).lit ?? (dv as { cs?: string }).cs ?? "") : "";
        const hms = raw.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
        const from = raw.match(/^(?:System\.)?TimeSpan\.From(Milliseconds|Seconds|Minutes)\((\d+(?:\.\d+)?)\)$/i);
        const unit: Record<string, number> = { milliseconds: 1, seconds: 1000, minutes: 60000 };
        const ms = hms ? ((+hms[1] * 60 + +hms[2]) * 60 + +hms[3]) * 1000 : from ? +from[2] * unit[from[1].toLowerCase()] : undefined;
        if (ms === undefined) { bad(path, n.name ?? n.act, `待つ時間 ${raw || String(dv)} は直せない`); return; }
        emit(d, `await page.waitForTimeout(${Math.round(ms)});`);
        return;
      }
      default:
        bad(path, n.name ?? n.act, `${n.act} は Playwright に直す表が無い`);
        emit(d, `// 変換できない: ${n.act}${n.name ? `（${n.name}）` : ""}`);
    }
  };

  const declare = (vars: { name: string; type: string; default?: unknown }[], d: number) => {
    for (const v of vars) {
      names.set(v.name.toLowerCase(), v.name);
      const t = TS_TYPES[v.type];
      const init = v.default !== undefined ? expr(v.default as Value, `variables.${v.name}`, `${v.name} の既定値`) : t ? DEFAULTS[t] : undefined;
      if (!t) bad(`variables.${v.name}`, v.name, `型 ${v.type} は TypeScript の型に直していない（型を付けない）`);
      emit(d, `let ${v.name}${t ? `: ${t}` : ""}${init !== undefined ? ` = ${init}` : ""};`);
    }
  };

  const ins = (wf.arguments ?? []).filter((a) => a.dir !== "Out");
  const outs = (wf.arguments ?? []).filter((a) => a.dir !== "In");
  const tsType = (t: string) => TS_TYPES[t] ?? "unknown";
  for (const a of wf.arguments ?? []) if (!TS_TYPES[a.type]) bad(`arguments.${a.name}`, a.name, `型 ${a.type} は TypeScript の型に直していない（unknown にする）`);

  const body: string[] = [];
  const hold = lines.splice(0);
  for (const a of outs.filter((x) => x.dir === "Out")) emit(1, `let ${a.name}: ${tsType(a.type)} = ${DEFAULTS[tsType(a.type)] ?? "undefined as unknown"};`);
  // 渡されなかった引数は、IR の既定値（XAML・Coded の既定値と同じ）
  const tsDefault = (a: (typeof ins)[number]) => (a.default === undefined ? "" : ` ?? ${typeof a.default === "object" ? JSON.stringify(a.default.lit) : String(a.default)}`);
  for (const a of ins) emit(1, `let ${a.name}: ${tsType(a.type)} = (args.${a.name}${tsDefault(a)}) as ${tsType(a.type)};`);
  if (wf.variables?.length) declare(wf.variables, 1);
  block(wf.body, 1, "body");
  emit(1, `return { ${outs.map((a) => a.name).join(", ")} };`);
  body.push(...hold, ...lines);

  const inType = `{ ${ins.map((a) => `${a.name}?: ${tsType(a.type)}`).join("; ")} }`;
  const outType = `{ ${outs.map((a) => `${a.name}: ${tsType(a.type)}`).join("; ")} }`;
  const code = [
    `// tools/pw/ir-to-pw.ts で IR（${wf.workflow}）から生成。手で直さず IR を直す`,
    `// 動かし方: node <このファイル> [引数の JSON ファイル] [--headed] [--locale ja-JP]`,
    `import { readFileSync } from "node:fs";`,
    `import { resolve } from "node:path";`,
    `import type { Page } from "playwright-core";`,
    `import { getText, launch, log, waitState } from ${JSON.stringify(opt.runtimeImport)};`,
    ``,
    `export async function ${safeName(wf.workflow)}(page: Page, args: ${inType} = {}): Promise<${outType}> {`,
    ...body,
    `}`,
    ``,
    `if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {`,
    `  const argv = process.argv.slice(2);`,
    `  const file = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--locale");`,
    `  const li = argv.indexOf("--locale");`,
    `  const { browser, page } = await launch(li >= 0 ? argv[li + 1] : "ja-JP", { headless: !argv.includes("--headed") });`,
    `  try {`,
    `    const out = await ${safeName(wf.workflow)}(page, file ? JSON.parse(readFileSync(file, "utf8")) : {});`,
    `    console.log(JSON.stringify(out));`,
    `  } finally {`,
    `    await browser.close();`,
    `  }`,
    `}`,
    ``,
  ].join("\n");
  return { code, unconverted };
}

const safeName = (s: string) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : "run");

export function pwReport(wf: Workflow, res: PwResult): string {
  const l = [`# ${wf.workflow}：IR から Playwright（TypeScript）への変換`, ""];
  if (!res.unconverted.length) l.push("変換できなかったものは無い。");
  else {
    l.push("## 変換できなかったもの・意味が変わるもの", "", "| 場所 | もの | 理由 |", "| --- | --- | --- |");
    for (const u of res.unconverted) l.push(`| \`${u.path}\` | ${u.what.replace(/\|/g, "\\|")} | ${u.why.replace(/\|/g, "\\|")} |`);
  }
  return l.join("\n") + "\n";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
  const project = opt("--project");
  const outArg = opt("--out");
  if (!argv.length || (!project && !outArg)) {
    console.error("使い方: node tools/pw/ir-to-pw.ts --project <P> <IR>... [--out <dir>]");
    process.exit(2);
  }
  const repoFile = project ? join(project, "ir", "repository.json") : undefined;
  const repo = repoFile && existsSync(repoFile) ? (JSON.parse(readFileSync(repoFile, "utf8")) as Repository) : undefined;
  const out = resolve(outArg ?? join(project!, "pw"));
  mkdirSync(out, { recursive: true });
  const runtime = relative(out, join(dirname(fileURLToPath(import.meta.url)), "runtime.ts")).replace(/\\/g, "/");
  let n = 0;
  for (const f of argv) {
    const wf = JSON.parse(readFileSync(f, "utf8")) as Workflow;
    const res = irToPlaywright(wf, repo, { runtimeImport: runtime.startsWith(".") ? runtime : `./${runtime}` });
    const base = join(out, wf.workflow);
    writeFileSync(`${base}.pw.ts`, res.code);
    writeFileSync(`${base}.pw.md`, pwReport(wf, res));
    console.log(`OK ${f} -> ${base}.pw.ts（変換できなかったもの ${res.unconverted.length} 件 → ${wf.workflow}.pw.md）`);
    for (const u of res.unconverted) console.log(`  ${u.path}: ${u.what}: ${u.why}`);
    n += res.unconverted.length;
  }
}
