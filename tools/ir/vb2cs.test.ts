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
  // VB の定数と組み込み
  ['"a" & vbCr & "b" & VBLF', '"a" + "\\r" + "b" + "\\n"'],
  ['"x" & vbCrLf & vbTab', '"x" + "\\r\\n" + "\\t"'],
  ['"x" & vbNewLine', '"x" + Environment.NewLine'],
  ["s = vbNullString", "s == null"],
  ['Now.ToString("yyyy")', 'DateTime.Now.ToString("yyyy")'],
  ["Today.AddDays(1)", "DateTime.Today.AddDays(1)"],
  ["Date.Now", "DateTime.Now"],
  ['Integer.Parse("1")', 'int.Parse("1")'],
  ["ControlChars.CrLf", "Microsoft.VisualBasic.ControlChars.CrLf"],
  ["Left(s, 3)", "Microsoft.VisualBasic.Strings.Left(s, 3)"],
  ["Len(s)", "Microsoft.VisualBasic.Strings.Len(s)"],
  ["IsNumeric(s)", "Microsoft.VisualBasic.Information.IsNumeric(s)"],
  ["Chr(13)", "Microsoft.VisualBasic.Strings.Chr(13)"],
  // 条件、ラムダ、型
  ['If(a, "x", "y")', '(a ? "x" : "y")'],
  ['If(s, "y")', '(s ?? "y")'],
  ['IIf(a > 1, 1, 2)', "(a > 1 ? 1 : 2)"],
  ['"n=" & If(a, 1, 2).ToString', '"n=" + (a ? 1 : 2).ToString()'],
  ["Function(x) x + 1", "x => x + 1"],
  ['dt.Rows.Cast(Of DataRow).Select(Function(r) r("Name").ToString)', 'dt.Rows.Cast<DataRow>().Select(r => r["Name"].ToString())'],
  ["items.Any(Function(p As String) p.Length = 1)", "items.Any((String p) => p.Length == 1)"],
  ['items.Where(Function(x) x <> "").Count', 'items.Where(x => x != "").Count()'],
  ["dt.AsEnumerable.Count", "dt.AsEnumerable().Count()"],
  ["dt.Rows.Count", "dt.Rows.Count"],
  ['New DataColumn("M", GetType(String))', 'new DataColumn("M", typeof(String))'],
  ["TypeOf o Is String", "(o is String)"],
  ['New Foo("a") With {.A = 1, .B = "x"}', 'new Foo("a") { A = 1, B = "x" }'],
  // リテラル
  ['s.Split(","c)', "s.Split(',')"],
  ['s.Split(","c)(0)', "s.Split(',')[0]"],
  ['"\'"c', "'\\''"],
  ['{"a", "b"}', 'new[] { "a", "b" }'],
  ['String.Join(",", {"a", "b"})', 'String.Join(",", new[] { "a", "b" })'],
  ["#1/2/2020#", "new DateTime(2020, 1, 2)"],
  ["#2020-01-02#", "new DateTime(2020, 1, 2)"],
  ["&H10", "0x10"],
  ['Foo(a:=1, b:="x")', 'Foo(a: 1, b: "x")'],
  // 添字、大文字小文字
  ['dt.Rows(0)("A")', 'dt.Rows[0]["A"]'],
  ['row("A").tostring', 'row["A"].ToString()'],
  ['row.Field(Of String)("A")', 'row.Field<String>("A")'],
  ['s.TRIM.toupper', "s.Trim().ToUpper()"],
  // 優先順位と意味の違い
  ["Not x Is Nothing", "!(x == null)"],
  ['Not a = "b" AndAlso c', '!(a == "b") && c'],
  ["Not String.IsNullOrEmpty(s)", "!String.IsNullOrEmpty(s)"],
  ["7 / 2", "(double)7 / 2"],
  ["count / 2", "(double)count / 2"],
  ["x / 2", "x / 2"],
  ['"a" & (count + 1)', '"a" + (count + 1)'],
  ['"a" & -1', '"a" + -1'],
];
for (const [vb, cs] of ok) test(`VB → C#: ${vb}`, () => assert.deepEqual(vbToCs(vb, scope), { cs }));

for (const vb of ["Sub(x) Foo(x)", "a \\ b", "2 ^ 3", "{}", "AddressOf Foo", 'a Like "b*"', "From x In y Select x", '"a" & count + 1', "count & i", "IIf(a, 1)", "#1/2/2020 10:00#"])
  test(`VB → C# できない: ${vb}`, () => assert.ok("error" in vbToCs(vb, scope)));

test("配列の既定値", () => assert.deepEqual(vbDefaultToCs('{"太郎", "花子"}', "String[]", scope), { cs: 'new String[] { "太郎", "花子" }' }));
