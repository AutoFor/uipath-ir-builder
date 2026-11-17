# Maestro（Orchestrate と Automate）

Maestro のプロジェクトを AI に作らせるときに読む。作り方の方針は「独自の IR を作らず、公式 SDK（`@uipath/maestro-builder-sdk`）のソースを書いて `tools/maestro/verify.mjs` で確かめる」（[docs/maestro-ir-vs-sdk.md](../docs/maestro-ir-vs-sdk.md)）。ここは、その上で知っておくことと、実際に動かして確かめた範囲。

公式ドキュメントは `C:\Users\seiya\Documents\UiPath\maestro-docs\`（docs.uipath.com の `llms-maestro.txt` と `llms-maestro-automate.txt` にある .md を全部。628 ページ、2026-11-13 取得）。UiPath の著作物なのでリポジトリには入れない。取り直すときは同じ 2 つの一覧から。IXP は `C:\Users\seiya\Documents\UiPath\ixp-docs\`（`llms-ixp.txt` のうち flow-user-guide 37・overview 24・release-notes 18 の 79 ページ、2026-11-14 取得。user-guide と Studio Web はまだ）。docs.uipath.com は 3 並列・0.3 秒間隔で 80 ページほど取ると Cloudflare の確認画面と 429 になる。取るときは 1 ページずつ間を空ける

## 1. 2 つの製品

| | Maestro Orchestrate | Maestro Automate |
| --- | --- | --- |
| 向き | 長く続く業務プロセス（人や外のイベントを何日も待つ） | エージェントと API をつなぐ短い処理（分〜時間） |
| キャンバス | Flow、BPMN、Case | Flow だけ |
| 1 回の実行 | 上限なし | 24 時間まで |
| 同時に動く数 | 上限なし | 50 |
| 実行中の操作（止める・再開・版の移し替え・途中の段へ飛ぶ） | できる | できない |
| 監視 | Maestro の Monitoring、Flow instances | Automate instances（Monitoring には出ない） |
| 価格 | Orchestrate の料金 | run 単位（月 2,500 / 10,000 / 50,000 回まで含む。超えると 1 回 0.05 PU か 0.25 AI Units）。ビルド・デバッグ・評価は無料 |

迷ったら Automate で始め、1 日以上待つ・実行中に人が手を入れる・同時 50 を超える・BPMN か Case が要る、のどれかなら Orchestrate。Automate から Orchestrate への変換は作り直しなしで、行き来できる。

### ファイルの違いは 2 か所だけ（実物で確かめた）

`uip maestro flow init <名前> --automate` と、付けないものを比べた：

- `operate.json` の `runtimeOptions.profile`：Automate は `"Lite"`、Orchestrate は `"Standard"`
- Automate には中身が空の目印 `.maestro_automate` がある

`.flow`、`project.uiproj`、ソリューションの resources は同じ。SDK のソースもコマンドも同じなので、**生成するものは変わらない**。`verify.mjs --automate --pack` は Automate の雛形で .nupkg まで作る（パッケージの `operate.json` が `Lite` になる）。Orchestrator のジョブの種類はどちらも Maestro Flow。

## 2. 流れ

```bash
cd tools/maestro && npm install --ignore-scripts                         # SDK（package.json で 6.66.5 に固定）
node tools/maestro/verify.mjs --automate --out <dir> <名前>.flow.ts       # types → check → compile → validate（--pack で .nupkg も）
node tools/maestro/debug.mjs <dir>/<名前>.flow/<名前>.flow --automate -i '{"x":1}'   # テナントでデバッグ実行し、ノードごとの結果を出す（.bpmn と <名前>.case/caseplan.json も。--attachment <入力名>=<ファイル>）
```

- `debug.mjs` は一時フォルダに `flow init`（`--automate` なら Automate）し、`.flow` を入れて `uip maestro flow debug` を流す。**テナントの Studio Web に試しのソリューションが 1 つ増える**
- `verify.mjs` の `--out` は `<dir>/<名前>.flow/<名前>.flow`（フォルダと同じ名前のファイル）に書く
- `verify.mjs --tenant` は既定のログインのテナントと照合する。別のログインのテナント（trial など）で動かすものは `--profile <名前>` を付ける（照合の一覧を読むときだけ使う）
- **BPMN の `debug.mjs` は、変数と失敗の理由も出す**（AUT-1211）。`bpmn debug` の結果には変数が無いので、続けて `uip maestro bpmn debug-instance variables`（ノードの出力とプロセスの変数）と、Completed でなければ `incidents` を読む。スクリプトが投げた文は incident の `ErrorDetails` にそのまま入る（`traces spans get` を読まなくてよくなった）。CLI はキーの先頭を大文字にして返す（`Response.Level`）ので、プロセスの変数は `GlobalDefinitions` の `Name` で宣言した名前に戻して出す
- **Case の `debug.mjs` は入力を渡せない**（`uip maestro case debug` に `-i` が無い。渡すと ValidationError で何も動かない。`debug.mjs` は先に止める）。入力の要るケースはデプロイして `uip or jobs start <プロセスの Key> --input-arguments` で動かす
- SDK の最新は 6.96.1（2026-11-13）。6.66.5 との差は関数 2 つ（`ANY_ESCALATION`、`taskOutput`）と、Case の型がいくつか。どちらにも Switch の「Match all cases」（テナントでは 11 月に入った）は無い

## 3. Flow の書き方で、つまずくところ

- **参照は `$vars` から**。ノードの出力は `$vars.<ノード id>.output`。SDK では `out("step", "field")`、トリガーの入力は `input("name")`（`$vars.start.output.name`）。`.output` の外にあるもの：
  - ループの中の `$vars.<loop>.currentItem` / `currentIteration`（1 から） / `collection`。ループの後は `$vars.<loop>.output`
  - サブフローの中から入力を読むときは `$vars.<subflow>Start.output.<入力>`。サブフローの戻りは `$vars.<subflow>.output.<名前>`
  - 失敗したノードの `$vars.<id>.error`（`code`、`message`、`detail`、`category`、`status`。エラーの道の中だけ）
  - Quick Form の結果（押したボタン）は `$vars.<id>.status`
- **トリガーの既定の id は道具で違う**：SDK と Studio Desktop は `start`、Studio Web は `manualTrigger1`。生成するなら id を自分で決める
- **Script の戻り値**：デバッグの結果では `outputs.response` に入るが、式からは `$vars.<id>.output.<field>` で読めた
- **`.flow` の中の式は `=js:` で始まる**。固定値の欄に式を埋めるときは `{{ }}`。条件の式に `return` は書かない
- **Script の中では外と通信できない**（`fetch` などは無い）。外を呼ぶなら HTTP のノード
- **HTTP のノードは `http({ managed: true })`（v2）で書く**。今の HTTP Request（v2）は Integration Service の汎用 HTTP（`uipath-uipath-http`）を通る。テナントで確かめた（2026-11-16、見本 `samples/maestro/coverage/HttpV2.flow.ts`、相手は httpbin.org）：
  - **2xx 以外は失敗になり、`onError` に来る**（404 で確かめた）。失敗した step の `$vars.<id>` は `{ error: true, output: { code: "404", message: "Integration Services resource not found", detail: "Unified HttpRequest failed with status code '404' …", category: "User", status: 404, element: "<id>" } }`。文書の `IntSvcVendorRequestFailed`（102021）は出ず、`code` は状態コードの文字列だった。`onError` の後ろは `<id>ErrorEnd` で終わり、本線の続きは走らない
  - **成功の output は `{ code, headers, body }`。状態コードは `code`**。SDK 6.66.5 と `check` は `statusCode` とし、`.code` を読むと `HTTP_READ_UNKNOWN_FIELD` で止める。そのまま `statusCode` で書けば、`verify.mjs` の compile の後で `fixHttpV2` が `$vars.<v2 の id>.output.statusCode` を `.code` に直す
  - **分岐（`branches: [{ name, condition }]`）は動く**。出口は `branch-<name>`（`.stepToList("branch-<name>", …)`。合流は `.stepToRef("<id>")`）。ただし **SDK は条件に `=js:` を付けず、付けないと条件が評価されずにいつも既定の出口に行く**。これも `fixHttpV2` が付ける。文書の例も `$vars.<id>.output.code === 200`
  - 失敗の中身（`$vars.<id>.output`）は、`check` / `validate` が「`error` しか無い」とみなして、読むと止める（`STEP_READ_WITHOUT_OUTPUT`・`EXPRESSION_DIAGNOSTIC`。`h.err("status")` も validate が落とす）。読む方法はまだ無い
  - `retryCount`（5xx・429・通信エラーだけ再試行。既定 0）と `timeout`（ISO 8601。既定 `PT15M`）は書けて通る（効き目は確かめていない）
  - `http({ managed: false })` は退役した v1（`core.action.http`）を出し、`check` が `HTTP_V1_RETIRED` の warning を出す（レジストリは v2 だけ）。テナントではまだ動いたが、4xx も成功の道に来て（`statusCode: 404` の成功）、`onError` は走らない（`HTTP_ONERROR_V1`）。新しく書かない
- **Data Fabric の 4 ノードは、エラーの道を付けられない**（Terminate も）。落ちると run は Faulted で止まり、Automate の同時 50 の枠を使い続ける
- **Data Fabric の出力は「生きた参照」**：読むたびにクエリをやり直す。ループや Transform に渡したときだけ、その時点の写しになる。Query の `multiple` は `output.results[]`、上限 1000 件
- **Merge を Decision（branch）の後ろに置かない**（走らない側を待ち続ける）。並列の後ろだけ
- **Terminate は Completed で終わる**（Faulted にならない）
- コネクタは 2026-11-11 から、相手が 2xx 以外を返すと失敗になった（それまでは成功の道で、本文を見て分けていた）

### エージェント・会話・コネクタ（Automate で動かして分かったこと）

- **flow の中のエージェント（`inlineAgent`）**：compile が `.flow` の横に `<id>/agent.json` を書く。これもプロジェクトに入れないと実行で `Package resolution failed`（`debug.mjs` は横のフォルダも写す）。返す値は `returns: { answer: "string" }` で宣言し、プロンプトで「それを返して終える」と言う。言わないとモデルが「エラーとして終える」を選んで `AGENT_RUNTIME.TERMINATION_LLM_RAISED_ERROR` になった。`maxTokenPerResponse` が小さすぎると `CHAT_MODEL.UNSUCCESSFUL_STOP_REASON`
- **会話のエージェント（`conversationalAgent`）の `maxIterations` は 8 以下**。SDK の既定はそれを超え、`verify.mjs` は通すが、Studio Web の問題パネルが止める。明示する
- **会話の flow は CLI の debug では動かない**（`inputSchema` / `outputSchema` が無いと言われて上がらない。チャットを送る手段も無い）。`uip solution upload <ソリューションのフォルダ>` で上げ、Studio Web のデバッグのチャットで話しかける。返事と `sendMessage` の文が出て、成功になった
- **コネクタは `uip maestro registry prepare` を `tools/maestro`（SDK のあるフォルダ）で流す**。ほかの場所だと「SDK が無い」と言われる。接続は `uip is connections list --all-folders` で探す（既定は個人ワークスペースだけを見る）
- **`registry prepare` は `--profile` を見ず、既定のログインの接続を `.flow-sdk/bindings.json` に書く**（1.204.0、2026-11-17）。trial（接続が 0 件）で `--profile trial` を付けて流しても、既定のログインの組織の Slack の接続（`seiya-kawashima`）を結んで成功した。`--connection-id <trial の接続>` を渡すと「この tenant の一覧に無い」と断る。SDK は `UIPATH_CLI_INHERITED_PROFILE` でログインを受け継ぐ作りだが、uip 1.204.0 はこれを見ず、設定すると `PROFILE_MISMATCH`（「uip update して」）で止まる。`.flow-sdk/` は prepare が `tools/maestro` に作る作業場で、コミットしない
- **別のログインのテナントのコネクタは、`bindings.json` を手で書けば prepare なしで動いた**（trial、2026-11-17、`samples/maestro/deploy/GenAiTour.flow.ts`）。形は見本の先頭の注釈どおり（接続の Id は `propertyAttribute: "ConnectionId"`、フォルダの Key は `"FolderKey"`。値は `uip is connections list <key> --all-folders --profile <名前>` の `Id` と `FolderKey`）。これを置いた `<ws>/.flow-sdk/` を `verify.mjs --workspace <ws>` に渡す。UiPath GenAI Activities（`uipath-uipath-airdk`）のように SDK が入力の形を持っているコネクタは、overlay（connectors-local）が無くても `check` が入力の名前と必須を見る（`summarize-text` に `text` と書くと `CONNECTOR_INPUT`：必須は `prompt`）。入力の欄は `uip maestro flow registry get uipath.connector.<key>.<action> --connection-id <Id> --profile <名前>` の `inputDefinition.fields`（`--connection-id` が無いと欄が出ない）。照合は `verify.mjs --tenant --profile <名前>`
- **UiPath GenAI Activities のノードの出力**（Automate、trial）：`$vars.<id>.output` が応答そのもの（debug の結果では `response` の下）。言語の判定（`detect-language`、入力 `text`）は `.language`（`"Japanese"`）、要約（`summarize-text`、入力 `prompt`・`summaryFormat`・`detectInputLanguage`）は `.summary`、Web 検索（`web-search`、入力 `provider`（`GoogleCustomSearch` / `Jina`）・`query`・`num`）は `.results[]`（`title`・`url`・`snippet`）と `.formattedResults`。LLM の 2 つは `usage`・`model`（`gpt-5.1-2025-11-13`）・`choices` も返す。1 本の flow で 3 つが 1 つの接続を使うと、validate が「接続の共有」の warning を出す（同じアカウントで使うなら気にしなくてよい）
- **RPA のジョブが失敗すると、`rpaWorkflow` の `onError` に来る**（Automate、trial、2026-11-17、`samples/maestro/deploy/RpaOnError.flow.ts`）。`$vars.<id>.error` は `{ code: "Robot", status: 502, message: "Failure in the Orchestrator Job", detail: "<RPA の例外とスタック（in Main.xaml at …）>", category }`。debug の結果では失敗した node の出力が `Error`（先頭が大文字）で見えるが、式からは `.error`。エラーの道は `<id>ErrorEnd` で終わり、本線の続きは走らない。ジョブを待つ間（Unattended のロボットで 1 分ほど）flow は止まって待つ
- **Quick Form（`hitl`）にはエラーの道を付けられない**。trial の登録簿の `uipath.human-in-the-loop.quick-form`（1.6）は出口が `completed` だけで、`supportsErrorHandling` が無い。SDK の `check` も `.onError` を `ONERROR_NO_ERROR_PORT` で止める。文書の「Quick Form にエラーの道」（2026-10-30）は Flow のこのノードにはまだ来ていない
- **割り当てない人のタスクも `uip tasks complete` で完了できる**（trial、2026-11-17）。`uip tasks list` の JSON は日本語のタイトルを `\uXXXX` で返すので、`grep` で探さず `--output-filter "[?IsCompleted==\`false\`]"` で絞る。タスクはデバッグのフォルダ（`FolderId` はそのたびに違う）にできる
- **人のタスク（Quick Form）は `uip tasks complete <id> --type QuickFormTask --folder-id <id> --action Approve --data <JSON>` で完了できる**。タスクは `uip tasks list` の `CreatedTime` と `Title` で探す。完了すると、出力に `Action` と入力した値が入り、分岐の先へ進んだ
- **ファイルを入力にするとき**は `debug.mjs --attachment <入力名>=<ファイル>`
- **要約（`summarize`）と一括変換（`batchTransform`）はプランによっては動かない**（`460002 Failed to create ephemeral index`、詳細は `Unavailable with current plan`）。手元の検証は通る

## 4. ノードと、確かめた範囲

「テナント」はテナントでデバッグ実行して Completed を見たもの（Orchestrate の列は 2026-11-14 に、Automate で確かめた見本を `--automate` なしで流し直した）。「手元」は `verify.mjs`（types・check・compile・validate）だけ。見本は `samples/maestro/coverage/`、`samples/maestro/work-calendar/`、`tools/maestro/fixtures/`。

| ノード（SDK） | Automate | Orchestrate | 見本 |
| --- | --- | --- | --- |
| manual トリガー、`input` / `output` / `return` | テナント | テナント | `LoopTour`、`ControlTour` |
| `entryPoint` で入口を増やす、`scheduled`、`formTrigger` | テナント（既定の入口だけ動かした。定期実行はデプロイしないと動かない） | テナント（既定の入口） | `Triggers` |
| `script` | テナント | テナント | 全部 |
| `transform`（filter） | テナント | テナント | `ControlTour` |
| `branch` / `switch` / `parallel` | テナント | テナント | `ControlTour` |
| `loop` / `doWhile` / `updates`（変数の更新）、ループの中の変数 | テナント | テナント | `ControlTour`、`LoopTour`、`LoopVars` |
| BPMN：Script task、Exclusive（既定の道）、入力 | — | テナント | `ScriptGateway.bpmn` |
| Case：ステージ、ルール、タイマーのタスク | — | テナント | `samples/maestro/TimerCase.case` |
| `delay` | テナント | テナント | `ControlTour` |
| `http`（managed: false、退役した v1） | テナント | テナント | `ControlTour` |
| `http`（managed: true、v2）：成功・`branches`・2xx 以外の失敗 | テナント | テナント | `HttpV2` |
| `subflow` | テナント | テナント | `ControlTour` |
| `onError` | テナント | テナント | `ControlTour` |
| `mock`、`terminate` | テナント | テナント | `LoopTour` |
| `dataFabricCreate` / `Read` / `Update` / `Delete` | テナント | テナント | `DataFabricTour`、`WorkCalendarCheck`（RPA から Data Fabric を使う形は knowledge/dataservice.md） |
| `rpaWorkflow`：成功、ファイルの入力、出力を後ろで読む | テナント（Community と trial） | テナント | `fixtures/tenant/Rpa.*`、`deploy/DuViaRpa`（RPA で Document Understanding） |
| `rpaWorkflow` の `onError`（RPA のジョブの失敗） | テナント（trial、2026-11-17） | 手元 | `deploy/RpaOnError` |
| `connector`（Slack のユーザーグループの一覧。読むだけ） | テナント（Community） | テナント | `fixtures/tenant/Slack.*`（先に `registry prepare`。下） |
| `connector`（UiPath GenAI Activities：言語の判定・要約・Web 検索） | テナント（trial、2026-11-17。`bindings.json` を手で書いた） | 手元 | `deploy/GenAiTour` |
| `agent`（公開済み） | テナント | テナント | `fixtures/tenant/Agent.*`（PERSONAL_WORKSPACE を実際の名前にして流す） |
| `inlineAgent`（flow の中で定義するエージェント） | テナント | テナント | `InlineAgent` |
| `hitl`（Quick Form）：作る → 完了 → 再開 → 分岐 | テナント（Community と trial。`uip tasks complete` で完了） | テナント（人が完了） | `fixtures/ok/Approval.flow` |
| 会話（`conversationTrigger`、`waitForMessage`、`conversationalAgent`、`sendMessage`） | テナント（Studio Web のデバッグのチャットで） | 手元 | `Chat` |
| `documentClassify` | テナント（分類器なしで Completed、結果は空） | 手元 | `Documents` |
| `summarize`、`batchTransform` | Community では動かない（`Unavailable with current plan`、一時インデックスが作れない）。**trial（Standard）ではテナントで動いた**（2026-11-17、AUT-1211）：要約の出力は `$vars.<id>.output.content.Text`（と `Citations[]`）、一括変換は列を足した CSV のファイル参照（`ID`・`FullName`・`MimeType`） | 同じ（trial で Orchestrate として流した） | `Documents` |
| `ixpExtract` / `dynamicExtract` | `ixpExtract` は動いた（Standard のトライアル。Community はデプロイが 403）。`dynamicExtract` は Studio Web の Debug で抽出サービスまで届くが、実行時の SingleExtract が INVALID_DOCUMENT。Studio Web だけで作った Flow でも同じ（設計時の Dataset の予測は通る）（10 節） | 同じ | — |
| 音声（`voiceTrigger`、`voiceAgent`、`endCall`、`createOutgoingCall`） | 手元と、テナントの登録簿との突き合わせ（下の「音声のノード」）。着信はデプロイと電話番号（SIP の電話会社か Twilio の契約）が要り、発信はデバッグでも本当にかけて課金されるので、試せない | 同じ | `Voice` |
| `publishedFunction`（Function ノード、JS/TS の関数） | — | テナント（trial、2026-11-17。`samples/function-ts/quote` を pack → `or packages upload` → `or processes create` した「AUT1211Quote」を呼び、`{subtotal, discount, total}` が `$vars.<id>.output` に入った） | `deploy/FunctionCall` |
| BPMN の「Start and wait for Function」（`Orchestrator.ExecuteFunctionAsync`） | — | テナント（trial。SDK に専用のメソッドが無いので `.activity()` に型名を渡す。名前とフォルダで指すときは `typeVersion: "v2"`。出力は `outputs: { total: "=total" }` で変数に入った） | `deploy/FunctionTask` |
| `apiWorkflow`（生成器で作った API ワークフローを呼ぶ） | テナント（トライアル。配列の引数も渡せた） | 手元 | `deploy/CallApiWorkflow`（knowledge/api-workflow.md） |
| BPMN：並列ゲートウェイ、タイマーの中間イベント、サブプロセス、multi-instance、エラーの境界イベント | — | テナント | `BpmnTour.bpmn` |
| BPMN：Inclusive ゲートウェイ、Event-based ゲートウェイ、エラー開始のイベントサブプロセス | — | テナント | `BpmnEvents.bpmn` |
| Case：ステージ 3 つ、前のステージの完了で入る、タスク 2 つを並べて動かす、必須のステージで完了 | — | テナント | `CaseTour.case` |
| `onEvent` / `waitForEvent`（Data Fabric のレコード作成） | 手元。WEBHOOK 方式でデバッグでは動かない。デプロイすると行の作成で起動した（10 節） | デプロイで起動した（`event-bindings.mjs` で整える。10 節） | `EventWait`、`deploy/DfEvent` |
| 定期実行のトリガー（デプロイ） | テナント（5 分ごとに動いた） | — | `deploy/Nightly` |
| 定期実行の Cron（デプロイ、AUT-1192） | テナント（2026-11-17、Sorahane Trial の個人ワークスペース。`0 * * * * ?` で毎分 12 秒ごろに動き、3 回とも Successful） | — | `deploy/CronTick` |
| `queueItem` | テナント（試しのキューに項目ができた。trial でも debug で入った） | — | `deploy/QueueTour` |
| キューの残りのノード（Delete queue items・Set transaction status）と Queue trigger | 下の「キューのノード」 | 同じ | — |
| BPMN の Custom instance ID | — | テナント（trial。`InstanceDisplayName` が式の値になった） | `InstanceId.bpmn` |
| Case の QuickForm（`case-quickform.mjs`） | — | テナント（trial。タスクができ、`uip tasks complete` で完了した） | `CaseQuickForm.case` |
| BPMN の Call activity（`startAgenticProcess`）と戻り値 | — | テナント | `deploy/Parent`、`deploy/Child` |
| ビジネスルール（`businessRule`、DMN） | — | 評価できた（DMN 1.3、`.uirule` を直す。10 節） | `deploy/RuleCall`、`deploy/Tier` |

### 音声のノード（trial の登録簿と SDK 6.66.5 の突き合わせ、2026-11-17）

| ノード | 登録簿の版 | SDK が書く版 | 差 |
| --- | --- | --- | --- |
| `core.trigger.voice`（Incoming call） | 1.0 | 1.0 | なし |
| `uipath.agent.voice`（Voice agent） | 1.2 | 1.0 | 登録簿の入力に `voice.turnDetection`（`silenceDurationMs`・`prefixPaddingMs` 0〜5000、`sensitivity` low / high）と `voice.agentSpeaksFirst`（既定 true）があり、SDK の `voiceAgent` には無い（Studio Web で足す）。`maxIterations` は 1〜8。上にエスカレーション、下にコンテキストと道具をつなぐ口がある |
| `uipath.conversational.voice.end-call`（End call） | 1.0 | 1.0 | なし |
| `uipath.conversational.voice.create-outgoing-call` | 1.0 | 1.0 | なし |

- SDK は Voice agent の設定を、ノードではなく横の `<UUID>/agent.json` に書く（`settings.engine: "conversational-v1"`、`mode: "voice"`、`voice: { model: "gemini-3.1-flash-live-preview", maxTokens: 65536, temperature: 0, persona: "Aoede" }`）。音声のモデルは `uip agent model list` には出ない（文字のモデルだけ）ので、使えるかは CLI では確かめられない
- Voice agent の出力は `uipath__agent_response_messages`・`uipath__voice_call_context`（`type: phone | web`、`id`、`conversationId`）・`uipath__voice_session`（`callEnded`・`endedBy`（agent / user / system / error）・`reason`）
- `verify.mjs`（check・compile・validate）は 1.0 のまま通る。動かすには電話番号が要るので、テナントでは動かしていない

**Automate として動いていることの確かめ**：`debug.mjs --automate` で動かしたプロジェクトを Studio Web で開くと、下のツールバーが「製品: Maestro Automate」、エクスプローラーが「Maestro Automate プロジェクト」になっていた。Orchestrator のジョブは `RuntimeType: "Flow"` で、profile は出ない。

## 5. 稼働日カレンダー（Automate の見本）

`samples/maestro/work-calendar/WorkCalendarCheck.flow.ts`：今日の日付（日本時間）で WorkCalendar を読み、動かすかを返す。App（`samples/apps/work-calendar.json`）で編集した表を、RPA 側（`samples/apps/work-calendar-rpa/ir/IsRunDay.json`）と同じ決めごとで見る。テナントで、登録なし → `run: false, 登録が無い日`、動かす日 → `run: true` を確かめた（試しの行は消した）。この後ろに `rpaWorkflow` を置けば「動く日だけ RPA を呼ぶ」になる。

## 6. BPMN（Orchestrate）

見本：`samples/maestro/coverage/ScriptGateway.bpmn.ts`（入力 → Script → Exclusive → 終了。テナントで両方の道を確かめた）、`tools/maestro/fixtures/`。

- **式の書き方が Flow と違う**：`vars.<変数>`、ループの中は `iterator.item`（入れ子は `iterator[0].item`）、Data Fabric は `datafabric.<表>["qes:<列>=<値>"].<列>`（1 件。0 件は空、複数はエラー）か `qem:`（最大 1000 件の配列）。ファイルの中では `=js:`。C# の式は非推奨（2026-01）。式の中で代入 `=` は使えない
- **Script task の戻り値は `=result.response`**（SDK の `scriptVersion` v3）。ドキュメントは `scriptResponse` と書くが、そう書くと **validate は通り、実行すると値が入らない**（実際に分岐を間違えた）。Script の中では引数名ではなく `vars.<id>` で読む（`SCRIPT_BARE_INPUT_REF`）
- **Exclusive ゲートウェイには既定の道（`default`）を付ける**。どの条件にも当たらないとインスタンスが落ちる（"No outgoing flow for gateway"）。Inclusive と Parallel の分岐には同じ種類の合流を置く
- **実行されるのは一部の要素だけ**。描けても動かないもの：Signal、Escalation、Link、Conditional、Compensation、Complex ゲートウェイ、Loop マーカー、Ad-hoc、Transaction、Data object、2 つ目以降のプール。動くもの：None / Message / Timer / Queue の開始、Message・Timer の中間と境界、Error の境界（割り込みだけ）、None / Message / Error / Terminate の終了、User / Service / Script / Send / Receive / Business rule タスク、Exclusive / Inclusive / Parallel / Event-based、サブプロセス、Call activity、イベントサブプロセス（Error 開始・Message 開始）、multi-instance
- **multi-instance は Action を決めてからマーカーを付ける**（逆だと集めた結果が null だらけ）。並列は 50 件ずつ
- 1 プロジェクトに `.bpmn` は 1 つ。`bpmn:process` の id は変えない（"No diagrams found"）。変数名を変えると変数 ID も変わる（2026-03）
- エラー：Error mapping（2026-03）でノードの失敗をエラーに対応づけ、境界のエラーかイベントサブプロセスで受ける。同じスコープではイベントサブプロセスが先。再試行は 1〜10 回、1 秒〜1 時間、合計 24 時間まで
- `humanTask({ app })` は SDK のままでは落ちる。`tools/maestro/bpmn-app-task.mjs` で書き換える（[docs/maestro-tenant-resources.md](../docs/maestro-tenant-resources.md)）
- **multi-instance で今の要素を読むには `itemVar: "iterator[0]"` にし、`inputs: { cur: "=iterator[0].item" }` で渡して、スクリプトでは `cur` と名前で読む**（テナントで確かめた）。次はどれも値が入らない：`itemVar: "item"` と `=iterator.item`（エンジンが `iterator.iterator<id>.item` に読み替えて「無い」）、`vars.item`（空のまま。黙って通るので、空なら投げるようにして気づいた）、`=js:iterator.item`（`iterator` が undefined）。この形に SDK の `check` は `SCRIPT_BARE_INPUT_REF` の warning を出すが、動く。SDK の説明（`iterator.<itemVar>`、inputs の名前はスクリプトから読めない）とは違う
- **Inclusive ゲートウェイの `default` の道は、ほかの条件に当たっても毎回通った**（Exclusive の既定とは違う）。「どれにも当たらないときだけ」にしたいなら、その道にも条件を書く
- **メッセージの中間イベント（`intermediateCatchEvent({ message })`）は、コネクタのイベントを結ばないと待たずにすぐ完了した**。Event-based ゲートウェイで「返事か期限か」を作るなら、返事の側にコネクタのイベントが要る
- **イベントサブプロセスの開始イベントは SDK が `<id>_start` として作る**。自分で `startEvent` を書くとエラー。`sequenceFlow("<id>_start", …)` でつなぐ
- 失敗の理由は `uip traces spans get <インスタンス>` の `Incident - <要素>` の `errorDetails`。BPMN の debug はスクリプトの出力を見せないので、調べたい値は `throw new Error(JSON.stringify(…))` で投げてここで読んだ
- `uip maestro bpmn debug` の結果は PascalCase（`FinalStatus`、`ElementExecutions`）で、変数の値は出ない。変数は `uip maestro bpmn debug-instance variables <インスタンス>`（子のプロセスも含めるなら `variables-all`）、失敗は `debug-instance incidents` で読める（1.204 にある。AUT-1207 の 6。`debug.mjs` はまだ使っていない）。`--timeout` も無い（`debug.mjs` が吸収する）。init の雛形に入れたあと `bpmn refresh` で `entry-points.json` を作り直す

## 7. Case Management（Orchestrate）

見本：`samples/maestro/TimerCase.case.ts`（テナントで Completed、AUT-1080）、`tools/maestro/fixtures/ok/Approval.case.ts`。

- ケース ＝ ステージ ＋ ルール（WHEN イベント / IF 条件 / ACTION）。ルールは**イベントで動く**（データを見回らない）。IF で参照する項目は、どこかのタスクが必ず書くこと（書かれないと永遠に真にならない）
- ステージは Primary（辺か入場ルール）と Secondary（入場ルールだけ。入ると必ず割り込む）。Required のステージが終わらないとケースは終わらない
- **Exit ルールは動いているタスクを止めない**。Exit で終えた Required のステージは「完了」に数えないので、後ろで受けるか Exit the case と組にする
- 再入場で動かすかのフラグは、ドキュメントに `runOnlyOnce`（新しい）と `runOnReentry`（古い）が混ざり意味が逆。値を明示する
- Case Manager エージェントの出力は `caseManagerDecisions` の形でないと**黙って無視される**
- `uip maestro case debug` は JSON の前にログの行を出す（`debug.mjs` は最初の `{` の行から読む）。Case は内部で BPMN にされ、`CaseRulesEvaluatorNode`（ルールの評価）、`CaseManagerNode`、ステージごとの SLA のイベントサブプロセスなどが動く。ステージは `Stage_<id>`、タスクは `t<id>` という要素になる
- 実行するアカウントに Triggers.view と Triggers.create が無いと、wait-for-trigger の段で 403（実行時にしか出ない）
- `action` にアプリを指定しないと 170004。QuickForm は SDK で書けないので、`tools/maestro/case-quickform.mjs` が compile の後で `caseplan.json` と `<タスク>.hitl.json` に足す（12 節）

## 8. 運用（Orchestrate）

- インスタンスの操作：Pause / Resume / Retry / Migrate / Cancel / Go to / 変数の編集。**Migrate の後は Paused なので Retry が要る**。Go to の後も Retry か Migrate
- Faulted のインスタンスの job は Orchestrator では Running（Suspended (with errors)）のまま残る。失敗の理由は `uip traces spans get <インスタンス>` の Incident のスパン
- デバッグは 1 回 35 分まで。人や長いタイマーはデプロイして確かめる
- 課金：1 インスタンス 1 Platform Unit（Unified）か 5 Agent Units（Flex）。無料枠なし。デバッグは無料
- 最適化（Process Mining）は BPMN と Case だけ。Flow はまだ

## 9. ドキュメントの食い違いと、実物での答え

| 食い違い | 実物（テナント / SDK）での答え |
| --- | --- |
| ループの位置は `currentIndex`（0 から）か `currentIteration`（1 から）か | **`currentIteration`（1 から）**。`currentIndex` は無い（`check` が止め、値も null）。ループの後の `output` は `[{ <中のノード>: { output } }, …]`（`LoopVars`） |
| BPMN の Script の戻り値は `scriptResponse` か | **`=result.response`**（`ScriptGateway`） |
| Terminate は Completed か Failed か | Flow の `terminate` は **Completed**（`LoopTour`） |
| Data Fabric のノードにエラーの道は付くか | 付かない（SDK も同じ） |
| 抽出の出力は `ExtractionResult` か `result` か | **ノードで違う**。Published のモデルのノード（`uipath.ixp.<プロジェクト>.…`、`serviceType: "IXP.Extraction"`）は `ExtractionResult`：テナントのレジストリ（`uip maestro flow registry get <NodeType>` の `outputDefinition`）がそう定義し、実行でも `output.ExtractionResult.ResultsDocument` だった（2026-11-16）。Studio Web の「Extract document」（`IDP.Extraction`）は `ExtractDocumentOutput` の `result`（`version` / `type` / `result` / `taxonomy` / `metadata`）。2026-07-07 のリリースノートの「`=ExtractionResult` → `=result`」は後者の話 |
| BPMN の multi-instance で今の要素は `iterator.item` か（SDK とドキュメント） | **`itemVar: "iterator[0]"` と `inputs: { cur: "=iterator[0].item" }`、スクリプトでは `cur`**（`BpmnTour`）。SDK の「inputs の名前はスクリプトから読めない」も、この場合は当たらない |
| Inclusive の合流は「動いた辺だけ待つ」か | 当たった道と `default` の道が全部動き、合流は全部を待って進んだ（`BpmnEvents`） |
| Automate のプロジェクトが本当に Automate として扱われるか | Studio Web で「製品: Maestro Automate」と出た（`operate.json` の `Lite`） |
## 10. デプロイして確かめたこと（2026-11-13、個人ワークスペース）

見本は `samples/maestro/deploy/`。1 つのソリューション（Flow 2 本・BPMN・rules プロジェクト）にまとめてデプロイし、確かめたあと片付けた（キューの削除 → `deploy uninstall` → 公開した版の `packages delete`）。

### 流れ

```bash
uip solution init <名前>                                   # その中で
uip maestro flow init <Flow> --automate                    # 入れ物を作り、verify.mjs --out の .flow を入れる
node tools/maestro/event-bindings.mjs <Flow>               # コネクタのイベントのトリガーの Flow のとき（下）
uip solution resources refresh --solution-folder .         # 同上
uip maestro bpmn init <BPMN>   && uip maestro bpmn refresh <BPMN>
uip rules init <Rules>         && uip rules validate <Rules> && uip rules refresh <Rules>
uip solution pack <ソリューション> <出力先> --version 1.0.0
python -I tools/maestro/fix-entry-points.py <出力先>/<名前>_1.0.0.zip <直した.zip>   # 定期実行の Flow があるとき（下）
uip solution publish <直した.zip> --personal-workspace
uip solution deploy run --name <名前> --package-name <名前> --package-version 1.0.0 --personal-workspace --folder-name <フォルダ>
uip solution deploy upgrade --name <名前> --package-name <名前> --version 1.0.1 --personal-workspace   # 版を上げる
# 片付け
uip solution deploy uninstall <名前> --yes
uip solution packages delete <名前> <版> --personal-workspace --yes
```

### 分かったこと

- **定期実行のトリガーの Flow は、そのままでは publish できない**。`solution pack` が作る nupkg の `entry-points.json` で、定期実行の入口の `uniqueId` が `"start"`（GUID でない）になり、`solution publish` が `1205 Corrupted solution package: No entry points defined for project <id>` で拒む。会話・イベントのトリガーや BPMN の入口は GUID なので通る。`tools/maestro/fix-entry-points.py` で GUID に直すと通った
- **デプロイすると、定期実行は本当に動いた**（5 分ごと。Orchestrator のジョブの `Source` が `Schedule`、Automate の flow として成功）
- **Cron でも書ける**（AUT-1192）。SDK 6.66.5 の `scheduled({ every })` は、`every` が Quartz の Cron（6〜7 項目、秒から始まる）なら、トリガーを 1.2 の定義（`timerType: "timeCycle"`、`timerValue: "<Cron>"`）で書く。ISO の繰り返し（`R/PT5M`）は今までどおり 1.1。
  - **タイムゾーンは書けない**。テナントの登録簿（`uip maestro flow registry get core.trigger.scheduled`）の最新も 1.2 で、項目は `timerType`・`timerValue` だけ。動いた時刻は UTC だった。
  - 文書は「タイムゾーンは必須、既定は UTC」と書くが、今の定義には無い。日本時間の「毎朝 9 時」は UTC の 0 時の `0 0 0 * * ?` と書く（日本には夏時間が無いので、ずれない）。
  - 前の実行が終わらないうちに次の時刻が来たときに、飛ばすか待たせるかは、デプロイの設定の Concurrency で決まる（文書。試していない）。
- **`flow init --automate` でソリューションに足すと、process の resource の `runtimeProfile` は `Standard` のまま**。Studio Web で作った Automate のソリューションも `Standard` だったので、Automate かどうかは project の `operate.json` の `profile: "Lite"` で決まると見ている
- `deploy run` は `--folder-name` が要る（`--personal-workspace` でも）。フォルダは `<個人ワークスペース>/<フォルダ名>`。`rules` のコマンドはこのフォルダをパスで見つけられず（Folder not found）、`--folder-key` なら通った。フォルダの Key は `uip or jobs get <ジョブ>` の `FolderKey`
- **BPMN の Call activity（`startAgenticProcess`）で、デプロイ済みの別の BPMN を呼んで待てた**（要素の種類は `CallActivity`）。入力は `input: { n: 21 }`、戻りは `outputs: { whole: "=result", doubled: "=result.doubled" }` で `{ doubled: 42 }` と `42` が入った
- **BPMN が値を返すには、終了イベントに mapping が要る**。SDK の `.output("doubled", …)` は宣言（`<uipath:output id elementId="done">`）だけで、それだけだとジョブの出力は `{}`。Studio Web で終了イベントに「引数」を足すと、終了イベントに `<uipath:mapping><uipath:type value="BPMN.Variables"/><uipath:output name source var custom="true"/></uipath:mapping>` が入る。SDK では `endEvent("done", { payload: { type: "BPMN.Variables", outputRows: [{ name: "doubled", type: "number", source: "=vars.value", var: "doubled", custom: true }] } })`。`source` は普通の変数（`.var()`）を指す（出力の名前を指すと `VARIABLE_DOES_NOT_EXIST`）
- **キュー**：`queueItem({ queue, folderPath, key: <キューの Key>, reference, item })` で項目ができた（`uip or queue-items list` で `New`）。試しのキューは `uip or queues create <名前> --folder-path …` で作り、`uip or queues delete <Key> --yes --force` で消した。Flow の SDK にはキューのトリガー、BPMN の SDK にはキューの開始イベントが無い
- **ビジネスルール（DMN）は BPMN から評価できた**（`"VIP"` → `gold`、ジョブは Successful）。`uip rules init` が作る DMN（`Business rule.dmn`、デシジョン テーブル）と `entry-points.json`（`type: "BusinessRules"`）を、同じソリューションでデプロイして `businessRule` から呼ぶ。要ったことは 4 つ:
  1. **DMN は 1.3 にする**。`rules init` は DMN 1.5（`https://www.omg.org/spec/DMN/20230324/MODEL/`）を書くが、評価する側は `Can't parse definition from given string: There is an error in XML document (1, 2).` で読めない（Studio Web も `Unsupported DMN version 1.5`）。名前空間を `https://www.omg.org/spec/DMN/20191111/MODEL/` と `.../20191111/DMNDI/` にする（DC・DI は 20180521 のまま）。`rules validate` は 1.3 も通る
  2. **パックした zip を `python -I tools/maestro/fix-entry-points.py <in.zip> <out.zip>` で直してから publish する**。pack はルールを `files/<id>/<名前>-<版>.uirule` という zip（`entry-points.json` と `.dmn`）で作るが、評価する側はこれを `.dmn` そのものとして読み、`Error parsing business rule`（300403）/ `Data at the root level is invalid. Line 1, position 1.` で失敗する。直すと中の `.dmn` に置き換わる
  3. **結果は `<要素の id>_businessRuleResponse` に `{ <decision>: { <列>: 値 } }` で入る**。列のキーは出力の `label` から作られる（`label="Output 1"` なら `Output_1`）ので、`label` を `name` と同じにする。`businessRule` の `outputs` で独自に写した変数（`=result.decision1.output1` など）は null のままだったので、スクリプトで `vars.rule_businessRuleResponse.decision1.output1` を読む
  4. **ルールは `deploy upgrade` では入れ替わらない**（`uip rules versions` は最初に入れた版のまま）。ルールを直したら `deploy uninstall` → `deploy run` で入れ直す
  ほか：`uip rules debug` は 403、`uip rules describe` は `has no argument contract on its resource`（評価には関係なかった）。`rules` のコマンドは個人ワークスペースの下のフォルダを `--folder-key` で指す。見本は `samples/maestro/deploy/Tier/` と `RuleCall.bpmn.ts`
- **コネクタのイベントのトリガー（Data Fabric のレコード作成）は動いた**（ジョブの `Source` が `IntegrationTrigger`、`$vars.start.output` に作った行がまるごと入る）。要ったことは 3 つ:
  1. 接続のサインインが生きていること（切れていると `ConnectedEventTrigger` を作るところで `invalid_grant`。人が Orchestrator の「コネクション」で再接続する）
  2. **ソリューションのプロジェクトに `bindings_v2.json` と `entry-points.json` を置き、`uip solution resources refresh` してから pack する**。`.flow` だけを入れると process の resource の `runtimeDependencies` が空で、デプロイは通るのにトリガーが作られず、行を足しても起動しない。2 つのファイルは `uip maestro flow pack <プロジェクト> <出力先>` が作る nupkg の `content/` から取れる（プロジェクトには書かない）
  3. **`where` で見張るエンティティを指定し、コンパイルした `.flow` の `detail.filterExpression` を消す**。この操作の引数は `entityScope`（`tenant` か `folder`）と `tenantEntityName` / `folderEntityName`（`uip is triggers objects uipath-uipath-dataservice CREATED_V3 --connection-id <id>` で見える）。SDK 6.66.5 は `where` を `eventParameters` に入れるが、同じ値で `filterExpression: "entityScope == 'tenant' && …"` も作り、これが残っていると起動しなかった（中身に `entityScope` は無い）。SDK は `EVENT_SCOPE_NOT_TAKEN` の warning も出すが誤り。`object` は `EVENT_UNKNOWN` で通らない
  2 と 3 は（デプロイして起動まで確かめた）`node tools/maestro/event-bindings.mjs <ソリューションの中の Flow プロジェクト>` がまとめてやる（そのあと `uip solution resources refresh --solution-folder <ソリューション>` → `solution pack`）。見本は `DfEvent.flow.ts`

- **IXP（文書の抽出）は Standard のトライアルの組織で、Flow から呼べた**（2026-11-13、組織 sorahaneworks、`uip login --profile trial` で別にログイン）。要ったこと:
  1. 組織を作っただけではテナントに IXP が無い（`Service: du not found`）。`uip admin tenants services add --service du` と `--service reinfer` を足す（`uip admin tenants services list` で入っているものが見える）
  2. そのあと API が 401 になる。ブラウザでテナントの IXP の画面（`/<org>/<tenant>/reinfer_/ixp`）を一度開くと通る（利用者の登録が起きる）
  3. `uip ixp projects create` → `uip ixp deployments create <プロジェクト> --version 0 --folder-key <Shared の Key>`（最初のモデルは version 0）。これで `uip maestro flow registry search "uipath.ixp"` に出る
  4. SDK の `ixpExtract({ project: <registry の NodeType>, modelName: <DeploymentName>, name: <DeploymentTitle>, folderName, fileRef })`。結果は `$vars.<id>.output.ExtractionResult.ResultsDocument.Fields[]` で、最上位はフィールド グループ（`FieldType: "FieldGroup"`、`FieldName` は `Invoice` や `Invoice > Line Items`）。項目はその `Values[]`（1 件 = 1 回の出現、明細なら 1 行）の `Components[]` に `{ FieldName, Values: [{ Value }] }` で入る。日付は `2026-10-05`、金額は `8100.00 JPY` の形
  見本は `samples/maestro/deploy/IxpExtract.flow.ts`（請求書番号・合計・明細 2 行が取れた）。`tools/maestro/debug.mjs` に `--profile` を足した
  `dynamicExtract`（Studio Web の「Extract document」、registry では「Extract v2」）は、生成器と CLI の経路では動かせなかった（2026-11-14）。分かったこと:
  - **SDK 6.66.5 の定義が古い**。SDK は `serviceType: "IXP.DynamicExtraction"` と旧い出力（`ExtractionResult`）を書くが、Studio Web は `serviceType: "IDP.Extraction"`、出力は `ExtractDocumentOutput`（`version` / `type` / `result` / `taxonomy` / `metadata`）。SDK のままだと何も呼ばれず、Completed なのに出力は空。Studio Web の定義に差し替えると抽出サービスまで届く
  - **項目の定義（`inputs.schemaDocument`）は `{ config, prompt, outputSchema }`**。`outputSchema` は JSON Schema で、最上位の各プロパティがフィールド グループ（1 件なら `type: ["object","null"]` と `properties`、繰り返しなら `type: "array"` と `items.properties`）。項目は `{ "$ref": "#/$defs/Exact%20Text", "x-uipath-field-id", "description" }` で、`$defs` に `Exact Text`・`Date`・`Monetary Quantity`・`Number`・`Inferred Text` を置く（形が違うと Studio Web が「must be "array" or ["object","null"]」と言う）。`config` は `extraction_method: "external_llm"`、`model: { family: "gemini", version: "gemini_2_5_flash" }` など。Studio Web の「Pick a template」で取った形を `uip solution download --extract` で読むのが確実
  - **実行には IDP processor が要る**。ノードの `inputs.processorKey` が、ソリューションのリソース `resources/solution_folder/idpProcessor/extraction/<名前>.json`（`kind: idpProcessor`、`apiVersion: ecs.uipath.com/v2`、`spec` に prompt と outputSchema の文字列）の `key` を指す。`.flow` の最上位の `bindings` に `{ resource: "idpProcessor", resourceKey: <key>, name: "processorKey", propertyAttribute: "processorKey" }` を置くと、`flow pack` が `bindings_v2.json` に、`solution pack` が process の `runtimeDependencies` に載せる。Studio Web はノードを置くと processor を作り、`modelName` と `folderKey` は空のまま
  - ここまで揃えても、`flow debug` でも `solution deploy` してからの実行でも `461005 Failed to fetch IDP processor（Processor could not be found）` になった（Studio Web が作った processor のファイルをそのまま入れても同じ）。CLI の経路では processor が用意されない
  - **生成器で作ったソリューションを `uip solution upload` で Studio Web に上げ、画面の Debug（Debug configuration の「Deploy resources before debugging」がオン）で動かすと、processor が用意されて抽出サービスまで届いた**（Solution resources に「IXP models / <processor 名> — Will be deployed in Debug folder」と出る。入力のファイルは Entrypoint arguments で付ける）。trace は IDP Extraction → IDP Digitization（成功、1 ページ）→ Extraction - SingleExtract と進む。processor の key は新しく作る（Studio Web の別のソリューションと同じ key だと、2 回目から `The IDP processor could not be resolved in its folder`）
  - ただし SingleExtract が毎回 `INVALID_DOCUMENT（The document could not be processed.）` で失敗し、ノードは `461002 IDP extraction task failed` になった。PDF 2 種と PNG、Studio Web のテンプレート（Sales Orders）と生成器の請求書の定義、Studio Web の processor と生成器の processor の、どの組み合わせでも同じ。帰属の方式（`attributionStrategy` を `WordId` → `Rules`）、言語（`Auto` / `UiPath`）、モデル（gemini-2.5-flash / 3.8-flash）を変えても同じ。trace の modelConfig は `product: "communicationsmining"`、`operationCode: "IXP.StructuredExtraction.Extraction"`
  - **公式の手順**（IXP の「Flow user guide」、`docs.uipath.com/ixp/automation-cloud/latest/flow-user-guide/`）：Extract node のモデルはソリューションのリソース（Studio Web の Explorer の「IXP models」）。手順は「ノードでモデルを作る → 文書を上げて注釈 → **Run evaluation** → Studio Web の **Deploy**（ソリューションごと）」で、デプロイ後は Orchestrator のソリューション フォルダの「IXP Models」タブに出る。テナントに IXP と Document Understanding の両方が要る。形式は PNG・JPG・PDF・TIFF・GIF。IXP in Flow は Preview。文書には Debug での実行時の動きも、CLI の `solution deploy` の経路も書いていない
  - **使い分け**：ノードの中でモデルを作る「Extract document」は Preview（Maestro のリリースノートでは 2026-10-30、IXP のリリースノートでは 10-23）。IXP の画面でプロジェクトを作ってフォルダにデプロイし、Flow では「Published」から選ぶ形（SDK の `ixpExtract`）は 9 月からある形で、こちらは実行まで動いた。Flow で文書を抜くときは `ixpExtract` を使う。Document Understanding のモデル（抽出器）を使う昔からの形は、Flow のノードには無く、RPA のワークフロー（Extract Document Data）を Maestro から呼ぶ（Maestro の「Extracting and validating documents」）。RPA の側は生成器で書けて、Flow から rpaWorkflow で呼び、請求書の値が取れた（`samples/maestro/deploy/DuViaRpa.flow.ts`、knowledge/document-understanding.md）
  - **公式どおり Studio Web の Deploy でも同じだった**（2026-11-14）。Studio Web だけで作った Flow を、画面の Deploy（Shared の下にソリューション フォルダ）で出し、`uip maestro flow process run <ProcessKey> <FolderKey> --release-key <ReleaseKey> --attachment invoice=<PDF>` で動かした。IDP Digitization は通るが SingleExtract が `INVALID_DOCUMENT` で、インスタンスは Faulted（`--wait` は Faulted のまま返らないので、`flow instance list -f <FolderKey>` と `traces spans get` で見る）。Debug・Studio Web の Deploy・CLI の deploy のどれでも実行時だけ落ちるので、サービス側の問題とみて、ここで止める。片付けは `flow instance cancel` → `solution deploy uninstall <名前> -y`
  - **公式の「注釈 → Run evaluation」を済ませても同じ**（2026-11-14）。Dataset で予測を Submit（33 項目を確定）し、Run evaluation（v1.0、F1 100、約 40 秒）は通った。そのあと Debug すると、やはり SingleExtract が `INVALID_DOCUMENT`。trace では Digitization の成果物（`documentId`、`dom.json.gz`、`document.pdf`、`pageCount: 1`）はできていて、SingleExtract は 1〜2 秒で落ちる（`modelConfig` は gemini-2.5-flash、`product: communicationsmining`、`subscriptionType: UiPathOwned`）。設計時の予測と評価は通り、Flow の実行だけが落ちる。抽出のモデルを GPT-6 Luna（OpenAI）に替えても同じで、1 秒ほどで落ちる。LLM の種類によらないので、モデルを呼ぶ前、実行時に文書を渡すところで落ちているとみる（SingleExtract の `documentId` は入力のファイルの `ID` と同じ値）。これより先はこちらから直せないので、UiPath の不具合として扱う。ライセンスではない：Admin → Licenses → Consumables の Platform Units は 0 / 8,000 消費（Standard Trial、2026-11-14）。AI Trust Layer の Audit は IXP の Failed / Blocked が 0 で、IXP in Flow の呼び出しは設計時の成功したものも含めて 1 件も記録されない（Published の IXP の呼び出しだけが記録される。文書では設計時も実行時も記録されるはずなので、記録が無いこと自体が異常の手がかり。AUT-1203 の 4）。**公開の DU API（Framework v1.0）で直接呼んでも、Flow で作ったモデル（IXP の default_extractor）は Digitization の後の抽出が 500 UnexpectedInternalServerError。同じトークン・同じ PDF で Predefined の invoices は 200**。Flow の層ではなく、Flow で作ったモデルのサーバー側の抽出が落ちている。新しい Flow で新しく作ったモデルでも同じだった（Flow で作ったモデル 3 つすべて。2026-11-14）。調べた結果は C:\Users\seiya\reports\UiPath IXP Preview 実行失敗の原因.md
  - **生成器のせいではない、と確かめた**（2026-11-14）。Studio Web だけで作った Flow（Manual trigger の file の入力 → Extract document、テンプレートは Sales Orders、processor も Studio Web が作ったまま）を画面の Debug で動かしても、同じ `INVALID_DOCUMENT` になった。一方、同じノードの **Definition → Dataset に同じ PDF を上げると、設計時の予測は通る**（Digitization → 抽出 → Attributing → Up to date。日付 2026-10-05、合計 8,100 JPY、明細 2 行に印が付く）。抽出のサービスと定義は動いていて、**実行時の SingleExtract の呼び出しだけが、このテナント（Standard のトライアル、US）で落ちる**。Preview の不具合か、テナントの設定の不足と見ている。それまでは、文書の抽出を Flow から動かすなら `ixpExtract`（IXP のプロジェクトをデプロイして使う）を使う。`dynamicExtract` を使うときは、項目の定義を Studio Web の Dataset で確かめる
- **IXP（文書の抽出）は Community プランだと、学習側は動くが Flow から呼べない**（2026-11-13）。`uip ixp projects create <名前> <PDF のフォルダ> -d "<抜く項目>"` でプロジェクトを作り、項目案（請求書と明細）が出て、`labellings get-predictions` の抽出も正しかった。`projects publish` も通った。**`uip ixp deployments create … --folder-key <Key>` は 403**（個人ワークスペースでも Standard のフォルダでも同じ。トークンには `Du.*` と `Reinfer` のスコープがある）。Flow の registry（`uip maestro flow registry search "uipath.ixp"`）はフォルダにデプロイしたモデルしか出さないので 0 件のまま、`ixpExtract` のノードは作れない。文書では Community でも抽出は「含まれる」が「機能は限られる」とあり、デプロイの可否は書いていない。`deployments` に削除のコマンドは無い（試しのプロジェクトは `projects delete <名前> -y` で消す）

### まだのもの

- 文書の抽出の `dynamicExtract`（実行時の SingleExtract が INVALID_DOCUMENT。Studio Web だけで作った Flow でも同じなので、サービス側を待つ）、要約・一括変換（プランの制限）、音声（電話番号と課金のある発信）
## 11. 文書で分かったこと（2026-11-15 の突き合わせ、AUT-1202）

公式の文書（maestro・maestro-automate）で分かり、まだテナントで試していないもの。番号は AUT-1202 の一覧の番号。テナントで確かめたら、上の節に移す。

### 動き・上限

- **Automate の上限は目安**（6）：24 時間・同時 50 は fair use の目安で、超えても止まらず失敗にもならない。Automate の run は、終わってから 30 日で Maestro から消える（Orchestrate は既定 30 日、管理者が 1〜180 日にできる）。Orchestrator のジョブとトレース（既定 90 日）は両方同じ。Automate の run は Maestro API と Process optimization の対象外。失敗した段からの Retry と Cancel はできる。
- **Automate の run の見え方**（37）：失敗した run は Faulted で待ち、Orchestrator では Running のまま（Stop / Kill / Duplicate job ができる）。Instance management の Run は入力を取らない（入力がある Flow は Start job から）。Studio Web の Manage → Versions から前の版を出し直せる。
- **Data Fabric の Query**（4）：Record limit の既定は 100（最大 1000）。101 件以上あると黙って切れる。Sort を付けないと返る組が毎回変わりうる。Records to skip（既定 0）。Single record は当たりが 2 件以上だと失敗する。
- **コネクタのイベントを待つ段**（15）：接続の側で 5 分ごとにイベントを確かめる（間隔は接続を編集して変える）。Data Fabric のイベント（`waitForEvent`）が遅れて見える理由。
- **スロットリング**（29）：1 つのインスタンスが短い間に多くの段を動かすと遅くされる（エラーにはならず、データも失われない）。Action history に Throttled が残る。止められない。
- **要素ごとの再試行**（23）：Backoff は Static / Linear / Exponential（base 1〜5）、Max duration、Retry on errors。実行するタスク（Service・Agent・API Workflow・Queue Item など）にだけ付けられ、ゲートウェイと待ちのイベントには付けられない。2026-10-30 から、範囲の外の値は Issues に出る。
- **Loop**（25）：Parallel では繰り返しが同時に動き、順番は保証されない。Break on condition は順番に動かすときだけ効く。繰り返す配列はループの始めに固定される。Loop にもエラーの道を付けられる。SDK には `parallel` と `b.break()` がある。
- **サブフローと並列**（26）：サブフローの中の Terminate は、そのサブフローだけを終える（親は続く）。サブフローの中の変数は `$vars.<subflow>.<変数>` で読む。並列の枝の中で変えた変数は、ほかの枝に見えない。Merge は「Match all cases」の Switch の後では動いた枝だけを待ち、どれかの枝が落ちると Merge もエラーになる。待ちに期限は無い。
- **Script ノード**（27）：`$metadata`（`InstanceId` など）が使える。`fetch`・`XMLHttpRequest`・`WebSocket`・`eval`・`Function`・`indexedDB`・`caches` は使えない。大きなデータは時間切れや上限に当たる。
- **ファイル**（38）：ファイルは変数に入らず参照で渡る。Job Attachment（既定、Orchestrator の保持方針に従う）と Data Fabric のファイル欄は、互いに置き換えられない。
- **API Workflow ノード**（24）：呼び先の必須の入力が欠けていても Flow は何も言わない。呼び先が先にデプロイされていないと、実行時に「The job's associated process could not be found」。

### 2026-10-30 の変更（D）

- **BPMN と Case は、必須の変数が空だとデバッグも止まる**（7。以前は publish だけ）。`debug.mjs` で流していたものが上がらなくなる場合がある。
- **Quick Form にエラーの道を付けられる**（8）。SDK の `hitl` が `onError` を通すかは確かめていない。
- **Validate extraction ノード**（22、Preview）：同じ Flow の中で Extract document として作った Extract だけに付けられる。Published のモデル（`ixpExtract`）には付けられない。
- **エラーの境界イベントのある BPMN を CLI で pack できる**（32。以前は Studio Web で開いて保存し直す必要があった）。
- **音声**（36）：`callContext` に `from`・`to`（電話番号）が入る。Voice agent からエスカレーションの出口が無くなった（人の段は後ろに置く）。Call context を結ばないと約 25 秒の無音で切れる。serverless のマシンが割り当てられていないと、ツールが全部エラー。

### 課金・権限・運用

- **ビジネスルール**（10）：1 回評価するごとに 0.2 Platform Units（Flex は 1 Agent Unit）。Orchestrator の Business Rules は、使っているプロセスをデプロイし直さずに直せる（Edit で File を差し替える。保存した後は版を変えられない）。引数の名前は英字・数字・`_` だけで、先頭は英字か `_`。
- **無償（Unlicensed / Express）の利用者**（9）：Automate の文書は、Studio Desktop からのデプロイ・IXP・個人ワークスペースへの 2 本目以降のデプロイ・Action Center にライセンスが要るとする。Orchestrate の Unified Pricing の文書は、Flow の GA でこれらを開いたと書く（2 つの文書で書き方が違う）。Community の `ixp deployments create` が 403 だったのは、利用者のライセンスの種類で説明できるかもしれない。
- **子のプロセスを動かすアカウント**（16）：既定ではフォルダで空いているアカウントで動く。指定するには、Orchestrator のプロセスの Package Requirements → Execution settings で Runtime type・Account（Run as myself もある）・Machine を決める。
- **Case を動かす権限**（17）：Triggers.view / create のほか、Maestro の画面で変数の値を見るのに Logs.view（Automation User に入っていない）。Case App から操作するなら Apps.view / edit / create。
- **Case が完了しても、Orchestrator ではプロセスが Running のまま**（18。Reopen のため）。状態は Case App で見る。SLA のタイマーは Pause の間は止まる。Retry は、失敗したタスクか遷移だけをやり直す。
- **Case の `runOnlyOnce`**（11）：タスクの既定は false で、再入場のたびに動き直す。true にすると前の出力を残して動かない。ステージに true を付けると、そのステージには戻れない。
- **グループの割り当て**（2）：デバッグではグループの割り当ては効かない（[../docs/task-assignment.md](../docs/task-assignment.md)）。Workload と Round Robin はローカルのグループだけ（AD のグループは拒まれる）。エラーは `NoUsersFoundInLocalGroup`・`NoEligibleUsersFoundInGroup`。

### ノード・機能（まだ見本に無い）

- **HTTP Webhook**（12）：ノードが渡す URL に要求が来ると、run が始まるか、待っていた run が進む。Filter を付けられる。出力の形は最初の要求が来るまで分からない。デプロイしないと届かない。SDK の関数一覧に無い。（→ 12 節：trial は接続が無く試していない）
- **Flow のキュー**（13）：Queue trigger がある（1 つのキューで起動できる Flow は 1 本だけ）。キューのノードには Delete queue items と Set transaction status もある。（→ 12 節：Delete queue items は動いた。Queue trigger はこのテナントで無効）
- **BPMN のキューの開始イベント**（14）：1 つの項目が 1 つのインスタンスを始める（バッチは 1 に固定）。InProgress のまま 24 時間で Abandoned。終わりに Set transaction status が要る。Get queue items は新しい順に 100 件まで、Bulk add は 1 回 15,000 件まで。Wait for queue event には期限が無い（境界のタイマーを付ける）。（→ 12 節：trial の BPMN の登録簿に無い）
- **評価**（20）：Flow の評価セットはノード単位か Flow 単位のどちらか。評価器は決定的なもの（Contains・Exact match・JSON similarity）、LLM のもの（semantic similarity・strict JSON similarity・Trajectory）、ツールの呼び出しを見るもの（ノード単位だけ）。デバッグの run からデータを取り込める。BPMN の評価は Preview で、ノード単位も CLI も無い。CLI は `uip maestro flow eval`（[uip-cli.md](uip-cli.md)）。（→ 12 節：BPMN の評価は CLI に無い）
- **Function ノード**（21、2026-09-17、Preview）：Python・JS・TS の coded function を呼ぶ。BPMN は Service task の「Start and wait for Function」（06-19）。関数は `uip function` で作れる（[functions.md](functions.md)）。（→ 12 節：Flow と BPMN の両方でテナントで動いた）
- **BPMN の Custom instance ID**（30）：開始イベントの General で、インスタンスの名前を式で決める（開始の直後に 1 回だけ評価。Insights と Process Mining では探せない）。生成器では扱っていない。（→ 12 節：見本 InstanceId.bpmn でテナントで動いた）
- **BPMN の Data Fabric の式**（31）：2026-07-03 から、エンティティ名と `?folderPath=` にバインディングや変数を書ける（`datafabric[bindings.EntityName?folderPath=bindings.FolderKey][...]`）。09-03 から、絞り込みの値の `=js:` が評価される。（→ 12 節：trial では debug でもデプロイでも表が見えず、BPMN からは使えなかった）
- **Maestro API**（28）：Swagger は `https://cloud.uipath.com/{org}/{tenant}/pims_/api/swagger`。CaseApp v3 で ad-hoc タスクを起こす（`tasks/trigger`）、ケースを閉じる（`close`）、ケースの状態を読む。どれも `X-UIPATH-FolderKey` が要る。呼ぶときは `node tools/platform/cloud-api.mjs ... --service pims_`（[cloud-ops.md](cloud-ops.md)）。（→ 12 節：v1 は読めた。v3 の CaseApp は Case app (Modern) が要り、trial では 403）
- **要約ノード**（35）：1,000 ページまでの文書を扱い、出典付きで答える。（→ 4 節の表：trial で動いた）
- **画面と開発の道具**（33・34）：BPMN の Simulate はタスクを動かさず、ゲートウェイの道を人が選ぶ。デバッグでブレークポイントを置き、止まっている間に変数を直せる（Studio Web だけ）。VS Code の UiPath Maestro Orchestrate 拡張で `.flow` を見て直せ、検証が Problems に出る（`UiPath: Package` / `Deploy`）。Studio Desktop でも Flow を作れる（Data Fabric のノードは無い）。
- **公式の skill**（19）：`uip skills install` で入る `uipath-maestro-flow`（09-16 に GA）、`uipath-maestro-case`・`uipath-maestro-bpmn`（Preview）。この道具では、作るのは SDK のソースと `verify.mjs`、skill は CLI の使い方の参照として読む（AGENTS.md の Maestro の行）。
## 12. Orchestrate の残りを動かした結果（2026-11-17、trial、AUT-1211）

試しの組織 sorahaneworks（`--profile trial`）で確かめた。作った試しの資源は AUT-1211 のコメントに一覧がある。

### Function（JS/TS の関数）を呼ぶ

- **Flow**：`publishedFunction({ key, name, folderPath, inputs, returns })`。key は `uip maestro flow registry search <関数の名前>` に出る `uipath.core.function.<key>`（プロセスの Key）。登録簿は関数を作った後に `registry pull` し直さないと出ない。出力は `$vars.<id>.output.<返した項目>`（見本 `deploy/FunctionCall`）
- **BPMN**：「Start and wait for Function」（`Orchestrator.ExecuteFunctionAsync`）は SDK に専用のメソッドが無い。`.activity(id, "Orchestrator.ExecuteFunctionAsync", { typeVersion: "v2", context: { name, folderPath }, inputs: {…}, outputs: { total: "=total" } })` で書いて動いた（見本 `deploy/FunctionTask`）。v2 は名前とフォルダで探す。プロセスの binding は無くても動いた
- 関数は `uip function pack` → `uip or packages upload` → `uip or processes create --entry-point content/functions/<関数>.ts`（[functions.md](functions.md)）

### キューのノード（Flow）

- **SDK にあるのは `queueItem`（Create queue item）だけ**。Delete queue items・Set transaction status・Set transaction progress・Postpone・Queue trigger は無い
- **テナントの登録簿も出さない**。`uip maestro flow registry search queue` には出るが `AvailableOnTenant: false`、`registry get` は Node not found、`uip maestro flow node add` は「Node type '…' is not enabled for this tenant. Ask an admin to enable the feature flag」（trial も既定のログインの組織も同じ）。それでも **`queueItem`（create）は実行できる**ので、この判定は CLI の側だけのもの
- **Delete queue items は rawNode で動いた**：`rawNode({ nodeType: "core.action.queue.delete-items", version: "1.0", manifest, inputs: { items: js\`[$vars.enqueue.output]\` } })`。出力は消した数（`$vars.<id>.output` が `1`、debug の結果では `deletedCount`）。消せるのは New の項目で、各項目に `Id` と `RowVersion` が要る（`queueItem` の出力をそのまま渡せる。`check` は `RowVersion` を読むと `QUEUE_READ_UNKNOWN_FIELD` で止める）（見本 `deploy/QueueDelete`）
- **manifest は CLI から取る**：`node tools/maestro/cli-manifest.mjs core.action.queue.delete-items`（uip の `@uipath/maestro-tool` の bundle の中の定義をそのまま出す。手で書かない）
- **Set transaction status も実行まで届いた**が、New の項目を渡すと `170048 Failed to set queue transaction status`（`This queue item has not been processed yet.`）。InProgress の項目（Queue trigger が渡すもの）が要る。Orchestrator の API の `StartTransaction` は、ロボットでないログインでは 204（項目を渡さない）で、作れなかった
- **Queue trigger は試していない**：デプロイが要り、テナントで無効と出ている。SDK の `.trigger()` も manual・scheduled・event・form・conversation・voice だけ
- テナントで機能を有効にしてもらえば、Studio Web で作って `solution download` した形と比べる

### BPMN

- **キューの開始イベント・Set transaction status・Get queue items・Bulk add・Wait for queue event は、trial の BPMN の登録簿（`uip maestro bpmn registry list`）に無い**。あるのは Create queue item と Create and wait for queue item だけ。文書にはあるが、このテナントでは作れない
- **Custom instance ID は動いた**（見本 `InstanceId.bpmn`）。Studio Web で開始イベントの General → Custom instance ID に入れて保存した形を `solution download` で読み、SDK で同じものを書いた：内部の変数 `.var("internalCustomInstanceId", "string", { name: "_internalCustomInstanceId", elementId: "start", custom: true, internal: true })` と、開始イベントの `payload: { type: "BPMN.Variables", outputRows: [{ name: "_internalCustomInstanceId", type: "string", source: "=<式>", var: "internalCustomInstanceId", custom: true }] }`。debug のインスタンスの `InstanceDisplayName`（`uip maestro bpmn debug-instance status`）が `注文-A-100` になった。validate は開始イベントで入力を読むところに `VARIABLE_NOT_SET` の warning を出すが、動く。Studio Web は欄に打った文字をそのまま `source` に書く（`=` を付けない）。式として確かめたのは `=` を付けた形
- **Data Fabric の式（`datafabric.<表>["qes:…"]`）は、この trial では BPMN から使えなかった**（debug でも、デプロイした実行でも）。
  - 表の場所：テナントの表とフォルダの表（Shared）の両方で試した。表をソリューションの資源に入れた形（`uip solution resources add --source remote --kind Entity`。デプロイするとデプロイ先のフォルダに同じ名前の空の表ができる）も試した。
  - 書き方：`datafabric.<表>`、`datafabric["<表>?folderPath=Shared"]`、`datafabric[vars.<変数>]`、`datafabric[bindings.<名前>]`、`=js:` で絞り込みの値を組む形を試した。
  - どれも `400300 Property '<表>' not found against object of type …ExpressionDictionary` だった。エンジンの `datafabric` の辞書に表が入っていない。
  - Studio Web の BPMN にも、表を宣言する手段が無い。変数の型は Text・Number・Boolean・Object・Array・Date-time・Date・Time・Asset・Credential だけで、Data manager にも Script task のプロパティにも Data Fabric の項目が無い。
  - CLI（`@uipath/maestro-tool`）の中で `datafabric[bindings.<表>?folderPath=bindings.<フォルダ>]["qes:…"]` を組むのは Case の生成器だけ。Case のエンティティのレコード（`type: "reference"` の変数と `reference: { referenceType: "dataFabric", entity, folder, queryMode, query }`）に使っている。文書の 2026-07-03 の変更は、この参照の仕組みのことと見ている。
  - BPMN で Data Fabric を読むなら、Data Fabric のコネクタ（`.dataService()`、IS の接続が要る）を使う。
- **評価（Preview）は CLI に無い**（`uip maestro bpmn` に `eval` が無い。Flow は `uip maestro flow eval`）。Studio Web の BPMN のプロジェクトには Datasets の欄（Run dataset・Manage evaluators）がある。流していない

### Flow の HTTP Webhook

- コネクタのトリガー `uipath.connector.trigger.uipath-http-webhook.http-webhook`（Integration Service の `uipath-http-webhook`）。**接続が要る**：`registry get` も「Trigger nodes require --connection-id」と断る。trial には接続が無く、新しく作らない約束なので、形も確かめていない

### Case

- **QuickForm は `tools/maestro/case-quickform.mjs` で足す**。ソースの横に `<名前>.quickform.json`（ステージの名前・タスクの名前・フォームの項目・ボタン・押したボタンを入れる変数）を置くと、`verify.mjs` が compile の後で caseplan.json にタスク（`type: "action"`、context の `hitlType: "quick"`、`hitlSchemaId`）と `<タスク>.hitl.json` を足してから validate する。形は公式の skill（uipath-human-in-the-loop の hitl-casetask-action.md）と、SDK が action のタスクに書く outputs（`id`・`var`・`source`・`target`・`elementId`）に合わせた。trial の debug でタスク（QuickFormTask）ができ、`uip tasks complete --action Approve --data '{"comment":"…"}'` で完了すると、ケースの変数に `decision: "Approve"` と `comment` が入り、ケースは Completed（見本 `CaseQuickForm.case`）
  - 出力を書く変数はソースで `.var()` しておく。ステージの出口は `required-tasks-completed` にする（タスクは compile の後に入るので、`selected-tasks-completed` で名前を指せない）。入力をフォームに出すなら `.input({ … }, { from: manualTrigger() })`（`from` が無いと validate が `STRICT_INPUTOUTPUTS_COMPANION`）
  - `_schemaFileId` は仮の UUID。実行には効かないが、Studio Web の「Edit Schema」は開かない（skill の文書）
  - validate は `STRICT_BINDINGS_ABSENT` の warning を出す（QuickForm は binding が要らないので気にしなくてよい）
- **Maestro API（pims_）**：Swagger は `node tools/platform/cloud-api.mjs GET /api/swagger/v1/swagger.json --service pims_`。パスは `/api/v…`（Swagger の `servers` が `/pims_/api`）。フォルダは `X-UIPATH-FolderKey` で指す（`cloud-api.mjs --folder-key` が付ける。個人ワークスペースの Key は Folders で引けないので、引けなくても付けて送る）。Git Bash からは `MSYS_NO_PATHCONV=1` を付ける（`/api/…` が Windows のパスに直される）
  - **v1 は読めた**（`Jobs.View` で通る）：`GET /api/v1/instances/<id>`、`GET /api/v1/cases/<id>/case-status`（ステージとタスクの状態）、`GET /api/v1/caseapp/instances/<id>/variables`（debug のインスタンスでも通る）
  - **v3（CaseApp）は、この trial では使えなかった**（403 の `PIMS-150011` / `150012` / `400037`）。試したこと（2026-11-17）：
    - debug のインスタンスと、デプロイして `uip or jobs start` で動かしたインスタンスの両方で呼んだ。
    - `.caseApp()` で Case app を有効にした。
    - caseplan の `metadata` に Case role を書いた：`caseAppVersion: "v2"`（Case app (Modern)）と、`caseRoles: [{ id, name, actions: ["CaseManagement.Cases.ViewSummary", …], scope: "case" }]`。形は CLI の中のスキーマ（`CaseManagementCaseAppRoleSchema`）に合わせ、`uip maestro case validate` は通った。
    - 自分に組み込みの役割（Case Owner・Case Observer）を、プロセスの範囲で割り当てた：`uip admin authorization roles assignments create --scope-path "/tenant/<テナント>/casemanagement/process/<プロセス>"`。プロセスの指し方は GUID・Key の文字列・大文字の 3 通り。Git Bash では `MSYS_NO_PATHCONV=1` が要る（付けないと `C:/Program Files/Git/tenant/…` で登録される）。
  - どれでも 403 のままだった。分かったことは 4 つ：
    - Studio Web は `caseAppVersion: "v2"` のケースを開いても Legacy の Case app の欄しか出さず、Case roles の画面が無い。Case app (Modern) は Preview（2026-11-11）で、このテナントでは有効になっていないと見ている。
    - デプロイしても、ケースに書いた役割はテナントの役割として作られなかった（`roles list --role-type Custom` が 0 件）。
    - Maestro のプロセスの画面には Instance management と Monitoring しか無く、Access のタブが無い。
    - 組み込みの Case Owner には `CASEMANAGEMENT.CASES.VIEWSUMMARY` が入っていない。これを含む役割は CLI では作れない（Tenant の役割にすると「Role contains actions with a different ScopeType」。casemanagement は `--service` に渡せない）。
  - Case app (Modern) が有効なテナントで、Studio Web の Case roles で作った形を `solution download` して確かめるまでは、`tasks/trigger`・`close` は試せない。
  - ad-hoc のタスクはソースで `.allowAdhocTasks()` とタスクの `entryWhen(rule("adhoc"))`（見本 `CaseApi.case`）
- `uip maestro case process run` はインスタンスを作ったが、終わるまで返らなかった。デプロイしたケースは `uip or jobs start <プロセスの Key> --folder-key <Key>` で起こす方が扱いやすい
