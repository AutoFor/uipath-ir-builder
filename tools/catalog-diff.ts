// カタログの版どうしの差分と、差分がサンプル・対応表に与える影響を出す。
//
//   node tools/catalog-diff.ts UiPath.System.Activities 26.2.6 26.10.0                 … 差分（Markdown）
//   node tools/catalog-diff.ts UiPath.System.Activities 26.2.6 26.10.0 --impact        … 影響判定も付ける
//   node tools/catalog-diff.ts catalog/X/a.json catalog/X/b.json --impact --out out.md  … ファイルを直接渡す
//   オプション: --json（JSON で出す）、--out <ファイル>、--threshold <N>（抽出器の違いと見なす「同名プロパティが増えたアクティビティ数」、既定 10）、
//               --fail-on-error（影響判定で error があれば終了コード 1）
//
// 差分は2つに分ける。
//   real    … 版で本当に変わったと見てよいもの
//   suspect … 抽出器の違いかもしれないもの。古いカタログは今の抽出器で作り直していない（DLL が手元に無い）ので、
//             readOnly / Result / Description のように「古い版に載っていないだけ」のものが混ざる。判定は理由つきで出す
// 判定のルール（suspect にするもの）:
//   - 増えたプロパティが out の Result
//   - 同じ名前・種類のプロパティが threshold 個以上のアクティビティで一斉に増えた（基底クラスの扱いの違い）
//   - overloadGroups が「なし → [自分の名前]」になった / default が「なし ⇄ あり」になった
//   - kind が prop ⇄ in/out になった
//   - browsable が変わり、同時に declaredOn も変わった（継承メンバーの見え方の違い）
//   - readOnly は古い版に項目が無いので比べない（件数だけ出す）
// Coded API（services）は、両方の版に services があるときだけ比べる。古いカタログには無いので、その場合は「比較できない」と出す。

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type CProp = {
  name: string; kind: string; type: string; required: boolean; enum?: string[]; overloadGroups?: string[];
  obsolete: boolean; browsable?: boolean; declaredOn?: string; default?: string; readOnly?: boolean;
};
export type CAct = { className: string; clrType: string; obsolete: boolean; browsable: boolean; props: CProp[] };
export type CMethod = { name: string; returns: string; params: { name: string; type: string }[]; obsolete: boolean };
export type CService = { name: string; methods: CMethod[] };
export type CCatalog = { package: string; version: string; activities: CAct[]; services?: CService[] };

export type ChangeKind =
  | "propAdded" | "propRemoved" | "typeChanged" | "kindChanged" | "requiredChanged" | "enumAdded" | "enumRemoved"
  | "obsoleteChanged" | "browsableChanged" | "overloadChanged" | "defaultChanged" | "activityObsolete" | "activityBrowsable";
export type Change = {
  kind: ChangeKind; clrType: string; className: string; prop?: string;
  from?: string; to?: string; values?: string[];
  grade: "real" | "suspect"; why?: string;
};
export type MethodChange = { service: string; method: string; kind: "added" | "removed" | "signature"; from?: string; to?: string };
export type Diff = {
  package: string; from: string; to: string;
  added: { className: string; clrType: string; props: number }[];
  removed: { className: string; clrType: string }[];
  changes: Change[];
  ignored: { readOnly: number; declaredOn: number };
  services: { comparable: boolean; reason?: string; changes: MethodChange[] };
  oldAct: Map<string, CAct>; newAct: Map<string, CAct>;
  oldSvc: Map<string, CService>; newSvc: Map<string, CService>;
};

const j = (v: unknown) => (v === undefined ? "なし" : JSON.stringify(v));
const sig = (m: CMethod) => `(${m.params.map((p) => `${p.type} ${p.name}`).join(", ")}) -> ${m.returns}`;

