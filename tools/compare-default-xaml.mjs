// get-default-xaml の出力（knowledge/default-xaml/*.json）とカタログを突き合わせ、Markdown で結果を出す。
//
// 使い方: node tools/compare-default-xaml.mjs catalog/a.json catalog/b.json > knowledge/default-xaml-compare.md

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const catalogs = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, "utf8")));
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
