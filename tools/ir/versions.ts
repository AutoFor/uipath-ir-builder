// どの版のカタログを使うかを決める。カタログの版の一覧はここにだけ書く（AUT-612）。
//
// - 指定なし：既定の版（DEFAULT_VERSIONS）
// - --project <dir>：その UiPath プロジェクトの project.json の dependencies の版。カタログに無い版はエラー（推測で近い版を使わない）
//
// ルートの imports を既存の XAML から読むのもここ（どちらも「対象プロジェクトに合わせる」ためのもの）。

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadCatalog } from "./catalog.ts";
import type { Catalog } from "./catalog.ts";

// 既定の版（C:\Users\Public\uipath-ir-probe に合わせたもの）。読み込む順もこのまま
export const DEFAULT_VERSIONS: Record<string, string> = {
  "System.Activities": "6.0.0",
  "UiPath.System.Activities": "26.10.0",
  "UiPath.UIAutomation.Activities": "26.10.6",
  "UiPath.Excel.Activities": "3.6.1",
  "UiPath.Persistence.Activities": "1.13.0",
  "UiPath.Testing.Activities": "25.10.1",
};
const CODED_BASE = { pkg: "UiPath.CodedWorkflows", version: "24.10.3" };
// project.json の dependencies に書かれないもの（.NET と Coded の基底クラス）。書かれていれば、そちらの版を使う
const IMPLICIT = new Set(["System.Activities", CODED_BASE.pkg]);

export const catalogFile = (pkg: string, version: string) => `catalog/${pkg}/${version}.json`;
export const DEFAULT_CATALOG_FILES = Object.entries(DEFAULT_VERSIONS).map(([p, v]) => catalogFile(p, v));
export const DEFAULT_SERVICE_FILES = [
  ...["UiPath.System.Activities", "UiPath.UIAutomation.Activities", "UiPath.Excel.Activities", "UiPath.Testing.Activities"].map((p) => catalogFile(p, DEFAULT_VERSIONS[p])),
  catalogFile(CODED_BASE.pkg, CODED_BASE.version),
];

// 版を決められないときのエラー。CLI は runSelection でメッセージを出して終了コード 2 にする
export class VersionError extends Error {}

export type Selection = {
  versions: Record<string, string>; // パッケージ -> 版
  files: string[]; // loadCatalog に渡すカタログ
  serviceFiles: string[]; // tools/coded/check.ts が読むカタログ
  legacy: string[]; // 古い形式のカタログ（services も readOnly の判定も無い）
  warnings: string[];
};

// "[26.10.0]" や "26.10.0" から版を取り出す。範囲（"[1.0,2.0)" など）は1つに決められないのでエラー
export function parseDependencyVersion(pkg: string, spec: string): string {
  const m = spec.trim().match(/^\[?\s*([0-9A-Za-z.+-]+)\s*\]?$/);
  const ok = m && (spec.includes("[") ? spec.trim().endsWith("]") : !spec.includes("]"));
  if (!ok) throw new VersionError(`${pkg} の版 "${spec}" は範囲なので、カタログを1つに決められない。project.json に版を1つだけ書く（例 "[1.2.3]"）`);
  return m![1];
}

const readJson = (f: string) => JSON.parse(readFileSync(f, "utf8").replace(/^\uFEFF/, ""));

export function readProject(projectDir: string) {
  const f = join(projectDir, "project.json");
  if (!existsSync(f)) throw new VersionError(`${f} が無い。--project には UiPath プロジェクトのフォルダを渡す`);
  return readJson(f);
}

// project.json の式の言語（expressionLanguage）。書いていなければ VisualBasic（Studio の既定）。知らない値はエラー
export function projectLanguage(projectDir: string): "VisualBasic" | "CSharp" {
  const l = readProject(projectDir).expressionLanguage ?? "VisualBasic";
  if (l !== "VisualBasic" && l !== "CSharp") throw new VersionError(`${join(projectDir, "project.json")} の expressionLanguage "${l}" は扱えない（VisualBasic か CSharp）`);
  return l;
}

// 古い抽出器で作ったカタログ：services の項目が無く、readOnly のプロパティも1つも無い。
// （services が無いだけなら Coded API の無いパッケージ。Persistence と System.Activities がそう）
function isLegacy(c: { services?: unknown; activities: { props: { readOnly?: boolean }[] }[] }) {
  return !("services" in c) && !c.activities.some((a) => a.props.some((p) => p.readOnly));
}

