# ローコードのエージェント（Agents・Agent Builder）

UiPath のエージェント（`https://cloud.uipath.com/<組織>/agents_` の画面と、Studio Web の Agent Builder）について分かったこと（2026-11-15）。

- 公式のスキル（`uipath-agents` の lowcode）を読み、CLI（`uip agent`、`uip` 1.204.0）と画面を全部触った。
- トライアルのテナントで、生成 → 実行 → 評価 → デプロイ → ジョブ → 取り出し → 取り込みまで確かめた。
- Python で書くエージェント（Coded Agent）は [python-agents.md](python-agents.md)。CLI 全体の使い分けは [uipath-clis.md](uipath-clis.md)。

## 結論

- **エージェントは IR から生成する**。
  - 生成器：`node tools/agent/gen.ts <ir.json> --project <フォルダ> --profile <名前>`。
  - IR の見本：`samples/agent/*.json`。
  - 生成器は次を自動でやる：
    - `uip agent init`（フォルダが無ければ）
    - `agent.json`・`resources/`・評価を書く
    - `uip agent refresh` → `validate`
    - 道具があれば `uip solution resources refresh`
- **画面やテンプレートで作ったものは IR に戻して取り込む**。
  - 手順：`uip solution download <Id> -d <dir> --extract` → `node tools/agent/to-ir.ts <エージェントのフォルダ> --out <ir.json>`。
  - 以後は IR を正本にする。
- **どれを使うか**：

| やりたいこと | 使うもの |
| --- | --- |
| エージェントを作る・直す | IR ＋ `tools/agent/gen.ts`（中で `uip agent init / refresh / validate`） |
| 画面・テンプレートで作ったものを取り込む | `uip solution download --extract` ＋ `tools/agent/to-ir.ts` |
| 品質の点検 | `uip agent review`（評価が 5 件未満などを FAIL にする） |
| 1 回動かして結果を見る（自律型） | `uip agent debug <フォルダ> -i '{…}' [--attachment 名前=ファイル]` |
| 会話型を試す | Studio Web の Debug のチャット（`debug` は会話型に未対応） |
| 評価を流す | Studio Web の Evaluations の再生ボタン。結果は `uip agent eval run list / results` で読める（`eval run start` は落ちる。下の「落とし穴」） |
| Studio Web に置く | `uip solution upload <ソリューションのフォルダ>`（`debug` も裏で上げる） |
| 本番に出す | `uip solution pack` → `publish` → `deploy run` |
| ジョブで動かす | `uip or jobs start <プロセスの Key> --input-arguments '{…}' --wait-for-completion` |
| 動いている様子・消費・フィードバック | `agents_` の画面 |
| Python でしか書けないもの（独自のグラフ、外部のライブラリ） | `uip codedagent`（[python-agents.md](python-agents.md)） |

## 画面（agents_）にあるもの

`agents_` は**作る場所ではなく、登録簿と観測の場所**。作るのは Studio Web（「Build your agent now」もそこへ飛ぶ）。

| メニュー | 中身 |
| --- | --- |
| Overview | Platform Units の消費、完了した実行数、成功率、平均の応答時間 |
| Agent Registry / Agents | デプロイ済みのエージェント（フォルダごと）。開くと Dashboard・Design・Review runs・Feedback・Evaluations (Preview)・Memory (Preview)・Run now |
| Conversational (Preview) | デプロイ済みの会話型（会話型のエージェントと、会話のトリガーを持つ Maestro Flow） |
| Draft agents | まだ出していない Studio Web のエージェント |
| Templates | UiPath のテンプレート 23 種。「Use」で Studio Web にソリューションができる |
| Guardrails | ガードレールの説明と入口（設定は各エージェントで） |
| Context grounding indexes | インデックス（RAG）の作成と取り込みの様子 |
| Feedback | 実行への👍👎。メモリの元になる。「View API docs」あり |
| Memory spaces (Preview) | エージェントのメモリ |
| Phone numbers (Preview) | SIP の電話番号を Flow の着信トリガーにつなぐ |
| MCP servers (Preview) | 道具として呼べる MCP サーバーの一覧（足すのは Orchestrator） |

デプロイしたエージェントの Evaluations には、データセット・評価器・評価の実行・スケジュールがある（実行時の評価）。

### Studio Web の Agent Builder（エージェントを開いた画面）

