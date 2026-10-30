// アクティビティ → Coded の対応表（mappings/<pkg>/<ClassName>.json）を読む。1アクティビティ1ファイル。
//
// 形:
// {
//   "activity": "WriteTextFile",                 // ClassName
//   "package": "UiPath.System.Activities",
//   "coded": [                                   // 上から順に、when がそろう最初のものを使う
//     { "when": ["FileName"],                    // この props が IR にあるときに使う（省略可）
//       "call": "system.WriteTextFile",          // サービス.メソッド か、基底クラスのメソッド名（"Log"）
//       "args": { "text": "{Text}", "file": "LocalResource.FromPath({FileName})", "encoding": "{Encoding}" },
//       "returns": "Content" },                  // 戻り値を受ける out プロパティ（省略可）
//     { "code": "{Collection}.Add({Item});" }    // サービスを使わず C# の文で書くとき
//   ],
//   "ignore": ["ContinueOnError"],               // Coded では意味のない props（あっても捨てる）
//   "notes": "..."
// }
// "coded": null と "reason": "..." で「Coded API なし」を表す（生成するとその理由でエラーになる）。
// InvokeWorkflowFile のように引数の受け渡しが特殊なものは "special": "invokeWorkflow"。
//
// テンプレートの {Prop}:
//   in のプロパティ → C# の式（VB から直したもの、{ lit } は C# の文字列リテラル）
//   out / inout のプロパティ → 代入先の変数名
//   enum のプロパティ → メンバー名そのまま（"UiPath.CodedWorkflows.LogLevel.{Level}" のように使う）
//   {Prop|enum} → enum の完全名（UiPath.UIAutomationNext.Enums.NClickType.Double。フラグの "Alt, Ctrl" は A | B）
//   {Prop|str} → 文字列にする（文字列だと分かる式はそのまま、それ以外は Convert.ToString(...)）
//   {typeArg} → ジェネリックの型引数（C# の型名）
// args の値が、IR に無いプロパティを参照していたら、その引数ごと省く（省略可能な引数かどうかはチェッカーが確かめる）。
//
// UI 操作（tools/ir/uia.ts）のための書き方:
//   {Target}（objs のプロパティ）→ new TargetAnchorableModel { ... } のようなモデルの式
//   {app} → いちばん内側の "special": "scope"（NApplicationCard）が作るアプリの変数（UiTargetApp）
//   args の値をオブジェクトにすると、オプションのオブジェクトを作る:
//     "clickOptions": { "new": "ClickOptions", "set": { "ClickType": "NClickType.{ClickType}", "Timeout": "{Timeout}" } }
//     → new ClickOptions { ClickType = NClickType.Double, Timeout = 10 }（IR にある props の分だけ。1つも無ければ引数ごと省く。"always": true なら new ClickOptions()）
//   "special": "scope" … call の戻り値を using (var appN = ...) で受け、body をその中に書く（NApplicationCard）
//   "branches": { "true": "IfExists", "false": "IfNotExists" } … call の戻り値（bool）で子（slots）を if / else に分ける（NCheckState）

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type ObjArg = { new: string; set: Record<string, string>; always?: boolean };

export type Variant = {
  when?: string[];
  call?: string;
  args?: Record<string, string | ObjArg>;
  returns?: string;
  code?: string;
  special?: "invokeWorkflow" | "scope";
  branches?: { true?: string; false?: string };
  usings?: string[];
};

export type Mapping = {
  activity: string;
  package: string;
  coded: Variant[] | null;
  reason?: string;
  ignore?: string[];
  notes?: string;
  file: string;
};

export function loadMappings(root: string): { maps: Map<string, Mapping>; errors: string[] } {
  const maps = new Map<string, Mapping>();
  const errors: string[] = [];
  const dir = join(root, "mappings");
  if (!existsSync(dir)) return { maps, errors };
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!e.endsWith(".json")) continue;
      const rel = relative(root, p).replaceAll("\\", "/");
      try {
        const m = JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) as Mapping;
        if (!m.activity || !m.package) { errors.push(`${rel}: activity と package が要る`); continue; }
        if (`${m.activity}.json` !== e) errors.push(`${rel}: ファイル名は ${m.activity}.json にする`);
        if (m.coded === null && !m.reason) errors.push(`${rel}: coded が null なら reason を書く`);
        const key = `${m.package}/${m.activity}`;
        if (maps.has(key)) errors.push(`${rel}: ${key} の対応表が2つある`);
        maps.set(key, { ...m, file: rel });
      } catch (e) {
        errors.push(`${rel}: JSON が読めない（${(e as Error).message}）`);
      }
    }
  };
  walk(dir);
  return { maps, errors };
}

// テンプレートが参照するプロパティ名
export function refs(template: string): string[] {
  return [...template.matchAll(/\{(\w+)(?:\|\w+)?\}/g)].map((m) => m[1]).filter((n) => n !== "typeArg" && n !== "app");
}
