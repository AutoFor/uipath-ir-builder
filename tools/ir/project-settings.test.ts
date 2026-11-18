// プロジェクト設定（.settings/<プロファイル>/settings-*.json）の既定値を、Coded の生成で IR の未設定の props に補うこと。

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCatalog } from "./catalog.ts";
import { generateCoded } from "./generate-coded.ts";
import { CATALOG_FILES, repoRoot as root } from "./import-xaml.ts";
import { loadMappings } from "./mapping.ts";
import { projectDefaults, readSettings } from "./project-settings.ts";
import type { Workflow } from "./types.ts";

const cat = loadCatalog(root, CATALOG_FILES);
const { maps } = loadMappings(root);
const UIA = "UiPath.UIAutomationNext.Activities.";

// .settings/<profile>/ に settings-*.json を置いた一時プロジェクト
function withProject(files: Record<string, Record<string, Record<string, unknown>>>, f: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "ps-"));
  try {
    for (const [profile, byFile] of Object.entries(files)) {
      mkdirSync(join(dir, ".settings", profile), { recursive: true });
      for (const [name, body] of Object.entries(byFile)) writeFileSync(join(dir, ".settings", profile, name), "﻿" + JSON.stringify(body));
    }
    f(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("readSettings：プロファイルの settings-*.json をまとめて読む（BOM 付きも、別のプロファイルは読まない）", () => {
  withProject({
    Release: { "settings-a.json": { [`${UIA}ApplicationCard.CloseMode`]: "IfOpenedByAppBrowser" }, "settings-b.json": { [`${UIA}CheckState.CheckStateTimeout`]: "5" } },
    Debug: { "settings-a.json": { [`${UIA}ApplicationCard.CloseMode`]: "Never" } },
  }, (dir) => {
    assert.deepEqual(readSettings(dir), { [`${UIA}ApplicationCard.CloseMode`]: "IfOpenedByAppBrowser", [`${UIA}CheckState.CheckStateTimeout`]: "5" });
    assert.equal(readSettings(dir, "Debug")[`${UIA}ApplicationCard.CloseMode`], "Never");
  });
  assert.deepEqual(readSettings(join(tmpdir(), "no-such-project-xyz")), {}, "設定が無いプロジェクトは空");
});

test("projectDefaults：キーをアクティビティのプロパティにし、型に合わせて数値にする", () => {
  const d = projectDefaults(cat, {
    [`${UIA}ApplicationCard.CloseMode`]: "IfOpenedByAppBrowser",
    [`${UIA}CheckState.CheckStateTimeout`]: "5",
    [`${UIA}Generic.Timeout`]: "30",
  });
  assert.equal(d.NApplicationCard?.CloseMode, "IfOpenedByAppBrowser");
  assert.equal(d.NCheckState?.Timeout, 5, "CheckState の Timeout は Generic.Timeout より CheckStateTimeout が強い");
  assert.equal(d.NClick?.Timeout, 30, "Generic.Timeout は UI Automation の Timeout を持つアクティビティすべてに付く");
  assert.equal(typeof d.NClick?.Timeout, "number");
});

test("generateCoded：IR で未設定の props にプロジェクト設定を補い、IR の値のほうが強い", () => {
  const wf = JSON.parse(readFileSync(join(root, "samples/ir/UiPath.UIAutomation.Activities/NApplicationCard.min.json"), "utf8")) as Workflow;
  const gen = (w: Workflow, pd?: ReturnType<typeof projectDefaults>) => {
    const r = generateCoded(w, cat, maps, { namespace: "N", projectDefaults: pd });
    assert.deepEqual(r.issues, []);
    return r.code;
  };
  const pd = projectDefaults(cat, { [`${UIA}ApplicationCard.CloseMode`]: "IfOpenedByAppBrowser" });
  assert.doesNotMatch(gen(wf), /IfOpenedByAppBrowser/, "設定を渡さなければ補わない");
  assert.match(gen(wf, pd), /CloseMode = (\w+\.)*NAppCloseMode\.IfOpenedByAppBrowser/);

  const withIr = structuredClone(wf);
  const card = withIr.body.find((n) => n.act === "NApplicationCard")!;
  card.props = { ...(card.props ?? {}), CloseMode: "Never" };
  const out = gen(withIr, pd);
  assert.match(out, /CloseMode = (\w+\.)*NAppCloseMode\.Never/);
  assert.doesNotMatch(out, /IfOpenedByAppBrowser/);
});
