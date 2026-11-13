// ローコードの UiPath Apps（Studio Web の「RPA アプリ」）を IR から作り、Studio Web に取り込めるソリューションにする。
//
//   node tools/apps/rpa-app.ts <app.json> (--out <dir> | --uis <file.uis> | --check)
//     --out <dir>        ソリューションのフォルダを書く（<dir>/<solution>.uipx、<dir>/<app>/...）
//     --uis <file.uis>   取り込み用の zip を書く。Studio Web へは uip solution upload <file.uis>
//                        （フォルダを upload に渡すと .local が送られず、イベントがつながらない）
//     --check            検証だけ
//   終了コード: 0 = 書けた / 1 = 検証で弾かれた / 2 = 使い方の誤り
//
// パーツ（knowledge/apps.md の「ローコードの Apps」）:
//   - ページ：.app/models/models-<systemName>.json。部品は Studio Web の書き出しから取った雛形（templates/rpa-app/controls.json）を
//     写して id を振り直し、文字や必須などの式（expressions）だけを書き換える
//   - App の変数：App 本体の JSON の appFields。式から使うと tokens と bindingReferences でつなぐ
//   - イベント（ボタンのクリック）：RPA のワークフロー <ページ>_<部品>_click.xaml。部品の events から start-automation で呼ぶ。
//     .local/ProjectSettings.json の ProjectAppMetadata で、その XAML をページの codebehind にする
//   - Studio Web が作る DLL（.entities、JitCustomTypes）と、XAML の Apps.* の参照は書かない（取り込んだあと Studio Web が作る）

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { deflateRawSync, crc32 } from "node:zlib";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATES = join(root, "templates", "rpa-app");

// ---- IR ----

export type Value = string | boolean | number | { var: string } | { vb: string };
export type Step = { set: string; value: string } | { open: string };
export type Control = {
  type: ControlType;
  name: string;
  label?: Value; text?: Value; placeholder?: Value; required?: Value; checked?: Value; hidden?: Value; disabled?: Value;
  min?: Value; max?: Value; rows?: Value;
  props?: Record<string, Value>; // 雛形の部品にある式の項目を名前で直接（tooltip など）
  onClick?: Step[]; // button だけ
};
export type Page = { name: string; controls: Control[] };
export type Variable = { name: string; type: "string"; default?: string };
export type RpaApp = { app: string; solution?: string; kind?: "rpa-app"; variables?: Variable[]; pages: Page[] };
export type Issue = { path: string; code: string; message: string };

export type ControlType = "textbox" | "number" | "textarea" | "checkbox" | "dropdown" | "date" | "button" | "label" | "table";
export const COMPONENT: Record<ControlType, string> = {
  textbox: "form-text-vb", number: "form-text-number-vb", textarea: "form-text-area-vb", checkbox: "form-check-box",
  dropdown: "form-dropdown-vb", date: "form-mobile-date-picker-vb", button: "form-button", label: "form-label", table: "form-simple-table-vb",
};
// IR の項目 → 部品の式の項目
const FRIENDLY: Record<string, string> = {
  label: "label", text: "text", placeholder: "placeholder", required: "required", checked: "resolvableChecked",
  hidden: "resolvableHidden", disabled: "resolvableDisabled", min: "inputControlMinValue", max: "inputControlMaxValue", rows: "numberOfRows",
};
const DATA_TYPE: Record<Variable["type"], string> = { string: "System.String" };
const XAML_TYPE: Record<Variable["type"], string> = { string: "x:String" };
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const VB_RESERVED = new Set(["and", "as", "boolean", "byref", "byval", "call", "case", "catch", "class", "const", "date", "decimal", "dim", "do", "double", "each", "else", "end", "error", "false", "finally", "for", "function", "get", "if", "in", "integer", "is", "let", "long", "loop", "me", "mod", "module", "new", "next", "not", "nothing", "object", "of", "on", "or", "property", "public", "rem", "return", "select", "set", "short", "single", "static", "step", "stop", "string", "sub", "then", "to", "true", "try", "until", "when", "while", "with"]);

type Json = any;
let cache: { controls: Json; page: Json; app: Json; event: string } | undefined;
function templates() {
  if (!cache) {
    const r = (f: string) => readFileSync(join(TEMPLATES, f), "utf8");
    cache = { controls: JSON.parse(r("controls.json")), page: JSON.parse(r("page.json")), app: JSON.parse(r("app.json")), event: r("event.xaml") };
  }
  return cache;
}
const vbProps = (component: string): Set<string> =>
  new Set(Object.entries<Json>(templates().controls[component].control.properties).filter(([, p]) => p.valueType === "vb-expression").map(([n]) => n));

