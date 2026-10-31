// テナントの資源の照合（AUT-1079）。成果物が指す RPA、エージェント、Action App、接続が、テナントに本当にあるかを見る。
// check、compile、validate はテナントを見ないので、無い資源を指していても通る（docs/maestro-tenant-resources.md）。
// テナントへの操作は一覧の読み取りだけ。verify.mjs の --tenant から使う。

const GUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const low = (s) => String(s ?? "").toLowerCase();

function findBindings(node, out = []) {
  if (Array.isArray(node)) for (const x of node) findBindings(x, out);
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "bindings" && Array.isArray(v)) out.push(...v);
      else findBindings(v, out);
    }
  }
  return out;
}

function fromBindings(bindings) {
  const groups = new Map();
  for (const b of bindings) {
    const kind = low(b.resource);
    if (!kind || !b.resourceKey) continue;
    const key = `${kind}|${b.resourceKey}`;
    const g = groups.get(key) ?? { kind, resourceKey: b.resourceKey };
    if (b.propertyAttribute === "name") g.name = b.default;
    if (b.propertyAttribute === "folderPath") g.folder = b.default;
    if (b.propertyAttribute === "ConnectionId") g.id = b.default;
    groups.set(key, g);
  }
  const refs = [];
  for (const g of groups.values()) {
    if (g.kind === "connection") refs.push({ kind: "connection", id: g.id ?? g.resourceKey });
    else if (g.kind === "app") refs.push({ kind: "app", name: g.name, folder: g.folder, key: new RegExp(`^${GUID}$`).test(g.resourceKey) ? g.resourceKey : undefined });
    else if (g.name) refs.push({ kind: "process", name: g.name, folder: g.folder });
    else refs.push({ kind: g.kind, unchecked: true, name: g.resourceKey });
  }
  return refs;
}

/** 成果物の中身から、テナントの資源への参照を取り出す */
export function extractRefs(family, text) {
  if (family === "bpmn") {
    const refs = [];
    for (const m of text.matchAll(/<uipath:binding\b[^>]*>/g)) {
      const attr = (n) => m[0].match(new RegExp(`\\b${n}="([^"]*)"`))?.[1];
      if (low(attr("resource")) === "connection" && attr("propertyAttribute") === "ConnectionId") refs.push({ kind: "connection", id: attr("default") });
    }
    // startProcess は binding を作らず、context に folderPath と name を直接書く
    for (const m of text.matchAll(/name="folderPath"[^>]*value="([^"]*)"\s*\/>\s*<uipath:input name="name"[^>]*value="([^"]*)"/g)) {
      if (!m[1].startsWith("=") && !m[2].startsWith("=")) refs.push({ kind: "process", name: m[2], folder: m[1] });
    }
    return refs;
  }
  const doc = JSON.parse(text);
  const refs = fromBindings(findBindings(doc));
  // Flow の RPA などは、ノードの型にリリースのキーが入っている。名前が合っていてもキーが違うことがある
  for (const n of Array.isArray(doc.nodes) ? doc.nodes : []) {
    const m = String(n.type ?? "").match(new RegExp(`^uipath\\.core\\.(?:rpa-workflow|api-workflow|agent|agentic-process)\\.(${GUID})$`));
    if (m) refs.push({ kind: "processKey", key: m[1], where: n.id });
  }
  return refs;
}

/** 参照を一覧と突き合わせて、診断を返す。tenant = { processes: [{Key, Name, FolderPath}], apps: [{Key, Name, Folder}], connections: [{Id, Name, State}] } */
export function checkRefs(refs, tenant) {
  const out = [];
  const error = (code, message, where = null) => out.push({ level: "error", code, where, message });
  for (const r of refs) {
    if (r.unchecked) {
      out.push({ level: "warning", code: "REF_UNCHECKED", where: null, message: `照合の方法が無い資源（${r.kind}: ${r.name}）` });
    } else if (r.kind === "process") {
      const same = tenant.processes.filter((p) => p.Name === r.name);
      if (!same.length) error("REF_NOT_FOUND", `プロセス「${r.name}」がテナントに無い（フォルダ ${r.folder ?? "指定なし"}）`);
      else if (r.folder && !same.some((p) => p.FolderPath === r.folder)) error("REF_WRONG_FOLDER", `プロセス「${r.name}」はフォルダ ${r.folder} に無い（ある場所: ${same.map((p) => p.FolderPath).join("、")}）`);
    } else if (r.kind === "processKey") {
      if (!tenant.processes.some((p) => low(p.Key) === low(r.key))) error("REF_NOT_FOUND", `リリースのキー ${r.key} がテナントに無い`, r.where);
    } else if (r.kind === "app") {
      const hit = tenant.apps.filter((a) => (r.key ? low(a.Key) === low(r.key) : a.Name === r.name));
      if (!hit.length) error("REF_NOT_FOUND", `アプリ「${r.name}」がテナントに無い`);
      else if (r.folder && !hit.some((a) => a.Folder === r.folder)) error("REF_WRONG_FOLDER", `アプリ「${r.name}」はフォルダ ${r.folder} に無い（ある場所: ${hit.map((a) => a.Folder).join("、")}）`);
    } else if (r.kind === "connection") {
      const c = tenant.connections.find((x) => low(x.Id) === low(r.id));
      if (!c) error("REF_NOT_FOUND", `接続 ${r.id} がテナントに無い（registry prepare をしていない記号名かもしれない）`);
      else if (c.State !== "Enabled") out.push({ level: "warning", code: "REF_CONNECTION_STATE", where: null, message: `接続「${c.Name}」の状態が ${c.State}` });
    }
  }
  return out;
}
