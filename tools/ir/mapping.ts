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
//   {Prop|str} → 文字列にする（文字列だと分かる式はそのまま、それ以外は Convert.ToString(...)）
//   {typeArg} → ジェネリックの型引数（C# の型名）
//   {Prop:-既定} → IR にその props が無いときは「既定」の文字列を入れる（その引数は省かれない。out 引数の捨て先 `out {Prop:-_}` にも使える）
//   {Dict|dict} → 引数の辞書（IR の dicts）を new Dictionary<string, object> { ["名前"] = 値 } にする（In のみ）
//   {Prop|is_Member} → enum の値が Member なら true、でなければ false（ExecutionMode が None か、など）
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
  ignore?: string[]; // この形のときだけ捨てる props（mapping の ignore はどの形でも捨てる）
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
  return [...template.matchAll(/\{(\w+)(?:\|\w+)?(?::-[^}]*)?\}/g)].map((m) => m[1]).filter((n) => n !== "typeArg");
}

// 既定（{Prop:-既定}）を持たない参照だけ。これが IR に無いと、その引数は省かれる
export function requiredRefs(template: string): string[] {
  return [...template.matchAll(/\{(\w+)(?:\|\w+)?(:-[^}]*)?\}/g)].filter((m) => m[2] === undefined).map((m) => m[1]).filter((n) => n !== "typeArg");
}
