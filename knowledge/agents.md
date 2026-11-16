# ローコードのエージェント（Agents・Agent Builder）

UiPath のエージェント（`https://cloud.uipath.com/<組織>/agents_` の画面と、Studio Web の Agent Builder）について分かったこと（2026-11-15）。

- 公式のスキル（`uipath-agents` の lowcode）を読み、CLI（`uip agent`、`uip` 1.204.0）と画面を全部触った。
- トライアルのテナントで、生成 → 実行 → 評価 → デプロイ → ジョブ → 取り出し → 取り込みまで確かめた。道具（プロセス・RPA・Integration Service・MCP・組み込み）、コンテキスト（インデックス・Data Fabric）、エスカレーション、メモリとフィードバックも動かした。
- Python で書くエージェント（Coded Agent）は [python-agents.md](python-agents.md)。CLI 全体の使い分けは [uipath-clis.md](uipath-clis.md)。

## 結論

- **エージェントは IR から生成する**。
  - 生成器：`node tools/agent/gen.ts <ir.json> --project <フォルダ> --profile <名前>`。
  - IR の見本：`samples/agent/*.json`。
  - 生成器は次を自動でやる：
    - `uip agent init`（フォルダが無ければ）
    - `agent.json`・`resources/`・評価を書く
    - `uip agent refresh` → `validate`
    - 外を指す道具・コンテキスト・メモリがあれば `uip solution resources refresh`（MCP は `resources add`）
  - 道具（プロセス・Integration Service・MCP）、コンテキスト（インデックス・Data Fabric）、エスカレーションの引数や形は、テナントから取って書く（推測で書かない）
- **画面やテンプレートで作ったものは IR に戻して取り込む**。
  - 手順：`uip solution download <Id> -d <dir> --extract` → `node tools/agent/to-ir.ts <エージェントのフォルダ> --out <ir.json>`。
  - 以後は IR を正本にする。
- **どれを使うか**：

| やりたいこと | 使うもの |
| --- | --- |
| エージェントを作る・直す | IR ＋ `tools/agent/gen.ts`（中で `uip agent init / refresh / validate`） |
| 画面・テンプレートで作ったものを取り込む | `uip solution download --extract` ＋ `tools/agent/to-ir.ts` |
| 品質の点検 | `uip agent review`（評価が 5 件未満などを FAIL にする） |
| 1 回動かして結果を見る（自律型） | `uip agent debug <フォルダ> -i '{…}' [--attachment 名前=ファイル]`。ソリューションの中のアプリ（エスカレーション）・MCP サーバーを使うものは Studio Web の Debug（「Deploy resources before debugging」で用意する。CLI の `debug` は用意しない） |
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
| Conversational (Preview) | デプロイ済みの会話型（会話型のエージェントと、会話のトリガーを持つ Maestro Flow）。開くと Dashboard（利用者・メッセージ・会話の数）・Design・Review runs・Feedback・Evaluations・**Channels**（Microsoft Teams のアプリとして出す）・**A2A**（ほかのエージェントから呼ぶ口。Endpoint と Agent card の JSON。「Copy A2A URL」）・**Chat**（その場で話せる） |
| Draft agents | まだ出していない Studio Web のエージェント |
| Templates | UiPath のテンプレート 23 種。「Use」で Studio Web にソリューションができる。自分のエージェントは Studio Web の「Submit as template」（名前と説明）で組織のテンプレートにできる：Studio Web の Templates（種類は Solution）と `agents_` の Templates の両方に出る。Studio Web の Templates のカードの ⋮ に New solution from template（Cloud / Local Workspace）・Edit solution・Demote to User level・Pin・Delete |
| Guardrails | ガードレールの説明だけの画面（Configure / Fine-tune / Monitor の 3 つの絵と、公式の文書へのリンク。押せるものは無い。設定は Studio Web の各エージェント、試すのは評価、見るのは各エージェントの Review runs）。使える検証器は `uip agent guardrails list`：pii_detection・prompt_injection・harmful_content・intellectual_property・user_prompt_attacks・llm_as_judge |
| Context grounding indexes | インデックス（RAG）の一覧と、検索・取り込みのジョブの数のグラフ、使っている数（trial は 10 個まで）。「Create Index」：名前・説明・フォルダ、Ingestion（Basic＝文字だけ・無料、Advanced＝表や画像も・Platform Units を使う）、Data Source（Storage Bucket か Connector）→ Orchestrator のフォルダ・バケット（「Add New」でその場で作れる）・ファイルの種類・Include Subfolders、右の File Upload でバケットにファイルを上げる、Schedule Ingestion（定期の取り込み。無ければ手で）。Save で取り込みが始まる |
| Feedback | 実行への👍👎。メモリの元になる。「View API docs」あり |
| Memory spaces (Preview) | エージェントのメモリ。作成（名前・説明・フォルダ）、開くと Configure・**Import**（JSON から）・**Export**（`memory-space-<名前>-<Id>.json`）・Add memory（Feedback の一覧から選ぶ）・Delete（名前を打って確かめる）。Export した JSON を別の memory space に Import すると、同じ項目が入った（下の「メモリの Export / Import の形」） |
| Phone numbers (Preview) | 電話番号を Flow の着信トリガー（voiceTrigger）につなぐ。「Connect number」は SIP Trunk（ラベル・番号・向き・SIP のドメイン）か Twilio、「Manage inbound access」は自分の SIP のドメイン・許す IP・SIP のユーザーとパスワード。番号は電話会社の契約が要る |
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
- `samples/agent/policy-qa.json`：コンテキスト（インデックスの規程と、Data Fabric の表）
- `samples/agent/expense-escalation.json`：エスカレーション（Action Center のアプリで人に承認してもらう）
- `samples/agent/web-research.json`：Integration Service の道具（UiPath GenAI Activities の Web Search）
- `samples/agent/mcp-price.json`：AgentHub の MCP サーバーの道具
- `samples/agent/doc-tools.json`：組み込みの道具（DeepRAG・Batch Transform・Create File）
- `samples/agent/invoice-validation.json`：IXP の道具と、書類の確認（Document Validation Task）のエスカレーション

