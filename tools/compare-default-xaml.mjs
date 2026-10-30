// get-default-xaml の出力（knowledge/default-xaml/*.json）とカタログを突き合わせ、Markdown で結果を出す。
//
// 使い方:
//   node tools/compare-default-xaml.mjs catalog/a.json catalog/b.json > knowledge/default-xaml-compare.md
//   node tools/compare-default-xaml.mjs --generated samples/generated [--activity WriteTextFile]
//     生成した XAML（フォルダか .xaml）の中のアクティビティを、Studio の既定 XAML と比べる。
//     見るもの: xmlns、x:TypeArguments の有無、プロパティを属性で書くか要素で書くか、既定 XAML が付ける値（Version="V5" など）の欠け。
//     食い違いがあれば終了コード 1
//
// 既定 XAML の取り方（作業用プロジェクトの中で、uip login 済みで）:
//   uip rpa activities get-default-xaml --activity-class-name UiPath.Core.Activities.WriteTextFile \
//     --project-dir C:\Users\Public\uipath-ir-probe-<名前> --output json > knowledge/default-xaml/WriteTextFile.json

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
if (argv[0] === "--generated") { compareGenerated(argv.slice(1)); process.exit(process.exitCode ?? 0); }

const catalogs = argv.map((p) => JSON.parse(readFileSync(p, "utf8")));
const byClass = new Map(catalogs.flatMap((c) => c.activities.map((a) => [a.className, { ...a, package: `${c.package} ${c.version}` }])));

const dir = "knowledge/default-xaml";
const rows = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const res = JSON.parse(readFileSync(join(dir, file), "utf8").replace(/^﻿/, ""));
  if (res.Result !== "Success") continue;
  const xaml = res.Data.message;

  // ルートの <Activity> の直下にある最初の要素がアクティビティ本体
  const m = xaml.match(/<Activity\b[^>]*>\s*<(?:(\w+):)?(\w+)\b([^>]*?)\/?>/);
  if (!m) continue;
  const [, prefix, className, attrText] = m;
  const tag = prefix ? `${prefix}:${className}` : className;

  const attrs = [...attrText.matchAll(/([\w:.]+)="([^"]*)"/g)]
    .filter(([, k]) => !k.startsWith("xmlns") && !k.includes(":"))
    .map(([, k, v]) => ({ name: k, value: v }));
  // <uix:NTypeInto.VerifyOptions> のような要素形式のプロパティ
  const elems = [...xaml.matchAll(new RegExp(`<${tag}\\.(\\w+)>`, "g"))].map(([, k]) => ({ name: k, value: "(要素)" }));
  const shown = [...attrs, ...elems];

  const act = byClass.get(className);
  if (!act) {
    rows.push({ className, missing: true, shown });
    continue;
  }
  const props = new Map(act.props.map((p) => [p.name, p]));
  const shownNames = new Set(shown.map((s) => s.name));

  rows.push({
    className,
    package: act.package,
    shown,
    notInCatalog: shown.filter((s) => !props.has(s.name)),
    // {x:Null} は「値なし」なので enum の判定から外す
    badEnum: attrs.filter((s) => s.value !== "{x:Null}" && props.get(s.name)?.enum && !props.get(s.name).enum.includes(s.value)),
    hidden: act.props.filter((p) => !shownNames.has(p.name) && p.name !== "DisplayName"),
    requiredUnset: act.props.filter((p) => p.required && !shownNames.has(p.name)),
  });
}