export function diffCatalogs(a: CCatalog, b: CCatalog, threshold = 10): Diff {
  const oldAct = new Map(a.activities.map((x) => [x.clrType, x]));
  const newAct = new Map(b.activities.map((x) => [x.clrType, x]));
  const added = [...newAct.values()].filter((x) => !oldAct.has(x.clrType)).map((x) => ({ className: x.className, clrType: x.clrType, props: x.props.length }));
  const removed = [...oldAct.values()].filter((x) => !newAct.has(x.clrType)).map((x) => ({ className: x.className, clrType: x.clrType }));
  const changes: Change[] = [];
  const ignored = { readOnly: 0, declaredOn: 0 };
  const push = (c: Change) => changes.push(c);

  for (const [clr, y] of newAct) {
    const x = oldAct.get(clr);
    if (!x) continue;
    const base = { clrType: clr, className: y.className };
    if (x.obsolete !== y.obsolete) push({ ...base, kind: "activityObsolete", from: String(x.obsolete), to: String(y.obsolete), grade: "real" });
    if (x.browsable !== y.browsable) push({ ...base, kind: "activityBrowsable", from: String(x.browsable), to: String(y.browsable), grade: "real" });
    const px = new Map(x.props.map((p) => [p.name, p]));
    const py = new Map(y.props.map((p) => [p.name, p]));
    for (const [n, p] of py) {
      if (p.readOnly) ignored.readOnly++;
      const q = px.get(n);
      if (!q) {
        const isResult = n === "Result" && p.kind === "out";
        push({ ...base, kind: "propAdded", prop: n, to: `${p.kind} ${p.type}${p.required ? " 必須" : ""}`, grade: isResult ? "suspect" : "real", why: isResult ? "out の Result は古い抽出器が拾っていない" : undefined });
        continue;
      }
      if (q.type !== p.type) push({ ...base, kind: "typeChanged", prop: n, from: q.type, to: p.type, grade: "real" });
      if (q.kind !== p.kind) {
        const flip = q.kind === "prop" || p.kind === "prop";
        push({ ...base, kind: "kindChanged", prop: n, from: q.kind, to: p.kind, grade: flip ? "suspect" : "real", why: flip ? "prop ⇄ in/out は抽出器の判定の違いかもしれない" : undefined });
      }
      if (q.required !== p.required) push({ ...base, kind: "requiredChanged", prop: n, from: String(q.required), to: String(p.required), grade: "real" });
      if (q.obsolete !== p.obsolete) push({ ...base, kind: "obsoleteChanged", prop: n, from: String(q.obsolete), to: String(p.obsolete), grade: "real" });
      const decl = q.declaredOn !== p.declaredOn;
      if (decl) ignored.declaredOn++;
      if (q.browsable !== p.browsable) push({ ...base, kind: "browsableChanged", prop: n, from: String(q.browsable), to: String(p.browsable), grade: decl ? "suspect" : "real", why: decl ? "declaredOn も変わっている（継承メンバーの見え方の違い）" : undefined });
      const oe = q.enum ?? [], ne = p.enum ?? [];
      const ea = ne.filter((v) => !oe.includes(v)), er = oe.filter((v) => !ne.includes(v));
      if (q.enum && p.enum) {
        if (ea.length) push({ ...base, kind: "enumAdded", prop: n, values: ea, grade: "real" });
        if (er.length) push({ ...base, kind: "enumRemoved", prop: n, values: er, grade: "real" });
      }
      if (j(q.overloadGroups) !== j(p.overloadGroups)) {
        const selfOnly = !q.overloadGroups && p.overloadGroups?.length === 1 && p.overloadGroups[0] === n;
        push({ ...base, kind: "overloadChanged", prop: n, from: j(q.overloadGroups), to: j(p.overloadGroups), grade: selfOnly ? "suspect" : "real", why: selfOnly ? "古い抽出器が overloadGroups を出していない" : undefined });
      }
      if (q.default !== p.default) {
        const oneSided = q.default === undefined || p.default === undefined;
        push({ ...base, kind: "defaultChanged", prop: n, from: j(q.default), to: j(p.default), grade: oneSided ? "suspect" : "real", why: oneSided ? "default の有無は抽出器の違いかもしれない" : undefined });
      }
    }
    for (const [n] of px) if (!py.has(n)) push({ ...base, kind: "propRemoved", prop: n, grade: "real" });
  }

  // 一斉に増えたプロパティは基底クラスの扱いの違い
  const addCount = new Map<string, number>();
  for (const c of changes) if (c.kind === "propAdded") addCount.set(`${c.prop}|${(c.to ?? "").split(" ")[0]}`, (addCount.get(`${c.prop}|${(c.to ?? "").split(" ")[0]}`) ?? 0) + 1);
  for (const c of changes)
    if (c.kind === "propAdded" && c.grade === "real" && (addCount.get(`${c.prop}|${(c.to ?? "").split(" ")[0]}`) ?? 0) >= threshold) {
      c.grade = "suspect";
      c.why = `同じプロパティが ${addCount.get(`${c.prop}|${(c.to ?? "").split(" ")[0]}`)} 個のアクティビティで一斉に増えた（基底クラスの扱いの違い）`;
    }

  // Coded API
  const oldSvc = new Map((a.services ?? []).map((s) => [s.name, s]));
  const newSvc = new Map((b.services ?? []).map((s) => [s.name, s]));
  const services: Diff["services"] = { comparable: !!a.services && !!b.services, changes: [] };
  if (!services.comparable)
    services.reason = !a.services && !b.services ? "両方の版に services が無い" : !a.services ? `${a.version} のカタログに services が無い（Coded API の抽出より前に作ったカタログ）。${b.version} には ${newSvc.size} サービスある` : `${b.version} のカタログに services が無い`;
  else {
    for (const name of new Set([...oldSvc.keys(), ...newSvc.keys()])) {
      const os = oldSvc.get(name), ns = newSvc.get(name);
      const om = new Map<string, CMethod[]>(), nm = new Map<string, CMethod[]>();
      for (const m of os?.methods ?? []) om.set(m.name, [...(om.get(m.name) ?? []), m]);
      for (const m of ns?.methods ?? []) nm.set(m.name, [...(nm.get(m.name) ?? []), m]);
      for (const mn of new Set([...om.keys(), ...nm.keys()])) {
        const o = om.get(mn), n = nm.get(mn);
        if (!o) services.changes.push({ service: name, method: mn, kind: "added", to: n!.map(sig).join(" | ") });
        else if (!n) services.changes.push({ service: name, method: mn, kind: "removed", from: o.map(sig).join(" | ") });
        else {
          const os2 = o.map(sig).sort(), ns2 = n.map(sig).sort();
          if (os2.join("|") !== ns2.join("|")) services.changes.push({ service: name, method: mn, kind: "signature", from: os2.join(" | "), to: ns2.join(" | ") });
        }
      }
    }
  }
  return { package: b.package, from: a.version, to: b.version, added, removed, changes, ignored, services, oldAct, newAct, oldSvc, newSvc };
}