| 項目 | 書き方 |
| --- | --- |
| `name`・`description` | `project.uiproj` の Name・Description になる |
| `conversational` | `true` で会話型。既にあるプロジェクトと違えば止める（会話型と自律型は作り直す） |
| `model`・`temperature`・`maxTokens`・`maxIterations` | 書かなければ init のまま。モデルは `uip agent model list --profile <名前>` で選ぶ（init の既定は古い） |
| `harness` | `"advanced"` で Advanced harness（Preview）。`settings.mode` が `advanced` になる（既定 `standard`）。2026-11-17 に trial で validate → debug が通った（`engine` は `basic-v2` のまま）。文書の制約：ガードレールと一緒に使えない（生成器が `ADVANCED_GUARDRAILS` で止める）、画面で切り替えると道具の Static / Argument の値とモデルごとの設定が消える、一部の IS の活動と Clone as coded が使えない、Analyze Files は要らない（ファイルは作業場に入る）、プレビュー中は料金が半額 |
| `system`・`user` | 本文。`{{input.名前}}` で入力、`@{tools.名前}`・`@{contexts.名前}`・`@{escalations.名前}` でリソースを指す。`contentTokens` は生成器が作る。会話型は `user` を書かない |
| `input`・`output` | `{ "名前": "string" }` か JSON Schema。`"file"`・`"file[]"` はファイル（job-attachment）。入力は既定で必須（`"required": false` で外す）、出力は `"required": true` を書いたものだけ必須 |
| `tools` | 下の 5 つと `{ "raw": {resource.json} }` |
| ・プロセス | `{ "process": "名前", "folder": "Shared/…" }`。デプロイ済みの RPA・API ワークフロー・エージェント・Maestro。引数の形（V2 の JSON Schema）はテナントから取る |
| ・組み込み | `{ "builtin": "analyze-attachments" }`（ファイルを読む）、`{ "builtin": "deep-rag", "task": "…" }`（長い書類を出典つきでまとめる。`citations: false` で出典なし）、`{ "builtin": "batch-transform", "task": "…", "columns": [{ "name", "description" }], "webSearch": true }`（CSV の行ごとに列を足す）、`{ "builtin": "create-file" }`（ファイルを作る）。形は Studio Web で足して取り出したもの（`tools/agent/builtin-tools.json`） |
| ・Integration Service | `{ "integration": "<connector の key>", "activity": "<ObjectName>", "values": { "固定する項目": 値 } }`。活動は `uip is typecache activities <key>`、接続は既定のもの（`connection` で Id か名前） |
| ・MCP | `{ "mcp": "<slug>", "tools": ["使う道具"] }`。AgentHub の MCP サーバー（`uip agenthub mcp list`）。`tools` を書かなければ全部（動的） |
| ・IXP | `{ "ixp": "<IXP のプロジェクト>", "tag": "staging" }`。タグ（staging / live）の付いたモデルだけ使える（`uip ixp projects publish <名前> --model-version <版> --tag staging`） |
| `contexts` | `{ "index": "<インデックス名>", "folder": "Shared" }`（RAG。`mode` は semantic / deeprag / batchtransform。Structured は 2026-09 に廃止され、表のデータは Data Fabric のコンテキストで引く。生成器は `structured` を `RETIRED_MODE` で止める）、`{ "dataFabric": ["表"], "folder": "Shared" }`（フォルダの表だけ）、`{ "attachments": true, "name": "…" }` |
| `escalations` | `{ "app": "<Action Center のアプリ>", "recipients": ["メール"], "outcomes": { "reject": "end" }, "title": "…" }`。アプリはソリューションの中か、デプロイ済みの Workflow Action。`recipients` はメールの文字列のほか、`{ "group": "グループ名" }`・`{ "groupId": "GUID" }`・`{ "userId": "GUID" }`・`{ "assetEmail": "アセット名", "folder": "Shared" }`・`{ "assetGroup": "アセット名", "folder": "Shared" }`・`{ "argEmail": "入力の名前" }`・`{ "argGroup": "入力の名前" }`（resource の `type` 5・2・1・4・6・7・8。アセットは `assetName`＋`folderPath`、入力は `argumentName` で書く。スキルの guardrails.md の Recipient shapes。テナントではメールだけ確かめた。グループの割り当てはデバッグでは効かない）。書類の確認は `{ "validate": "<IXP の道具の名前>", "bucket": "<バケット>", "bucketFolder": "Shared" }`（バケットは生成器が `resources add` でソリューションに取り込む） |
| `memory` | `[{ "space": "<memory space>", "folder": "Shared", "fields": { "入力の名前": 重み } }]`。space は先に画面で作る。生成器は `uip agent memory add` を呼ぶ |
| `resources` | ほかの `resource.json` をそのまま |
| （flow の中） | `--inline-in-flow` を付けると、`--project` は `<flow のフォルダ>/<UUID>`（無ければ flow のフォルダを渡すと `uip agent init --inline-in-flow` で作る）。リソースのフォルダは名前ではなく id、refresh は flow の `bindings_v2.json` に bindings を書き、ソリューションの手順（refresh・resources add）は飛ばす。flow 側のノードは [maestro.md](maestro.md) |
| `guardrails` | `{ "pii": ["Email"], "action": "log" }`、`{ "harmful": [...] }`、`{ "promptInjection": 0.5 }`、`{ "ip": ["Text", "Code"] }`（IP 保護。実行の後だけ）、`{ "userPromptAttacks": true }`（実行の前だけ、Llm）、`{ "judge": "ルール", "model": "<モデル>", "positive": [], "negative": [], "threshold": 2 }`（LLM as Judge。ルール 4,000 字・例 2 つずつ 1,000 字まで。別に料金）、`{ "raw": {...} }`。`action: "log"` には `severity`（Info / Warning / Error、既定 Warning）。引数の形は `uip agent guardrails list` に合わせ、trial で validate が通った（2026-11-17）。道具ごとのカスタムガードレールは `{ "tool": "<道具>", "rules": [{ "word": "contains", "value": "…" }, { "number": "greaterThan", "value": 100, "fields": [{ "path": "total", "source": "output" }] }, { "boolean": "equals", "value": true }, { "always": "input" }] }`（規則は AND。`fields` が無ければ全部の項目。形はスキルの guardrails.md。テナントではまだ試していない）。Escalate の動作は `raw` で書く |
| `evals` | 既定の評価セットのケース：`name`・`inputs`・`expected`・`behavior`（振る舞いの評価器に渡す期待） |
| `evalFiles` | 既定のほかの評価セット・評価器のファイル（`to-ir.ts` がテンプレートから取り込む） |

