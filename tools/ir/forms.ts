// Studio のフォーム（UiPath.Form.Activities の Show Form などが表示するもの）のファイルを検査する。AUT-1209、knowledge/forms.md。
//
// フォームのファイルは生成しない。.uiform は Studio のフォーム デザイナーが書くのと同じ JSON で、AI が直接書く（IR と同じく正本）。
// ワークフローの IR からは FormId（ファイルの Metadata.Id の GUID）で指す。build がプロジェクトの中を探して
// .local/content/FormsRuntime.json（IdMap：FormId → プロジェクトからの相対パス）を作り、実行時はそれで探す。
//
//   .uiform：{ "Metadata": { "Id", "Kind": "FormIo" }, "DesignProperties": { "Title", "Width", ... }, "Data": { form.io のフォーム } }
//   .html  ：先頭の <!-- form { "Metadata": { "Id", "DisplayName", "Kind": "Html" } } --> のコメント。値は uiPathApi.getValue / setValue
//
// 使い方：
//   node tools/ir/forms.ts check --project <P> [<ir.json>...]   フォームのファイルを検査し、IR の FormId がプロジェクトにあるかを見る
//   node tools/ir/forms.ts list --project <P>                    FormId、種類、パス、部品の key とイベント名の一覧

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Node, Workflow } from "./types.ts";

export type FormIssue = { file: string; code: string; message: string };
export type FormInfo = { file: string; id: string; kind: "FormIo" | "Html"; keys: string[]; events: string[] };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// form.io の部品のうち、値を持たない（キーで読み書きしない）もの
const LAYOUT = new Set(["columns", "panel", "table", "tabs", "fieldset", "well", "content", "htmlelement"]);
// 子を持つ部品（form.io の components / columns[].components / rows[][].components）
const CHILD_KEYS = ["components", "columns", "rows"];
// Studio の FormIoComponentTypes（UiPath.Studio.Forms.Runtime）にある部品の種類
export const KNOWN_TYPES = new Set([
  "button", "checkbox", "number", "password", "radio", "select", "label", "textarea", "textfield", "datagrid", "datatable", "day", "time",
  "datetime", "selectboxes", "survey", "datamap", "currency", "url", "email", "phoneNumber", "htmlelement", "content", "columns", "panel",
  "table", "tabs", "hidden", "container", "editgrid", "filePath", "fieldset", "well",
]);
// ウィンドウとメッセージのイベント（FormEvents の既定。部品のイベントは <key>.click / <key>.changed）
export const WINDOW_EVENTS = ["window.closed", "window.got_focus", "window.lost_focus", "window.state_changed", "form.message"];

const readText = (f: string) => readFileSync(f, "utf8").replace(/^﻿/, "");

// HTML のフォームの先頭の <!-- form ... --> から Metadata を読む
export function htmlHeader(text: string): unknown {
  const m = /<!--\s*form\b([\s\S]*?)-->/.exec(text);
  if (!m) return undefined;
  return JSON.parse(m[1]);
}

type Comp = { type?: unknown; key?: unknown; action?: unknown; input?: unknown; [k: string]: unknown };

function walk(c: unknown, out: Comp[]) {
  if (Array.isArray(c)) { for (const x of c) walk(x, out); return; }
  if (!c || typeof c !== "object") return;
  const o = c as Comp;
  if (typeof o.type === "string") out.push(o);
  for (const k of CHILD_KEYS) if (k in o) walk(o[k], out);
}

