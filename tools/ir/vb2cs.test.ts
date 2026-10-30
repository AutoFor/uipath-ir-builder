// VB → C# の式の変換のテスト。node --test tools/ir/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { vbToCs, vbDefaultToCs } from "./vb2cs.ts";

const scope = new Map([
  ["names", "String[]"], ["count", "Int32"], ["row", "DataRow"], ["items", "List<String>"], ["ex", "Exception"], ["dt", "DataTable"], ["i", "Int32"],
]);

const ok: [string, string][] = [
  ['"あいさつした人数: " & count.ToString', '"あいさつした人数: " + count.ToString()'],
  ['it = "item2"', 'it == "item2"'],
  ["New List(Of String)", "new List<String>()"],
  ['New InvalidOperationException("わざと")', 'new InvalidOperationException("わざと")'],
  ["name.Length >= 2", "name.Length >= 2"],
  ['String.Join(",", items)', 'String.Join(",", items)'],
  ['row("Name").ToString', 'row["Name"].ToString()'],
  ['dt.Rows(0).Item("A")', 'dt.Rows[0]["A"]'],
  ["CInt(x) + -1", "Convert.ToInt32(x) + -1"],
  ["Not a AndAlso b <> Nothing", "!a && b != null"],
  ["CType(o, String).Trim", "((String)(o)).Trim()"],
  ['New Dictionary(Of String, Object) From {{"a", 1}}', 'new Dictionary<String, Object>() { { "a", 1 } }'],
  ["COUNT + 1", "count + 1"],
  ["x Is Nothing", "x == null"],
  ['"a""b\\c"', '"a\\"b\\\\c"'],
  ["names(i)", "names[i]"],
  ["a Mod 2 = 0", "a % 2 == 0"],
];
for (const [vb, cs] of ok) test(`VB → C#: ${vb}`, () => assert.deepEqual(vbToCs(vb, scope), { cs }));

for (const vb of ['If(f, "a", "b")', "Function(x) x + 1", "a \\ b", "2 ^ 3", "{1, 2}", "AddressOf Foo"])
  test(`VB → C# できない: ${vb}`, () => assert.ok("error" in vbToCs(vb, scope)));

test("配列の既定値", () => assert.deepEqual(vbDefaultToCs('{"太郎", "花子"}', "String[]", scope), { cs: 'new String[] { "太郎", "花子" }' }));
