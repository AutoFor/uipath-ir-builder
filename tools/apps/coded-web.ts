// Coded Web App（URL で開く React + TypeScript のアプリ。@uipath/uipath-typescript の SDK で UiPath を呼ぶ）を IR から作る。
//
//   node tools/apps/coded-web.ts <app.json> --out <dir> [--check]
//     --out <dir>  プロジェクトのフォルダに書く（package.json、uipath.json、src/...）
//     --check      検証だけ
//   終了コード: 0 = 書けた / 1 = 検証で弾かれた / 2 = 使い方の誤り
//
// 形は UiPath のスキル（uipath-coded-apps）の Coded Web App のテンプレート（web-app-template.md の「Q6 = no（bare Tailwind）」）のまま:
//   - サインイン：src/hooks/useAuth.tsx（OAuth PKCE。new UiPath() は設定を <meta name="uipath:*"> から読み、sdk.initialize() でサインインへ飛ぶ）
//   - 設定：uipath.json（clientId、scope、orgName、tenantName、baseUrl、redirectUri）。手元では @uipath/coded-apps-dev の Vite プラグインが meta にする。
//     デプロイ先ではプラットフォームが meta を入れる
//   - 画面：records（Data Fabric のレコードの表。tools/apps/coded-parts.ts の RecordList）と processes（プロセスを始めるフォーム）
//   - スコープ：使うサービスから決める（SDK の docs/oauth-scopes.md とスキルの Common Scope Bundles）
//
// 書いたあとは、そのフォルダで npm install → npm run build。uip codedapp pack / publish / deploy で出す（publish は -t Web が既定）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { RECORD_LIST_CSS, RECORD_LIST_TSX, checkRecords, recordListJsx, type Issue, type RecordList } from "./coded-parts.ts";

// ---- IR ----

export type ProcessInput = { name: string; label?: string; type?: "string" | "number" | "boolean"; required?: boolean };
export type ProcessForm = {
  title: string; // フォームの見出し
  name: string; // Orchestrator のプロセスの名前（processes.start({ name }) ）
  folderPath?: string; // プロセスのフォルダ（例 "Shared"）。無ければアプリをデプロイしたフォルダ
  folderKey?: string; // フォルダの GUID。folderPath とどちらか
  inputs?: ProcessInput[]; // 入力引数（inputArguments に JSON で渡す）
  button?: string; // ボタンの文字（既定「始める」）
};
export type WebApp = {
  app: string; // kebab-case。フォルダ名
  kind: "web";
  title: string;
  subtitle?: string;
  clientId?: string; // External Application（非機密）の client ID。無ければ書き換える印を入れる
  orgName?: string; // cloud.uipath.com/<orgName>
  tenantName?: string; // 例 DefaultTenant
  baseUrl?: string; // API のホスト（既定 https://api.uipath.com。cloud.uipath.com ではない）
  redirectUri?: string; // 手元の開発の URL（既定 http://localhost:5173）
  scope?: string; // スコープを自分で決めるとき。無ければ使うサービスから作る
  records?: RecordList[];
  processes?: ProcessForm[];
};

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const PLACEHOLDER = { clientId: "<External Application の client ID>", orgName: "<組織名>", tenantName: "<テナント名>" };

