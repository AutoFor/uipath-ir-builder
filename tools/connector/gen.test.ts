// Connector Builder の生成器（tools/connector/gen.ts）。
// - IR の検査と、CLI のコマンド・フィールドのファイルの組み立て（CLI を呼ばない）
// - 見本（samples/connector/*.json）を実際の CLI でローカルに作り、validate が通ること・できたファイルの中身（CLI が入っていなければ飛ばす）

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, fieldsOf, plan, run, type ConnectorIr } from "./gen.ts";

const root = join(import.meta.dirname, "..", "..");
const sample = (n: string) => JSON.parse(readFileSync(join(root, "samples", "connector", n), "utf8")) as ConnectorIr;
const base: ConnectorIr = {
  connector: "Acme", baseUrl: "https://api.acme.com", auth: { type: "none" },
  activities: [{ name: "items", method: "GET", path: "/items" }],
};

test("check：見本は誤りが無い", () => {
  for (const f of readdirSync(join(root, "samples", "connector"))) assert.deepEqual(check(sample(f)), [], f);
});

test("check：よくある誤りを見つける", () => {
  const msgs = (ir: ConnectorIr) => check(ir).map((i) => i.path);
  assert.deepEqual(msgs({ ...base, baseUrl: "http://api.acme.com" }), ["baseUrl"]);
  assert.deepEqual(msgs({ ...base, baseUrl: "https://api.acme.com/" }), ["baseUrl"]);
  assert.deepEqual(msgs({ ...base, categories: ["Chat"] }), ["categories"]);
  assert.deepEqual(msgs({ ...base, auth: { type: "apiKey" } }), ["auth"], "header か query のどちらか");
  assert.deepEqual(msgs({ ...base, auth: { type: "apiKey", header: "X-Key", validate: "v1/me" } }), ["auth.validate"]);
  assert.deepEqual(msgs({ ...base, activities: [] }), ["activities"]);
  assert.deepEqual(msgs({ ...base, version: "1.0" }), ["version"]);
  assert.deepEqual(msgs({ ...base, activities: [{ name: "a", method: "POST", path: "/a", hooks: { preRequest: "return 1;" } }] }), ["activities[0].hooks.preRequest"], "done で返す");
  assert.deepEqual(msgs({ ...base, activities: [{ name: "a", method: "POST", path: "/a", hooks: { onError: "done();" } as never }] }), ["activities[0].hooks.onError"]);
  const hook = (code: string | string[]) => msgs({ ...base, activities: [{ name: "a", method: "POST", path: "/a", hooks: { preRequest: code } }] });
  assert.deepEqual(hook(["// done() で返す", "return 1;"]), ["activities[0].hooks.preRequest"], "コメントの中の done( は数えない");
  assert.deepEqual(hook("/* done( */ return 1;"), ["activities[0].hooks.preRequest"]);
  assert.deepEqual(hook("log('done(');"), ["activities[0].hooks.preRequest"], "文字列の中の done( は数えない");
  assert.deepEqual(hook("x.done({});"), ["activities[0].hooks.preRequest"], "ほかのものの done は数えない");
  assert.deepEqual(hook(["// 組み立てる", "const s = 'a // b';", "done({ request_vendor_body: { s } });"]), []);
  assert.deepEqual(msgs({ ...base, activities: [{ name: "Items", method: "GET", path: "items" }] }), ["activities[0].name", "activities[0].path"]);
  assert.deepEqual(msgs({ ...base, activities: [{ name: "a", method: "GET", path: "/a" }, { name: "a", method: "POST", path: "/a" }] }), ["activities[1].name"]);
  assert.deepEqual(msgs({ ...base, activities: [{ name: "a", method: "GET", path: "/a", request: [{ name: "x" }] }] }), ["activities[0].request"]);
  assert.deepEqual(msgs({ ...base, activities: [{ name: "a", method: "POST", path: "/a", response: [{ name: "x", required: true }] }] }), ["activities[0].response[0].required"]);
});

test("fieldsOf：request / response をメソッドの下に、required もメソッドの下に、同じ名前は1つに", () => {
  const f = fieldsOf({
    name: "a", method: "POST", path: "/a",
    request: [{ name: "id", required: true, primary: true, label: "ID" }, { name: "kind", sample: "text", enum: ["text"] }],
    response: [{ name: "id" }, { name: "ok", type: "boolean" }],
  });
  assert.deepEqual(f, [
    { name: "id", type: "string", method: { POST: { request: true, required: true, response: true } }, displayName: "ID", design: { position: "primary" } },
    { name: "kind", type: "string", method: { POST: { request: true } }, sampleValue: "text", enum: ["text"] },
    { name: "ok", type: "boolean", method: { POST: { response: true } } },
  ]);
});