// ---------------------------------------------------------------- 影響判定

export type Severity = "error" | "warn" | "info";
export type Finding = { severity: Severity; file: string; activity: string; prop?: string; reason: string };
export type Usage = { file: string; kind: "sample" | "mapping"; act: string; props: Record<string, unknown>; calls?: string[]; callArgs?: Record<string, string[]> };

const SERVICE_VARS: Record<string, string> = { system: "ISystemService", uiAutomation: "IUiAutomationAppService" };

// IR のサンプルから、アクティビティの使い方（act と、書いているプロパティ・値）を集める
export function collectSampleUsage(file: string, wf: unknown): Usage[] {
  const out: Usage[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.act === "string") {
      const props: Record<string, unknown> = { ...((o.props as Record<string, unknown>) ?? {}) };
      for (const k of ["dicts", "lists", "objs"]) for (const n of Object.keys((o[k] as object) ?? {})) props[n] = props[n] ?? null;
      if (o.args) props.Arguments = props.Arguments ?? null;
      if (o.assigns) props.Assigns = null;
      if (o.catches) props.Catches = null;
      out.push({ file, kind: "sample", act: o.act, props });
    }
    for (const x of Object.values(o)) walk(x);
  };
  walk(wf);
  return out;
}

// 対応表から、参照しているプロパティと呼ぶ API を集める
export function collectMappingUsage(file: string, m: Record<string, unknown>): Usage | undefined {
  if (typeof m.activity !== "string") return undefined;
  const props: Record<string, unknown> = {};
  const calls: string[] = [];
  const callArgs: Record<string, string[]> = {};
  const refs = (s: string) => { for (const r of s.matchAll(/\{([A-Za-z_]\w*)(?::[^}]*)?\}/g)) props[r[1]] = null; };
  for (const e of (Array.isArray(m.coded) ? m.coded : []) as Record<string, unknown>[]) {
    for (const w of (e.when as string[]) ?? []) props[w.split("=")[0]] = null;
    if (typeof e.code === "string") refs(e.code);
    if (typeof e.call === "string") { calls.push(e.call); callArgs[e.call] = [...(callArgs[e.call] ?? []), ...Object.keys((e.args as object) ?? {})]; refs(e.call); }
    for (const v of Object.values((e.args as Record<string, string>) ?? {})) if (typeof v === "string") refs(v);
    if (typeof e.returns === "string") props[e.returns] = null;
  }
  return { file, kind: "mapping", act: m.activity, props, calls, callArgs };
}