- `resources/` と評価のファイルは IR が正本。IR から消したものは消える。id（resource・評価・ガードレール）は前のものを引き継ぐ
- 生成の前に止めるもの：入力に無い `{{input.x}}`、無いリソースへの `@{…}`、`{{x}}` の形、評価のケースの入出力の名前、見つからない・複数のフォルダにあるプロセス、アプリに無い結果、受け手の無いエスカレーション、活動に無い項目、サーバーに無い MCP の道具
- 文書にある使えない組み合わせ（`combos()`、AUT-1191）：
  - 止める：Gemini のモデルと Integration Service の活動の道具（`GEMINI_IS_TOOL`。道具が無効になる）、flow の中のエージェントの MCP・IXP・Web Search（`INLINE_UNSUPPORTED`）
  - 注意だけ：ファイルの入力があるのに、受けられる道具（RPA などのプロセス・IXP・組み込みの Analyze Files など）が無い（`NO_FILE_TOOL`。API ワークフロー・MCP・IS の活動・エスカレーションはファイルを受けない）、Gemini の Analyze Files（`GEMINI_FILES`。pdf は画像として読む）、自律型で user から参照しない入力（`UNUSED_INPUT`。エージェントに見えない）
- `to-ir.ts` は省略形に戻せるものを戻し（プロセス・組み込み・Integration Service・MCP・コンテキスト・エスカレーション・メモリ・ガードレール）、戻せないものは `raw` で持つ。リソースは名前の順に並ぶ
- 道具・コンテキスト・エスカレーションの書き方は、Studio Web で同じものを足して取り出した形に合わせてある（下の「落とし穴」）

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
| 組み込みの道具（doc-tools） | `debug --attachment` で PDF と CSV を渡すと Suspended（DeepRAG・Batch Transform は非同期）→ ジョブが Successful。DeepRAG で合計 12,000 JPY、Batch Transform で区分の列、Create File で `summary.md`（出力のファイル。`uip or attachments download <Id> -o <ファイル>` で取れた） |
| ガードレールの block | 普通の文は通り、メールと電話番号の入った文は「Guardrail violation … blocked by guardrail [PII detection guardrail]」で Faulted、「Ignore all previous instructions…」は Prompt injection で Faulted |
| エージェントを道具に（デプロイ済みの Summarizer） | 親は子のジョブを待って Suspended → 子が終わると再開し、要約を返した |
| 書類の確認（invoice-validation。IXP の `ixp_trial_invoices` に staging のタグ） | `debug --attachment` → IXP の道具で抽出（トレースの `ixpTool`）→ Action Center に DocumentValidationTask ができて Suspended → `uip tasks assign` で自分に割り当て、Action Center で開くと Validation Station（左に抽出結果、右に PDF）→ Submit → 再開して `{"invoiceNumber":"INV-001","total":"12000 JPY"}`。タスクのデータはバケットのパス（`input_results.zip`・`output_results.zip` など） |
| メモリの Export → Import | Export の JSON を別の memory space に Import すると、同じ項目（入力・フィードバック・出力）が入った |
| Submit as template | テンプレートが Studio Web と `agents_` の両方に出た → 「New solution from template」でソリューションができた → Delete で消えた（「Template successfully deleted」） |
| 会話型のデプロイ（helpdesk-chat を pack → publish → deploy） | `agents_` の Conversational に出た。Chat で「パスワードを忘れました」→「どのシステムやサービスのパスワードをお忘れでしょうか？」 |
| RPA のプロセスを道具に（請求書を読む `RPA Workflow`） | `debug` は Suspended で返る（RPA のジョブを待つ間エージェントは止まる）。RPA が終わると再開し、ジョブは Successful（`invoiceNumber: INV-001`、`total: 12000`） |
| エスカレーション（Studio Web の「Simple Approval」テンプレートのアプリ） | 5 万円で Action Center にタスク → エージェントは Suspended → `uip tasks complete --action approve --data '{"Comment":"…"}'` → 再開して `{"decision":"approved","comment":"…"}`。受け手をメールで書くと、タスクはその人に割り当て済みでできる |
| コンテキスト（インデックスと Data Fabric） | 規程の質問に「第1条 交通費」、過去の件数 2。トレースで、インデックスはセマンティック検索、表はエージェントが SQL（`SELECT COUNT(Applicant) … WHERE Applicant = '山田'`）を書いて流していた |
| Integration Service（Web Search） | 「UiPath の本社は？」→ ニューヨーク、出典 2 つ（uipath.com、Wikipedia） |
| MCP（UiPath の種類のサーバーに Probe を道具 `price_total` として足す） | Studio Web の Debug で `{"tier":"SILVER","usedTool":true}`。CLI の `debug` は Not Found |
| インデックスを画面で作る（Basic・バケットに規程の txt） | Save から 1 分足らずで取り込みが Successful。CLI の `context-grounding list` では `extraction_strategy: NativeV1`（Basic）、`search` で規程の本文が出た |
| flow の中のエージェントを生成（`--inline-in-flow`） | flow（`InlineAgent.flow`）の `<UUID>` のフォルダに生成 → `node tools/maestro/debug.mjs` で flow ごと動かして Completed、エージェントのノードが `{"answer":"no"}` を返した |
| メモリ | 実行 → `uip traces feedback create --positive` → `uip agent memory item add <名前> --memory-type episodic --feedback-id <Id>` → 次の実行でメモリが 1 件当たり、例としてプロンプトに入った（トレースの `agentMemoryLookup`） |