test("plan：init → auth set → activity create → hook create → validate。apiKey は customApiKey、Bearer は prefix", () => {
  const { commands, issues } = plan(sample("line-messaging.json"), { organization: "acme" });
  assert.deepEqual(issues, []);
  assert.deepEqual(commands.map((c) => c.args.slice(3, 6).join(" ")), ["init --name LINE Messaging API", "auth set --connector-dir", "activity create --connector-dir", "activity hook create", "validate --connector-dir {root}"]);
  const [init, auth, act, hook] = commands;
  assert.deepEqual(hook.args.slice(6), ["--connector-dir", "{root}", "--resource-name", "push_message", "--method", "POST", "--hook-type", "preRequest", "--custom-code-file", "hook-push_message-preRequest.js"]);
  assert.match(hook.files!["hook-push_message-preRequest.js"], /done\(\{ request_vendor_body: \{ to: b\.to, messages: \[\{ type: 'text', text: b\.text \}\] \} \}\);\n$/);
  assert.ok(init.args.includes("--organization") && init.args.includes("acme"));
  assert.deepEqual(auth.args.slice(5), ["--connector-dir", "{root}", "--auth-type", "customApiKey", "--api-key-param-name", "Authorization", "--api-key-prefix", "Bearer ", "--key-config-display-name", "チャネルアクセストークン", "--validation-vendor-path", "/v2/bot/info", "--validation-method", "GET"].slice(0));
  assert.ok(act.args.includes("--fields-file") && act.files?.["fields-push_message.json"]);
  assert.equal(act.args[act.args.indexOf("--vendor-path") + 1], "/v2/bot/message/push");
});

test("plan：本文の無い POST は --no-body、query の apiKey は --api-key-location query", () => {
  const { commands } = plan({ ...base, auth: { type: "apiKey", query: "key" }, activities: [{ name: "start", method: "POST", path: "/jobs/start" }] });
  assert.ok(commands[1].args.includes("--api-key-location"));
  assert.ok(commands[2].args.includes("--no-body"));
  assert.ok(!commands[2].args.includes("--fields-file"));
});

const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");

test("run：見本を CLI でローカルに作り、validate が通る（テナントには上げない）", { skip: !existsSync(uipJs) && "uip の CLI が無い", timeout: 300_000 }, () => {
  const work = mkdtempSync(join(tmpdir(), "connector-"));
  try {
    const r = run(sample("line-messaging.json"), work, { organization: "irtest" });
    assert.ok(r.ok, r.error);
    assert.equal(r.key, "design-irtest-linemessagingapi");
    const el = join(r.root!, "app", "element");
    const e = JSON.parse(readFileSync(join(el, "element.json"), "utf8"));
    assert.deepEqual(e.authentication, { type: "customApiKey" });
    const key = e.configuration.find((c: { key: string }) => c.key === "custom.api.key");
    assert.equal(key.type, "PASSWORD");
    assert.equal(key.encrypt, true, "トークンは暗号化される");
    assert.equal(e.configuration.find((c: { key: string }) => c.key === "base.url").defaultValue, "https://api.line.me");
    assert.ok(e.parameters.some((p: { vendorName: string; name: string }) => p.vendorName === "Authorization" && p.name === "Bearer ${configuration.custom.api.key}"));
    assert.deepEqual(e.resources.map((x: { method: string; vendorPath: string }) => `${x.method} ${x.vendorPath}`).sort(), ["GET /v2/bot/info", "POST /v2/bot/message/push"]);
    const sr = JSON.parse(readFileSync(join(el, "standard-resources", "push_message.json"), "utf8"));
    assert.equal(sr.fields["text"].method.POST.required, true);
    // フック：resource-<name>-<method>-<type>.js に置かれ、element.json の resources[].hooks に登録される
    const push = e.resources.find((x: { method: string; path: string }) => x.method === "POST" && x.path === "/push_message");
    assert.deepEqual(push.hooks.map((h: { type: string; ref: string }) => `${h.type} ${h.ref}`), ["preRequest resource-push_message-POST-preRequest.js"]);
    assert.match(readFileSync(join(el, "hooks", "resource-push_message-POST-preRequest.js"), "utf8"), /request_vendor_body/);
    assert.equal(sr.fields["sentMessages[*].id"].method.POST.response, true);
    assert.equal(sr.fields["to"].displayName, "送り先");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