- 上：Debug（自律型は入力を入れて実行、会話型はチャット）、Deploy（Deploy / Publish）、Submit as template、Share
- キャンバス：エージェントの箱に Memory・Escalations・Context・Tools をつなぐ。「Review agent」（Autopilot の点検）、「Clone as Coded Agent」（Python に写す）
- 右：Standard / Advanced harness、モデル、システムプロンプト・ユーザープロンプト（`@{tools.X}` は緑のチップで出る）、入出力のスキーマ、モデルの設定、ガードレール
- 下：Execution Trail・History・Evaluations（会話型は Chat）
- 一覧（Cloud Workspace）の各行のメニュー：Open・Duplicate・Share・Pin・Open in Studio Desktop・Save to Local Workspace・**Download solution**（＝エクスポート）・Delete。「Create New」の一番下に **Import**（＝`.uis` の取り込み）

## 生成器の IR

見本を写して直す：

- `samples/agent/price-agent.json`：自律型。デプロイ済みの API ワークフローを道具にする。ガードレールと評価 5 件つき
- `samples/agent/invoice-reader.json`：ファイルの入力と組み込みの Analyze Files
- `samples/agent/helpdesk-chat.json`：会話型

| 項目 | 書き方 |
| --- | --- |
| `name`・`description` | `project.uiproj` の Name・Description になる |
| `conversational` | `true` で会話型。既にあるプロジェクトと違えば止める（会話型と自律型は作り直す） |
| `model`・`temperature`・`maxTokens`・`maxIterations` | 書かなければ init のまま。モデルは `uip agent model list --profile <名前>` で選ぶ（init の既定は古い） |
| `system`・`user` | 本文。`{{input.名前}}` で入力、`@{tools.名前}`・`@{contexts.名前}`・`@{escalations.名前}` でリソースを指す。`contentTokens` は生成器が作る。会話型は `user` を書かない |
| `input`・`output` | `{ "名前": "string" }` か JSON Schema。`"file"`・`"file[]"` はファイル（job-attachment）。入力は既定で必須（`"required": false` で外す）、出力は `"required": true` を書いたものだけ必須 |
| `tools` | `{ "process": "名前", "folder": "Shared/…" }`（デプロイ済みの API ワークフロー・エージェント・Maestro。引数の形はテナントから取る）、`{ "builtin": "analyze-attachments" }`、`{ "raw": {resource.json} }` |
| `resources` | 道具以外（コンテキスト・エスカレーション・MCP）の `resource.json` をそのまま |
| `guardrails` | `{ "pii": ["Email"], "action": "log" }`、`{ "harmful": [...] }`、`{ "promptInjection": 0.5 }`、`{ "raw": {...} }` |
| `evals` | 既定の評価セットのケース：`name`・`inputs`・`expected`・`behavior`（振る舞いの評価器に渡す期待） |
| `evalFiles` | 既定のほかの評価セット・評価器のファイル（`to-ir.ts` がテンプレートから取り込む） |

- `resources/` と評価のファイルは IR が正本。IR から消したものは消える。id（resource・評価・ガードレール）は前のものを引き継ぐ
- 生成の前に止めるもの：入力に無い `{{input.x}}`、無いリソースへの `@{…}`、`{{x}}` の形、評価のケースの入出力の名前、見つからない・複数のフォルダにあるプロセス
- RPA（XAML）のプロセスの道具は、引数が .NET の形なので今は `raw` で書く

## 確かめた結果（trial）

| 試したこと | 結果 |
| --- | --- |
| 雛形を `debug` | 10 秒で Successful（「1+1」→「2」） |
| price-agent を生成 → `debug` | 道具 Probe（API ワークフロー）を呼び、品目の JSON の文字列を配列に直して渡した。PII のガードレールが入力と出力で動いた（トレースで確認） |
| price-agent の `review` | PASS 100（評価を 5 件にする前は FAIL 85：`TOO_FEW_EVALS`） |
| 評価（画面から） | 5 件が 70 秒で完了。出力の比較 65.6、振る舞い 48.8。結果は CLI の `eval run results` で読めた |
| 取り出し → `to-ir` | 元の IR と完全に同じ（往復できる） |
| テンプレート（Language Detection Agent）を取り込み | `to-ir` → 生成 → `review` PASS 98 → `debug` で「今日はいい天気ですね」→ `Japanese`。テンプレートの評価セット（30 件、完全一致）も `evalFiles` で持ってきた |
| invoice-reader を `debug --attachment invoice=invoice.pdf` | 組み込みの Analyze Files で読み、合計 12000・JPY |
| helpdesk-chat（会話型）を生成 → upload | Studio Web の Debug のチャットで「パソコンが急に遅くなりました」→ 1 つだけ質問を返した（プロンプトどおり） |
| price-agent を pack → publish → deploy | `Shared/PriceAgentTest` に出た。`agents_` の Deployed agents に出る |
| ジョブ（`or jobs start`） | Serverless（ServerlessJobType `PythonAgent`）で 12 秒、Successful |