## 落とし穴

- **`uip agent eval run start` はクラウドで必ず `failed`（0 件）になる**（1.204.0）。
  - 画面は `startMultipleEvaluators?solutionId=…&debugProjectId=<エージェントの Id>` を送るが、CLI は `debugProjectId` を付けない。道具の無い雛形でも、評価器のモデルを変えても落ちた。
  - 評価は画面の再生ボタンで流し、結果を `uip agent eval run list / results --set "<セット名>" --path <フォルダ>` で読む。
- **デプロイ後の評価（実行時の評価、2026-10 に Preview）は `uip eval` にある**（独立した `@uipath/eval-tool`。`uip or eval` ではない。1.204.0 に入っている）。サブコマンドは `execute-and-evaluate`・`run`（list / get / results）・`eval-set`・`evaluation`・`evaluator`・`schedule`・`simulatable-components`。どれもプロセスの Key（`uip or processes list --all-folders`）で指す。画面は `agents_` のエージェントの Evaluations。
  - **テナントで流せた**（2026-11-16、IR の 5 件の評価を持つ小さなエージェントを `Shared/<フォルダ>` にデプロイして）。5 件で 59.6 秒、Score 1。わざと期待を違えた 1 件を足すと、その件だけ 0 で Score 0.83（6 件・83.6 秒）。手順は下の「デプロイ後の評価を CLI で流す」
  - 文書の中身：画面は Datasets・Evaluators・Eval runs・Schedules。評価器は Contains Text、LLM Judge（Output / Strict JSON / Trajectory / Simulation）、Tool Call（Arguments / Count / Order / Output）。Review runs から本番の実行をデータセットに足せる。副作用のある道具と HITL は Static mock か Generated response でシミュレートする（`simulatable-components` で一覧）。評価はパッケージとは別に保存するので、変えても再発行は要らない。スケジュールでは Trajectory を使えない。Maestro は対象外
  - 作るときの評価（`uip agent eval`、`evals/`）とは別物。**パッケージに入れた `evals/` は、デプロイしても実行時の評価には入らない**（デプロイ直後の `eval-set list`・`evaluator list` は空）
