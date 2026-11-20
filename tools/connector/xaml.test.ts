// 自作コネクタの IR → Studio の XAML（Insert Record。tools/connector/xaml.ts）。
// 形は Studio で Insert Record（LINE Messaging API・push_message）を置いて保存した XAML から写した（2026-11-19、UiPath.IntegrationService.Activities 1.36.0）。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { ConnectorIr } from "./gen.ts";
import { checkInsertRecord, configuration, connectorKey, encodeConfiguration, fieldId, insertRecord, literalProblem, parseSetValue, workflow, type InsertRecordOpt } from "./xaml.ts";

const root = join(import.meta.dirname, "..", "..");
const line = JSON.parse(readFileSync(join(root, "samples", "connector", "line-messaging.json"), "utf8")) as ConnectorIr;
const opt = {
  activity: "push_message", connectionId: "8094e970-3924-42db-bca9-6f32fd1b07b7", activityTypeId: "e2c7639a-829c-322b-bd62-a896f4b6f881",
  organization: "autofor", values: { to: { cs: "in_To" }, text: { lit: "テスト <1> & \"2\"" } },
};
const decode = (x: string) => [...x.matchAll(/Configuration="([^"]+)"/g)].map((m) => JSON.parse(gunzipSync(Buffer.from(m[1], "base64")).toString("utf8")));

test("fieldId：ランタイムの NamingHelper と同じ（Studio が保存した名前）", () => {
  assert.equal(fieldId("to"), "_to", "To は VB の予約語");
  assert.equal(fieldId("text"), "text");
  assert.equal(fieldId("sentMessages[*].id", true), "out_sentMessages_array_sub_id");
  assert.equal(fieldId("class"), "_class", "C# の予約語");
  assert.equal(fieldId("2nd"), "_2nd");
  assert.equal(fieldId("a-b"), "aminus_signb");
  assert.equal(fieldId("file"), "_file");
});

test("configuration：Studio が保存した Configuration と同じ（旧版の push_message の to だけ）", () => {
  // Studio が保存したもの（コネクタ 1.0.0、欄は to と messages[*]…。Studio は messages[*] を捨てたので to だけ）
  const studio = {
    FieldsContainer: {
      SearchableFields: [],
      InputFields: [{ Name: "to", DisplayName: "送り先", Description: "ユーザー ID（U から始まる）またはグループ ID", Type: "string", Design: { Position: "Primary" }, Required: true, FieldLocation: "Body" }],
      OutputFields: [{ Name: "sentMessages[*].id", DisplayName: "送ったメッセージの ID", Description: "The sentMessages[*].id", Type: "string", Request: false, Response: true, ResponseCurated: true, FieldLocation: "Output", IsMainResponseField: true }],
    },
    InstanceParameters: { Version: "1.0.0", ConnectorKey: "custom-autofor-linemessagingapi", ActivityType: "Generic", Operation: "Create" },
    LocalizedActivityName: "Insert Record",
    CachedLookupValues: { ObjectName: [{ Id: "push_message", DisplayColumns: ["プッシュメッセージを送る"], StringFormatDisplayColumns: "{0}", DisplayName: "プッシュメッセージを送る", Custom: false }] },
    CachedBrowserItems: {}, PrimaryKeys: [], PackageVersion: "1.36.0", ConnectorName: "LINE Messaging API", ConnectorVersion: "1.0.0",
    ObjectDisplayName: "プッシュメッセージを送る", ObjectName: "push_message", Operation: "Create", HttpMethod: "POST", Path: "/push_message",
    Language: "ja", MaxPageSize: 200, HasBreakingChanges: false, IsFieldAsSolutionResourceEnabled: true, TextBlocks: [],
  };
  const act = { ...line.activities[0], request: [line.activities[0].request![0]] };
  assert.deepEqual(configuration({ ...line, version: undefined }, act, { organization: "autofor" }), studio);
  assert.equal(JSON.stringify(decode(`Configuration="${encodeConfiguration(studio)}"`)[0]), JSON.stringify(studio), "gzip + base64 で戻せる");
  assert.equal(connectorKey(line, "autofor"), "custom-autofor-linemessagingapi");
});

