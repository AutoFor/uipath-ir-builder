// テストケース（IR の "testCase"）。knowledge/testing.md の「テストケース」。
//
// - Given / When / Then を、その名前の Sequence 3 つの body に開く（XAML も Coded も同じ IR から作るため）
// - project.json の designOptions.fileInfoCollection に載せる・外す。Studio はここに載っているファイルをテストケースとして扱う
//   （XAML の中身はふつうのワークフローと同じ。Studio のテンプレート Test Automation Project の TestCase.xaml で確かめた）

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Workflow, Issue } from "./types.ts";

export const GWT = ["given", "when", "then"] as const;
const label = { given: "Given", when: "When", then: "Then" } as const;

// Given / When / Then を body に開く。テストケースでないのに書いた・body と一緒に書いたものはエラー
export function expandTestCase(wf: Workflow): { wf: Workflow; issues: Issue[] } {
  const issues: Issue[] = [];
  const used = GWT.filter((k) => wf[k] !== undefined);
  if (wf.testCase !== undefined && typeof wf.testCase !== "boolean") {
    const t = wf.testCase;
    if (t.status !== undefined && t.status !== "Publishable" && t.status !== "InProgress") issues.push({ path: "testCase.status", code: "TESTCASE", message: `status "${t.status}" は Publishable か InProgress` });
    if (t.id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id)) issues.push({ path: "testCase.id", code: "TESTCASE", message: `id "${t.id}" は GUID で書く` });
  }
  if (!used.length) return { wf, issues };
  if (!isTestCase(wf)) issues.push({ path: used[0], code: "TESTCASE", message: `${used.join(" / ")} はテストケース（"testCase": true）にだけ書ける` });
  if (wf.body?.length) issues.push({ path: "body", code: "TESTCASE", message: "given / when / then と body は一緒に書けない（どちらかにする）" });
  if (issues.length) return { wf, issues };
  const body = GWT.map((k) => ({ act: "Sequence", name: label[k], body: wf[k] ?? [] }));
  const { given: _g, when: _w, then: _t, ...rest } = wf;
  return { wf: { ...rest, body }, issues };
}

export const isTestCase = (wf: Workflow) => wf.testCase !== undefined && wf.testCase !== false;

// project.json の置き場所。--project があればそれ、無ければ --out かその親（verify.mjs の coded/）
export function findProjectDir(outDir: string, project?: string): string | undefined {
  for (const d of [project, outDir, dirname(outDir)]) if (d && existsSync(join(d, "project.json"))) return d;
  return undefined;
}

export type TestCaseEntry = { fileName: string; wf: Workflow };

// fileInfoCollection を IR に合わせる。テストケースは載せ（testCaseId は IR、既存、新しい GUID の順）、テストケースでなくなったものは外す。
// fileName はプロジェクトからの相対パス（区切りは \）。変えたファイル名を返す
export function registerTestCases(projectDir: string, entries: TestCaseEntry[]): string[] {
  const file = join(projectDir, "project.json");
  const raw = readFileSync(file, "utf8");
  const bom = raw.startsWith("﻿") ? "﻿" : "";
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const pj = JSON.parse(raw.slice(bom.length));
  pj.designOptions ??= {};
  const list: { editingStatus?: string; testCaseId?: string; fileName: string }[] = (pj.designOptions.fileInfoCollection ??= []);
  const changed: string[] = [];
  const same = (a: string, b: string) => a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();
  for (const { fileName, wf } of entries) {
    const name = fileName.replace(/\//g, "\\");
    const i = list.findIndex((e) => same(e.fileName, name));
    if (!isTestCase(wf)) {
      if (i >= 0) { list.splice(i, 1); changed.push(name); }
      continue;
    }
    const opt = typeof wf.testCase === "object" ? wf.testCase : {};
    const next = { editingStatus: opt.status ?? "Publishable", testCaseId: opt.id ?? (i >= 0 && list[i].testCaseId ? list[i].testCaseId! : randomUUID()), fileName: name };
    if (i < 0) { list.push(next); changed.push(name); continue; }
    if (list[i].editingStatus !== next.editingStatus || list[i].testCaseId !== next.testCaseId || list[i].fileName !== name) {
      list[i] = { ...list[i], ...next };
      changed.push(name);
    }
  }
  if (changed.length) writeFileSync(file, bom + JSON.stringify(pj, null, 2).replace(/\n/g, eol), "utf8");
  return changed;
}