- **`expected` の無い評価のケースは、既定の評価器（出力の比較）がエラー**になる（「non-empty expected output」）。振る舞いだけを見るケースは、振る舞いの評価器の点だけが付く。生成器は注意を出す。
- **`uip agent review` は評価が 5 件未満で FAIL**（`NO_EVALS`・`TOO_FEW_EVALS`）。
- **組み込みの道具（`type: "internal"`）に `location` を書かない**。`"solution"` にすると validate が `folderPath "solution_folder"` を求めて落ちる。
- **`debug` はソリューションを Studio Web に上げる**。初回は `.uipx` の `SolutionId` が Studio Web の Id に書き換わり、次からは同じソリューションを上書きする。`eval run start` が読む `SolutionStorage.json` は `debug` / `upload` では作られない（`--solution-id` を渡す。`download --extract` には入っている）。文書は「`upload` が自動で書く」とするが、2026-11-17 に 1.204 で upload しても作られなかった（AUT-1207 の 8）。
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
- **組み込みの道具の形はスキルの文書と違う**：Studio Web は DeepRAG・Batch Transform にファイルを受ける `inputSchema`（`attachment`）を付け、指示は `query: { variant: "static", value }`、`fileExtension` も書く。生成器は Studio Web の形を使う。
- **UiPath ScreenPlay は組み込みの道具ではない**：道具の一覧で選ぶと、RPA のプロジェクト（「ScreenPlay for Web」、`Main.xaml`）がテンプレートとしてソリューションに入り、それを呼ぶプロセスの道具（`type: process`、`location: solution`）ができる。
- **書類の確認（Document Validation Task）**：IXP の道具がエージェントに要り、その IXP のプロジェクトにタグ（staging / live）の付いたモデルが要る（「Only tagged models are available」）。ストレージのバケットも要る（Studio Web はソリューションに取り込む）。resource は `escalationType: 1` と `vsEscalationProperties`（`ixpToolId`・`storageBucketName`・`storageBucketFolderPath`）。受け手を書いてもタスクは Unassigned でできた（`uip tasks assign` で割り当てる）。完了は Action Center の Validation Station で Submit（CLI の `tasks complete --type DocumentValidationTask` は `--data` が丸ごと置き換えになるので使わない）。
- **エスカレーションの種類は画面では App Task と Document Validation Task（IXP の検証）だけ**。メール・Slack・Teams のチャンネルは画面に無い（ランタイムは知っているが、作る手段が無い）。
- **CLI の `debug` は、ソリューションの中のアプリ・MCP サーバーをデバッグのフォルダに用意しない**（「No app: … found in folder」「Not Found」）。Studio Web の Debug は「Deploy resources before debugging」で用意してから動かす。
- **Studio Web の Debug が終わると、その実行を評価するジョブ（`command: eval`）が自動で 1 つ流れる**。エスカレーションのあるエージェントでは、その評価のジョブもタスクを作って Suspended になる（タスクを完了すれば終わる）。
- **RPA など時間のかかる道具を呼ぶと、`debug` は Suspended を返して終わる**。結果は `uip or jobs get <JobKey>`（Successful になるまで待つ）。
- **エスカレーションのアプリ**：
  - Workflow Action の種類だけ（Studio Web の「RPA app」の Action App。Coded Action App は使えない）。このリポジトリの `rpa-app.ts` が作るのは普通の RPA アプリなので使えない。
  - いちばん早いのは、Studio Web でエスカレーションの「Action App」→「+ New App」→ テンプレート（Simple Approval など）。アプリがソリューションの中にできる。
  - ソリューションの中のアプリがあるときに `uip solution resources refresh` を流すと、アプリの宣言を新しい key で作り直し（`app/workflow Action/` → `app/`）、エスカレーションの `resourceKey` が宙に浮く。生成器はアプリがソリューションの中のときは refresh を流さない。
  - Studio Web が書くエスカレーションは受け手が空（`recipients: []`）。生成器は受け手を必ず求める。
