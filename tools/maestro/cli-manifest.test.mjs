// tools/maestro/cli-manifest.mjs：CLI の bundle からノードの定義を取り出すときの、名前と import の書き換え。
import { test } from "node:test";
import assert from "node:assert/strict";
import { exportsName, rewriteImports } from "./cli-manifest.mjs";

test("ノードの型から bundle の変数名を作る", () => {
  assert.equal(exportsName("core.action.queue.delete-items"), "core_action_queue_delete_items_exports");
  assert.equal(exportsName("core.trigger.queue"), "core_trigger_queue_exports");
});

test("相対の import を元のフォルダに向ける（3 つの書き方）", () => {
  const src = 'import"./a.js";\nimport { x } from "./b.js";\nconst m = await import("./c.js");\nimport y from "node:fs";';
  assert.equal(rewriteImports(src, "file:///D/dist/"),
    'import"file:///D/dist/a.js";\nimport { x } from "file:///D/dist/b.js";\nconst m = await import("file:///D/dist/c.js");\nimport y from "node:fs";');
});
