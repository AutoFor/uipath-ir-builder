import { test } from "node:test";
import assert from "node:assert/strict";
import { deepEqual, matches, rawResponse } from "./evals.mjs";

test("deepEqual：キーの順は見ない、キーの大文字小文字・真偽と数・配列の長さは見る", () => {
  assert.equal(deepEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), true);
  assert.equal(deepEqual({ sum: 5 }, { Sum: 5 }), false);
  assert.equal(deepEqual({ ok: true }, { ok: 1 }), false);
  assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
  assert.equal(deepEqual({ a: null }, { a: null }), true);
});

test("matches：targetOutputKey が * なら全体、道なら その値、両方に無い道は不合格", () => {
  assert.equal(matches({ a: { b: 1 }, c: 2 }, { a: { b: 1 }, c: 9 }, "a.b"), true);
  assert.equal(matches({ a: 1 }, { a: 1 }, "*"), true);
  assert.equal(matches({ a: 1 }, { a: 1 }, "x.y"), false);
  assert.equal(matches({ a: 1, b: 2 }, { a: 1, b: 3 }, ["a", "b"]), false);
});

test("rawResponse：最後の Response の生の値。オブジェクトでなければ { result } に包む", () => {
  const log = [
    'x Response task evaluated successfully for "Response_1": {"response":{"grade":"A"}}',
    'y Response task evaluated successfully for "Response_2": {"response":{"grade":"B"}}',
  ].join("\n");
  assert.deepEqual(rawResponse(log), { grade: "B" });
  assert.deepEqual(rawResponse('Response task evaluated successfully for "R": {"response":[1,2]}'), { result: [1, 2] });
  assert.equal(rawResponse("nothing"), undefined);
});
