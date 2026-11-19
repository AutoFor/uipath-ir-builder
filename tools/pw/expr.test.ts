import { strict as assert } from "node:assert";
import { test } from "node:test";
import { exprToTs } from "./expr.ts";

const names = new Map([["out_text", "out_Text"], ["found1", "found1"], ["in_url", "in_Url"]]);
const ts = (v: Parameters<typeof exprToTs>[0]) => { const r = exprToTs(v, names); assert.ok("ts" in r, "why" in r ? r.why : ""); return r.ts; };
const why = (v: Parameters<typeof exprToTs>[0]) => { const r = exprToTs(v, names); assert.ok("why" in r); return r.why; };

test("リテラル・数値・真偽値", () => {
  assert.equal(ts({ lit: 'a"b' }), '"a\\"b"');
  assert.equal(ts(30), "30");
  assert.equal(ts(true), "true");
});

test("VB の式：名前は宣言の綴りにそろえ、演算子を直す", () => {
  assert.equal(ts('"結果: " & OUT_TEXT'), '"結果: " + out_Text');
  assert.equal(ts('"a""b"'), '"a\\"b"');
  assert.equal(ts("Not found1"), "!found1");
  assert.equal(ts('Not out_Text = "x"'), '!(out_Text === "x")');
  assert.equal(ts('found1 AndAlso out_Text <> ""'), 'found1 && out_Text !== ""');
  assert.equal(ts("out_Text.Trim.ToUpper"), "out_Text.trim().toUpperCase()");
  assert.equal(ts('out_Text.Contains("ok")'), 'out_Text.includes("ok")');
  assert.equal(ts('New Exception("出ない")'), 'new Error("出ない")');
});

test("C# の式（{ cs }）", () => {
  assert.equal(ts({ cs: "!found1" }), "!found1");
  assert.equal(ts({ cs: 'out_Text == "a\\tb" || found1' }), 'out_Text === "a\\tb" || found1');
  assert.equal(ts({ vb: "x", cs: 'new Exception("e")' }), 'new Error("e")');
});

test("直せないものは理由を返す", () => {
  assert.match(why("DateTime.Now.ToString"), /DateTime/);
  assert.match(why('String.Format("{0}", out_Text)'), /String/);
  assert.match(why("out_Text.Substring(1, 2)"), /Substring/);
  assert.match(why({ cs: '$"a{out_Text}"' }), /\$/);
  assert.match(why("New List(Of String)"), /New/);
});