function walkJson(dir: string, pred: (f: string) => boolean, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkJson(p, pred, acc);
    else if (pred(e.name)) acc.push(p);
  }
  return acc;
}

export function loadUsages(root: string): Usage[] {
  const us: Usage[] = [];
  const rel = (p: string) => p.slice(root.length + 1).replace(/\\/g, "/");
  for (const f of walkJson(join(root, "samples", "ir"), (n) => n.endsWith(".json") && !n.endsWith(".verify.json"))) {
    const wf = JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""));
    if (wf && typeof wf === "object" && "workflow" in wf) us.push(...collectSampleUsage(rel(f), wf));
  }
  for (const f of walkJson(join(root, "mappings"), (n) => n.endsWith(".json"))) {
    const u = collectMappingUsage(rel(f), JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")));
    if (u) us.push(u);
  }
  return us;
}

const litValue = (v: unknown): string | undefined => (typeof v === "string" ? v : v && typeof v === "object" && "lit" in v ? String((v as { lit: unknown }).lit) : typeof v === "boolean" || typeof v === "number" ? String(v) : undefined);

// 古い版 → 新しい版へ上げたとき、サンプルと対応表のどれが影響を受けるか
export function assessImpact(d: Diff, usages: Usage[]): Finding[] {
  const out: Finding[] = [];
  const byName = new Map<string, string[]>(); // className / clrType → clrType（新旧どちらかにあるもの）
  for (const m of [d.oldAct, d.newAct]) for (const a of m.values()) for (const k of [a.className, a.clrType]) byName.set(k, [...new Set([...(byName.get(k) ?? []), a.clrType])]);
  const add = (severity: Severity, u: Usage, activity: string, reason: string, prop?: string) => out.push({ severity, file: u.file, activity, prop, reason });
  const changesBy = new Map<string, Change[]>();
  for (const c of d.changes) changesBy.set(c.clrType, [...(changesBy.get(c.clrType) ?? []), c]);
  const removedSet = new Set(d.removed.map((r) => r.clrType));

  for (const u of usages) {
    const clrs = byName.get(u.act) ?? [];
    const names = new Set(Object.keys(u.props));
    for (const clr of clrs) {
      const cn = (d.newAct.get(clr) ?? d.oldAct.get(clr))!.className;
      if (removedSet.has(clr)) { add("error", u, cn, `${d.to} にアクティビティが無い（${d.from} にはあった）`); continue; }
      for (const c of changesBy.get(clr) ?? []) {
        const sev = (s: Severity): Severity => (c.grade === "suspect" ? "info" : s);
        const sfx = c.grade === "suspect" ? `（抽出器の違いかもしれない：${c.why}）` : "";
        const used = c.prop ? names.has(c.prop) : true;
        switch (c.kind) {
          case "propRemoved": if (used) add("error", u, cn, `プロパティが消えた`, c.prop); break;
          case "typeChanged": if (used) add("warn", u, cn, `型が変わった ${c.from} → ${c.to}`, c.prop); break;
          case "kindChanged": if (used) add(sev("warn"), u, cn, `種類が変わった ${c.from} → ${c.to}${sfx}`, c.prop); break;
          case "obsoleteChanged": if (used && c.to === "true") add("warn", u, cn, "obsolete になった", c.prop); break;
          case "browsableChanged": if (used && c.to === "false") add(sev("warn"), u, cn, `browsable=false になった${sfx}`, c.prop); break;
          case "activityObsolete": if (c.to === "true") add("warn", u, cn, "アクティビティが obsolete になった"); break;
          case "activityBrowsable": if (c.to === "false") add("warn", u, cn, "アクティビティが browsable=false になった"); break;
          case "enumRemoved": {
            if (u.kind !== "sample") break;
            const v = litValue(u.props[c.prop!]);
            if (v !== undefined && c.values!.includes(v)) add("error", u, cn, `使っている値 ${v} が enum から消えた`, c.prop);
            break;
          }
          default: break;
        }
      }
      // 新しく必須になった / 必須で増えたプロパティを、サンプルが書いているか。同じ overloadGroups の別プロパティがあれば書いたことにする
      if (u.kind === "sample") {
        const act = d.newAct.get(clr);
        const cs = (changesBy.get(clr) ?? []).filter((c) => c.grade === "real" && ((c.kind === "requiredChanged" && c.to === "true") || (c.kind === "propAdded" && c.to?.endsWith("必須"))));
        for (const c of cs) {
          const p = act?.props.find((q) => q.name === c.prop);
          // overloadGroups を持つ必須プロパティは「どれか1つ」でよい（Path / FileResource のような別の書き方）
          const alt = (p?.overloadGroups ?? []).length > 0;
          const covered = names.has(c.prop!) || (alt && act!.props.some((q) => q.required && (q.overloadGroups ?? []).length > 0 && names.has(q.name)));
          if (!covered) add("warn", u, cn, c.kind === "propAdded" ? "必須のプロパティが増えたが、サンプルが書いていない" : "新しく必須になったが、サンプルが書いていない", c.prop);
        }
      }
    }
    if (u.kind === "mapping" && d.services.comparable) {
      for (const call of u.calls ?? []) {
        const [v, ...rest] = call.split(".");
        const svc = SERVICE_VARS[v];
        if (!svc || rest.length !== 1) continue;
        for (const mc of d.services.changes.filter((m) => m.service === svc && m.method === rest[0])) {
          if (mc.kind === "removed") add("error", u, u.act, `Coded API ${call} が消えた`);
          else if (mc.kind === "signature") add("warn", u, u.act, `Coded API ${call} の引数が変わった：${mc.from} → ${mc.to}`);
        }
      }
    }
  }
  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  const seen = new Set<string>();
  return out
    .filter((f) => { const k = JSON.stringify(f); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file) || a.activity.localeCompare(b.activity));
}