## 落とし穴

- **`uip agent eval run start` はクラウドで必ず `failed`（0 件）になる**（1.204.0）。
  - 画面は `startMultipleEvaluators?solutionId=…&debugProjectId=<エージェントの Id>` を送るが、CLI は `debugProjectId` を付けない。道具の無い雛形でも、評価器のモデルを変えても落ちた。
  - 評価は画面の再生ボタンで流し、結果を `uip agent eval run list / results --set "<セット名>" --path <フォルダ>` で読む。
- **`uip or eval`（実行時の評価）は 1.204.0 に無い**。スキルの文書は先の版のもの。デプロイ後の評価は `agents_` のエージェントの Evaluations から。
- **`expected` の無い評価のケースは、既定の評価器（出力の比較）がエラー**になる（「non-empty expected output」）。振る舞いだけを見るケースは、振る舞いの評価器の点だけが付く。生成器は注意を出す。
- **`uip agent review` は評価が 5 件未満で FAIL**（`NO_EVALS`・`TOO_FEW_EVALS`）。
- **組み込みの道具（`type: "internal"`）に `location` を書かない**。`"solution"` にすると validate が `folderPath "solution_folder"` を求めて落ちる。
- **`debug` はソリューションを Studio Web に上げる**。初回は `.uipx` の `SolutionId` が Studio Web の Id に書き換わり、次からは同じソリューションを上書きする。`eval run start` が読む `SolutionStorage.json` は `debug` / `upload` では作られない（`--solution-id` を渡す。`download --extract` には入っている）。
- **デプロイ済みのプロセスを道具にしたソリューションを deploy すると、そのプロセスもデプロイ先のフォルダに入る**（price-agent では `Shared/PriceAgentTest` に Probe もできた）。
- **Studio Web で開いて保存すると変わるもの**：
  - 会話型に `settings.voice`（音声のモデル）が足される。
  - `projectId` が `.uipx` の Project Id に書き換わることがある。
  - 道具の `inputSchema` に `title: "Inputs"` が戻る。
  - 生成器は既にある `agent.json` に重ねて書くので、これらは残る。
- **テンプレートは古い形**（`version` 1.1.0、本文が `{{Content}}` でトークンが `input.Content`）。
  - `to-ir.ts` は本文を `contentTokens` から組み直す。
  - `uip agent refresh` で 1.2.0 に上がる。
- **`debug` は会話型に未対応**。`agent init` の既定のモデル（`gpt-5.4`、会話型は Claude Sonnet 4.5）は古いので、IR で選ぶ。
- 実行の出力のキーは先頭が大文字になって返る（`debug` の `Output` が `Total`・`Tier`）。ジョブの `OutputArguments` は小文字のまま（`total`）と `__pydantic_extra__`。

## 片付け

```bash
uip solution deploy uninstall <デプロイ名> --yes --profile <名前>
uip solution packages delete <パッケージ名> <版> --yes --profile <名前>
uip solution delete <Studio Web のソリューションの Id> --yes --profile <名前>   # debug・upload・テンプレートで作ったもの。--yes が要る
```

`deploy uninstall` で、デプロイ先のフォルダ（道具のプロセスの写しも）が消える。

```bash
```

## 確かめていないもの

- エスカレーション（Action Center のアプリ。Workflow Action の種類が要る。Coded Action App は使えない）、コンテキスト（インデックス・Data Fabric）、MCP、Integration Service の道具、メモリ（`uip agent memory`）。生成器では `resources` の raw で書ける
- RPA（XAML）のプロセスを道具にする（.NET の引数を JSON Schema に直す）
- flow の中のエージェント（`--inline-in-flow`）。[maestro.md](maestro.md) の `inlineAgent` を参照

## 出典

- スキル `uipath-agents` の `references/lowcode/`（lowcode.md、project-lifecycle.md、agent-definition.md、critical-rules、capabilities/*）
- https://docs.uipath.com/agents/automation-cloud/latest
