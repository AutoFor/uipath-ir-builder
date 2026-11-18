// UI 操作が「要素が見つからない」で落ちたときの直し案づくり（ui-repair.ts）の中身。外のコマンドを呼ばない部分だけを置く（テストする）。
//
// 流れ（knowledge/ui-repair.md）:
//   1. run のログから、落ちたアクティビティと場所を読む（parseRunFailure）
//   2. IR の中のそのアクティビティとターゲットを探す（locateTarget）
//   3. uip rpa uia で今の画面の要素ツリーを取り、候補を選んでセレクターを作り直す（parseTree、rankCandidates、scoreLive）
//      画面を読むのは UiPath 標準の uip rpa uia だけ（Playwright・browser-use は使わない）
//   4. 直し案を出す（buildProposal）。IR を直すのは人が確かめてから（applyProposal）

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readDescriptors } from "../ir/coded-descriptors.ts";
import { join, relative } from "node:path";

// ---- 1. run のログ ----

export type RunFailure = {
  ui: boolean; // UI 操作の失敗（要素が見つからない、など）か
  exceptionType?: string;
  message: string;
  file?: string; // 落ちた場所のファイル（プロジェクトからの相対パス。coded/Login__Coded.cs、MoneyForward/Login.xaml）
  line?: number; // Coded の行
  activity?: string; // XAML のアクティビティの DisplayName（Source:）
  hint?: string; // セレクターでは直らない失敗のとき、何を見ればよいか
};

const UI_EXCEPTION = /UIAutomationNext\.Exceptions\.|NodeNotFoundException|SelectorNotFoundException|ElementNotFoundException|UiAutomationException/;
const UI_MESSAGE = /UI\) 要素が見つかりませんでした|could not find the user interface \(UI\) element|Cannot find the UI element/i;
// UI の例外でも、セレクターを直しても直らないもの
const NOT_SELECTOR: [RegExp, string][] = [
  [/Chromium API プロトコルへのアタッチに失敗|attach to the Chromium API/i,
    "入力方式 DebuggerApi（Chromium API）が Chrome にアタッチできなかった。ほかにデバッガーでつないでいるもの（Claude in Chrome などの拡張機能、開いている拡張機能のポップアップ、DevTools）を閉じるか、その操作の InteractionMode を変える"],
];

// uip rpa run --output json の出力（前に [Information] などの行が付く）から、失敗の中身を読む
export function parseRunFailure(log: string, projectDir: string): RunFailure | undefined {
  const j = log.search(/^\{\s*$/m);
  if (j < 0) return undefined;
  let env: { Result?: string; Message?: string; Data?: { hasErrors?: boolean; errorMessage?: string | null } };
  try { env = JSON.parse(log.slice(j)); } catch { return undefined; }
  let err: string | null | undefined = env.Data?.errorMessage;
  if (!err && env.Message) { try { err = JSON.parse(env.Message).errorMessage; } catch { err = env.Message; } }
  if (!err) return undefined;
  const exceptionType = err.match(/Exception Type:\s*(\S+)/)?.[1];
  const message = err.match(/Message:\s*([^\r\n]+)/)?.[1]?.trim() ?? err.split(/\r?\n/)[0];
  const hint = NOT_SELECTOR.find(([re]) => re.test(err!))?.[1];
  const f: RunFailure = { ui: !hint && (UI_EXCEPTION.test(exceptionType ?? "") || UI_MESSAGE.test(err)), exceptionType, message, ...(hint ? { hint } : {}) };
  // Coded：プロジェクトの .cs の行（.local の生成物は除く）
  const norm = (p: string) => p.replace(/\\\\/g, "\\").replace(/\//g, "\\").toLowerCase();
  const root = norm(projectDir).replace(/\\$/, "") + "\\";
  for (const m of err.matchAll(/ in ([A-Za-z]:[^\r\n:]*?\.cs):line (\d+)/g)) {
    const p = norm(m[1]);
    if (!p.startsWith(root) || p.includes("\\.local\\")) continue;
    f.file = m[1].replace(/\\\\/g, "\\").slice(root.length).replace(/\\/g, "/");
    f.line = Number(m[2]);
    break;
  }
  if (!f.file) {
    const src = err.match(/^Source:\s*([^\r\n]+)/m)?.[1]?.trim();
    if (src) f.activity = src;
    const x = err.match(/^in ([^\r\n]+\.xaml)\s*$/m)?.[1];
    if (x) f.file = x.replace(/\\/g, "/");
  }
  return f;
}

// ---- 2. IR の中を探す ----

type Json = unknown;
export type Located = {
  irFile: string; // プロジェクトからの相対パス（ir/MoneyForward/Login.json）
  path: (string | number)[]; // IR の中のノードの場所
  node: Record<string, any>;
  target: Record<string, any>; // objs.Target
  app?: Record<string, any>; // いちばん近い外側の NApplicationCard の objs.TargetApp
};

const litOf = (v: unknown): string | undefined => (typeof v === "string" ? v : v && typeof v === "object" && "lit" in (v as object) ? String((v as { lit: unknown }).lit) : undefined);

export function irFiles(projectDir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".json")) out.push(p); } };
  walk(join(projectDir, "ir"));
  return out.sort();
}