// ---------------------------------------------------------------- 出力

const KIND_LABEL: Record<ChangeKind, string> = {
  propAdded: "プロパティが増えた", propRemoved: "プロパティが消えた", typeChanged: "型が変わった", kindChanged: "種類（in / out / prop）が変わった",
  requiredChanged: "必須が変わった", enumAdded: "enum の値が増えた", enumRemoved: "enum の値が消えた", obsoleteChanged: "obsolete が変わった",
  browsableChanged: "browsable が変わった", overloadChanged: "overloadGroups が変わった", defaultChanged: "default が変わった",
  activityObsolete: "アクティビティの obsolete が変わった", activityBrowsable: "アクティビティの browsable が変わった",
};
const kindOrder: ChangeKind[] = ["propRemoved", "typeChanged", "requiredChanged", "enumRemoved", "enumAdded", "kindChanged", "obsoleteChanged", "activityObsolete", "browsableChanged", "activityBrowsable", "propAdded", "overloadChanged", "defaultChanged"];

const detail = (c: Change) =>
  c.values ? c.values.map((v) => `\`${v}\``).join(", ") : c.from !== undefined && c.to !== undefined ? `${c.from} → ${c.to}` : (c.to ?? c.from ?? "");

export function renderMarkdown(d: Diff, findings?: Finding[], usageCount?: { samples: number; mappings: number }): string {
  const L: string[] = [];
  const real = d.changes.filter((c) => c.grade === "real");
  const sus = d.changes.filter((c) => c.grade === "suspect");
  const n = (k: ChangeKind, cs = real) => cs.filter((c) => c.kind === k).length;
  L.push(`# カタログの差分：${d.package} ${d.from} → ${d.to}`, "");
  L.push("`node tools/catalog-diff.ts` が作った。「本当の差分」と「抽出器の違いかもしれないもの」を分けている。", "");
  L.push("## 要約", "", "| 項目 | 件数 |", "| --- | --- |");
  L.push(`| アクティビティが増えた | ${d.added.length} |`, `| アクティビティが消えた | ${d.removed.length} |`);
  for (const k of kindOrder) if (k !== "propAdded") L.push(`| ${KIND_LABEL[k]}（本当の差分） | ${n(k)} |`);
  L.push(`| ${KIND_LABEL.propAdded}（本当の差分） | ${n("propAdded")} |`);
  L.push(`| 抽出器の違いかもしれないもの | ${sus.length} |`, `| readOnly が付いたプロパティ（比べない） | ${d.ignored.readOnly} |`, "");

  L.push("## アクティビティの増減", "");
  if (d.added.length) { L.push("増えた：", ""); for (const a of d.added) L.push(`- \`${a.className}\`（${a.clrType}、プロパティ ${a.props} 個）`); L.push(""); } else L.push("増えたものはない。", "");
  if (d.removed.length) { L.push("消えた：", ""); for (const a of d.removed) L.push(`- \`${a.className}\`（${a.clrType}）`); L.push(""); } else L.push("消えたものはない。", "");

  for (const k of kindOrder) {
    const cs = real.filter((c) => c.kind === k);
    if (!cs.length) continue;
    L.push(`## ${KIND_LABEL[k]}（${cs.length}）`, "", "| アクティビティ | プロパティ | 内容 |", "| --- | --- | --- |");
    for (const c of cs.sort((a, b) => a.className.localeCompare(b.className) || (a.prop ?? "").localeCompare(b.prop ?? ""))) L.push(`| ${c.className} | ${c.prop ?? ""} | ${detail(c)} |`);
    L.push("");
  }

  if (sus.length) {
    L.push(`## 抽出器の違いかもしれないもの（${sus.length}）`, "", "古いカタログは今の抽出器で作り直していないので、版の差ではなく抽出の差かもしれない。理由ごとにまとめる。", "");
    const g = new Map<string, Change[]>();
    for (const c of sus) g.set(`${KIND_LABEL[c.kind]}：${c.why}`.replace(/[0-9]+ 個のアクティビティ/, "N 個のアクティビティ"), [...(g.get(`${KIND_LABEL[c.kind]}：${c.why}`.replace(/[0-9]+ 個のアクティビティ/, "N 個のアクティビティ")) ?? []), c]);
    for (const [why, cs] of g) {
      const names = [...new Set(cs.map((c) => (c.prop ? `${c.className}.${c.prop}` : c.className)))];
      L.push(`- **${why}**（${cs.length} 件）：${names.slice(0, 8).map((x) => `\`${x}\``).join(", ")}${names.length > 8 ? ` ほか ${names.length - 8} 件` : ""}`);
    }
    L.push("");
  }

  L.push("## Coded API（services）", "");
  if (!d.services.comparable) L.push(`比較できない：${d.services.reason}。`, "");
  else if (!d.services.changes.length) L.push("変わりなし。", "");
  else {
    L.push("| サービス | メソッド | 変更 | 内容 |", "| --- | --- | --- | --- |");
    for (const m of d.services.changes) L.push(`| ${m.service} | ${m.method} | ${{ added: "増えた", removed: "消えた", signature: "引数・戻り値が変わった" }[m.kind]} | ${m.from ? `${m.from} → ` : ""}${m.to ?? ""} |`);
    L.push("");
  }

  if (findings) {
    const c = (s: Severity) => findings.filter((f) => f.severity === s).length;
    L.push(`## 影響判定（${d.from} → ${d.to} に上げたとき）`, "");
    if (usageCount) L.push(`見たもの：サンプル（IR）のアクティビティ ${usageCount.samples} 個、対応表 ${usageCount.mappings} 個。`, "");
    L.push(`error ${c("error")} 件（直さないと build / 生成が落ちる）、warn ${c("warn")} 件（確かめる）、info ${c("info")} 件（抽出器の違いの可能性）。`, "");
    if (findings.length) {
      L.push("| 重さ | ファイル | アクティビティ | プロパティ | 内容 |", "| --- | --- | --- | --- | --- |");
      for (const f of findings) L.push(`| ${f.severity} | ${f.file} | ${f.activity} | ${f.prop ?? ""} | ${f.reason} |`);
      L.push("");
    } else L.push("影響を受けるサンプルと対応表は無い。", "");
  }
  return L.join("\n");
}

