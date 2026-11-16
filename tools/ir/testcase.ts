// テストケース（IR の "testCase"）。knowledge/testing.md の「テストケース」。
//
// - Given / When / Then を、その名前の Sequence 3 つの body に開く（XAML も Coded も同じ IR から作るため）
// - project.json の designOptions.fileInfoCollection に載せる・外す。Studio はここに載っているファイルをテストケースとして扱う
//   （XAML の中身はふつうのワークフローと同じ。Studio のテンプレート Test Automation Project の TestCase.xaml で確かめた）
// - データ駆動のテスト（testCase.data）は、行を .variations\<名前>.json に書き、そのテストケースの dataVariationFilePath にする。
//   形は UiPath.Testing.Activities の XBrowser Test Template（templates.json の DataVariationFilePath と
//   XBrowserTemplateDataVariation.json）と、Helm の UiPath.Project.dll の TestCaseFileInfo（DataVariationFilePath）で確かめた。
//   ファイルは行の配列で、キーはテストケースの In 引数の名前

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Workflow, Issue } from "./types.ts";

export const GWT = ["given", "when", "then"] as const;
const label = { given: "Given", when: "When", then: "Then" } as const;
// データ駆動のテストのファイルを置くフォルダ（UiPath.Project.dll の VariationsFolderName。Studio の Project パネルでは Test Data）
export const VARIATIONS_DIR = ".variations";

export type DataRow = Record<string, string | number | boolean | null>;
const testCaseOpts = (wf: Workflow) => (typeof wf.testCase === "object" ? wf.testCase : {});

// Given / When / Then を body に開く。テストケースでないのに書いた・body と一緒に書いたもの、testCase の誤りはエラー
export function expandTestCase(wf: Workflow): { wf: Workflow; issues: Issue[] } {
  const issues: Issue[] = [];
  const add = (path: string, message: string) => issues.push({ path, code: "TESTCASE", message });
  const used = GWT.filter((k) => wf[k] !== undefined);
  if (wf.testCase !== undefined && typeof wf.testCase !== "boolean") {
    const t = wf.testCase;
    if (t.status !== undefined && t.status !== "Publishable" && t.status !== "InProgress") add("testCase.status", `status "${t.status}" は Publishable か InProgress`);
    if (t.id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id)) add("testCase.id", `id "${t.id}" は GUID で書く`);
    if (t.data !== undefined) checkData(wf, t.data, add);
  }
  if (!used.length) return { wf, issues };
  if (!isTestCase(wf)) add(used[0], `${used.join(" / ")} はテストケース（"testCase": true）にだけ書ける`);
  if (wf.body?.length) add("body", "given / when / then と body は一緒に書けない（どちらかにする）");
  if (issues.length) return { wf, issues };
  const body = GWT.map((k) => ({ act: "Sequence", name: label[k], body: wf[k] ?? [] }));
  const { given: _g, when: _w, then: _t, ...rest } = wf;
  return { wf: { ...rest, body }, issues };
}

// データ駆動のテストの行：1 行以上、キーはテストケースの In 引数、値は文字列・数値・真偽値・null
function checkData(wf: Workflow, data: unknown, add: (path: string, message: string) => void) {
  if (!Array.isArray(data) || !data.length) { add("testCase.data", "data は行（オブジェクト）の配列で、1 行以上書く"); return; }
  const ins = new Set((wf.arguments ?? []).filter((a) => a.dir === "In").map((a) => a.name));
  data.forEach((row, i) => {
    const at = `testCase.data[${i}]`;
    if (!row || typeof row !== "object" || Array.isArray(row)) { add(at, "行はオブジェクト（{ \"引数名\": 値 }）で書く"); return; }
    const keys = Object.keys(row);
    if (!keys.length) add(at, "行に値が無い");
    for (const k of keys) {
      if (!ins.has(k)) add(`${at}.${k}`, `"${k}" はこのテストケースの In 引数に無い（行のキーは In 引数の名前。arguments に { "name": "${k}", "dir": "In", … } を書く）`);
      const v = (row as Record<string, unknown>)[k];
      if (v !== null && !["string", "number", "boolean"].includes(typeof v)) add(`${at}.${k}`, "値は文字列・数値・真偽値・null だけ（Studio のテストデータは基本の型だけ編集できる）");
    }
  });
}

