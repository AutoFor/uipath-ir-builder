// プロジェクトのファイル（project.json など）を IR から作るテスト（tools/ir/project.ts）。
//
// - samples/project/<名前>/ … Studio が作ったプロジェクトの写し。ir/project.ir.json から作り直すと同じファイルになり、
//   ir/*.json（ワークフローの IR）から作り直した XAML も元と意味が同じこと

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compareProject, importProject, importProjectDir, projectFiles, projectJson, stableGuid, type ProjectIr } from "./project.ts";
import { canonLines, repoRoot as root } from "./import-xaml.ts";
import { generate } from "./generate.ts";
import { loadSelected, projectRootImports } from "./versions.ts";

const dir = join(root, "samples", "project");

for (const name of readdirSync(dir)) {
  const p = join(dir, name);
  test(`プロジェクト ${name}：IR から作り直すと同じファイルになる`, () => {
    const ir = JSON.parse(readFileSync(join(p, "ir", "project.ir.json"), "utf8")) as ProjectIr;
    assert.deepEqual(importProjectDir(p), ir, "取り込んだ IR が ir/project.ir.json と違う");
    assert.deepEqual(compareProject(p, ir), []);
  });

  test(`プロジェクト ${name}：ワークフローの IR から作り直した XAML は元と意味が同じ`, () => {
    const { cat } = loadSelected(root, p);
    for (const f of readdirSync(join(p, "ir")).filter((x) => x.endsWith(".json") && x !== "project.ir.json")) {
      const wf = JSON.parse(readFileSync(join(p, "ir", f), "utf8"));
      const xml = generate(wf, cat, { language: "CSharp", rootImports: projectRootImports(p).imports });
      const orig = readFileSync(join(p, wf.file ?? `${wf.workflow}.xaml`), "utf8");
      assert.deepEqual(canonLines(xml), canonLines(orig), f);
    }
  });
}

test("XAML がまだ無いプロジェクトでは、ルートの imports を project.ir.json の rootImports から取る", () => {
  const ir = JSON.parse(readFileSync(join(dir, "LongRunningAutomation", "ir", "project.ir.json"), "utf8")) as ProjectIr;
  const t = mkdtempSync(join(tmpdir(), "project-ir-"));
  try {
    for (const [f, body] of projectFiles(ir)) if (body !== null) writeFile(join(t, f), body);
    writeFile(join(t, "ir", "project.ir.json"), JSON.stringify(ir));
    assert.deepEqual(projectRootImports(t).imports, ir.rootImports);
  } finally { rmSync(t, { recursive: true, force: true }); }
});

test("雛形と違うところだけを overrides に持ち、消えたキーは null で表す", () => {
  const ir: ProjectIr = { name: "P", kind: "process", dependencies: { "UiPath.System.Activities": "[25.10.2]" } };
  const pj = projectJson(ir);
  assert.equal(pj.projectId, stableGuid("P"), "projectId を省くと名前から決まる GUID");
  assert.equal((pj.runtimeOptions as Record<string, unknown>).supportsPersistence, false);
  const changed = { ...pj, dotNetVersion: "8.0", runtimeOptions: { ...(pj.runtimeOptions as object), isAttended: true } } as Record<string, never>;
  delete (changed as Record<string, unknown>).publishData;
  const back = importProject(changed);
  assert.deepEqual(back.overrides, { runtimeOptions: { isAttended: true }, publishData: null, dotNetVersion: "8.0" });
  assert.deepEqual(projectJson(back), changed);
  assert.equal(importProject(projectJson({ ...ir, kind: "longRunning" })).kind, "longRunning", "長時間実行（supportsPersistence・requiresUserInteraction）を見分ける");
});

function writeFile(f: string, s: string) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s, "utf8"); }