// IR を歩いて、条件に合うノード（objs.Target を持つもの）を探す
function findNodes(wf: Json, pred: (n: Record<string, any>) => boolean): { path: (string | number)[]; node: Record<string, any>; app?: Record<string, any> }[] {
  const hits: { path: (string | number)[]; node: Record<string, any>; app?: Record<string, any> }[] = [];
  const walk = (x: Json, path: (string | number)[], app?: Record<string, any>) => {
    if (Array.isArray(x)) { x.forEach((y, i) => walk(y, [...path, i], app)); return; }
    if (!x || typeof x !== "object") return;
    const n = x as Record<string, any>;
    const here = n.objs?.TargetApp && typeof n.act === "string" ? n.objs.TargetApp : app;
    if (typeof n.act === "string" && n.objs?.Target && pred(n)) hits.push({ path, node: n, app: here });
    for (const [k, v] of Object.entries(n)) if (k !== "objs") walk(v, [...path, k], here);
  };
  walk(wf, []);
  return hits;
}

export function locateTarget(projectDir: string, f: RunFailure): Located | { error: string } {
  if (!f.file) return { error: "落ちた場所（ファイル）がログから分からない" };
  const files = irFiles(projectDir);
  if (!files.length) return { error: `${projectDir}/ir に IR が無い（import-xaml.ts --project --out <P>/ir で作る）` };
  let pred: (n: Record<string, any>) => boolean;
  let irs = files;
  if (f.file.endsWith(".cs") && f.line) {
    const src = readFileSync(join(projectDir, f.file), "utf8").split(/\r?\n/);
    const ln = src[f.line - 1] ?? "";
    let ref = ln.match(/Reference = "([^"]+)"/)?.[1];
    // オブジェクトリポジトリ（Descriptors.<アプリ>.<画面>.<要素>）で書いた行は、ObjectRepository.cs で Reference に引き直す
    const desc = ln.match(/\(\s*(Descriptors\.[^\s,()]+)/)?.[1];
    if (!ref && desc) for (const [r, d] of readDescriptors(projectDir) ?? []) if (d.path === desc && d.kind === "element") { ref = r; break; }
    if (!ref) return { error: `${f.file} の ${f.line} 行目にターゲットの Reference が無い（UI 操作の行でない）` };
    pred = (n) => litOf(n.objs.Target.Reference) === ref;
  } else if (f.activity) {
    const xaml = f.file.replace(/\.xaml$/i, "");
    irs = files.filter((p) => { const wf = JSON.parse(readFileSync(p, "utf8")); return (wf.file ?? `${wf.workflow}.xaml`).replace(/\.xaml$/i, "").toLowerCase() === xaml.toLowerCase(); });
    pred = (n) => n.name === f.activity;
  } else return { error: "落ちたアクティビティがログから分からない" };
  const found: Located[] = [];
  for (const p of irs) {
    const wf = JSON.parse(readFileSync(p, "utf8"));
    for (const h of findNodes(wf, pred)) found.push({ irFile: relative(projectDir, p).replace(/\\/g, "/"), path: h.path, node: h.node, target: h.node.objs.Target, app: h.app });
  }
  if (!found.length) return { error: "IR の中に、落ちたアクティビティのターゲットが見つからない（IR が古い？ 取り込み直す）" };
  if (found.length > 1 && f.file.endsWith(".cs")) return found[0]; // 同じ Reference は同じ要素（同じ画面の同じ要素を何度も使う）
  if (found.length > 1) return { error: `IR の中に "${f.activity}" が ${found.length} 個ある。どれか決められない` };
  return found[0];
}

