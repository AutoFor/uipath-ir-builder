// VB の XAML → C# の XAML（convert-xaml.ts）のテスト。作業用の出力は out/test-convert/ に作る。

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
mkdirSync(join(root, "out", "test-convert"), { recursive: true });
const work = mkdtempSync(join(root, "out", "test-convert", "t-"));
after(() => rmSync(work, { recursive: true, force: true }));
const convert = (...args: string[]) => spawnSync(process.execPath, [join(root, "tools", "ir", "convert-xaml.ts"), ...args], { cwd: root, encoding: "utf8" });

test("VB の XAML を C# の XAML にする。元の imports は残し、C# のテンプレートの参照を足す", () => {
  const r = convert(join(root, "samples", "generated", "Main.xaml"), "--to", "CSharp", "--out", work);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const x = readFileSync(join(work, "Main.xaml"), "utf8");
  assert.match(x, /^﻿<Activity [^\r\n]*sap2010:ExpressionActivityEditor\.ExpressionActivityEditor="C#"/);
  assert.match(x, /<mca:CSharpValue x:TypeArguments="x:Object">&quot;短すぎる名前: &quot; \+ name<\/mca:CSharpValue>/);
  assert.match(x, /<mca:CSharpReference x:TypeArguments="x:String">message<\/mca:CSharpReference>/);
  assert.doesNotMatch(x, /="\[[^"]*\]"|>\[[^<]*\]<|mva:/);
  assert.match(x, /<AssemblyReference>Microsoft\.CSharp<\/AssemblyReference>/);
  assert.match(x, /<x:String>System\.Text<\/x:String>/);
});

test("取り込めない XAML（C# の式）と、C# に直せない式は変換しない。C# → VB はできない", () => {
  const cs = convert(join(root, "samples", "xaml-import", "unsupported", "CSharpExpr.xaml"), "--to", "CSharp", "--out", work);
  assert.equal(cs.status, 1);
  assert.match(cs.stdout, /CSHARP_EXPR/);

  const named = join(work, "Named.xaml");
  writeFileSync(named, readFileSync(join(root, "samples", "generated", "VbExpressions.xaml"), "utf8"));
  const n = convert(named, "--to", "CSharp", "--out", join(work, "o"));
  assert.equal(n.status, 1);
  assert.match(n.stdout, /CS_EXPR .*名前付き引数/);

  const vb = convert(named, "--to", "VisualBasic", "--out", work);
  assert.equal(vb.status, 2);
  assert.match(vb.stderr, /C# → VB はできない/);
});
