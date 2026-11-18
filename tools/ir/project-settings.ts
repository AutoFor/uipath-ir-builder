// プロジェクト設定（Studio の「プロジェクト設定 → アクティビティ」。<P>/.settings/<プロファイル>/settings-*.json）の既定値。
//
// XAML のアクティビティは、プロパティが未設定（XAML に書いていない）のとき、ここの値で動く（デバッグは Debug、Orchestrator のジョブは Release）。
// Coded のオプション（TargetAppOptions など）はこれを見ず、クラス自身の既定値を使う（CloseMode は Always、CheckState の Timeout は 30 秒など）。
// そのため gen-coded.ts は、IR で未設定の props にこの値を補う（既定 XAML の値・IR の値のほうが強い）。
//
// 確かめたこと（moneyforward_cs、2026-11-18）：ApplicationCard.CloseMode=IfOpenedByAppBrowser、CheckState.CheckStateTimeout=5。
// new した NApplicationCard の CloseMode / OpenMode は null（未設定）で、XAML ではこの設定の値で動く。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalog } from "./catalog.ts";
import type { Value } from "./types.ts";

export type ProjectDefaults = Record<string, Record<string, Value>>; // アクティビティのクラス名 → プロパティ → 値

const UIA = "UiPath.UIAutomationNext.Activities.";
// 設定のキー → どのアクティビティのどのプロパティか。activities が "*uia" なら UI Automation（モダン）の Timeout を持つアクティビティすべて
const MAP: { key: string; activities: string[] | "*uia"; prop: string }[] = [
  { key: `${UIA}Generic.Timeout`, activities: "*uia", prop: "Timeout" },
  { key: `${UIA}ApplicationCard.OpenMode`, activities: ["NApplicationCard"], prop: "OpenMode" },
  { key: `${UIA}ApplicationCard.CloseMode`, activities: ["NApplicationCard"], prop: "CloseMode" },
  { key: `${UIA}ApplicationCard.UserDataFolderMode`, activities: ["NApplicationCard"], prop: "UserDataFolderMode" },
  { key: `${UIA}ApplicationCard.WebDriverMode`, activities: ["NApplicationCard"], prop: "WebDriverMode" },
  { key: `${UIA}CheckState.CheckStateTimeout`, activities: ["NCheckState"], prop: "Timeout" },
  { key: `${UIA}KeyboardEvents.ClickBeforeMode`, activities: ["NTypeInto"], prop: "ClickBeforeMode" },
  { key: `${UIA}KeyboardEvents.EmptyFieldMode`, activities: ["NTypeInto"], prop: "EmptyFieldMode" },
  { key: `${UIA}KeyboardEvents.TypeIntoClipboardMode`, activities: ["NTypeInto"], prop: "ClipboardMode" },
];

// settings-*.json を1つの「キー → 値」にする（ファイルはパッケージごと。中身は { "<キー>": 値 } の形）
export function readSettings(project: string, profile: "Release" | "Debug" = "Release"): Record<string, unknown> {
  const dir = join(project, ".settings", profile);
  const out: Record<string, unknown> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => /^settings-.*\.json$/.test(x)).sort()) {
    try { Object.assign(out, JSON.parse(readFileSync(join(dir, f), "utf8").replace(/^﻿/, ""))); } catch { /* 読めないファイルは飛ばす */ }
  }
  return out;
}

// プロジェクト設定を、アクティビティごとの既定値（IR の値の形）にする。プロパティの型に合わせて数値・真偽値に直す
export function projectDefaults(cat: Catalog, settings: Record<string, unknown>): ProjectDefaults {
  const out: ProjectDefaults = {};
  for (const m of MAP) {
    if (!(m.key in settings)) continue;
    const raw = settings[m.key];
    const acts = m.activities === "*uia"
      ? cat.activities.filter((a) => a.package === "UiPath.UIAutomation.Activities" && /^N[A-Z]/.test(a.className) && a.props.some((p) => p.name === m.prop)).map((a) => a.className)
      : m.activities;
    for (const cls of acts) {
      const a = cat.activities.find((x) => x.className === cls);
      const p = a?.props.find((x) => x.name === m.prop);
      if (!p) continue;
      let v: Value;
      if (/Double|Int32|Int64|Decimal/.test(p.type)) v = Number(raw);
      else if (/Boolean/.test(p.type)) v = String(raw).toLowerCase() === "true";
      else v = String(raw);
      (out[cls] ??= {})[m.prop] = v;
    }
  }
  return out;
}
