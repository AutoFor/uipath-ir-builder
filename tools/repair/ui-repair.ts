// UI 操作が「要素が見つからない」で落ちたとき、今の画面を調べて IR の直し案を出す。npm の依存なし（browser-use だけ Python）。
//
//   node tools/repair/ui-repair.ts --project <P> --run <ワークフロー>   [--name <作業名>] [--no-observe] [--top <n>]
//       ワークフロー（coded/Login__Coded.cs、MoneyForward/Login.xaml など）を uip rpa run で動かし、UI 操作で落ちたら止めて直し案を作る
//   node tools/repair/ui-repair.ts --project <P> --log <run のログ>   [...]
//       すでにある uip rpa run --output json の出力から直し案を作る（動かさない）
//   node tools/repair/ui-repair.ts apply <proposal.json>
//       直し案を IR に当てる（人が確かめてから）。そのあと gen.ts / gen-coded.ts で作り直す
//
// 直し案は out/repair/<作業名>/proposal.md と proposal.json。流れと注意は knowledge/ui-repair.md。
// - IR は直さない（apply を人が呼ぶまで）。画面は読むだけ（browser-use にも、クリックや入力をさせない）
// - browser-use は ANTHROPIC_API_KEY があり、tools/repair/.venv に入っているときだけ使う。無ければ uip rpa uia だけで調べる
// - interact get-all の Cookie や HTML の中身は保存しない（repair.ts の LIVE_KEEP）

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyProposal, currentTarget, hintsFromTarget, locateTarget, parseLiveAttrs, parseRunFailure, parseSelector, parseTree, proposalMarkdown, rankCandidates, scoreLive, wildMatch, type Proposal } from "./repair.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");
const py = join(root, "tools", "repair", ".venv", "Scripts", "python.exe");

const args = process.argv.slice(2);
const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const die = (m: string, code = 2): never => { console.error(m); process.exit(code); };

if (args[0] === "apply") {
  const f = args[1] ?? die("使い方: node tools/repair/ui-repair.ts apply <proposal.json>");
  const p: Proposal = JSON.parse(readFileSync(f!, "utf8"));
  const irPath = join(p.project, p.irFile);
  const wf = JSON.parse(readFileSync(irPath, "utf8"));
  const r = applyProposal(wf, p);
  if ("error" in r) die(`NG ${r.error}`, 1);
  writeFileSync(irPath, JSON.stringify(wf, null, 2) + "\n", "utf8");
  console.log(`OK ${irPath}：${(r as { changed: string[] }).changed.join(", ")} を変えた。gen.ts / gen-coded.ts で作り直して、もう一度動かす`);
  process.exit(0);
}

