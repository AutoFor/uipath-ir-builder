#!/usr/bin/env node
// Automation Cloud の REST API を、uip のログイン（プロファイル）のトークンで呼ぶ。
// uip の CLI に無い操作だけに使う（knowledge/cloud-ops.md の「API」）。トークンは表示しない。
//
//   node tools/platform/cloud-api.mjs GET  /odata/TestDataQueues --profile trial --folder-path Shared
//   node tools/platform/cloud-api.mjs POST /odata/TestDataQueues --profile trial --folder-path Shared --body '{"Name":"Q","ContentJsonSchema":"{}"}'
//   node tools/platform/cloud-api.mjs DELETE /api/TestDataQueueActions/DeleteItems --profile trial --folder-path Shared --body '[1,2]'
//
// --service は URL の製品の部分（既定 orchestrator_。testmanager_、du_、dataservice_ など）。
// --folder-path / --folder-key / --folder-id でフォルダを指す（Orchestrator の X-UIPATH-OrganizationUnitId）。
// --folder-key は X-UIPATH-FolderKey も付ける（Maestro の pims_ はこちらを読む）。個人ワークスペースの Key は Folders で引けないので、引けなくても続ける。
// --body は JSON の文字列か @ファイル。GET 以外は、何を変えるかを先に人に確かめてから流す。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function parseArgs(argv) {
  const [method, path, ...rest] = argv;
  const o = { method: (method ?? "").toUpperCase(), path, service: "orchestrator_" };
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i], v = rest[i + 1];
    if (k === "--profile") o.profile = v, i++;
    else if (k === "--service") o.service = v, i++;
    else if (k === "--folder-path") o.folderPath = v, i++;
    else if (k === "--folder-key") o.folderKey = v, i++;
    else if (k === "--folder-id") o.folderId = v, i++;
    else if (k === "--body") o.body = v.startsWith("@") ? readFileSync(v.slice(1), "utf8") : v, i++;
    else throw new Error(`知らない引数：${k}`);
  }
  if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(o.method) || !o.path?.startsWith("/")) {
    throw new Error("使い方：cloud-api.mjs <GET|POST|PUT|PATCH|DELETE> </パス> [--profile 名前] [--service orchestrator_] [--folder-path|--folder-key|--folder-id] [--body JSON|@ファイル]");
  }
  return o;
}

function session(profile) {
  if (profile && !/^[\w.-]+$/.test(profile)) throw new Error(`プロファイルの名前が変：${profile}`);
  const args = ["login", "refresh", "--output", "json", ...(profile ? ["--profile", profile] : [])];
  // Windows の uip は uip.cmd なので cmd 経由で呼ぶ（shell: true は使わない）
  const [cmd, argv] = process.platform === "win32" ? ["cmd.exe", ["/d", "/s", "/c", "uip", ...args]] : ["uip", args];
  const out = execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const d = JSON.parse(out.slice(out.indexOf("{"))).Data;
  if (!d?.AccessToken) throw new Error("uip login refresh からトークンが取れない。uip login status を見る");
  return d;
}

async function call(s, o, method, path, body, folderId, folderKey) {
  const url = `${s.BaseUrl.replace(/\/$/, "")}/${s.OrganizationName}/${s.TenantName}/${o.service}${path}`;
  const headers = { Authorization: `Bearer ${s.AccessToken}`, "Content-Type": "application/json; charset=utf-8" };
  if (folderId) headers["X-UIPATH-OrganizationUnitId"] = String(folderId);
  if (folderKey) headers["X-UIPATH-FolderKey"] = folderKey;
  const r = await fetch(url, { method, headers, body });
  const text = await r.text();
  return { status: r.status, text };
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const s = session(o.profile);
  let folderId = o.folderId;
  if (!folderId && (o.folderPath || o.folderKey)) {
    const f = o.folderKey ? `Key eq ${o.folderKey}` : `FullyQualifiedName eq '${o.folderPath.replace(/'/g, "''")}'`;
    const r = await call(s, { service: "orchestrator_" }, "GET", `/odata/Folders?$filter=${encodeURIComponent(f)}&$select=Id`);
    folderId = JSON.parse(r.text).value?.[0]?.Id;
    if (!folderId && !o.folderKey) throw new Error(`フォルダが見つからない：${o.folderPath}`);
  }
  const r = await call(s, o, o.method, o.path, o.body, folderId, o.folderKey);
  let out = r.text;
  try { out = JSON.stringify(JSON.parse(r.text), null, 2); } catch { /* JSON でなければそのまま */ }
  console.log(JSON.stringify({ status: r.status, org: s.OrganizationName, tenant: s.TenantName }));
  if (out) console.log(out);
  if (r.status >= 400) process.exitCode = 1;
}

main().catch((e) => { console.error(e.message); process.exitCode = 2; });