export function check(app: WebApp): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(app.app ?? "")) add("app", "APP_NAME", "app は小文字の kebab-case（例 work-portal）。フォルダ名になる");
  if (app.kind !== "web") add("kind", "APP_KIND", "kind は web（Action App は tools/apps/coded-action.ts）");
  if (!app.title) add("title", "APP_SHAPE", "title（画面の見出し）が要る");
  if (app.baseUrl !== undefined && !/^https:\/\/([a-z]+\.)?api\.uipath\.com\/?$/.test(app.baseUrl)) add("baseUrl", "APP_SHAPE", "baseUrl は API のホスト（https://api.uipath.com など。cloud.uipath.com ではない）");
  if (app.redirectUri !== undefined && !/^https?:\/\//.test(app.redirectUri)) add("redirectUri", "APP_SHAPE", "redirectUri は URL");
  for (const k of ["clientId", "orgName", "tenantName", "scope"] as const) if (app[k] !== undefined && typeof app[k] !== "string") add(k, "APP_SHAPE", `${k} は文字列`);
  checkRecords(app.records, "records", add);
  if (app.processes !== undefined && !Array.isArray(app.processes)) add("processes", "APP_PROCESS", "processes は配列");
  (Array.isArray(app.processes) ? app.processes : []).forEach((p, i) => {
    const at = `processes[${i}]`;
    if (!p.title) add(`${at}.title`, "APP_PROCESS", "title（フォームの見出し）が要る");
    if (!p.name) add(`${at}.name`, "APP_PROCESS", "name（プロセスの名前）が要る");
    if (p.folderPath && p.folderKey) add(`${at}.folderKey`, "APP_PROCESS", "folderPath と folderKey はどちらか 1 つ");
    if (p.folderKey && !GUID.test(p.folderKey)) add(`${at}.folderKey`, "APP_PROCESS", "folderKey は GUID");
    const names = new Set<string>();
    (p.inputs ?? []).forEach((x, j) => {
      if (!x.name) add(`${at}.inputs[${j}].name`, "APP_PROCESS", "name（入力引数の名前）が要る");
      if (names.has(x.name)) add(`${at}.inputs[${j}].name`, "APP_PROCESS", `"${x.name}" が重なっている`);
      names.add(x.name);
      if (x.type !== undefined && !["string", "number", "boolean"].includes(x.type)) add(`${at}.inputs[${j}].type`, "APP_PROCESS", "type は string / number / boolean");
    });
  });
  if (!(app.records ?? []).length && !(app.processes ?? []).length) add("records", "APP_SHAPE", "records か processes が 1 つは要る");
  return issues;
}

// ---- 作る ----

// OAuth のスコープ。Data Fabric（読む）は DataFabric.Schema.Read DataFabric.Data.Read、プロセスを始めるのは OR.Execution OR.Jobs
export function scopes(app: WebApp): string {
  if (app.scope) return app.scope;
  return [
    ...((app.records ?? []).length ? ["DataFabric.Schema.Read", "DataFabric.Data.Read"] : []),
    ...((app.processes ?? []).length ? ["OR.Execution", "OR.Jobs"] : []),
  ].join(" ");
}

const js = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
const jsx = (s: string) => s.replace(/[{}<>&]/g, (c) => `{'${c}'}`);