// .uiform の中身を検査する。返すのは問題と、部品の key・イベント名
export function checkUiForm(file: string, j: unknown): { issues: FormIssue[]; info?: FormInfo } {
  const issues: FormIssue[] = [];
  const add = (code: string, message: string) => issues.push({ file, code, message });
  if (!j || typeof j !== "object" || Array.isArray(j)) { add("FORM_BAD_JSON", ".uiform は JSON のオブジェクトにする（Metadata / DesignProperties / Data）"); return { issues }; }
  const o = j as Record<string, unknown>;
  const md = o.Metadata as Record<string, unknown> | undefined;
  if (!md || typeof md !== "object") { add("FORM_NO_METADATA", "Metadata が無い（{ \"Id\": GUID, \"Kind\": \"FormIo\" }）。build が FormId を見つけられない"); return { issues }; }
  const id = md.Id;
  if (typeof id !== "string" || !GUID.test(id)) add("FORM_BAD_ID", `Metadata.Id は GUID の文字列にする（いま ${JSON.stringify(id)}）`);
  if (md.Kind !== "FormIo") add("FORM_BAD_KIND", `.uiform の Metadata.Kind は "FormIo"（いま ${JSON.stringify(md.Kind)}）`);
  const data = o.Data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object" || !Array.isArray(data.components)) {
    add("FORM_NO_COMPONENTS", "Data は form.io のフォーム（{ \"display\": \"form\", \"components\": [...] }）にする。components が無いと何も出ない");
    return { issues };
  }
  const comps: Comp[] = [];
  walk(data.components, comps);
  const keys: string[] = [];
  const events: string[] = [];
  const seen = new Set<string>();
  for (const c of comps) {
    const t = c.type as string;
    if (!KNOWN_TYPES.has(t)) add("FORM_UNKNOWN_TYPE", `部品の type "${t}" は Studio のフォームの部品に無い（knowledge/forms.md の一覧）`);
    if (LAYOUT.has(t)) continue;
    if (typeof c.key !== "string" || !c.key) { add("FORM_NO_KEY", `type "${t}" の部品に key が無い。Get / Set Form Values と Show Form の Arguments は key で指す`); continue; }
    if (seen.has(c.key)) add("FORM_DUP_KEY", `部品の key "${c.key}" が重なっている。値の読み書きがどちらに行くか決まらない`);
    seen.add(c.key);
    if (t === "button") {
      // action:"event" のボタンは customEvent を出す（<key>.click のトリガー）。"submit" はフォームを送信して閉じる
      if (c.action !== undefined && c.action !== "event" && c.action !== "submit" && c.action !== "reset")
        add("FORM_BUTTON_ACTION", `ボタン "${c.key}" の action "${String(c.action)}" は使わない（"submit" か "event"）`);
      events.push(`${c.key}.click`);
      continue;
    }
    keys.push(c.key);
    events.push(`${c.key}.changed`);
  }
  return { issues, info: typeof id === "string" ? { file, id, kind: "FormIo", keys, events: [...WINDOW_EVENTS.filter((e) => e !== "form.message"), ...events] } : undefined };
}

export function checkHtmlForm(file: string, text: string): { issues: FormIssue[]; info?: FormInfo } {
  const issues: FormIssue[] = [];
  const add = (code: string, message: string) => issues.push({ file, code, message });
  let h: unknown;
  try { h = htmlHeader(text); } catch (e) { add("FORM_BAD_JSON", `先頭の <!-- form ... --> の JSON が読めない（${(e as Error).message}）`); return { issues }; }
  if (h === undefined) return { issues }; // フォームではない HTML
  const md = (h as { Metadata?: Record<string, unknown> }).Metadata;
  if (!md) { add("FORM_NO_METADATA", "<!-- form --> に Metadata が無い"); return { issues }; }
  if (typeof md.Id !== "string" || !GUID.test(md.Id)) add("FORM_BAD_ID", `Metadata.Id は GUID の文字列にする（いま ${JSON.stringify(md.Id)}）`);
  if (md.Kind !== "Html") add("FORM_BAD_KIND", `HTML のフォームの Metadata.Kind は "Html"（いま ${JSON.stringify(md.Kind)}）`);
  if (!/uiPathApi/.test(text)) add("FORM_HTML_NO_API", "uiPathApi（getValue / setValue / sendMessage）が無い。Get / Set Form Values が値を読み書きできない");
  const keys = [...text.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
  return { issues, info: typeof md.Id === "string" ? { file, id: md.Id, kind: "Html", keys, events: [...WINDOW_EVENTS] } : undefined };
}

const SKIP_DIRS = new Set([".local", ".objects", ".settings", ".project", ".codedworkflows", ".entities", ".tmh", ".screenshots", "node_modules", ".git", "output"]);

function listFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(e)) listFiles(p, out); }
    else if (/\.(uiform|html?)$/i.test(e)) out.push(p);
  }
  return out;
}

// プロジェクトの中のフォームを全部読んで検査する（build と同じく、プロジェクトの中のどこに置いてもよい）
export function scanProject(projectDir: string): { forms: FormInfo[]; issues: FormIssue[] } {
  const forms: FormInfo[] = [];
  const issues: FormIssue[] = [];
  for (const f of listFiles(projectDir)) {
    const rel = relative(projectDir, f).replace(/\\/g, "/");
    const text = readText(f);
    let r: { issues: FormIssue[]; info?: FormInfo };
    if (/\.uiform$/i.test(f)) {
      try { r = checkUiForm(rel, JSON.parse(text)); } catch (e) { r = { issues: [{ file: rel, code: "FORM_BAD_JSON", message: `JSON として読めない（${(e as Error).message}）` }] }; }
    } else r = checkHtmlForm(rel, text);
    issues.push(...r.issues);
    if (r.info) forms.push(r.info);
  }
  const byId = new Map<string, string>();
  for (const f of forms) {
    const prev = byId.get(f.id.toLowerCase());
    if (prev) issues.push({ file: f.file, code: "FORM_DUP_ID", message: `Metadata.Id ${f.id} が ${prev} と同じ。ファイルを写したら Id を新しくする` });
    else byId.set(f.id.toLowerCase(), f.file);
  }
  return { forms, issues };
}