// ---------------------------------------------------------------- CLI

export function loadCatalogFile(root: string, spec: string): CCatalog {
  const f = existsSync(spec) ? spec : join(root, "catalog", spec + ".json");
  return JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""));
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const flag = (n: string) => args.includes(n);
  const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const optVals = new Set(["--out", "--threshold"].map((n) => opt(n)).filter(Boolean));
  const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && optVals.has(a)));
  let a: CCatalog, b: CCatalog;
  if (pos.length === 3) { a = loadCatalogFile(root, `${pos[0]}/${pos[1]}`); b = loadCatalogFile(root, `${pos[0]}/${pos[2]}`); }
  else if (pos.length === 2) { a = loadCatalogFile(root, pos[0]); b = loadCatalogFile(root, pos[1]); }
  else { console.error("使い方: node tools/catalog-diff.ts <パッケージ> <旧版> <新版> [--impact] [--json] [--out ファイル] [--threshold N] [--fail-on-error]"); process.exit(2); }
  const d = diffCatalogs(a, b, Number(opt("--threshold") ?? 10));
  let findings: Finding[] | undefined, uc: { samples: number; mappings: number } | undefined;
  if (flag("--impact")) {
    const us = loadUsages(root);
    findings = assessImpact(d, us);
    uc = { samples: us.filter((u) => u.kind === "sample").length, mappings: us.filter((u) => u.kind === "mapping").length };
  }
  const text = flag("--json")
    ? JSON.stringify({ package: d.package, from: d.from, to: d.to, added: d.added, removed: d.removed, changes: d.changes, ignored: d.ignored, services: d.services, findings }, null, 2)
    : renderMarkdown(d, findings, uc);
  if (opt("--out")) writeFileSync(opt("--out")!, text + "\n");
  else console.log(text);
  if (flag("--fail-on-error") && findings?.some((f) => f.severity === "error")) process.exit(1);
}

if (process.argv[1] && basename(process.argv[1]) === "catalog-diff.ts") main();