// ---- 検証 ----

export function check(a: RpaApp): Issue[] {
  const out: Issue[] = [];
  const add = (path: string, code: string, message: string) => out.push({ path, code, message });
  const name = (n: unknown, at: string) => {
    if (typeof n !== "string" || !IDENT.test(n)) add(at, "APP_NAME", `名前は英字で始まる英数字と _ にする（${JSON.stringify(n)}）`);
    else if (VB_RESERVED.has(n.toLowerCase())) add(at, "APP_NAME", `VB の予約語は名前にできない（${n}）`);
  };
  if (a.kind && a.kind !== "rpa-app") add("kind", "APP_KIND", `kind は "rpa-app"（${a.kind}）`);
  name(a.app, "app");
  const vars = new Map<string, Variable>();
  (a.variables ?? []).forEach((v, i) => {
    const at = `variables[${i}]`;
    name(v.name, `${at}.name`);
    if (vars.has(v.name)) add(`${at}.name`, "APP_NAME", `変数の名前が重なっている（${v.name}）`);
    vars.set(v.name, v);
    if (!(v.type in DATA_TYPE)) add(`${at}.type`, "APP_UNSUPPORTED", `変数の型 ${v.type} はまだ書けない（string だけ。knowledge/apps.md）`);
  });
  if (!Array.isArray(a.pages) || !a.pages.length) { add("pages", "APP_SHAPE", "ページが 1 つも無い"); return out; }
  const pages = new Map<string, Set<string>>();
  a.pages.forEach((p, i) => {
    name(p.name, `pages[${i}].name`);
    if (pages.has(p.name)) add(`pages[${i}].name`, "APP_NAME", `ページの名前が重なっている（${p.name}）`);
    if (vars.has(p.name)) add(`pages[${i}].name`, "APP_NAME", `ページと変数の名前が重なっている（${p.name}）`);
    pages.set(p.name, new Set((p.controls ?? []).map((c) => c.name)));
  });
  const value = (v: Value, at: string) => {
    if (v && typeof v === "object") {
      if ("var" in v) { if (!vars.has(v.var)) add(at, "APP_REF", `変数 ${v.var} が無い`); }
      else if (!("vb" in v) || typeof v.vb !== "string" || !v.vb.trim()) add(at, "APP_SHAPE", "値は文字・真偽・数、{ var }、{ vb } のどれか");
      else controlsRef(v.vb, at);
    } else if (!["string", "boolean", "number"].includes(typeof v)) add(at, "APP_SHAPE", "値は文字・真偽・数、{ var }、{ vb } のどれか");
  };
  // 式の中の Controls.<ページ>.<部品> がある名前か
  const controlsRef = (expr: string, at: string) => {
    for (const m of expr.matchAll(/\bControls\.(\w+)(?:\.(\w+))?/g)) {
      const ctl = pages.get(m[1]);
      if (!ctl) add(at, "APP_REF", `ページ ${m[1]} が無い（${m[0]}）`);
      else if (m[2] && !ctl.has(m[2])) add(at, "APP_REF", `ページ ${m[1]} に部品 ${m[2]} が無い（${m[0]}）`);
    }
  };
  a.pages.forEach((p, pi) => {
    const seen = new Set<string>();
    (p.controls ?? []).forEach((c, ci) => {
      const at = `pages[${pi}].controls[${ci}]`;
      name(c.name, `${at}.name`);
      if (seen.has(c.name)) add(`${at}.name`, "APP_NAME", `部品の名前がページの中で重なっている（${c.name}）`);
      seen.add(c.name);
      const comp = COMPONENT[c.type as ControlType];
      if (!comp) { add(`${at}.type`, "APP_TYPE", `部品 ${c.type} は無い（${Object.keys(COMPONENT).join(" / ")}）`); return; }
      const has = vbProps(comp);
      for (const [k, v] of Object.entries(c)) {
        if (["type", "name", "props", "onClick"].includes(k)) continue;
        if (!(k in FRIENDLY)) { add(`${at}.${k}`, "APP_PROP", `項目 ${k} は無い（${Object.keys(FRIENDLY).join(", ")}、props、onClick）`); continue; }
        if (!has.has(FRIENDLY[k])) { add(`${at}.${k}`, "APP_PROP", `${c.type} に ${k} は無い`); continue; }
        value(v as Value, `${at}.${k}`);
      }
      for (const [k, v] of Object.entries(c.props ?? {})) {
        if (!has.has(k)) add(`${at}.props.${k}`, "APP_PROP", `${c.type}（${comp}）に式の項目 ${k} は無い`);
        else value(v, `${at}.props.${k}`);
      }
      if (c.onClick) {
        if (c.type !== "button") add(`${at}.onClick`, "APP_PROP", "onClick は button だけ");
        c.onClick.forEach((s: Json, si) => {
          const sat = `${at}.onClick[${si}]`;
          if ("set" in s) {
            if (!vars.has(s.set)) add(`${sat}.set`, "APP_REF", `変数 ${s.set} が無い`);
            if (typeof s.value !== "string" || !s.value.trim()) add(`${sat}.value`, "APP_SHAPE", "value は VB の式");
            else controlsRef(s.value, `${sat}.value`);
          } else if ("open" in s) {
            if (!pages.has(s.open)) add(`${sat}.open`, "APP_REF", `ページ ${s.open} が無い`);
            else if (s.open === p.name) add(`${sat}.open`, "APP_REF", "いまのページは開けない");
          } else add(sat, "APP_SHAPE", "手順は { set, value } か { open }");
        });
      }
    });
  });
  return out;
}

