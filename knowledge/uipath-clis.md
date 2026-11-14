# UiPath の CLI の使い分け

UiPath の CLI は 5 つある。このマシン（DESKTOP）に全部入れて、生成器の出力で試した（2026-11-14）。

- `uip` のつまずきどころは [uip-cli.md](uip-cli.md)。
- このページは、ほかの CLI の入れ方・確かめたこと・使い分け。

## 結論（この道具での使い分け）

| やりたいこと | 使う CLI | 理由 |
| --- | --- | --- |
| 生成した XAML の式まで、build の前に早く確かめる | **`uipcli package analyze`**（`node tools/verify/analyze.mjs <P>`。`verify.mjs` も build / run の前に自動で流す） | 式をコンパイルする。SSH から動く。1 プロジェクト 4〜8 秒 |
| RPA の build / run（ロボットで動かす） | `uip rpa`（`tools/verify/queue-run.mjs` 経由） | 今の verify の仕組み。SSH からは窓口を通す |
| テナントの操作（デプロイ・ジョブ・トリガー・接続・Data Fabric） | `uip` | ほかの CLI より扱える範囲が広い |
| API ワークフロー・Maestro・ソリューション・Studio Web | `uip` | ほかの CLI には無い |
| CI/CD（GitHub Actions などで pack・deploy・テスト） | `uipcli` | CI のプラグインがこれを使う。外部アプリの認証（`-A -I -S`）で動く |
| Python の Coded Agent・関数 | `uipath`（Python） | Python の実行環境（`run`・`dev`・`eval`・Studio Web との `push` / `pull`）を持つ |
| XAML の XML・型の壊れだけを見る | `UiPath.Studio.CommandLine analyze` | 式は見ない。`uipcli` の analyze で足りるので、普段は使わない |
| ロボットのある機械で、その場で動かす | `UiRobot execute` | SSH からは動かない。普段は使わない |

## 入っているもの