test("insertRecord：ConnectionId・UiPathActivityTypeId・FieldObjects（値は InArgument、C# の式は CSharpValue）", () => {
  const x = insertRecord(line, opt);
  assert.match(x, /^ {4}<isactr:ConnectorActivity Configuration="H4sI[^"]+" ConnectionId="8094e970-3924-42db-bca9-6f32fd1b07b7" DisplayName="プッシュメッセージを送る" sap2010:WorkflowViewState.IdRef="ConnectorActivity_1" UiPathActivityTypeId="e2c7639a-829c-322b-bd62-a896f4b6f881">/);
  assert.match(x, /<isactr:FieldObject Name="_to" Type="FieldArgument">\s*<isactr:FieldObject.Value>\s*<InArgument x:TypeArguments="x:String">\s*<mca:CSharpValue x:TypeArguments="x:String">in_To<\/mca:CSharpValue>/);
  assert.match(x, /<isactr:FieldObject Name="text" Type="FieldArgument">\s*<isactr:FieldObject.Value>\s*<InArgument x:TypeArguments="x:String">テスト &lt;1&gt; &amp; &quot;2&quot;<\/InArgument>/);
  assert.match(x, /<isactr:FieldObject Name="out_sentMessages_array_sub_id" Type="FieldArgument" \/>/);
  assert.doesNotMatch(x, /sco:Collection/, "項目があるときは FieldObject を直に並べる（Studio の形）");
  const [c] = decode(x);
  assert.deepEqual(c.FieldsContainer.InputFields.map((f: { Name: string }) => f.Name), ["to", "text"]);
  assert.equal(c.ConnectorVersion, "1.0.1");
  assert.equal(c.ObjectName, "push_message");
});

test("checkInsertRecord：よくある誤り", () => {
  const paths = (o: Partial<typeof opt> & { values?: Record<string, { lit: string } | { cs: string }> }, ir = line) => checkInsertRecord(ir, { ...opt, ...o }).map((i) => i.path);
  assert.deepEqual(paths({}), []);
  assert.deepEqual(paths({ activity: "nope" }), ["activity"]);
  assert.deepEqual(paths({ values: { to: { lit: "U1" } } }), ["values.text"], "必須の欄に値が無い");
  assert.deepEqual(paths({ values: { ...opt.values, messages: { lit: "x" } } }), ["values.messages"]);
  assert.deepEqual(paths({ activityTypeId: "x", connectionId: "y" }), ["connectionId", "activityTypeId"]);
  const arr: ConnectorIr = { ...line, activities: [{ ...line.activities[0], request: [{ name: "to", required: true }, { name: "messages[*].text" }], hooks: undefined }] };
  assert.deepEqual(paths({ values: { to: { lit: "U1" } } }, arr), ["values.messages[*].text"], "配列の欄は Studio が捨てる");
  assert.throws(() => insertRecord(line, { ...opt, activity: "nope" }), /activity/);
});

test("workflow：C# の Main（入力引数・imports に Integration Service）", () => {
  const x = workflow(line, { ...opt, args: ["in_To"] });
  assert.match(x, /sap2010:ExpressionActivityEditor.ExpressionActivityEditor="C#"/);
  assert.match(x, /xmlns:isactr="http:\/\/schemas.uipath.com\/workflow\/integration-service-activities\/isactr"/);
  assert.match(x, /xmlns:mca="clr-namespace:Microsoft.CSharp.Activities;assembly=System.Activities"/);
  assert.match(x, /<x:Property Name="in_To" Type="InArgument\(x:String\)" \/>/);
  assert.match(x, /<AssemblyReference>UiPath.IntegrationService.Activities.Runtime<\/AssemblyReference>/);
  assert.match(x, /<x:String>UiPath.IntegrationService.Activities.Runtime.Activities<\/x:String>/);
  assert.equal(decode(x).length, 1);
});