// ---- 生成 ----

const hex = () => randomBytes(16).toString("hex");
const vbString = (s: string) => `"${s.replace(/"/g, '""')}"`;
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Ids = { next: () => string };

// 雛形を写し、32 桁の id（部品・式）を新しくし、内部の通し番号（"id": "ID1234"）を振り直す
function cloneWithNewIds(t: Json, ids: Ids, map = new Map<string, string>()): Json {
  const re = (s: string) => s.replace(/\bid[0-9a-f]{32}\b/g, (old) => { if (!map.has(old)) map.set(old, `id${hex()}`); return map.get(old)!; });
  const walk = (v: Json): Json => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: Json = {};
      for (const [k, x] of Object.entries(v)) o[re(k)] = k === "id" && typeof x === "string" && /^ID\d+$/.test(x) ? ids.next() : walk(x);
      return o;
    }
    return typeof v === "string" ? re(v) : v;
  };
  return walk(t);
}

type Built = { model: Json; formId: string; systemName: string; events: { file: string; xaml: string }[] };

function setExpr(ctl: Json, group: Json, prop: string, v: Value, appFields: Map<string, Json>, refs: Json) {
  const p = ctl.properties[prop];
  const eid = p.value.expressionId;
  const e = group.expressions[eid];
  if (!e) throw new Error(`雛形の ${ctl.component} に ${prop} の式が無い（templates/rpa-app を作り直す）`);
  e.tokens = [];
  if (v && typeof v === "object" && "var" in v) {
    const f = appFields.get(v.var)!;
    Object.assign(e, { expression: v.var, isLiteral: false, addedVia: "VEB" });
    e.tokens = [{ token: v.var, type: "AppVariables.AppVariable", startIndex: 0, endIndex: v.var.length, tokenId: f.id, tokenType: "app-variable", isContextualArg: false, properties: [] }];
    (refs[f.id] ??= []).push(eid);
  } else if (v && typeof v === "object") Object.assign(e, { expression: v.vb, isLiteral: false });
  else Object.assign(e, { expression: typeof v === "string" ? vbString(v) : String(v), isLiteral: true });
}