export function appTsx(app: WebApp): string {
  const records = app.records ?? [];
  const processes = app.processes ?? [];
  const ind = "        ";
  const parts = [
    ...records.map((r) => recordListJsx(r, "entities", ind)),
    ...processes.map((p) => [
      `${ind}<StartProcess`,
      `${ind}  processes={processes}`,
      `${ind}  title=${JSON.stringify(p.title)}`,
      `${ind}  processName=${JSON.stringify(p.name)}`,
      ...(p.folderPath ? [`${ind}  folderPath=${JSON.stringify(p.folderPath)}`] : []),
      ...(p.folderKey ? [`${ind}  folderKey=${JSON.stringify(p.folderKey)}`] : []),
      `${ind}  inputs={[${(p.inputs ?? []).map((x) => `{ name: ${js(x.name)}, label: ${js(x.label ?? x.name)}, type: ${js(x.type ?? "string")}${x.required ? ", required: true" : ""} }`).join(", ")}]}`,
      `${ind}  button=${JSON.stringify(p.button ?? "始める")}`,
      `${ind}/>`,
    ].join("\n")),
  ];
  return `// tools/apps/coded-web.ts が IR（${app.app}）から作った。手で直さない
// 形はスキルのテンプレート（web-app-template.md の src/App.tsx「Q6 = no」）。サインインするまではサインインの画面を出す
import { useMemo } from 'react';
${records.length ? "import { Entities } from '@uipath/uipath-typescript/entities';\n" : ""}${processes.length ? "import { Processes } from '@uipath/uipath-typescript/processes';\n" : ""}import { AuthProvider, useAuth } from './hooks/useAuth';
${records.length ? "import RecordList from './components/RecordList';\n" : ""}${processes.length ? "import StartProcess from './components/StartProcess';\n" : ""}
function AppContent() {
  const { isAuthenticated, isLoading, error, login, logout, sdk } = useAuth();
  // サービスは useAuth の sdk から作る（スキルの create-web-app.md「SDK Setup」）
${records.length ? "  const entities = useMemo(() => new Entities(sdk), [sdk]);\n" : ""}${processes.length ? "  const processes = useMemo(() => new Processes(sdk), [sdk]);\n" : ""}
  if (isLoading) return <div className="p-8">読み込み中…</div>;
  if (error) return <div className="p-8 text-red-600 break-words">エラー：{error}</div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-lg shadow p-8 text-center">
          <h1 className="text-2xl font-semibold mb-2 break-words">${jsx(app.title)}</h1>
          <p className="text-gray-600 mb-6">UiPath のアカウントでサインインする。</p>
          <button
            onClick={login}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            UiPath でサインイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="flex justify-between items-center gap-4 p-4 border-b">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate">${jsx(app.title)}</h1>
${app.subtitle ? `          <p className="text-sm text-gray-600 truncate">${jsx(app.subtitle)}</p>\n` : ""}        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-600 hover:text-gray-900 shrink-0"
        >
          サインアウト
        </button>
      </header>
      <main className="p-8 max-w-5xl mx-auto">
${parts.join("\n")}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
`;
}

// プロセスを始めるフォーム。processes.start({ name }, { folderPath / folderKey, inputArguments })
export const START_PROCESS_TSX = `// tools/apps/coded-web.ts が書いた。手で直さない
// プロセスを始める。Processes.start({ name }, options)。フォルダを渡さなければ、アプリをデプロイしたフォルダ
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Processes } from '@uipath/uipath-typescript/processes';

export interface ProcessInput {
  name: string; // 入力引数の名前（in_Date など）
  label: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
}

interface StartProcessProps {
  processes: Processes;
  title: string;
  processName: string;
  folderPath?: string;
  folderKey?: string;
  inputs: ProcessInput[];
  button: string;
}

type Value = string | number | boolean;

function StartProcess({ processes, title, processName, folderPath, folderKey, inputs, button }: StartProcessProps) {
  const [values, setValues] = useState<Record<string, Value>>(() =>
    Object.fromEntries(inputs.map((i) => [i.name, i.type === 'boolean' ? false : i.type === 'number' ? 0 : ''])),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = inputs.every((i) => !i.required || i.type !== 'string' || String(values[i.name]).trim() !== '');
  const set = (name: string, value: Value) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const jobs = await processes.start(
        { name: processName },
        { folderPath, folderKey, inputArguments: inputs.length ? JSON.stringify(values) : undefined },
      );
      setResult(jobs.map((j) => \`\${j.key}（\${j.state}）\`).join('、'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="my-6 border rounded-lg p-4">
      <h2 className="text-base font-semibold mb-3 break-words">{title}</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {inputs.map((i) => (
          <label key={i.name} className="flex flex-col gap-1 text-sm min-w-0">
            <span className="truncate">
              {i.label}
              {i.required && <span className="text-red-600"> *</span>}
            </span>
            {i.type === 'boolean' ? (
              <input type="checkbox" className="w-4 h-4" checked={values[i.name] === true} onChange={(e) => set(i.name, e.target.checked)} />
            ) : (
              <input
                type={i.type === 'number' ? 'number' : 'text'}
                step="any"
                className="border rounded px-2 py-1"
                value={String(values[i.name])}
                onChange={(e) => set(i.name, i.type === 'number' ? Number(e.target.value) || 0 : e.target.value)}
              />
            )}
          </label>
        ))}
        <button
          type="submit"
          disabled={busy || !valid}
          className="self-start py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? '始めています…' : button}
        </button>
      </form>
      {result && <p className="mt-3 text-sm text-green-700 break-words">始めたジョブ：{result}</p>}
      {error && <p className="mt-3 text-sm text-red-600 break-words" role="alert">始められませんでした：{error}</p>}
    </section>
  );
}

export default StartProcess;
`;