test("insertRecord：改行などのある文字列は C# の文字列の式で書く（XAML の要素の中の文字は空白がまとめられ、改行が消えるため）", async () => {
  const { csString, needsCsLiteral } = await import("./xaml.ts");
  assert.equal(needsCsLiteral("1行目\n2行目"), true);
  assert.equal(needsCsLiteral("a\tb"), true);
  assert.equal(needsCsLiteral(" 前に空白"), true);
  assert.equal(needsCsLiteral("後ろに空白 "), true);
  assert.equal(needsCsLiteral("間に  2つ"), true);
  assert.equal(needsCsLiteral("ふつうの 文"), false);
  // 入力は本物の改行・引用符・\・タブ。出力は C# のエスケープ（String.raw はバックスラッシュをそのまま）
  assert.equal(csString('改行\r\nと "引用" と \\ とタブ\t'), String.raw`"改行\r\nと \"引用\" と \\ とタブ\t"`);

  const x = insertRecord(line, { ...opt, values: { to: { lit: "Uxxx" }, text: { lit: "1行目\n2行目 & <3>" } } });
  assert.match(x, /<InArgument x:TypeArguments="x:String">Uxxx<\/InArgument>/, "改行の無い文字列はそのまま");
  assert.ok(x.includes(String.raw`<mca:CSharpValue x:TypeArguments="x:String">&quot;1行目\n2行目 &amp; &lt;3&gt;&quot;</mca:CSharpValue>`), "改行は \\n、\" & < は XAML のエスケープ");
  assert.doesNotMatch(x, /1行目\n2行目/, "要素の中に改行をそのまま書かない");
});

test("configuration：InstanceParameters.Version も ConnectorVersion と同じコネクタの版。キーは --connector-key で渡せる", () => {
  const act = line.activities[0];
  const c = configuration(line, act, { organization: "autofor" });
  assert.equal(c.InstanceParameters.Version, "1.0.1");
  assert.equal(c.ConnectorVersion, "1.0.1");
  assert.equal(configuration(line, act, { organization: "x", connectorKey: "custom-auto-for-linemessagingapi" }).InstanceParameters.ConnectorKey, "custom-auto-for-linemessagingapi");
});

test("checkInsertRecord：組織の名前に - があるときはキーを直に渡す", () => {
  const paths = (o: Partial<InsertRecordOpt>) => checkInsertRecord(line, { ...opt, ...o }).map((i) => i.path);
  assert.deepEqual(paths({ organization: "auto-for" }), ["organization"]);
  assert.deepEqual(paths({ organization: "auto-for", connectorKey: "custom-auto-for-linemessagingapi" }), []);
  assert.deepEqual(paths({ connectorKey: "design-autofor-x" }), ["connectorKey"]);
  const [c] = decode(insertRecord(line, { ...opt, organization: "auto-for", connectorKey: "custom-auto-for-linemessagingapi" }));
  assert.equal(c.InstanceParameters.ConnectorKey, "custom-auto-for-linemessagingapi");
});

test("parseSetValue：@ は C# の式、@@ は @ で始まる文字列", () => {
  assert.deepEqual(parseSetValue("@in_To"), { cs: "in_To" });
  assert.deepEqual(parseSetValue("@@here"), { lit: "@here" });
  assert.deepEqual(parseSetValue("@@@x"), { lit: "@@x" });
  assert.deepEqual(parseSetValue("ふつう @ 途中"), { lit: "ふつう @ 途中" });
});

test("checkInsertRecord：文字列で渡した値が欄の型に読めるか", () => {
  assert.equal(literalProblem("number", "1.5"), undefined);
  assert.equal(literalProblem("number", "-2e3"), undefined);
  assert.match(literalProblem("number", "abc")!, /数値/);
  assert.equal(literalProblem("integer", "42"), undefined);
  assert.match(literalProblem("integer", "4.2")!, /整数/);
  assert.equal(literalProblem("boolean", "True"), undefined);
  assert.match(literalProblem("boolean", "yes")!, /True か False/);
  assert.equal(literalProblem("date", "2026-11-20"), undefined);
  assert.equal(literalProblem("date", "2026-11-20T09:00:00"), undefined);
  assert.match(literalProblem("date", "11/20")!, /日付/);
  assert.equal(literalProblem("string", "なんでも"), undefined);
  assert.equal(literalProblem(undefined, "なんでも"), undefined);
  const ir: ConnectorIr = { ...line, activities: [{ ...line.activities[0], request: [...line.activities[0].request!, { name: "count", type: "integer" }] }] };
  const paths = (count: { lit: string } | { cs: string }) => checkInsertRecord(ir, { ...opt, values: { ...opt.values, count } }).map((i) => i.path);
  assert.deepEqual(paths({ lit: "abc" }), ["values.count"], "生成の前に止める");
  assert.deepEqual(paths({ lit: "3" }), []);
  assert.deepEqual(paths({ cs: "abc" }), [], "C# の式は見ない（型はコンパイルで分かる）");
});