function eventXaml(page: string, control: string, steps: Step[], forms: Map<string, { formId: string }>, vars: Map<string, Variable>): string {
  const t = templates().event;
  const body = steps.map((s, i) => {
    if ("set" in s) {
      const ty = XAML_TYPE[vars.get(s.set)!.type];
      return `    <Assign DisplayName="Assign" sap2010:WorkflowViewState.IdRef="Assign_${i + 1}">
      <Assign.To>
        <OutArgument x:TypeArguments="${ty}">[AppVariable.${s.set}]</OutArgument>
      </Assign.To>
      <Assign.Value>
        <InArgument x:TypeArguments="${ty}">[${xml(s.value)}]</InArgument>
      </Assign.Value>
    </Assign>`;
    }
    return `    <uwana:OpenAppsPage AsBottomSheet="{x:Null}" AsBottomSheetEnabled="{x:Null}" AsPopOver="{x:Null}" AsPopOverEnabled="{x:Null}" OpenInPageContainer="{x:Null}" PageContainerArg="{x:Null}" PageContainerId="{x:Null}" PreventCloseOnClick="{x:Null}" PreventCloseOnClickEnabled="{x:Null}" Result="{x:Null}" CurrentFormId="${forms.get(page)!.formId}" DisplayName="Open Apps Page" sap2010:WorkflowViewState.IdRef="OpenAppsPage_${i + 1}" PageFormId="${forms.get(s.open)!.formId}" PageName="${s.open}">
      <uwana:OpenAppsPage.OpenInPageContainerExpression>
        <scg:Dictionary x:TypeArguments="x:String, x:String" />
      </uwana:OpenAppsPage.OpenInPageContainerExpression>
      <uwana:OpenAppsPage.PageArg>
        <InArgument x:TypeArguments="x:String">
          <Literal x:TypeArguments="x:String">
            <sap:WorkflowViewStateService.ViewState>
              <scg:Dictionary x:TypeArguments="x:String, x:Object">
                <x:String x:Key="apps::expression">Controls.${s.open}</x:String>
              </scg:Dictionary>
            </sap:WorkflowViewStateService.ViewState>${s.open}</Literal>
        </InArgument>
      </uwana:OpenAppsPage.PageArg>
      <uwana:OpenAppsPage.PageNameExpression>
        <scg:Dictionary x:TypeArguments="x:String, x:String" />
      </uwana:OpenAppsPage.PageNameExpression>
    </uwana:OpenAppsPage>`;
  });
  return `${t}  <Sequence sap:VirtualizedContainerService.HintSize="356,732" sap2010:WorkflowViewState.IdRef="Sequence_1">
    <sap:WorkflowViewStateService.ViewState>
      <scg:Dictionary x:TypeArguments="x:String, x:Object">
        <x:Boolean x:Key="IsExpanded">True</x:Boolean>
      </scg:Dictionary>
    </sap:WorkflowViewStateService.ViewState>
    <ui:ManualTrigger Result="{x:Null}" DisplayName="${page}_${control} : クリック時 Event" sap2010:WorkflowViewState.IdRef="ManualTrigger_1" />
${body.join("\n")}
  </Sequence>
</Activity>`;
}