const fmt = (ps) => (ps.length ? ps.map((p) => `\`${p.name}\``).join(", ") : "なし");
const out = [];
out.push("# get-default-xaml とカタログの突き合わせ", "");
out.push(`カタログ: ${catalogs.map((c) => `${c.package} ${c.version}`).join(" / ")}`, "");
out.push("| アクティビティ | default に出た | うちカタログに無い | enum 外の値 | default に出ない | うち out | うち必須 |");
out.push("| --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) {
  if (r.missing) {
    out.push(`| ${r.className} | ${r.shown.length} | **カタログに型が無い** | | | | |`);
    continue;
  }
  const outs = r.hidden.filter((p) => p.kind === "out" || p.kind === "inout");
  out.push(`| ${r.className} | ${r.shown.length} | ${r.notInCatalog.length} | ${r.badEnum.length} | ${r.hidden.length} | ${outs.length} | ${r.requiredUnset.length} |`);
}
out.push("");
for (const r of rows.filter((r) => !r.missing)) {
  out.push(`## ${r.className}`, "");
  out.push(`- default に出たもの: ${r.shown.map((s) => `\`${s.name}=${s.value}\``).join(", ") || "なし"}`);
  out.push(`- カタログに無いもの: ${fmt(r.notInCatalog)}`);
  if (r.badEnum.length) out.push(`- enum 外の値: ${r.badEnum.map((s) => `\`${s.name}=${s.value}\``).join(", ")}`);
  out.push(`- default に出ない out/inout: ${fmt(r.hidden.filter((p) => p.kind === "out" || p.kind === "inout"))}`);
  out.push(`- default に出ない必須: ${fmt(r.requiredUnset)}`);
  out.push("");
}
console.log(out.join("\n"));

// ---- 生成した XAML と既定 XAML の比較 ----
function compareGenerated(args) {
  const ai = args.indexOf("--activity");
  const only = ai >= 0 ? args[ai + 1] : undefined;
  const inputs = args.filter((a, i) => !a.startsWith("--") && !(ai >= 0 && i === ai + 1));
  const files = [];
  const walk = (p) => statSync(p).isDirectory() ? readdirSync(p).forEach((e) => walk(join(p, e))) : p.endsWith(".xaml") && files.push(p);
  inputs.forEach(walk);

  // 既定 XAML: ClassName -> { uri, typeArgs, attrs: Map, elems: Set }
  const defaults = new Map();
  for (const f of readdirSync("knowledge/default-xaml").filter((f) => f.endsWith(".json"))) {
    const res = JSON.parse(readFileSync(join("knowledge/default-xaml", f), "utf8").replace(/^\uFEFF/, ""));
    if (res.Result !== "Success") continue;
    const x = res.Data.message;
    const ns = nsMap(x);
    const m = x.match(/<Activity\b[^>]*>\s*<(?:(\w+):)?(\w+)\b([^>]*?)(\/?)>/);
    if (!m) continue;
    const [, prefix, cls, attrText] = m;
    const tag = prefix ? `${prefix}:${cls}` : cls;
    defaults.set(cls, {
      file: f, uri: ns.get(prefix ?? ""), typeArgs: /x:TypeArguments=/.test(attrText),
      attrs: new Map([...attrText.matchAll(/([\w.]+)="([^"]*)"/g)].filter(([, k]) => !k.includes(":")).map(([, k, v]) => [k, v])),
      elems: new Set([...x.matchAll(new RegExp(`<${tag}\.(\w+)>`, "g"))].map(([, k]) => k)),
    });
  }

  const issues = [];
  let compared = 0;
  for (const f of files) {
    const x = readFileSync(f, "utf8");
    const ns = nsMap(x);
    for (const m of x.matchAll(/<(?:(\w+):)?(\w+)\b((?:\s+[\w:.]+="[^"]*")*)\s*(\/?)>/g)) {
      const [, prefix, cls, attrText] = m;
      const d = defaults.get(cls);
      if (!d || (only && cls !== only)) continue;
      compared++;
      const at = `${f.replaceAll("\\", "/")} の ${cls}`;
      const uri = ns.get(prefix ?? "");
      if (uri !== d.uri) issues.push(`${at}: xmlns が違う（生成 ${uri} / 既定 ${d.uri}）`);
      const ta = /x:TypeArguments=/.test(attrText);
      if (ta !== d.typeArgs) issues.push(`${at}: x:TypeArguments が${ta ? "付いている" : "無い"}（既定は${d.typeArgs ? "付く" : "付かない"}）`);
      const attrs = new Map([...attrText.matchAll(/([\w.]+)="([^"]*)"/g)].filter(([, k]) => !k.includes(":")).map(([, k, v]) => [k, v]));
      const tag = prefix ? `${prefix}:${cls}` : cls;
      // この要素の中身（同じタグの入れ子は考えない。最初の閉じタグまで）
      const start = m.index + m[0].length;
      const end = m[4] ? start : x.indexOf(`</${tag}>`, start);
      const inner = end > start ? x.slice(start, end) : "";
      const elems = new Set([...inner.matchAll(new RegExp(`<${tag}\.(\w+)>`, "g"))].map(([, k]) => k));
      for (const k of attrs.keys()) if (d.elems.has(k)) issues.push(`${at}: ${k} を属性で書いている（既定は要素）`);
      for (const k of elems) if (d.attrs.has(k) && !d.elems.has(k)) issues.push(`${at}: ${k} を要素で書いている（既定は属性）`);
      for (const [k, v] of d.attrs) {
        if (v === "{x:Null}" || k === "DisplayName" || k === "IsDisplayNameAuto") continue;
        if (!attrs.has(k) && !elems.has(k)) issues.push(`${at}: 既定 XAML の ${k}="${v}" が無い`);
      }
    }
  }
  console.log(`比べたアクティビティ: ${compared} 個（既定 XAML ${defaults.size} 種類）`);
  for (const i of issues) console.log(`  ${i}`);
  if (only && !defaults.has(only)) console.log(`  knowledge/default-xaml/${only}.json が無い（get-default-xaml で取る）`);
  if (issues.length || (only && !compared)) process.exitCode = 1;
}

function nsMap(x) {
  return new Map([...x.matchAll(/xmlns(?::(\w+))?="([^"]*)"/g)].map(([, p, u]) => [p ?? "", u]));
}