// 指定がなければ既定の版。coded: true は C# を作るとき（services の無い古い版はエラーにする）
export function selectCatalogs(root: string, projectDir?: string, opts: { coded?: boolean } = {}): Selection {
  if (!projectDir) return { versions: { ...DEFAULT_VERSIONS }, files: DEFAULT_CATALOG_FILES, serviceFiles: DEFAULT_SERVICE_FILES, legacy: [], warnings: [] };

  const pj = readProject(projectDir);
  const warnings: string[] = [];
  const catalogDir = join(root, "catalog");
  const known = readdirSync(catalogDir);
  const available = (pkg: string) => readdirSync(join(catalogDir, pkg)).filter((f) => f.endsWith(".json") && !f.endsWith(".objects.json")).map((f) => f.replace(/\.json$/, ""));

  const wanted = new Map<string, string>([["System.Activities", DEFAULT_VERSIONS["System.Activities"]]]);
  const errors: string[] = [];
  const deps = Object.entries((pj.dependencies ?? {}) as Record<string, string>);
  for (const [name, spec] of deps) {
    const pkg = known.find((k) => k.toLowerCase() === name.toLowerCase()); // NuGet のパッケージ名は大文字小文字を区別しない
    if (!pkg) { warnings.push(`${name} のカタログが無い。このパッケージのアクティビティは書けない（検証で「未知のアクティビティ」になる）`); continue; }
    try {
      const v = parseDependencyVersion(name, spec);
      if (!available(pkg).includes(v)) errors.push(`${pkg} ${v} のカタログが無い（手元にある版：${available(pkg).join(", ")}）`);
      else wanted.set(pkg, v);
    } catch (e) {
      if (!(e instanceof VersionError)) throw e;
      errors.push(e.message);
    }
  }
  if (errors.length) throw new VersionError([`${join(projectDir, "project.json")} の版に合うカタログを選べない。`, ...errors.map((e) => `  ${e}`), "近い版で代用しない。抽出器でその版のカタログを作る（docs/version-upgrade.md の手順 1〜2）"].join("\n"));

  // 読む順は既定と同じにする（同じ名前のアクティビティの扱いが順番で変わらないように）
  const order = [...Object.keys(DEFAULT_VERSIONS), ...[...wanted.keys()].filter((p) => !(p in DEFAULT_VERSIONS))];
  const pkgs = order.filter((p) => wanted.has(p) && p !== CODED_BASE.pkg);
  const versions = Object.fromEntries(pkgs.map((p) => [p, wanted.get(p)!]));
  const files = pkgs.map((p) => catalogFile(p, wanted.get(p)!));
  const codedBase = catalogFile(CODED_BASE.pkg, wanted.get(CODED_BASE.pkg) ?? CODED_BASE.version);

  const legacy: string[] = [];
  const serviceFiles: string[] = [];
  for (const p of pkgs) {
    const f = catalogFile(p, wanted.get(p)!);
    const c = readJson(join(root, f));
    if (!IMPLICIT.has(p) && "services" in c) serviceFiles.push(f);
    if (isLegacy(c)) {
      legacy.push(`${p} ${wanted.get(p)}`);
      warnings.push(`${p} ${wanted.get(p)} は古い形式のカタログ。読み取り専用の判定（readOnly）が無いので、setter の無いプロパティを書いても検証で弾けず、build の「Cannot set unknown member」で分かる。out の Result も欠けていることがある`);
    }
    const objFile = (v: string) => join(root, `catalog/${p}/${v}.objects.json`);
    if (!existsSync(objFile(wanted.get(p)!)) && available(p).some((v) => existsSync(objFile(v))))
      warnings.push(`${p} ${wanted.get(p)} に .objects.json が無い。objs に書くオブジェクト（UI のターゲットなど）は書けない`);
  }
  serviceFiles.push(codedBase);
  // 古い形式に見えるカタログでも、対応表（mappings/<pkg>/）の無いパッケージは、C# から API を呼ばない（アクティビティは XAML 経由で呼ぶ。
  // knowledge/coded-via-xaml.md）。readOnly のプロパティがたまたま無い、Coded API の無い新しいカタログ（WebAPI 1.20.1 など）もここに入る
  const mapped = (l: string) => existsSync(join(root, "mappings", l.slice(0, l.lastIndexOf(" "))));
  if (opts.coded && legacy.some(mapped))
    throw new VersionError(`C# を作れない。次のカタログには services（Coded API）が無く、呼び出しを確かめられない：${legacy.filter(mapped).join(", ")}。その版の DLL から抽出器で作り直す（docs/version-upgrade.md の手順 2）`);
  if (opts.coded) for (const l of legacy.filter((x) => !mapped(x))) warnings.push(`${l} には services（Coded API）も対応表も無い。C# では、このパッケージのアクティビティを XAML 経由（RunWorkflow）で呼ぶ`);
  if (pj.targetFramework && pj.targetFramework !== "Windows") warnings.push(`このプロジェクトの targetFramework は ${pj.targetFramework}。生成器は Windows（.NET）の XAML で確かめている`);
  return { versions, files, serviceFiles, legacy, warnings };
}

