// RunWorkflow で呼ぶワークフローが返す辞書のキー（出力の名前）を、呼ばれる側のファイルから読む。
//
// RunWorkflow("x.cs" / "x.xaml") の戻り値は Dictionary<string, object> で、キーは呼ばれる側によって決まる:
//   - XAML: Out / InOut 引数の名前（<x:Property Name="名前" Type="OutArgument(...)" />）
//   - Coded（.cs）: [Workflow] / [TestCase] の Execute の戻り値
//       void → キー無し
//       1つ（DataTable など）→ "Output"（変数の名前ではない。Studio で確かめた）
//       名前付きのタプル（(string a, int b)）→ 要素の名前（"a"、"b"）
//
// XAML を Coded に変えると、1つの出力のキーが「引数の名前」から "Output" に変わる。呼び出し元（とくに手で書いた C#）が古い名前のまま読むと、
// 実行して初めて KeyNotFoundException になる（moneyforward_cs の Download月次推移、2026-11-19）。check.ts の RUN_WORKFLOW_KEY で見つける

import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

export type Outputs = { kind: "xaml" | "coded"; keys: string[] } | undefined;

// ファイルから出力のキーを読む。読めなければ undefined（検査しない）
export function workflowOutputs(file: string): Outputs {
  if (!existsSync(file)) return undefined;
  const src = readFileSync(file, "utf8").replace(/^﻿/, "");
  const ext = extname(file).toLowerCase();
  if (ext === ".xaml") return { kind: "xaml", keys: xamlOutputs(src) };
  if (ext === ".cs") {
    const keys = codedOutputs(src);
    return keys ? { kind: "coded", keys } : undefined;
  }
  return undefined;
}

export function xamlOutputs(src: string): string[] {
  return [...src.matchAll(/<x:Property\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((t) => /\bType="(?:In)?OutArgument\(/.test(t))
    .map((t) => /\bName="([^"]+)"/.exec(t)?.[1])
    .filter((n): n is string => !!n);
}

// [Workflow] / [TestCase] の付いた Execute の戻り値からキーを決める。見つからなければ undefined
export function codedOutputs(src: string): string[] | undefined {
  const m = /\[\s*(?:Workflow|TestCase)\s*(?:\([^)]*\))?\s*\][\s\S]*?\bpublic\s+(?:virtual\s+|override\s+|async\s+)*([\s\S]+?)\s+Execute\s*\(/.exec(src.replace(/\/\/[^\n]*/g, ""));
  if (!m) return undefined;
  let ret = m[1].trim();
  const task = /^(?:System\.Threading\.Tasks\.)?Task\s*<([\s\S]+)>$/.exec(ret);
  if (task) ret = task[1].trim();
  else if (/^(?:System\.Threading\.Tasks\.)?Task$/.test(ret)) ret = "void";
  if (ret === "void") return [];
  if (ret.startsWith("(") && ret.endsWith(")")) {
    // (string a, DataTable b) → a, b。名前の無い要素は Item1, Item2 …
    return splitTop(ret.slice(1, -1)).map((el, i) => {
      const name = /[>\]\w?]\s+([A-Za-z_]\w*)$/.exec(el.trim());
      return name ? name[1] : `Item${i + 1}`;
    });
  }
  return ["Output"];
}

// 一番外側のカンマで分ける（ジェネリックの < > の中は分けない）
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "<" || c === "(" || c === "[") depth++;
    else if (c === ">" || c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out;
}
