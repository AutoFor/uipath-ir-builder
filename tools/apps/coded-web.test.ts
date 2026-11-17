// tools/apps/coded-web.ts（Coded Web App の生成器）のテスト。
// npm install・build・uip codedapp pack は、samples/apps/work-portal.json で手で確かめた（knowledge/apps.md）。ここでは書いたものの中身を見る。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appTsx, check, generateFiles, scopes, type WebApp } from "./coded-web.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sample: WebApp = JSON.parse(readFileSync(join(root, "samples", "apps", "work-portal.json"), "utf8"));
const codes = (a: WebApp) => check(a).map((i) => i.code).sort();
const base = (x: Partial<WebApp> = {}): WebApp => ({ app: "w", kind: "web", title: "W", records: [{ title: "R", entity: "E", columns: [{ field: "Name" }] }], ...x });

test("見本は検証を通る", () => {
  assert.deepEqual(check(sample), []);
});

test("検証", () => {
  assert.deepEqual(codes(base()), []);
  assert.deepEqual(codes(base({ kind: "action" as "web" })), ["APP_KIND"]);
  assert.deepEqual(codes(base({ app: "Bad" })), ["APP_NAME"]);
  assert.deepEqual(codes(base({ baseUrl: "https://cloud.uipath.com" })), ["APP_SHAPE"]);
  assert.deepEqual(codes(base({ baseUrl: "https://alpha.api.uipath.com" })), []);
  assert.deepEqual(codes(base({ records: [] })), ["APP_SHAPE"]);
  assert.deepEqual(codes(base({ records: [{ title: "R", columns: [{ field: "a" }] }] })), ["APP_RECORDS"]);
  assert.deepEqual(codes(base({ processes: [{ title: "P", name: "X", folderPath: "Shared", folderKey: "00000000-0000-0000-0000-000000000000" }] })), ["APP_PROCESS"]);
  assert.deepEqual(codes(base({ processes: [{ title: "P", name: "X", inputs: [{ name: "a" }, { name: "a" }] }] })), ["APP_PROCESS"]);
  assert.deepEqual(codes(base({ processes: [{ title: "P", name: "X", inputs: [{ name: "a", type: "date" as "string" }] }] })), ["APP_PROCESS"]);
});

test("スコープは使うサービスから決める（IR の scope があればそれ）", () => {
  assert.equal(scopes(sample), "DataFabric.Schema.Read DataFabric.Data.Read OR.Execution OR.Jobs");
  assert.equal(scopes(base()), "DataFabric.Schema.Read DataFabric.Data.Read");
  assert.equal(scopes(base({ scope: "X" })), "X");
});

test("書くファイル：スキルのテンプレート（Q6 = no）の骨組み", () => {
  const f = generateFiles(sample);
  assert.deepEqual(Object.keys(f).sort(), [".gitignore", "index.html", "postcss.config.js", "src/App.tsx", "src/components/RecordList.css", "src/components/RecordList.tsx", "src/components/StartProcess.tsx", "src/hooks/useAuth.tsx", "src/index.css", "src/main.tsx", "tsconfig.json", "uipath.json", "vite.config.ts"]);
  assert.deepEqual(JSON.parse(f["uipath.json"]), {
    clientId: "<External Application の client ID>", scope: "DataFabric.Schema.Read DataFabric.Data.Read OR.Execution OR.Jobs",
    orgName: "<組織名>", tenantName: "<テナント名>", baseUrl: "https://api.uipath.com", redirectUri: "http://localhost:5173",
  });
  assert.match(f["vite.config.ts"], /base: '\.\/'/);
  assert.match(f["vite.config.ts"], /uipathCodedApps\(\)/);
  // OAuth PKCE：new UiPath()（設定は meta から）→ sdk.initialize() でサインイン → completeOAuth()
  assert.match(f["src/hooks/useAuth.tsx"], /new UiPath\(\)/);
  assert.match(f["src/hooks/useAuth.tsx"], /await sdk\.initialize\(\);/);
  assert.match(f["src/hooks/useAuth.tsx"], /await sdk\.completeOAuth\(\);/);
  assert.equal(f["src/index.css"], '@import "tailwindcss";\n');
  // 部品だけで、使わないものは書かない
  const g = generateFiles(base());
  assert.ok(!("src/components/StartProcess.tsx" in g));
  assert.ok(!appTsx(base()).includes("Processes"));
});

test("App.tsx：サービスは useAuth の sdk から作り、表とプロセスのフォームを並べる", () => {
  const t = appTsx(sample);
  assert.match(t, /const entities = useMemo\(\(\) => new Entities\(sdk\), \[sdk\]\);/);
  assert.match(t, /const processes = useMemo\(\(\) => new Processes\(sdk\), \[sdk\]\);/);
  assert.match(t, /<RecordList\n\s+entities=\{entities\}\n\s+title="稼働日カレンダー"\n\s+entity="WorkCalendar"/);
  assert.match(t, /processName="WorkCalendarCheck"\n\s+folderPath="Shared"/);
  assert.match(t, /\{ name: 'in_Date', label: '日付（yyyy-MM-dd）', type: 'string', required: true \}/);
  assert.match(t, /button="確かめる"/);
  const f = generateFiles(sample);
  assert.match(f["src/components/StartProcess.tsx"], /processes\.start\(\n\s+\{ name: processName \},\n\s+\{ folderPath, folderKey, inputArguments:/);
});