const project = resolve(val("--project") ?? die("--project <P> が要る"));
const runFile = val("--run"), logFile = val("--log");
if (!runFile && !logFile) die("--run <ワークフロー> か --log <run のログ> が要る");
const name = val("--name") ?? `repair-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const top = Number(val("--top") ?? 6);
const outDir = join(root, "out", "repair", name);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const notes: string[] = [];

const uip = (a: string[], timeout = 600) => {
  const r = spawnSync(process.execPath, [uipJs, ...a, "--project-dir", project], { cwd: project, encoding: "utf8", maxBuffer: 256 << 20, timeout: timeout * 1000 });
  return { ok: r.status === 0, out: (r.stdout ?? "") + (r.stderr ?? "") };
};

// ---- 1. 動かす（か、ログを読む）----
let log: string;
if (runFile) {
  console.log(`run ${runFile} …`);
  log = uip(["rpa", "run", "--file-path", runFile, "--output", "json"], 1800).out;
  writeFileSync(join(outDir, "run.log"), log, "utf8");
} else log = readFileSync(logFile!, "utf8");

const failure = parseRunFailure(log, project);
if (!failure) { console.log(/"hasErrors":\s*false/.test(log) ? "OK 失敗していない" : "NG run の結果が読めない"); process.exit(/"hasErrors":\s*false/.test(log) ? 0 : 2); }
if (!failure.ui) { console.log(`NG UI 操作の失敗ではない（${failure.exceptionType ?? "?"}: ${failure.message}）。直し案は作らない`); process.exit(1); }
console.log(`UI 操作の失敗：${failure.exceptionType} @ ${failure.file}${failure.line ? `:${failure.line}` : ""}`);

// ---- 2. IR の中を探す ----
const loc = locateTarget(project, failure);
if ("error" in loc) die(`NG ${loc.error}`, 1);
const L = loc as Exclude<typeof loc, { error: string }>;
const activity = String(L.node.name ?? L.node.act);
console.log(`IR：${L.irFile} の ${L.path.join(".")}（${activity}）`);
const lit = (v: any) => (typeof v === "string" ? v : v?.lit);
const appSel = lit(L.app?.Selector) ?? lit(L.target.ScopeSelectorArgument) ?? "";
const appUrl = lit(L.app?.Url);
const htmlAttrs = parseSelector(appSel).find((t) => t.tag === "html")?.attrs ?? {};

// ---- 3. 今の画面のタブ（uip rpa uia）----
const work = join(outDir, "uia");
mkdirSync(work, { recursive: true });
const wsl = work.replace(/\\/g, "/");
const cap = uip(["rpa", "uia", "snapshot", "capture", "--folder-path", wsl]);
if (!cap.ok) notes.push(`uip rpa uia snapshot capture が失敗した：${cap.out.slice(0, 300)}`);
const tabs: { ref: string; title: string; url?: string }[] = [];
if (existsSync(join(work, "window-tree.yml"))) {
  const lines = readFileSync(join(work, "window-tree.yml"), "utf8").split(/\r?\n/);
  lines.forEach((l, i) => {
    const m = l.match(/^\s*- BrowserTab "((?:[^"\\]|\\.)*)" \[ref=(b\d+)\]/);
    if (m) tabs.push({ ref: m[2], title: m[1], url: lines[i + 1]?.match(/^\s*- \/url: (.*)$/)?.[1] });
  });
}
// IR のアプリのセレクター（title / url）、無ければ Url のホストで探す
const host = appUrl ? new URL(appUrl).host : undefined;
const match = tabs.filter((t) =>
  (htmlAttrs.title || htmlAttrs.url)
    ? (!htmlAttrs.title || wildMatch(htmlAttrs.title, t.title)) && (!htmlAttrs.url || (t.url !== undefined && wildMatch(htmlAttrs.url, t.url)))
    : host !== undefined && t.url !== undefined && t.url.includes(host));
const byHost = host ? tabs.filter((t) => t.url?.includes(host)) : [];
const tab = match[0] ?? byHost[0];
const window: Proposal["window"] = tab ? { matched: match.length > 0, title: tab.title, url: tab.url, ref: tab.ref } : { matched: false };
if (!match.length) notes.push(`IR のアプリのセレクター ${appSel || "（なし）"} に合うタブが無い。${byHost.length ? `同じホストのタブ（${byHost.map((t) => `"${t.title}"`).join(", ")}）はある。ページやログイン状態が違うかもしれない` : `${host ?? "そのアプリ"} のタブも無い。アプリが開いていない`}`);

// ---- 4. browser-use（読むだけ）----
let observation: Record<string, unknown> | undefined;
let observedAttrs: Record<string, string> | undefined, observedLabel: string | undefined;
if (args.includes("--no-observe")) notes.push("browser-use は使わなかった（--no-observe）");
else if (!process.env.ANTHROPIC_API_KEY) notes.push("browser-use は使わなかった（ANTHROPIC_API_KEY が無い）");
else if (!existsSync(py)) notes.push("browser-use は使わなかった（tools/repair/.venv が無い。knowledge/ui-repair.md の手順で入れる）");
else {
  const inFile = join(outDir, "observe-in.json"), outFile = join(outDir, "observe-out.json");
  writeFileSync(inFile, JSON.stringify({
    activity, elementType: lit(L.target.ElementType), selector: lit(L.target.FullSelectorArgument) ?? lit(L.target.FuzzySelectorArgument),
    expectedUrl: appUrl, expectedTitle: htmlAttrs.title, currentTab: tab, error: failure.message,
  }, null, 2), "utf8");
  console.log("browser-use で画面を調べる …");
  const r = spawnSync(py, [join(root, "tools", "repair", "observe.py"), inFile, outFile], { encoding: "utf8", timeout: 600_000 });
  if (r.status === 0 && existsSync(outFile)) {
    observation = JSON.parse(readFileSync(outFile, "utf8"));
    const el = observation?.element as { label?: string; attributes?: Record<string, string> } | undefined;
    observedLabel = el?.label; observedAttrs = el?.attributes;
  } else notes.push(`browser-use が失敗した：${((r.stderr ?? "") + (r.stdout ?? "")).trim().split(/\r?\n/).slice(-3).join(" / ")}`);
}

// ---- 5. 要素ツリーから候補を選び、セレクターを作り直す（uip rpa uia）----
const hints = hintsFromTarget(L.node, L.target, { label: observedLabel, attrs: observedAttrs });
const lastTag = (s?: string) => { const t = parseSelector(s); return t[t.length - 1]?.attrs ?? {}; };
const wanted = { ...lastTag(lit(L.target.FuzzySelectorArgument)), ...lastTag(lit(L.target.FullSelectorArgument)), ...(observedAttrs ?? {}) };
for (const k of Object.keys(wanted)) if (/^(matching|fuzzylevel|check):/.test(k)) delete wanted[k];
const candidates: Proposal["candidates"] = [];
let proposed: Record<string, string> | undefined;
if (tab) {
  const app = uip(["rpa", "uia", "target-app", "resolve-defaults", "--refs", JSON.stringify([{ ref: tab.ref, definitionFilePath: `${wsl}/window.xaml` }]), "--name", "repair"]);
  const tree = app.ok ? uip(["rpa", "uia", "snapshot", "capture", tab.ref, "--folder-path", wsl]) : app;
  if (!tree.ok || !existsSync(join(work, "tree.yml"))) notes.push(`タブの要素ツリーが取れない：${tree.out.slice(0, 300)}`);
  else {
    const ranked = rankCandidates(parseTree(readFileSync(join(work, "tree.yml"), "utf8")), hints).slice(0, top);
    for (const c of ranked) {
      const g = uip(["rpa", "uia", "interact", "get-all", c.node.ref]);
      const live = g.ok ? parseLiveAttrs(g.out) : undefined;
      const s = live ? scoreLive(live, wanted) : { score: 0, matched: [], missed: [] };
      candidates.push({ ref: c.node.ref, role: c.node.role, name: c.node.name, score: c.score + s.score, why: [...c.why, ...s.matched.map((x) => `今も ${x}`), ...s.missed.map((x) => `合わない ${x}`)], live });
    }
    candidates.sort((a, b) => b.score - a.score);
    const [best, second] = candidates;
    if (!best) notes.push("要素ツリーに候補が無い（その画面に要素が無い？ 前の操作で別の画面に進んでいない？）");
    else if (second && best.score - second.score < 3) notes.push(`候補の点数が近い（${best.ref} ${best.score} と ${second.ref} ${second.score}）。どちらか人が決める（uip rpa uia interact highlight <ref> で確かめられる）`);
    else if (best.score < 4) notes.push(`いちばん点数の高い候補（${best.ref}、${best.score} 点）でも手がかりが少ない。人が確かめる`);
    else {
      const def = `${wsl}/target-1.xaml`;
      const r = uip(["rpa", "uia", "target-anchorable", "resolve-defaults", "--window-definition-file-path", `${wsl}/window.xaml`, "--window-ref", tab.ref,
        "--refs", JSON.stringify([{ ref: best.ref, definitionFilePath: def, name: activity, description: `ui-repair: ${activity}` }])]);
      if (!r.ok || !existsSync(def)) notes.push(`resolve-defaults が失敗した：${r.out.slice(0, 300)}`);
      else {
        const x = readFileSync(def, "utf8");
        const attr = (k: string) => x.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1]?.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
        proposed = {};
        for (const k of ["FullSelectorArgument", "SearchSteps"]) { const v = attr(k); if (v !== undefined) proposed[k] = v; }
        // スコープ（ページの題名など）は、今のものが今のタブに合わないときだけ変える
        const scopeNow = parseSelector(lit(L.target.ScopeSelectorArgument)).find((t) => t.tag === "html")?.attrs;
        const scopeOk = !scopeNow || ((!scopeNow.title || wildMatch(scopeNow.title, tab.title)) && (!scopeNow.url || (tab.url !== undefined && wildMatch(scopeNow.url, tab.url))));
        const scopeNew = attr("ScopeSelectorArgument");
        if (!scopeOk && scopeNew) { proposed.ScopeSelectorArgument = scopeNew; notes.push("今のスコープ（ScopeSelectorArgument）が今のタブの題名・URL に合わないので、作り直したものを案にした"); }
      }
    }
  }
}

const proposal: Proposal = { version: 1, project, irFile: L.irFile, path: L.path, activity, failure, current: currentTarget(L.target), proposed, window, observation, candidates, notes };
writeFileSync(join(outDir, "proposal.json"), JSON.stringify(proposal, null, 2) + "\n", "utf8");
writeFileSync(join(outDir, "proposal.md"), proposalMarkdown(proposal), "utf8");
console.log(`${proposed ? "OK 直し案を作った" : "-- 直し案は作れなかった（候補と notes を見る）"} -> ${join(outDir, "proposal.md")}`);
for (const n of notes) console.log(`  ${n}`);
process.exit(proposed ? 0 : 1);