function nodes(list: Node[] | undefined, out: Node[]) {
  for (const n of list ?? []) {
    out.push(n);
    nodes(n.body, out); nodes(n.then, out); nodes(n.else, out);
    for (const v of Object.values(n.slots ?? {})) nodes(v, out);
    for (const v of Object.values(n.cases ?? {})) nodes(v, out);
    for (const c of n.catches ?? []) nodes(c.body, out);
  }
}

const FORM_ACTS = /^(ShowFormActivity|CloseFormActivity|HideFormActivity|BringFormToFrontActivity|ChangeFormPropertiesActivity|ExecuteScriptActivity|GetFormFieldsActivity|SetFormFieldsActivity|FormTriggerActivity)$/;

// IR の Form のアクティビティの FormId・Arguments の key・トリガーの Event を、プロジェクトのフォームと突き合わせる
export function checkWorkflowRefs(wf: Workflow, irFile: string, forms: FormInfo[]): FormIssue[] {
  const issues: FormIssue[] = [];
  const all: Node[] = [];
  nodes(wf.body, all);
  for (const n of all) {
    const act = n.act.slice(n.act.lastIndexOf(".") + 1);
    if (!FORM_ACTS.test(act)) continue;
    const id = n.props?.FormId;
    if (typeof id !== "string") { issues.push({ file: irFile, code: "FORM_ID_MISSING", message: `${act} に FormId（フォームの Metadata.Id）が無い` }); continue; }
    const f = forms.find((x) => x.id.toLowerCase() === id.toLowerCase());
    if (!f) { issues.push({ file: irFile, code: "FORM_ID_NOT_FOUND", message: `${act} の FormId ${id} のフォームがプロジェクトに無い（実行時に NoMapEntry で落ちる）` }); continue; }
    for (const a of n.dicts?.Arguments ?? []) {
      const key = a.name.replace(/\.Items$/, "");
      if (f.kind === "FormIo" && !f.keys.includes(key))
        issues.push({ file: irFile, code: "FORM_KEY_NOT_FOUND", message: `${act} の Arguments の "${a.name}" は ${f.file} の部品の key に無い（${f.keys.join(", ")}）` });
    }
    const ev = n.props?.Event;
    if (act === "FormTriggerActivity" && typeof ev === "string" && !f.events.includes(ev))
      issues.push({ file: irFile, code: "FORM_EVENT_NOT_FOUND", message: `FormTriggerActivity の Event "${ev}" は ${f.file} に無い（${f.events.join(", ")}）` });
  }
  return issues;
}

function main(argv: string[]) {
  const cmd = argv[0];
  const pi = argv.indexOf("--project");
  const project = pi >= 0 ? argv[pi + 1] : undefined;
  if (!cmd || !["check", "list"].includes(cmd) || !project) {
    console.error("使い方: node tools/ir/forms.ts check --project <P> [<ir.json>...] | list --project <P>");
    process.exit(2);
  }
  if (!existsSync(project)) { console.error(`${project} が無い`); process.exit(2); }
  const { forms, issues } = scanProject(project);
  if (cmd === "list") {
    for (const f of forms) console.log(`${f.id}  ${f.kind.padEnd(6)}  ${f.file}\n  key: ${f.keys.join(", ") || "(なし)"}\n  イベント: ${f.events.join(", ")}`);
    if (!forms.length) console.log("フォームが無い");
  }
  const irs = argv.slice(1).filter((a, i, all) => a !== "--project" && all[i - 1] !== "--project");
  for (const f of irs) issues.push(...checkWorkflowRefs(JSON.parse(readText(f)) as Workflow, f, forms));
  for (const i of issues) console.log(`NG ${i.file}  ${i.code}  ${i.message}`);
  if (cmd === "check") console.log(issues.length ? `NG ${issues.length} 件` : `OK フォーム ${forms.length} 個${irs.length ? `、IR ${irs.length} 個` : ""}`);
  process.exit(issues.length ? 1 : 0);
}

if (process.argv[1] && /forms\.ts$/.test(process.argv[1])) main(process.argv.slice(2));
