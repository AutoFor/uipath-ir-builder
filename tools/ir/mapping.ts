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
// 一部の形だけ API が無いときは、その形を { "when": ["ExistingWorkbook"], "reason": "..." } と書く（同じく NO_CODED_API）。
// InvokeWorkflowFile のように引数の受け渡しが特殊なものは "special": "invokeWorkflow"。
//
// スコープ（Excel の Use Excel File など、body に子を持ち、子が参照する値を渡すもの）:
//   { "call": "excel.UseExcelFile", "scope": "using", "scopeType": "UiPath.Excel.IWorkbookQuickHandle", ... }
//   → using (var <item> = excel.UseExcelFile(...)) { <body> }。<item> は IR の item（delegate の引数名）。
//     scopeType は C# でその変数が持つ型（{@型名} で子から参照する。省略時は delegate の引数の型）
// そのほかの書き方:
//   "defaults": { "HasHeaders": true }     … IR に無いときに使う値（IR の値の形）。API の引数に既定値が無く、アクティビティにはあるとき
//   "init": { "param": "options", "type": "UseOptions", "props": { "Path": "{WorkbookPath}", ... } }
//                                          … 引数 options に new UseOptions { Path = ..., ... } を渡す。IR に無いプロパティの行は省く。
//                                            値を配列にすると、使える最初のもの（["{Password}", "...{SecurePassword}..."]）
//   "call": "{Range}.ReadRange"            … call にもテンプレートが使える（戻り値の型の拡張メソッドを呼ぶとき）
//
// テンプレートの {Prop}:
//   in のプロパティ → C# の式（VB から直したもの、{ lit } は C# の文字列リテラル）
//   out / inout のプロパティ → 代入先の変数名
//   enum のプロパティ → メンバー名そのまま（"UiPath.CodedWorkflows.LogLevel.{Level}" のように使う）
//   {Prop|str} → 文字列にする（文字列だと分かる式はそのまま、それ以外は Convert.ToString(...)）
//   {typeArg} → ジェネリックの型引数（C# の型名）
//   {Prop|type} → out のプロパティの代入先の変数の型（C# の型名）。object を返す API の結果を変換するとき
//   {@型名} → 外側のスコープ（"scope": "using"）の変数名。型名は scopeType の末尾（{@IWorkHandle} など）。無いときはその引数・行ごと省く
// args の値が、IR に無いプロパティを参照していたら、その引数ごと省く（省略可能な引数かどうかはチェッカーが確かめる）。

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type Variant = {
  when?: string[];
  call?: string;
  args?: Record<string, string>;
  returns?: string;
  code?: string;
  special?: "invokeWorkflow";
  usings?: string[];
  scope?: "using";
  scopeType?: string;
  defaults?: Record<string, string | number | boolean | { lit: string }>;
  init?: { param: string; type: string; props: Record<string, string | string[]> };
  reason?: string; // call も code も無く reason だけなら「この形は Coded API なし」
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
  return [...template.matchAll(/\{(\w+)(?:\|\w+)?\}/g)].map((m) => m[1]).filter((n) => n !== "typeArg");
}

// テンプレートが参照するスコープの変数（{@IWorkHandle} の IWorkHandle）
export function scopeRefs(template: string): string[] {
  return [...template.matchAll(/\{@([\w.]+)\}/g)].map((m) => m[1]);
}
