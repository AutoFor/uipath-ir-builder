// tools/catalog-diff.ts のテスト。小さな合成カタログで、差分の分類と影響判定を確かめる。
//   node --test tools/ir/catalog-diff.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { assessImpact, collectMappingUsage, collectSampleUsage, diffCatalogs, renderMarkdown } from "../catalog-diff.ts";
import type { CAct, CCatalog, CProp } from "../catalog-diff.ts";

const p = (name: string, o: Partial<CProp> = {}): CProp => ({ name, kind: "in", type: "System.String", required: false, obsolete: false, ...o });
const act = (className: string, props: CProp[], o: Partial<CAct> = {}): CAct => ({ className, clrType: `T.${className}`, obsolete: false, browsable: true, props, ...o });
const cat = (version: string, activities: CAct[], services?: CCatalog["services"]): CCatalog => ({ package: "P", version, activities, services });

test("増減と本当の差分", () => {
  const a = cat("1", [
    act("Gone", []),
    act("A", [p("Removed"), p("Typed"), p("Req", { required: true }), p("Mode", { enum: ["x", "y"] })]),
  ]);
  const b = cat("2", [
    act("New", [p("Q")]),
    act("A", [p("Typed", { type: "System.Int32" }), p("Req"), p("Mode", { enum: ["x", "z"] }), p("Added", { required: true })]),
  ]);
  const d = diffCatalogs(a, b);
  assert.deepEqual(d.added.map((x) => x.className), ["New"]);
  assert.deepEqual(d.removed.map((x) => x.className), ["Gone"]);
  const kinds = d.changes.map((c) => `${c.kind}:${c.prop}:${c.grade}`).sort();
  assert.deepEqual(kinds, ["enumAdded:Mode:real", "enumRemoved:Mode:real", "propAdded:Added:real", "propRemoved:Removed:real", "requiredChanged:Req:real", "typeChanged:Typed:real"]);
});

test("抽出器の違いは suspect にする", () => {
  const many = (n: number, withProp: boolean) => Array.from({ length: n }, (_, i) => act(`X${i}`, withProp ? [p("Description", { kind: "prop" }), p("Result", { kind: "out" })] : []));
  const d = diffCatalogs(cat("1", many(10, false)), cat("2", many(10, true)));
  assert.equal(d.changes.length, 20);
  assert.ok(d.changes.every((c) => c.grade === "suspect"));
  const few = diffCatalogs(cat("1", many(3, false)), cat("2", many(3, true)));
  assert.equal(few.changes.filter((c) => c.grade === "real").length, 3); // Description は 3 個なら本当の追加。Result は suspect
  const ro = diffCatalogs(cat("1", [act("A", [p("R")])]), cat("2", [act("A", [p("R", { readOnly: true })])]));
  assert.equal(ro.changes.length, 0);
  assert.equal(ro.ignored.readOnly, 1);
});

test("services は両方にあるときだけ比べる", () => {
  const m = (name: string, params: string[]) => ({ name, returns: "System.Void", params: params.map((t, i) => ({ name: `a${i}`, type: t })), obsolete: false });
  const none = diffCatalogs(cat("1", []), cat("2", [], [{ name: "ISystemService", methods: [m("Foo", [])] }]));
  assert.equal(none.services.comparable, false);
  const both = diffCatalogs(
    cat("1", [], [{ name: "ISystemService", methods: [m("Foo", ["System.String"]), m("Gone", [])] }]),
    cat("2", [], [{ name: "ISystemService", methods: [m("Foo", ["System.Int32"]), m("New", [])] }]),
  );
  assert.deepEqual(both.services.changes.map((c) => `${c.method}:${c.kind}`).sort(), ["Foo:signature", "Gone:removed", "New:added"]);
});

test("影響判定：サンプルと対応表", () => {
  const a = cat("1", [act("Gone", []), act("A", [p("Removed"), p("Mode", { enum: ["x", "y"] }), p("Old", { required: true })], {}), act("B", [])], [
    { name: "ISystemService", methods: [{ name: "Del", returns: "System.Void", params: [], obsolete: false }] },
  ]);
  const b = cat("2", [
    act("A", [p("Mode", { enum: ["x"] }), p("Old"), p("Path", { required: true, overloadGroups: ["Path"] }), p("Res", { required: true, overloadGroups: ["Res"] })]),
    act("B", [p("NowReq", { required: true })]),
  ], [{ name: "ISystemService", methods: [] }]);
  const d = diffCatalogs(a, b);
  const wf = { workflow: "W", body: [
    { act: "Gone" },
    { act: "A", props: { Removed: "x", Mode: { lit: "y" }, Path: "p" } },
    { act: "Sequence", body: [{ act: "B", props: {} }] },
  ] };
  const us = [
    ...collectSampleUsage("s.json", wf),
    collectMappingUsage("m.json", { activity: "A", coded: [{ when: ["Removed"], call: "system.Del", args: {} }] })!,
  ];
  const f = assessImpact(d, us).map((x) => `${x.severity}:${x.file}:${x.activity}:${x.prop ?? ""}`).sort();
  assert.deepEqual(f, [
    "error:m.json:A:",           // 消えた Coded API
    "error:m.json:A:Removed",    // 消えたプロパティを対応表が参照
    "error:s.json:A:Mode",       // 消えた enum 値を使用
    "error:s.json:A:Removed",
    "error:s.json:Gone:",
    "warn:s.json:B:NowReq",      // 新しく必須のものを書いていない
  ].sort());
  // Path と Res は別の書き方（どちらか1つ）なので、Path を書いている A は warn にならない
  assert.ok(!f.some((x) => x.includes("Res")));
  assert.match(renderMarkdown(d, assessImpact(d, us)), /影響判定/);
});