// services（Coded API）の無いパッケージ（.NET の System.Activities と Coded の基底クラスは除く）。
// C# の生成器は、このパッケージのアクティビティを XAML 経由で呼ぶ（coded-via-xaml.ts）
export function noCodedApiPackages(root: string, files: string[]): string[] {
  return files.map((f) => readJson(join(root, f))).filter((c) => !IMPLICIT.has(c.package) && !("services" in c)).map((c) => c.package as string);
}

// サンプルのフォルダ（samples/ir/<pkg>/ など）のパッケージが既定の版に無ければ、既定のカタログにそのパッケージの最新の版を足したもの。
// 既定の版にあるか、カタログが無ければ既定のまま
export function sampleCatalogFiles(root: string, pkg: string | undefined): string[] {
  if (!pkg || pkg in DEFAULT_VERSIONS || !existsSync(join(root, "catalog", pkg))) return DEFAULT_CATALOG_FILES;
  const cmp = (a: string, b: string) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); return 0; };
  const vs = readdirSync(join(root, "catalog", pkg)).filter((f) => f.endsWith(".json") && !f.endsWith(".objects.json")).map((f) => f.replace(/\.json$/, "")).sort(cmp);
  return vs.length ? [...DEFAULT_CATALOG_FILES, catalogFile(pkg, vs[vs.length - 1])] : DEFAULT_CATALOG_FILES;
}

// カタログを読み、既定 XAML が揃っていない版の注意も warnings に足す
export function loadSelected(root: string, projectDir?: string, opts: { coded?: boolean } = {}): { cat: Catalog; selection: Selection; warnings: string[] } {
  const selection = selectCatalogs(root, projectDir, opts);
  const cat = loadCatalog(root, selection.files);
  const warnings = [...selection.warnings];
  for (const [pkg, s] of Object.entries(cat.defaultSources))
    if (!s.flat) warnings.push(`${pkg} ${cat.versions[pkg]} の既定 XAML は ${s.versioned} 件（knowledge/default-xaml/${pkg}/${cat.versions[pkg]}/）。無いアクティビティには既定値（Version=V5 など）を足さない。必要なら取る（docs/version-upgrade.md の手順 5）`);
  return { cat, selection, warnings };
}

// CLI 用：VersionError はメッセージだけ出して終了コード 2
export function runSelection<T>(f: () => T): T {
  try {
    return f();
  } catch (e) {
    if (!(e instanceof VersionError)) throw e;
    console.error(e.message);
    process.exit(2);
  }
}

// ---- ルートの imports / AssemblyReference ----

export type RootImports = { imports: string[]; refs: string[] };

const unescapeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function block(xaml: string, name: string, item: RegExp): string[] {
  const m = xaml.match(new RegExp(`<TextExpression\\.${name}>([\\s\\S]*?)</TextExpression\\.${name}>`));
  return m ? [...m[1].matchAll(item)].map((x) => unescapeXml(x[1].trim())) : [];
}

// XAML のルートの imports を読む。無ければ undefined（呼ぶ側がエラーか注意にする）
export function readRootImports(xaml: string): RootImports | undefined {
  const imports = block(xaml, "NamespacesForImplementation", /<x:String\b[^>]*>([^<]*)<\/x:String>/g);
  const refs = block(xaml, "ReferencesForImplementation", /<AssemblyReference\b[^>]*>([^<]*)<\/AssemblyReference>/g);
  return imports.length && refs.length ? { imports, refs } : undefined;
}

// --imports-from：明示された XAML に imports が無ければエラー（黙ってテンプレートに戻さない）
export function readRootImportsFile(file: string): RootImports {
  if (!existsSync(file)) throw new VersionError(`--imports-from の XAML が無い: ${file}`);
  const r = readRootImports(readFileSync(file, "utf8"));
  if (!r) throw new VersionError(`${file} に TextExpression.NamespacesForImplementation / ReferencesForImplementation が無い`);
  return r;
}

// --project：main の XAML、無ければ直下の XAML（名前順）のうち、imports のある最初のもの。どれも無ければテンプレート（注意を出す）
export function projectRootImports(projectDir: string): { imports?: RootImports; notes: string[] } {
  const pj = readProject(projectDir);
  const others = readdirSync(projectDir).filter((f) => /\.xaml$/i.test(f)).sort();
  const cands = [...new Set([...(pj.main && others.includes(pj.main) ? [pj.main] : []), ...others])];
  for (const f of cands) {
    const r = readRootImports(readFileSync(join(projectDir, f), "utf8"));
    if (r) return { imports: r, notes: [] };
  }
  return { notes: [`${projectDir} に imports のある XAML が無いので、ルートの imports は BlankTemplate の並びを使う`] };
}