// ---- 決まった骨組み（スキルの web-app-template.md のまま。文字は日本語にした） ----

// useAuth.tsx はテンプレートの写し（注釈だけ日本語）
const USE_AUTH_TSX = `import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { UiPath, UiPathError } from '@uipath/uipath-typescript/core';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  sdk: UiPath;
  login: () => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // new UiPath() は clientId / orgName / tenantName / baseUrl / scope / redirectUri を <meta name="uipath:*"> から読む。
  // 手元では uipathCodedApps()（Vite のプラグイン）が uipath.json から入れ、デプロイ先ではプラットフォームが入れる
  const [sdk] = useState<UiPath>(() => new UiPath());
  const didInit = useRef(false);

  useEffect(() => {
    // React の StrictMode は開発中に 2 回呼ぶ。OAuth のコードは 1 回しか使えないので 2 回目を止める
    if (didInit.current) return;
    didInit.current = true;

    const initializeAuth = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (sdk.isInOAuthCallback()) {
          await sdk.completeOAuth();
          // 再読み込みで使い終わったコードをまた使わないよう、URL から OAuth の引数を消す
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setIsAuthenticated(sdk.isAuthenticated());
      } catch (err) {
        console.error('Authentication failed:', err);
        setError(err instanceof UiPathError ? err.message : 'サインインできませんでした');
      } finally {
        setIsLoading(false);
      }
    };
    initializeAuth();
  }, [sdk]);

  const login = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await sdk.initialize();
    } catch (err) {
      setError(err instanceof UiPathError ? err.message : 'サインインできませんでした');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    sdk.logout();
    setIsAuthenticated(false);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, sdk, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
`;

const FIXED: Record<string, (app: WebApp) => string> = {
  "index.html": (a) => `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${a.title.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  "vite.config.ts": () => `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { uipathCodedApps } from '@uipath/coded-apps-dev/vite'

// base: './' は必ず要る（プラットフォームがルートでない場所に置く）。
// uipathCodedApps() は手元の開発で uipath.json を <meta name="uipath:*"> にする。server.proxy は足さない（OAuth の戻りを壊す）
export default defineConfig({
  base: './',
  plugins: [
    react(),
    uipathCodedApps(),
  ],
  optimizeDeps: {
    include: ['@uipath/uipath-typescript'],
  },
})
`,
  "postcss.config.js": () => `export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
`,
  "tsconfig.json": () => JSON.stringify({
    compilerOptions: {
      target: "ES2022", lib: ["ES2022", "DOM", "DOM.Iterable"], module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx",
      strict: true, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true, isolatedModules: true, noUnusedLocals: true, noUnusedParameters: true, types: ["vite/client"],
    },
    include: ["src"],
  }, null, 2) + "\n",
  "src/index.css": () => `@import "tailwindcss";\n`,
  // Q6 = no は Vite の main.tsx のまま
  "src/main.tsx": () => `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,
  "src/hooks/useAuth.tsx": () => USE_AUTH_TSX,
  ".gitignore": () => "node_modules\ndist\n.uipath\n",
};