export const isTestCase = (wf: Workflow) => wf.testCase !== undefined && wf.testCase !== false;

// Coded のテストケースへの注意。データ駆動のテストは project.json の fileInfoCollection でつなぐが、
// Coded のテストケースはそこに載せない（載せると uip rpa run が落ちる）ので、つなぐ所が無い。In 引数は Execute の引数になる
export function codedTestCaseIssues(wf: Workflow): Issue[] {
  return testCaseOpts(wf).data !== undefined
    ? [{ path: "testCase.data", code: "TESTCASE_NO_DATA", message: "データ駆動のテスト（data）は XAML のテストケースだけにつなぐ。Coded では使わない（In 引数は Execute の引数になる）" }]
    : [];
}

// project.json の置き場所。--project があればそれ、無ければ --out かその親（verify.mjs の coded/）
export function findProjectDir(outDir: string, project?: string): string | undefined {
  for (const d of [project, outDir, dirname(outDir)]) if (d && existsSync(join(d, "project.json"))) return d;
  return undefined;
}

export type TestCaseEntry = { fileName: string; wf: Workflow };
type FileInfo = { editingStatus?: string; testCaseId?: string; dataVariationFilePath?: string; fileName: string };

// テストケースのデータのファイル（プロジェクトからの相対パス、区切りは \）
export const variationPath = (fileName: string) => `${VARIATIONS_DIR}\\${basename(fileName.replace(/\\/g, "/"), extname(fileName))}.json`;

// fileInfoCollection を IR に合わせる。テストケースは載せ（testCaseId は IR、既存、新しい GUID の順）、テストケースでなくなったものは外す。
// data があれば .variations\<名前>.json に書いて dataVariationFilePath にし、無くなれば（この道具が付けた）dataVariationFilePath を外す。
// Studio で付けたほかのデータ（Excel など）の dataVariationFilePath は残す。
// fileName はプロジェクトからの相対パス（区切りは \）。変えたファイル名を返す
export function registerTestCases(projectDir: string, entries: TestCaseEntry[]): string[] {
  const file = join(projectDir, "project.json");
  const raw = readFileSync(file, "utf8");
  const bom = raw.startsWith("﻿") ? "﻿" : "";
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const pj = JSON.parse(raw.slice(bom.length));
  pj.designOptions ??= {};
  const list: FileInfo[] = (pj.designOptions.fileInfoCollection ??= []);
  const changed: string[] = [];
  let pjChanged = false;
  const same = (a: string, b: string) => a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();
  for (const { fileName, wf } of entries) {
    const name = fileName.replace(/\//g, "\\");
    const i = list.findIndex((e) => same(e.fileName, name));
    if (!isTestCase(wf)) {
      if (i >= 0) { list.splice(i, 1); changed.push(name); pjChanged = true; }
      continue;
    }
    const opt = testCaseOpts(wf);
    const ours = variationPath(name);
    const prev = i >= 0 ? list[i] : undefined;
    const next: FileInfo = { ...prev, editingStatus: opt.status ?? "Publishable", testCaseId: opt.id ?? (prev?.testCaseId || randomUUID()), fileName: name };
    let dataChanged = false;
    if (opt.data !== undefined) {
      next.dataVariationFilePath = ours;
      const text = JSON.stringify(opt.data, null, 2).replace(/\n/g, eol) + eol;
      const vf = join(projectDir, ...ours.split("\\"));
      if (!existsSync(vf) || readFileSync(vf, "utf8") !== text) { mkdirSync(dirname(vf), { recursive: true }); writeFileSync(vf, text, "utf8"); dataChanged = true; }
    } else if (prev?.dataVariationFilePath && same(prev.dataVariationFilePath, ours)) delete next.dataVariationFilePath;
    const entryChanged = JSON.stringify(prev) !== JSON.stringify(next);
    if (entryChanged) {
      if (i >= 0) list[i] = next; else list.push(next);
      pjChanged = true;
    }
    if (entryChanged || dataChanged) changed.push(name);
  }
  if (pjChanged) writeFileSync(file, bom + JSON.stringify(pj, null, 2).replace(/\n/g, eol), "utf8");
  return changed;
}