// ---- セレクター ----

export type SelTag = { tag: string; attrs: Record<string, string> };

// <webctrl tag='INPUT' type='email' /><webctrl aaname='x' /> → [{ tag: "webctrl", attrs: { tag: "INPUT", type: "email" } }, ...]
export function parseSelector(sel: string | undefined): SelTag[] {
  if (!sel) return [];
  const out: SelTag[] = [];
  for (const m of sel.matchAll(/<(\w+)((?:\s+[\w:-]+\s*=\s*(?:'[^']*'|"[^"]*"))*)\s*\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of m[2].matchAll(/([\w:-]+)\s*=\s*(?:'([^']*)'|"([^"]*)")/g)) attrs[a[1]] = a[2] ?? a[3];
    out.push({ tag: m[1], attrs });
  }
  return out;
}

// セレクターの値（* と ? のワイルドカード）が、実際の値に合うか
export function wildMatch(pattern: string, value: string): boolean {
  const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[\\s\\S]*").replace(/\?/g, ".") + "$", "i");
  return re.test(value.trim());
}

// ---- 4. 要素ツリー（uip rpa uia snapshot capture の tree.yml）----

export type TreeNode = { ref: string; role: string; name: string; states: string[]; attrs: Record<string, string>; text?: string; line: number };

export function parseTree(yml: string): TreeNode[] {
  const nodes: TreeNode[] = [];
  const stack: { indent: number; node?: TreeNode }[] = [];
  yml.split(/\r?\n/).forEach((raw, i) => {
    const m = raw.match(/^(\s*)- (.*)$/);
    if (!m) return;
    const indent = m[1].length, body = m[2];
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const attr = body.match(/^\/([\w:-]+):\s?(.*)$/);
    if (attr) { const owner = stack[stack.length - 1]?.node; if (owner) owner.attrs[attr[1]] = attr[2]; return; }
    const n = body.match(/^(\w+)(?:\s+"((?:[^"\\]|\\.)*)")?((?:\s+\[[^\]]+\])*)\s*:?\s*(.*)$/);
    if (!n) { stack.push({ indent }); return; }
    const tags = [...n[3].matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]);
    const ref = tags.find((t) => t.startsWith("ref="))?.slice(4);
    if (!ref) { stack.push({ indent }); return; }
    const node: TreeNode = { ref, role: n[1], name: n[2] ?? "", states: tags.filter((t) => !t.startsWith("ref=")), attrs: {}, text: n[4] || undefined, line: i + 1 };
    nodes.push(node);
    stack.push({ indent, node });
  });
  return nodes;
}

// IR の ElementType と、ツリーの役割（Role）の対応。無ければ役割では絞らない
const ROLES: Record<string, string[]> = {
  InputBox: ["InputBox"], InputBoxPassword: ["InputBox"], InputBoxText: ["InputBox"],
  Button: ["Button", "Link"], Link: ["Link", "Button"], Text: ["Text", "Link", "Container", "Button"],
  CheckBox: ["CheckBox"], RadioButton: ["RadioButton"], DropDown: ["DropDown", "ComboBox"], ComboBox: ["ComboBox", "DropDown"],
};

export type Hints = {
  elementType?: string; // IR の ElementType
  words: string[]; // 名前に含まれていそうな言葉（DisplayName の '…'、aaname、DOM で見つけた要素の表示名など）
  attrs: Record<string, string>; // 元のセレクター（と DOM で見つけた要素）の属性。tag、id、type、name、aaname など
};

const HIDDEN = new Set(["invisible", "offscreen", "no rectangle", "disabled"]);

// ツリーの候補の点数（ツリーに出る情報だけで付ける。上位を interact get-all で確かめる）
export function rankCandidates(nodes: TreeNode[], h: Hints): { node: TreeNode; score: number; why: string[] }[] {
  const roles = h.elementType ? ROLES[h.elementType] : undefined;
  const out: { node: TreeNode; score: number; why: string[] }[] = [];
  for (const n of nodes) {
    if (n.states.some((s) => HIDDEN.has(s))) continue;
    let score = 0;
    const why: string[] = [];
    if (roles) { if (!roles.includes(n.role)) continue; score += roles[0] === n.role ? 3 : 1; why.push(`役割 ${n.role}`); }
    const hay = [n.name, n.text ?? "", ...Object.values(n.attrs)].join(" ").toLowerCase();
    for (const w of h.words) {
      if (!w) continue;
      if (n.name.trim().toLowerCase() === w.trim().toLowerCase()) { score += 7; why.push(`名前が「${w}」`); }
      else if (hay.includes(w.toLowerCase())) { score += 4; why.push(`「${w}」を含む`); }
    }
    for (const [k, v] of Object.entries(h.attrs)) if (n.attrs[k] !== undefined && !v.includes("*") && n.attrs[k].toLowerCase() === v.toLowerCase()) { score += 3; why.push(`${k}=${v}`); }
    out.push({ node: n, score, why });
  }
  return out.sort((a, b) => b.score - a.score || a.node.line - b.node.line);
}

// interact get-all の出力（- key: "value" の行）を読む。Cookie や HTML の中身は持たない（直し案やログに残さない）
export const LIVE_KEEP = ["tag", "id", "name", "type", "class", "aria-label", "aaname", "parentid", "parentclass", "href", "placeholder", "role", "title", "url", "visibility", "innertext", "value"];
export function parseLiveAttrs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/^- ([\w-]+): "(.*)"\s*$/gm)) if (LIVE_KEEP.includes(m[1])) out[m[1]] = m[2];
  return out;
}