| CLI | 版 | 場所 | 入れ方 |
| --- | --- | --- | --- |
| `uip` | 1.204.0 | `%APPDATA%\npm\node_modules\@uipath\cli` | `npm install -g @uipath/cli` |
| `uipcli` | 25.10.22 | `%USERPROFILE%\.dotnet\tools\uipcli.exe` | `dotnet tool install --global UiPath.CLI.Windows`（.NET 8 が要る）。パッケージは UiPath の公式の NuGet フィード（UiPath-Official）にある |
| `uipath`（Python） | 2.15.2 | `%USERPROFILE%\.local\bin\uipath.exe` | `uv tool install uipath`（PyPI）。`.local\bin` は PATH に入っていないので、フルパスで呼ぶか `uv tool update-shell` |
| `UiPath.Studio.CommandLine.exe` | 26.10.0 | `C:\Program Files\UiPathPlatform\Studio\<版>\` | Studio に付いてくる |
| `UiRobot.exe` | 26.10.0 | `C:\Program Files\UiPathPlatform\Robot\<版>\` | Robot に付いてくる |

- パッケージの名前：`UiPath.CLI.Windows`（Windows。25.10.x）、`UiPath.CLI`（古いクロスプラットフォーム版。25.4 で止まっている）、`UiPath.CLI.Windows.Legacy`。README には Linux・macOS 版も書いてある。
- UiPath.PowerShell（Orchestrator の PowerShell モジュール）は古いので入れていない。

## uipcli（UiPath.CLI.Windows）

```bash
uipcli package analyze <project.json> --resultPath <結果.json> [--analyzerTraceLevel Warning] [--stopOnRuleViolation]
uipcli package pack <project.json> -o <出力先> -v 1.0.1
uipcli package deploy <nupkg> <Orchestrator の URL> <テナント> -A <組織> -I <アプリの Id> -S <シークレット> --applicationScope "…"
uipcli job run <プロセス名> <URL> <テナント> …
uipcli test run <project.json> --orchestratorUrl … --orchestratorTenant …
uipcli solution pack | deploy | upload-package | …
```

- コマンドの続きを省くとヘルプが出る（`uipcli package analyze` だけで、その引数の一覧）。

### analyze（確かめたこと）

- 中で `UiPath.WorkflowCompiler validate` が動き、**式をコンパイルする**。
  - わざと未定義の変数（`name` → `nameX`）にした XAML で、`BC30451: 'nameX' is not declared` を出した。
  - Studio の `UiPath.Studio.CommandLine analyze` は同じものを通してしまう（[studio-extract-form-data.md](studio-extract-form-data.md) の AUT-1088）。
- VB・C#・クロスプラットフォーム（Portable）のプロジェクトで動いた。1 プロジェクト 4〜6 秒。
- 依存のパッケージは自分で取る（UiPath の公式のフィード。ネットワークが要る）。
- **SSH から動く**（ロボットを使わない）。`queue-run.mjs` は要らない。
- **終了コードは、エラーがあっても 0**。`--stopOnRuleViolation` を付けると 1 になるが、規則の警告でも 1 になる。
  - 結果は `--resultPath` の JSON で見る。コンパイル・XAML の読み込みのエラーは `ErrorCode: "ERROR"`。
  - `tools/verify/analyze.mjs` がこれを読んで、エラーがあれば 1 で終わる。
- **プロジェクトのフォルダに書き込む**（`.local`、`.codedworkflows`、`.objects`、`.project`、`.settings`）。`analyze.mjs` は写しで流す。
- 古い `.local` が残っていると、消したファイル（`CodedMain.cs` など）を参照して `CS0234` で落ちる。写すときに `.local` と `.codedworkflows` を除く。
- **`verify.mjs` に組み込んだ**（2026-11-14）。
  - 生成のあと、build / run の前に流す。エラーのあるファイルは NG、ほかは SKIP にし、build / run はしない。
  - 壊れた IR は 6 秒ほどで NG になった（今までは build を待っていた）。通る IR は analyze 8 秒のあと、XAML と C# の run まで OK。
  - XAML にエラーがあると、同じ誤りのある C#（`.cs`）のエラーは出なかった。XAML を直すと、次に C# のエラーが出るはず。
  - 止めるときは `--no-analyze`。uipcli が入っていなければ注意を出して飛ばす。
- **analyze が通っても、run が通る保証はない**（実行時の値の誤り、UI の要素、Orchestrator の資源は見ない）。build と run は今までどおり `queue-run.mjs` で確かめる。
- 規則の指摘（ST-USG-020「Log Message が無い」、TA-DBP-002「テストケースが無い」など）は、生成器の誤りではないことが多い。`--rules` で見られる。

### pack

- `package pack` で `.nupkg` ができた（5 秒ほど）。中でコンパイルもする。
- 今のデプロイは `uip`（ソリューション）なので、普段は使わない。

## uipath（Python の SDK の CLI）

```bash
uipath new <名前> --type function --dir <dir>    # main.py・pyproject.toml・uipath.json
uipath init                                       # entry-points.json・bindings.json・project.uiproj・AGENTS.md
uipath run main '{"message":"こんにちは","repeat":2}'
uipath auth / pack / publish / deploy / push / pull / eval / dev
```

- 関数の雛形（`--type function`）は、ログインせずに手元で `run` できた。
- エージェント（`--type agent`）は `uipath-langchain` などのエージェントの枠組みが要る。
- `uip` にも `uip agent`・`uip function` がある。uipath-ir-builder では Python のエージェントを作っていないので、使うときにスキル（`uipath-agents`・`uipath-functions`）と合わせて調べる。

## UiPath.Studio.CommandLine.exe

- コマンドは `analyze`・`analyze-file`・`publish`・`list`・`manage`（依存の追加と削除）・`options`・`git clone` / `git commit`。
- `analyze` は XML の壊れと未知の型だけを見て、式は見ない（AUT-1088）。`uipcli` の analyze で足りる。

## UiRobot.exe

- コマンドは `execute`・`pack`・`connect` / `disconnect`・`installprocess`・`version` など。
- **SSH から `execute` は「アクセスが拒否されました」で動かない**（`uip rpa run` と同じ）。画面のセッションで動かす。
- **`pack` は「Could not find Studio Command-Line application!」で動かない**（同じ機械に Studio 26.10 が入っているのに見つけない。理由は調べていない）。pack は `uipcli` か `uip` を使う。
- `version` は動く（26.10.0.0）。