- **コンテキスト**：
  - Data Fabric は**フォルダの表だけ**（「This view displays folder-level entities only」）。テナントの表は使えない。表は `uip df entities create <名前> --folder-key <フォルダ>` で作る。
  - インデックスは `uip context-grounding create --index-name <名前> --bucket-source <バケット> --folder-path Shared` → `ingest`（バケットは `uip or buckets create`、ファイルは `uip or bucket-files upload`）。
  - `solution resources refresh` はインデックス・バケット・Data Fabric の表もソリューションに取り込む（スキルの文書の「Data Fabric は作られない」は古い）。
- **Integration Service の道具**：
  - 固定の項目（選択肢のある項目、`values` で決めた項目）も `inputSchema` に残す（`enum` を選んだ値だけにし、`oneOf` に選択肢を並べる）。消すと実行で「Integration service returned an error … Request failed」（HTTP の失敗）。
  - 接続は `uip is connections create <key> --no-wait` で同意の URL をもらい、ブラウザで「Connect」を押す。UiPath GenAI Activities の接続は個人のワークスペースにできる。
- **MCP**：
  - サーバーは `uip agenthub mcp create uipath --name … --slug … --folder-path Shared`、道具は `uip agenthub mcp-tools create-resource --mcp <slug> --category api-workflow|automation|agent|agentic-process --target-name <プロセス> --target-folder-path <フォルダ>`。`--category` を間違えると「No automation candidate matched」。
  - `uip solution resources refresh` は UiPath の種類のサーバーを `mCPServer/coded/` に取り違え、実行で Not Found。正しくは `uip solution resources add --source remote --kind MCPServer --name <表示名> --cloud-key <サーバーの Id>`（`mcpServer/uiPath/` に置き、道具が呼ぶプロセスも入る）。生成器はこちらで取り込む。
  - エージェントの resource の `name` はサーバーの表示名、`folderPath` は `solution_folder`（Studio Web と同じ）。
- **メモリ**：
  - memory space は CLI で作れない（Studio Web のエージェントの Memory の「Create new」か `agents_` の Memory spaces）。`uip agent memory add` は付けるだけ。
  - フィードバックは `uip traces feedback create --trace-id … --positive --comment … --agent-id <agent.json の projectId> --folder-key <実行したフォルダ>`。
  - フィードバックをメモリに入れるのは `uip agent memory item add <名前> --memory-type episodic --feedback-id <Id>`。`agents_` の Feedback の行のアイコンを押しただけでは入らなかった。
  - Memory spaces の画面には Import / Export がある。
- **Studio Web のクラウドのプロジェクトの Id は、ローカルの `.uipx` の Project Id とも `agent.json` の `projectId` とも違う**ことがある。画面で開く URL の Id は、トレースの `agentId`（`designer/<agentId>?solutionId=…`）。

## 文書で分かったこと（2026-11-15 の突き合わせ、AUT-1201）

公式の文書（agents の user-guide・release-notes）で分かり、まだテナントで試していないもの。番号は AUT-1201 の表の番号。

### 動かす場所・権限