export const PACKAGE_VERSIONS = {
  "@uipath/uipath-typescript": "^1.8.4",
  "@uipath/coded-apps-dev": "^1.0.0-beta.1",
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "@vitejs/plugin-react": "^6.0.0",
  typescript: "~5.9.3",
  vite: "^8.0.0",
  tailwindcss: "^4.0.0",
  "@tailwindcss/postcss": "^4.0.0",
  postcss: "^8.4.0",
  autoprefixer: "^10.4.0",
};
const packageJson = (a: WebApp) => {
  const v = PACKAGE_VERSIONS;
  return JSON.stringify({
    name: a.app, private: true, version: "1.0.0", type: "module",
    scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
    dependencies: { "@uipath/uipath-typescript": v["@uipath/uipath-typescript"], react: v.react, "react-dom": v["react-dom"] },
    devDependencies: {
      "@tailwindcss/postcss": v["@tailwindcss/postcss"], "@types/react": v["@types/react"], "@types/react-dom": v["@types/react-dom"], "@uipath/coded-apps-dev": v["@uipath/coded-apps-dev"],
      "@vitejs/plugin-react": v["@vitejs/plugin-react"], autoprefixer: v.autoprefixer, postcss: v.postcss, tailwindcss: v.tailwindcss, typescript: v.typescript, vite: v.vite,
    },
  }, null, 2) + "\n";
};

// uipath.json：SDK の設定のただ 1 つの置き場所（.env は使わない）
export const uipathJson = (a: WebApp) => JSON.stringify({
  clientId: a.clientId ?? PLACEHOLDER.clientId,
  scope: scopes(a),
  orgName: a.orgName ?? PLACEHOLDER.orgName,
  tenantName: a.tenantName ?? PLACEHOLDER.tenantName,
  baseUrl: a.baseUrl ?? "https://api.uipath.com",
  redirectUri: a.redirectUri ?? "http://localhost:5173",
}, null, 2) + "\n";

export function generateFiles(app: WebApp): Record<string, string> {
  const files: Record<string, string> = {};
  files["uipath.json"] = uipathJson(app);
  files["src/App.tsx"] = appTsx(app);
  for (const [p, f] of Object.entries(FIXED)) files[p] = f(app);
  if ((app.records ?? []).length) { files["src/components/RecordList.tsx"] = RECORD_LIST_TSX; files["src/components/RecordList.css"] = RECORD_LIST_CSS; }
  if ((app.processes ?? []).length) files["src/components/StartProcess.tsx"] = START_PROCESS_TSX;
  return files;
}

// package.json は無いときだけ書く（npm install で版が足されたものを消さない）
export function writeProject(app: WebApp, out: string): string[] {
  const written: string[] = [];
  const put = (p: string, s: string) => { const f = join(out, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s, "utf8"); written.push(f); };
  for (const [p, s] of Object.entries(generateFiles(app))) put(p, s);
  if (!existsSync(join(out, "package.json"))) put("package.json", packageJson(app));
  return written;
}

function main() {
  const args = process.argv.slice(2);
  const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const out = val("--out");
  const checkOnly = args.includes("--check");
  const files = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
  if (files.length !== 1 || (!out && !checkOnly)) { console.error("使い方: node tools/apps/coded-web.ts <app.json> (--out <dir> | --check)"); process.exit(2); }
  const app: WebApp = JSON.parse(readFileSync(files[0], "utf8"));
  const issues = check(app);
  if (issues.length) {
    console.log(`NG ${files[0]}`);
    for (const i of issues) console.log(`  ${i.code.padEnd(16)} ${i.path}: ${i.message}`);
    process.exit(1);
  }
  if (checkOnly) { console.log(`OK ${files[0]}`); return; }
  const w = writeProject(app, resolvePath(out!));
  console.log(`OK ${files[0]} -> ${out}（${w.length} ファイル）。scope: ${scopes(app)}`);
  const missing = (["clientId", "orgName", "tenantName"] as const).filter((k) => !app[k]);
  if (missing.length) console.log(`  uipath.json の ${missing.join("、")} を書き換える（IR に書けば次から入る）`);
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();