export function generateFiles(a: RpaApp): Record<string, string> {
  const T = templates();
  const solution = a.solution ?? a.app;
  const solutionId = randomUUID(), projectId = randomUUID(), projectKey = randomUUID();
  const appSystemName = `ID${hex()}`;
  const vars = new Map((a.variables ?? []).map((v) => [v.name, v]));

  // App の変数
  const appFields = new Map<string, Json>();
  (a.variables ?? []).forEach((v, i) => appFields.set(v.name, {
    id: `hs${[...randomBytes(13)].map((b) => String(b % 100).padStart(2, "0")).join("").slice(0, 25)}`,
    name: v.name, type: v.type, defaultValue: v.default ?? null,
    appVariableDefinition: { id: `ID${2001 + i}`, name: v.name, baseType: "primitive", dataType: DATA_TYPE[v.type], defaultValue: v.default ?? null, options: [], dataTypeTokenId: null, dataTypeTokenType: null, fields: [] },
  }));

  // ページの id を先に決める（Open Apps Page が別のページの formId を使う）
  const forms = new Map(a.pages.map((p) => [p.name, { formId: `id${hex()}`, systemName: `ID${hex()}` }]));
  const files: Record<string, string> = {};
  const appMetadata: Record<string, Json> = {};
  const P = (f: string) => `${a.app}/${f}`;

  a.pages.forEach((pg, order) => {
    const { formId, systemName } = forms.get(pg.name)!;
    const page = structuredClone(T.page);
    let counter = page.idCounter;
    const ids: Ids = { next: () => `ID${++counter}` };
    const rootId = page.rootPanelId;
    const appRef = Object.values<Json>(page.rootReferences)[0];
    Object.assign(page, { id: `ID${hex()}`, order, systemName, appSystemName, formId, title: pg.name, rootReferences: { [appSystemName]: appRef } });
    const refs: Json = {};
    for (const c of pg.controls ?? []) {
      const t = T.controls[COMPONENT[c.type]];
      const map = new Map<string, string>();
      const ctl = cloneWithNewIds(t.control, ids, map);
      const group = cloneWithNewIds(t.expressions, ids, map);
      Object.assign(ctl, { name: c.name, _logicalParent: rootId });
      for (const [k, v] of Object.entries(c)) if (k in FRIENDLY) setExpr(ctl, group, FRIENDLY[k], v as Value, appFields, refs);
      for (const [k, v] of Object.entries(c.props ?? {})) setExpr(ctl, group, k, v, appFields, refs);
      if (c.onClick?.length) {
        const file = `${pg.name}_${c.name}_click.xaml`;
        const automationId = randomUUID();
        ctl.events.click.executors = [{ id: ids.next(), executorMethod: "start-automation", config: { automationId, workflowPath: file } }];
        ctl.events.click.actionType = "automation";
        page.workflowBindings[automationId] = { id: ids.next(), controlId: ctl.id, workflowPath: null, activities: {} };
        files[P(file)] = eventXaml(pg.name, c.name, c.onClick, forms, vars);
        appMetadata[file] = { AppFormId: formId, IsAppQueryBuilder: null };
      }
      page.controls[ctl.id] = ctl;
      page.controls[rootId].config.childIds.push(ctl.id);
      page.expressions[ctl.id] = group;
    }
    page.bindingReferences = refs;
    page.idCounter = counter + 1;
    files[P(`.app/models/models-${systemName}.json`)] = JSON.stringify(page);
  });

  // App 本体
  const start = forms.get(a.pages[0].name)!;
  const app = structuredClone(T.app);
  const ref = Object.values<Json>(app.rootReferences)[0];
  Object.assign(app, {
    id: `ID${hex()}`, systemName: appSystemName, title: a.app, appFields: [...appFields.values()],
    rootReferences: { [start.systemName]: ref },
    defaultForm: { ...app.defaultForm, rootSystemName: start.systemName, instanceJPath: `$.rootReferences.${start.systemName}.instances[?(@.id=="${ref.instances[0].id}")]` },
    unifiedProjectId: projectId, unifiedBuildSolutionId: solutionId, cacheKey: String(Date.now()),
  });
  files[P(`.app/models/models-${appSystemName}.json`)] = JSON.stringify(app);
  files[P(`.app/.context/${appSystemName}.json`)] = JSON.stringify({ expressionLanguage: "VB", isBlankApp: "true", projectType: "Process" }, null, 2);
  files[P(".app/documents/libraries-metadata.json")] = JSON.stringify({ [app.id]: { id: app.id, isPublic: false, parentId: null, metadata: { createdByDisplayName: "", createdByEmail: "", createdByFqn: "", createdOnDate: new Date().toISOString(), description: "", title: a.app } } });
  files[P(".local/ProjectSettings.json")] = JSON.stringify({ ProjectBreakpoints: '{"Value":{}}', ProjectWatches: '{"Value":[]}', ActivitiesMetadata: "{}", ProjectAppMetadata: JSON.stringify(appMetadata), ProjectAppExpressionsMetadata: "{}" });

  // そのまま写すファイル（トリガーの id だけ新しくする）
  const triggerId = randomUUID();
  const fixed = join(TEMPLATES, "files");
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  for (const f of walk(fixed)) {
    const rel = relative(fixed, f).replace(/\\/g, "/");
    files[P(rel)] = readFileSync(f, "utf8").replace(/c469b871-8511-4639-b839-6b3688ad5cd6/g, triggerId);
  }
  const project = JSON.parse(files[P("project.json")]);
  Object.assign(project, { name: a.app, projectId });
  files[P("project.json")] = JSON.stringify(project, null, 2);
  files[P("project.uiproj")] = JSON.stringify({ ProjectType: "WebApp", WebAppSettings: { AppId: appSystemName, IsCoreProject: true }, Name: a.app, Description: null, MainFile: "Main.xaml" }, null, 2);

  // ソリューション
  files[`${solution}.uipx`] = JSON.stringify({ DocVersion: "1.0.0", StudioMinVersion: "2025.04.0", SolutionId: solutionId, Projects: [{ Type: "WebApp", ProjectRelativePath: P("project.uiproj"), Id: projectKey }], AutomationHubIdeaUrl: null }, null, 2);
  files["SolutionStorage.json"] = JSON.stringify({ SolutionId: solutionId, Projects: [{ ProjectId: projectId, ProjectRelativePath: P("project.uiproj") }] }, null, 2);
  const key = { app: randomUUID(), appVersion: randomUUID(), package: randomUUID(), process: randomUUID() };
  const res = (kind: string, apiVersion: string, deps: Json[], spec: Json, folders = true, extra: Json = {}) => JSON.stringify({ docVersion: "1.0.0", resource: { name: a.app, kind, ...extra, apiVersion, projectKey, isOverridable: true, dependencies: deps, runtimeDependencies: [], files: [], folders: folders ? [{ fullyQualifiedName: "solution_folder" }] : [], spec, locks: [], key: (key as Json)[kind] } }, null, 2);
  files[`resources/solution_folder/app/${a.app}.json`] = res("app", "apps.uipath.com/v1", [{ name: a.app, kind: "appVersion" }, { name: a.app, kind: "process" }], { name: a.app, description: null, type: "Regular", version: null, appSystemName: null, appVersionRef: { key: key.appVersion }, codeBehindProcess: { key: key.process }, actionSchema: null, manualActivationActions: null });
  files[`resources/solution_folder/appVersion/${a.app}.json`] = res("appVersion", "apps.uipath.com/v2", [], { name: a.app, description: null, publishNote: null, version: null, projectId: null, isAppPublic: false, packageFile: null, packageKey: null }, false);
  files[`resources/solution_folder/package/${a.app}.json`] = res("package", "orchestrator.uipath.com/v1", [], { fileName: null, fileReference: null, name: a.app, description: null });
  files[`resources/solution_folder/process/webApp/${a.app}.json`] = res("process", "orchestrator.uipath.com/v1", [{ name: a.app, kind: "package" }], {
    entryPointUniqueId: null, inputArgumentsSchema: null, outputArgumentsSchema: null, inputArgumentsSchemaV2: null, outputArgumentsSchemaV2: null, type: "WebApp", name: a.app, description: null,
    package: { key: key.package }, packageName: `${solution.replace(/\s+/g, ".")}.webApp.${a.app}`, packageVersion: null, entryPointName: null, inputArguments: null, jobPriority: "Medium",
    hiddenForAttendedUser: true, alwaysRunning: true, autoStartProcess: false, jobRecording: "Disabled", targetFrameworkValue: "Portable", duration: 40, frequency: 500, quality: 100,
    remoteControlAccess: "None", robotSize: "Automatic", retentionAction: "Delete", retentionPeriod: 30, retentionBucketRef: null, staleRetentionAction: "Delete", staleRetentionPeriod: 180,
    staleRetentionBucketRef: null, entryPoints: null, connections: null, tags: [],
  }, true, { type: "webApp" });
  return files;
}