- **フォルダの要件**（22）：共有フォルダで動かすには、unattended robot の identity をフォルダに割り当てる（robot のライセンスは使わない）。エスカレーションのアプリを開くとそのフォルダでジョブが動くので、serverless robot か、unattended / testing のマシンテンプレートが要る。
- **会話型は unified runtime に移った**（23、2026-07）：Cloud の利用者の identity で動く（インデックスなどに利用者の権限が要る）。フォルダには serverless のマシンテンプレートを割り当てる（匿名のチャンネルだけ unattended robot）。並列の道具の呼び出しは 1 つずつ。1 回の応答が 1 つのジョブ。エスカレーションの間は会話が止まる。
- **RPA からエージェントを呼ぶのは Run Job 活動**（24）：UiPath.System.Activities 25.4.2 から（Run Agent も動くが、検索しても Run Job が入る）。ファイルの入力には Studio Desktop 2025.10.0 以上が要る。エージェントを変えたら再発行して、Orchestrator のプロセスを upgrade する。
- **Studio Web のポリシーの制約**（21、2026-09 に GA）：最小のスコア、温度の上限、応答のトークンの上限、HITL のエスカレーション必須、反復の上限。作るときと実行のときの両方で効き、新しい版は満たさないと発行できない。生成器の `temperature`・`maxTokens`・`maxIterations` が引っかかりうる。
- **2026-12-02 から、coded agents も agents の AI Trust Layer の設定と LLM の構成に従う**（34）。Enable Agents が無効だと coded agents もモデルを呼べない。coded agents だけの BYOM の構成は使われなくなる（[python-agents.md](python-agents.md)）。

### 上限・決まり

- **ファイル**（29）：Analyze Files は 1 ファイル 30 MB まで（数の上限は無い）。会話型のアップロードは 5 MB まで（画像と PDF）。Anthropic のモデルは、特殊文字や続いた空白の入ったファイル名を拒む。
- **トレースの保持**（31）：既定は 90 日。AI Trust Layer の TTL で 1 日か 7 日にできる。フィードバックかメモリの付いたトレースは TTL で消えない。見るには Logs.View（無ければ Jobs.View で一部だけ）。
- **メモリ**（30）：エピソードの項目の入力は編集できない（消して足し直す）。Feedback の画面と、メモリに足す画面は 30 日分だけ。CMK の暗号化は memory space を作るときだけ決められる。メモリに入るのは、エージェントの実行のスパンに付けたフィードバックだけ。重複の検出（Replace / Merge / Add anyway）、項目の有効・無効、Memory playground（エージェントを動かさずに当たりを試す）がある。
- **Clone as coded**（32）：自律型だけ。LangGraph の形。ガードレールは写らない。advanced は不可。一方向（戻せない）。何度でも複製できる。
- **電話（Voice）**（37）：通話は 10 分まで。録音は無い。人への転送はできない。Automation Cloud だけ。

### モデル・評価・レビュー

- **モデル**（36）：Premium（Claude Opus 4.7・GPT-5.5。1 回 0.4 Platform Units か 2 Agent Units）、gemini-3.5-flash。**Community と Standard Trial の組織は、既定では BYO のモデルしか使えない**（Sorahane Trial で gpt-5.4-mini が動いたので、この組織では使える設定になっている）。
- **評価の画面**（28）：評価セットの設定で、モデルと温度の組み合わせを並べて比べる。Optimize（パスは 10 まで、自律型だけ）。Fetch runtime traces（フィードバックした実行を取り込む）。Generate new evaluation set。JSON の Import。公開前の目安は評価 30 件以上・スコア 70% 以上（`uip agent review` の 5 件とは別）。
- **デプロイ後の評価**（20）：上の「落とし穴」と「デプロイ後の評価を CLI で流す」に書いた。
- **Agent score は Agent review に変わった**（38、2026-10-08）：Autopilot が Critical / Warning / Improvement を出し、A〜F で採点して、同じ会話で直す。Autopilot Agent（コーディングエージェント）が既定で、Classic に切り替えられる。`uip agent review` の点（PASS 100）とは別物。
- **自前の安全サービスのガードレール**（35、2026-10、Preview）：Azure AI Language・Azure Content Safety・Noma。管理者が AI Trust Layer に入れると、BYO の印付きで並ぶ。IR では `raw` でしか書けない。

### Teams

- **Teams のチャンネル**（27）：共有のアプリは、Teams の Apps で「UiPath Autopilot」を Add（1 対 1 のチャットだけ）。専用のアプリは、Channels タブの「Create a Teams App」→ manifest の ZIP を Teams に上げる（カスタムアプリを上げる権限が要る。Azure Bot の用意に 3〜5 分。名前は 42 字まで）。チャンネルで @ するには、組織の管理者の「Register external client」と、フォルダの unattended robot が要る。標準のチャンネルだけ（2026-10）。

## メモリの Export / Import の形

`agents_` の Memory spaces で Export すると、次の形の JSON（`version: 1`）。Import はこの JSON をそのまま読む。