// 実際の属性と、元のセレクターの最後の webctrl の属性の合い方
export function scoreLive(live: Record<string, string>, wanted: Record<string, string>): { score: number; matched: string[]; missed: string[] } {
  const matched: string[] = [], missed: string[] = [];
  for (const [k, v] of Object.entries(wanted)) {
    if (k === "idx" || v === "") continue;
    const got = live[k];
    if (got !== undefined && wildMatch(v, got)) matched.push(`${k}=${v}`); else missed.push(`${k}=${v}${got !== undefined ? `（今は ${got}）` : ""}`);
  }
  return { score: matched.length * 3 - missed.length, matched, missed };
}

// 元のターゲットから、探す手がかりを作る
export function hintsFromTarget(node: Record<string, any>, target: Record<string, any>, observed?: { label?: string; attrs?: Record<string, string> }): Hints {
  const words = new Set<string>();
  const quoted = typeof node.name === "string" ? node.name.match(/'([^']+)'/)?.[1] : undefined;
  if (quoted && !/^(INPUT|BUTTON|A|DIV|SPAN)\b/.test(quoted)) words.add(quoted.replace(/…$/, ""));
  const tags = [...parseSelector(litOf(target.FullSelectorArgument)), ...parseSelector(litOf(target.FuzzySelectorArgument))];
  const attrs: Record<string, string> = {};
  for (const t of tags) for (const [k, v] of Object.entries(t.attrs)) {
    if (/^(matching|fuzzylevel|check):/.test(k)) continue;
    if (k === "aaname" && v) words.add(v.replace(/^\*|\*$/g, "").trim());
    attrs[k] = v;
  }
  const nt = litOf(target.NativeTextArgument); if (nt) words.add(nt);
  if (observed?.label) words.add(observed.label);
  for (const [k, v] of Object.entries(observed?.attrs ?? {})) if (!(k in attrs)) attrs[k] = v;
  return { elementType: litOf(target.ElementType), words: [...words].filter(Boolean), attrs };
}

// ---- 5. 直し案 ----

export type Proposal = {
  version: 1;
  project: string;
  irFile: string;
  path: (string | number)[];
  activity: string;
  failure: RunFailure;
  current: Record<string, string | undefined>;
  proposed?: Record<string, string>;
  window?: { matched: boolean; title?: string; url?: string; ref?: string };
  screen?: { ref: string; role: string; name: string }[]; // 対象のタブの、操作できそうな要素（uip rpa uia の要素ツリー）。どの画面にいるかを人が見るため
  candidates: { ref: string; role: string; name: string; score: number; why: string[]; live?: Record<string, string> }[];
  notes: string[];
};

