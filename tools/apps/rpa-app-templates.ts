// Studio Web で作った RPA アプリのソリューションの書き出し（uip solution download --extract）から、
// tools/apps/rpa-app.ts が使う雛形（templates/rpa-app/）を作る。
//
//   node tools/apps/rpa-app-templates.ts <書き出したソリューションのフォルダ>
//
// 雛形にするもの（knowledge/apps.md の「ローコードの Apps」）:
//   - controls.json：部品（component）ごとに 1 つ。部品の JSON と、その部品の式（expressions のその部品の分）
//   - page.json：ページの骨組み（根のパネルと、その式だけ）
//   - app.json：App 本体の骨組み（appFields は空）
//   - event.xaml：イベントのワークフローの頭（名前空間と参照。Studio Web が作る Apps.* の参照は除く）
//   - files/：そのまま写すファイル（Main.xaml、トリガー、entry-points.json など）
// 人の名前・メール・id、テナント名は消す。

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(root, "templates", "rpa-app");

type Json = any;
const PERSONAL = ["ownerFqn", "ownerId", "createdByFqn", "createdById", "ownerDisplayName", "tenantId"];

function scrub(m: Json): Json {
  for (const k of PERSONAL) if (k in m) m[k] = "";
  for (const k of ["dateCreated", "dateLastOpened"]) if (k in m) m[k] = "2026-01-01T00:00:00.000Z";
  return m;
}

// ページの式から、ある部品の分だけを取る（expressions のキーは部品の id。根のパネルは "ID1"）
const groupOf = (page: Json, controlId: string) => page.expressions[controlId];

export function extract(sol: string) {
  const app = join(sol, "App");
  const models = join(app, ".app", "models");
  const pages: Json[] = [];
  let appModel: Json;
  for (const f of readdirSync(models)) {
    const m = JSON.parse(readFileSync(join(models, f), "utf8"));
    if (m.type === "app") appModel = m;
    else if (m.type === "form") pages.push(m);
  }
  if (!appModel || !pages.length) throw new Error(`App の JSON が見つからない: ${models}`);
  pages.sort((a, b) => a.order - b.order);

  // 部品：最初に出てきたものを雛形にする（根のパネルと、子のあるパネルは除く）
  const controls: Record<string, { control: Json; expressions: Json }> = {};
  for (const p of pages) {
    for (const [id, c] of Object.entries<Json>(p.controls)) {
      if (id === p.rootPanelId || c.config?.childIds?.length || controls[c.component]) continue;
      const control = structuredClone(c);
      delete control._logicalParent;
      for (const e of Object.values<Json>(control.events ?? {})) { e.executors = []; delete e.actionType; }
      controls[c.component] = { control, expressions: structuredClone(groupOf(p, id)) };
    }
  }

  // ページ：最初のページの根のパネルだけを残す
  const first = structuredClone(pages[0]);
  const rootPanel = first.controls[first.rootPanelId];
  rootPanel.config.childIds = [];
  first.controls = { [first.rootPanelId]: rootPanel };
  first.expressions = { [first.rootPanelId]: first.expressions[first.rootPanelId] };
  Object.assign(first, { workflowBindings: {}, bindingReferences: {}, autoDeletedControls: {}, alwaysHydratedControlIds: {}, documentBasedControlIds: {}, codedEventMap: {}, allModelErrors: {}, valueBindingMetadata: {}, pageTitle: "", title: "" });
  scrub(first);

  const appT = scrub(structuredClone(appModel));
  Object.assign(appT, { appFields: [], allModelErrors: {}, valueBindingMetadata: {}, tenants: [], collaborators: [], latestPublishedVersion: null, lastPublishedDate: null, latestPublishType: null });

  // イベントのワークフローの頭：最初の <Sequence の手前まで。Apps.* の参照は消す（Studio Web が作り直して足す）
  const ev = readdirSync(app).find((f) => f.endsWith(".xaml") && f !== "Main.xaml");
  if (!ev) throw new Error("イベントのワークフロー（<ページ>_<部品>_<イベント>.xaml）が無い");
  const evText = readFileSync(join(app, ev), "utf8");
  const head = evText.slice(0, evText.indexOf("  <Sequence")).split("\n").filter((l) => !/<AssemblyReference>Apps\.(app|form)\./.test(l)).join("\n");

  mkdirSync(join(OUT, "files"), { recursive: true });
  const w = (p: string, j: Json) => writeFileSync(join(OUT, p), typeof j === "string" ? j : JSON.stringify(j, null, 1) + "\n", "utf8");
  w("controls.json", controls);
  w("page.json", first);
  w("app.json", appT);
  w("event.xaml", head);
  const FIXED = ["project.json", "Main.xaml", "entry-points.json", ".app/AppsRequestTrigger.xaml", ".app/WorkflowAppsExpressions.json", ".app/documents/documents-metadata.json", ".local/generated/Triggers.Generated.xaml", ".project/PackagerFlags.json"];
  for (const f of FIXED) {
    const to = join(OUT, "files", f);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(app, f), to);
  }
  return { components: Object.keys(controls), pages: pages.length };
}

function main() {
  const sol = process.argv[2];
  if (!sol || !existsSync(join(sol, "App"))) { console.error("使い方: node tools/apps/rpa-app-templates.ts <書き出したソリューションのフォルダ>"); process.exit(2); }
  const r = extract(resolvePath(sol));
  console.log(`OK templates/rpa-app（部品 ${r.components.length}: ${r.components.join(", ")}）`);
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();