```jsonc
{
  "version": 1,
  "exportedAt": "…",
  "memorySpace": { "id", "name", "description", "lastQueried", "memoriesCount", "folderKey", "createdByUserId", "isEncrypted" },
  "items": [{
    "memoryItemId", "memorySpaceId", "feedbackId", "status", "memoryType",   // memoryType 0 = episodic
    "userId", "updateTime", "userEmail", "agentId",
    "trace": [ /* その実行のスパン（id・traceId・name・attributes・spanType・jobKey…） */ ],
    "feedback": { "traceId", "spanId", "id", "comment", "isPositive", "isOutput", "isAgentError", "isAgentPlanExecution", … }
  }]
}
```

- 項目は「実行のトレース ＋ フィードバック」をまるごと持つ（1 件 13KB ほど）。手で書くより、実行してフィードバックを付け、`uip agent memory item add --feedback-id` で入れる方が早い
- 別のテナントへ移すときに使う（公式の文書では「別の memory space やテナントへ」）

## デプロイ後の評価を CLI で流す

```bash
K=<プロセスの Key>        # uip or processes list --folder-path <デプロイ先> の Key
FK=<デプロイ先のフォルダの Key>
uip eval evaluator create --process-key $K --workload-id $K --folder-key $FK --name Exact   --evaluator-type-id uipath-exact-match --evaluator-config name:Exact --version 1.0
#   → EvaluatorId と ExternalId が返る
uip eval eval-set create --process-key $K --workload-id $K --folder-key $FK --name Smoke --evaluator-refs <ExternalId>
uip eval evaluation create --process-key $K --eval-set-id <EvalSetId> --folder-key $FK --name "…"   --inputs {text:…} --expected-output {<出力の項目>:…}
uip eval execute-and-evaluate --process-key $K --eval-set-id <EvalSetId>     # → EvalSetRunId
uip eval run get <EvalSetRunId> --process-key $K                           # Status: running → completed、Score（0〜1）
uip eval run results <EvalSetRunId> --process-key $K                       # 件ごとの Scores
```

- **`--workload-id` はプロセスの Key でよかった**（どの文書・ヘルプにも何を渡すか書いていない）
- **eval set の `--evaluator-refs` には評価器の `ExternalId` を渡す**。`EvaluatorId` を渡すと作るのは通るが、`execute-and-evaluate` が「Evaluator with externalId … not found」で断る（`eval-set update <Id> --evaluator-refs <ExternalId>` で直せる）。結果の `Scores[].EvaluatorId` は `EvaluatorId` の方
- `run results` の `Output` は空（`{}`）だった。出力そのものは見えない
- 1 件ごとにエージェントのジョブが動く（Agent Units か Platform Units を使う）。LLM の評価器（`uipath-llm-judge-…`）は `evaluatorConfig` に `prompt`・`model`・`targetOutputKey` が要る（スキルの文書。試していない）

## 片付け

```bash
uip solution deploy uninstall <デプロイ名> --yes --profile <名前>
uip solution packages delete <パッケージ名> <版> --yes --profile <名前>
uip solution delete <Studio Web のソリューションの Id> --yes --profile <名前>   # debug・upload・テンプレートで作ったもの。--yes が要る
```

`deploy uninstall` で、デプロイ先のフォルダ（道具のプロセスの写しも）が消える。試しに作ったほかのもの：

```bash
uip agenthub mcp delete <slug> --profile <名前>                       # MCP サーバー
uip is connections delete <接続の Id> --profile <名前>                 # Integration Service の接続
uip context-grounding delete --index-name <名前> --folder-path Shared  # インデックス（バケットは uip or buckets delete）
uip df entities delete <表の Id> --folder-key <フォルダ> --yes         # Data Fabric の表
uip traces feedback delete <Id> --folder-key <フォルダ> --yes          # フィードバック
```

memory space は `agents_` の Memory spaces の Delete で消す。

## 確かめていないもの

- 電話番号の接続（SIP の電話会社か Twilio の契約が要る）、Teams のチャンネル（Teams の管理者の操作が要る）。どちらも契約・権限が無いので試せない。画面の入力項目は上の表
- RPA のプロセスで、引数が V2 の JSON Schema を持たない古いもの：生成器は .NET の型の一覧（`InputArgumentsSchema`）から JSON Schema を作る（String → string、Int・Decimal・Double → number、Boolean → boolean、DateTime → date-time の string、`X[]` → array、それ以外は string。必須は引き継ぐ）。単体テストだけで、trial にそういうプロセスが無いので tenant では確かめていない

## 出典

- スキル `uipath-agents` の `references/lowcode/`（lowcode.md、project-lifecycle.md、agent-definition.md、critical-rules、capabilities/*）
- https://docs.uipath.com/agents/automation-cloud/latest