const PROPOSED_KEYS = ["FullSelectorArgument", "FuzzySelectorArgument", "ScopeSelectorArgument", "SearchSteps"] as const;

export function currentTarget(target: Record<string, any>): Record<string, string | undefined> {
  return Object.fromEntries(PROPOSED_KEYS.map((k) => [k, litOf(target[k])]));
}

export function proposalMarkdown(p: Proposal): string {
  const L: string[] = [];
  L.push(`# UI 操作の直し案：${p.activity}`, "");
  L.push(`- プロジェクト：\`${p.project}\``, `- IR：\`${p.irFile}\` の \`${p.path.join(".")}\``);
  L.push(`- 失敗：${p.failure.exceptionType ?? "?"} — ${p.failure.message}`, `- 場所：\`${p.failure.file ?? "?"}${p.failure.line ? `:${p.failure.line}` : ""}\``, "");
  L.push("## 今の画面", "");
  if (p.window) L.push(p.window.matched ? `- 対象のタブ：${p.window.title}（${p.window.url}、${p.window.ref}）` : "- **ターゲットのアプリ（タブ）が今の画面に無い**。アプリが開いていない、別のページにいる、ログイン状態が違う、などを先に確かめる");
  if (p.screen?.length) {
    L.push("", `<details><summary>そのタブの操作できそうな要素（${p.screen.length} 個、uip rpa uia）</summary>`, "", "| ref | 種類 | 名前 |", "| --- | --- | --- |");
    const cell = (s: string) => s.replace(/\|/g, "\\|");
    for (const e of p.screen) L.push(`| ${e.ref} | ${e.role} | ${cell(e.name)} |`);
    L.push("", "</details>");
  }
  L.push("", "## 直し案", "");
  if (p.proposed) {
    L.push("| プロパティ | 今 | 案 |", "| --- | --- | --- |");
    for (const k of PROPOSED_KEYS) if (p.proposed[k] !== undefined && p.proposed[k] !== p.current[k]) L.push(`| ${k} | \`${p.current[k] ?? "（なし）"}\` | \`${p.proposed[k]}\` |`);
    L.push("", "当てるとき（人が確かめてから）：", "", "```bash", `node tools/repair/ui-repair.ts apply <この直し案の proposal.json>`, "```");
  } else L.push("**直し案は出せなかった**。候補と notes を見て、人が決める。");
  L.push("", "## 候補（uip rpa uia の要素ツリー）", "");
  if (!p.candidates.length) L.push("（候補なし）");
  for (const c of p.candidates) L.push(`- ${c.ref} ${c.role} "${c.name}"：点数 ${c.score}（${c.why.join("、") || "手がかりなし"}）${c.live ? ` 属性 ${JSON.stringify(c.live)}` : ""}`);
  if (p.notes.length) { L.push("", "## notes", ""); for (const n of p.notes) L.push(`- ${n}`); }
  return L.join("\n") + "\n";
}

// 直し案を IR に当てる（人が確かめてから呼ぶ）。変えるのは objs.Target のセレクターと SearchSteps だけ
export function applyProposal(wf: Record<string, any>, p: Proposal): { changed: string[] } | { error: string } {
  if (!p.proposed) return { error: "直し案が無い" };
  let x: any = wf;
  for (const k of p.path) { x = x?.[k]; if (x === undefined) return { error: `IR に ${p.path.join(".")} が無い（IR が変わった？）` }; }
  const t = x?.objs?.Target;
  if (!t) return { error: `${p.path.join(".")} に objs.Target が無い` };
  // 直し案を作ったときから IR が変わっていたら当てない
  for (const k of PROPOSED_KEYS) if ((litOf(t[k]) ?? undefined) !== (p.current[k] ?? undefined)) return { error: `IR の ${k} が直し案を作ったときと違う。直し案を作り直す` };
  const changed: string[] = [];
  for (const k of PROPOSED_KEYS) {
    const v = p.proposed[k];
    if (v === undefined || v === p.current[k]) continue;
    t[k] = k === "SearchSteps" ? v : { lit: v };
    changed.push(k);
  }
  return { changed };
}