// 開く先のページは、取り込んだあと Studio Web で式を 1 回直すまで DLL ができない（knowledge/apps.md）
export function notices(a: RpaApp): string[] {
  const targets = new Set(a.pages.flatMap((p) => p.controls.flatMap((c) => (c.onClick ?? []).flatMap((s) => ("open" in s ? [s.open] : [])))));
  return [...targets].map((t) => `APP_OPEN_PAGE  ページ ${t} を開く手順がある。取り込んだあと、Studio Web で ${t} の部品の式を 1 回直して保存するまで「Selected page is not accessible」になる`);
}

// ---- zip（.uis）----

export function zip(files: Record<string, string>): Buffer {
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, "utf8"), comp = deflateRawSync(data), n = Buffer.from(name, "utf8"), crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    local.push(h, n, comp); central.push(c, n);
    offset += h.length + n.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

function main() {
  const args = process.argv.slice(2);
  const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const out = val("--out"), uis = val("--uis"), checkOnly = args.includes("--check");
  const files = args.filter((a, i) => !a.startsWith("--") && !["--out", "--uis"].includes(args[i - 1]));
  if (files.length !== 1 || (!out && !uis && !checkOnly)) { console.error("使い方: node tools/apps/rpa-app.ts <app.json> (--out <dir> | --uis <file.uis> | --check)"); process.exit(2); }
  const app: RpaApp = JSON.parse(readFileSync(files[0], "utf8"));
  const issues = check(app);
  if (issues.length) {
    console.log(`NG ${files[0]}`);
    for (const i of issues) console.log(`  ${i.code.padEnd(16)} ${i.path}: ${i.message}`);
    process.exit(1);
  }
  for (const n of notices(app)) console.log(`  注意 ${n}`);
  if (checkOnly) { console.log(`OK ${files[0]}`); return; }
  const gen = generateFiles(app);
  if (out) {
    for (const [p, s] of Object.entries(gen)) { const f = join(resolvePath(out), p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s, "utf8"); }
    console.log(`OK ${files[0]} -> ${out}（${Object.keys(gen).length} ファイル）`);
  }
  if (uis) {
    mkdirSync(dirname(resolvePath(uis)), { recursive: true });
    writeFileSync(uis, zip(gen));
    console.log(`OK ${files[0]} -> ${uis}（Studio Web へは uip solution upload ${uis}）`);
  }
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();
