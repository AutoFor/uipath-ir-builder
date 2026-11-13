# Maestro（Orchestrate と Automate）

Maestro のプロジェクトを AI に作らせるときに読む。作り方の方針は「独自の IR を作らず、公式 SDK（`@uipath/maestro-builder-sdk`）のソースを書いて `tools/maestro/verify.mjs` で確かめる」（[docs/maestro-ir-vs-sdk.md](../docs/maestro-ir-vs-sdk.md)）。ここは、その上で知っておくことと、実際に動かして確かめた範囲。

公式ドキュメントは `C:\Users\seiya\Documents\UiPath\maestro-docs\`（docs.uipath.com の `llms-maestro.txt` と `llms-maestro-automate.txt` にある .md を全部。628 ページ、2026-11-13 取得）。UiPath の著作物なのでリポジトリには入れない。取り直すときは同じ 2 つの一覧から。

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
- **HTTP のノード**：SDK 6.66.5 の `http({ managed: false })` は `core.action.http`（v1）を出し、`check` が `HTTP_V1_RETIRED` の warning を出す（レジストリは v2 だけ）。それでもテナントで動いた（下の表）。4xx は失敗ではなく成功の道に来る。失敗で分けたいなら `managed: true`
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
- **人のタスク（Quick Form）は `uip tasks complete <id> --type QuickFormTask --folder-id <id> --action Approve --data <JSON>` で完了できる**。タスクは `uip tasks list` の `CreatedTime` と `Title` で探す。完了すると、出力に `Action` と入力した値が入り、分岐の先へ進んだ
- **ファイルを入力にするとき**は `debug.mjs --attachment <入力名>=<ファイル>`
- **要約（`summarize`）と一括変換（`batchTransform`）はプランによっては動かない**（`460002 Failed to create ephemeral index`、詳細は `Unavailable with current plan`）。手元の検証は通る

## 4. ノードと、確かめた範囲

「テナント」はテナントでデバッグ実行して Completed を見たもの。「手元」は `verify.mjs`（types・check・compile・validate）だけ。見本は `samples/maestro/coverage/`、`samples/maestro/work-calendar/`、`tools/maestro/fixtures/`。

| ノード（SDK） | Automate | Orchestrate | 見本 |
| --- | --- | --- | --- |
| manual トリガー、`input` / `output` / `return` | テナント | テナント | `LoopTour`、`ControlTour` |
| `entryPoint` で入口を増やす、`scheduled`、`formTrigger` | テナント（既定の入口だけ動かした。定期実行はデプロイしないと動かない） | 手元 | `Triggers` |
| `script` | テナント | テナント | 全部 |
| `transform`（filter） | テナント | 手元 | `ControlTour` |
| `branch` / `switch` / `parallel` | テナント | テナント（branch） | `ControlTour` |
| `loop` / `doWhile` / `updates`（変数の更新）、ループの中の変数 | テナント | 手元 | `ControlTour`、`LoopTour`、`LoopVars` |
| BPMN：Script task、Exclusive（既定の道）、入力 | — | テナント | `ScriptGateway.bpmn` |
| Case：ステージ、ルール、タイマーのタスク | — | テナント | `samples/maestro/TimerCase.case` |
| `delay` | テナント | 手元 | `ControlTour` |
| `http`（managed: false） | テナント | 手元 | `ControlTour` |
| `subflow` | テナント | 手元 | `ControlTour` |
| `onError` | テナント | 手元 | `ControlTour` |
| `mock`、`terminate` | テナント | 手元 | `LoopTour` |
| `dataFabricCreate` / `Read` / `Update` / `Delete` | テナント | 手元 | `DataFabricTour`、`WorkCalendarCheck` |
| `rpaWorkflow` | テナント | テナント | `fixtures/tenant/Rpa.*` |
| `connector`（Slack のユーザーグループの一覧。読むだけ） | テナント | テナント | `fixtures/tenant/Slack.*`（先に `registry prepare`。下） |
| `agent`（公開済み） | テナント | テナント | `fixtures/tenant/Agent.*`（PERSONAL_WORKSPACE を実際の名前にして流す） |
| `inlineAgent`（flow の中で定義するエージェント） | テナント | 手元 | `InlineAgent` |
| `hitl`（Quick Form）：作る → 完了 → 再開 → 分岐 | テナント（`uip tasks complete` で完了） | テナント（人が完了） | `fixtures/ok/Approval.flow` |
| 会話（`conversationTrigger`、`waitForMessage`、`conversationalAgent`、`sendMessage`） | テナント（Studio Web のデバッグのチャットで） | 手元 | `Chat` |
| `documentClassify` | テナント（分類器なしで Completed、結果は空） | 手元 | `Documents` |
| `summarize`、`batchTransform` | 動かない：このテナントのプランでは `Unavailable with current plan`（一時インデックスが作れない） | 同じ | `Documents` |
| `ixpExtract` / `dynamicExtract` | 動かせない：テナントに IXP のモデルが無い | 同じ | — |
| 音声（`voiceTrigger`、`voiceAgent`、`endCall`、`createOutgoingCall`） | 手元。着信はデプロイと電話番号が要り、発信はデバッグでも本当にかけて課金される | 同じ | `Voice` |
| `queueItem`、`apiWorkflow`、`publishedFunction` | 手元（API ワークフローと関数はテナントに無い。キューは書き込みになる） | 手元 | `LocalOnly` |
| BPMN：並列ゲートウェイ、タイマーの中間イベント、サブプロセス、multi-instance、エラーの境界イベント | — | テナント | `BpmnTour.bpmn` |
| BPMN：Inclusive ゲートウェイ、Event-based ゲートウェイ、エラー開始のイベントサブプロセス | — | テナント | `BpmnEvents.bpmn` |
| Case：ステージ 3 つ、前のステージの完了で入る、タスク 2 つを並べて動かす、必須のステージで完了 | — | テナント | `CaseTour.case` |
| `onEvent` / `waitForEvent`（Data Fabric のレコード作成） | 手元。WEBHOOK 方式でデバッグでは動かない。デプロイは接続のサインイン切れ（invalid_grant）で失敗（10 章） | 同じ | `EventWait`、`deploy/DfEvent` |
| 定期実行のトリガー（デプロイ） | テナント（5 分ごとに動いた） | — | `deploy/Nightly` |
| `queueItem` | テナント（試しのキューに項目ができた） | — | `deploy/QueueTour` |
| BPMN の Call activity（`startAgenticProcess`）と戻り値 | — | テナント | `deploy/Parent`、`deploy/Child` |
| ビジネスルール（`businessRule`、DMN） | — | デプロイまで。評価は 403（権限） | `deploy/RuleCall`、`deploy/Tier` |

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
- `uip maestro bpmn debug` の結果は PascalCase（`FinalStatus`、`ElementExecutions`）で、変数の値は出ない。`--timeout` も無い（`debug.mjs` が吸収する）。init の雛形に入れたあと `bpmn refresh` で `entry-points.json` を作り直す

## 7. Case Management（Orchestrate）

見本：`samples/maestro/TimerCase.case.ts`（テナントで Completed、AUT-1080）、`tools/maestro/fixtures/ok/Approval.case.ts`。

- ケース ＝ ステージ ＋ ルール（WHEN イベント / IF 条件 / ACTION）。ルールは**イベントで動く**（データを見回らない）。IF で参照する項目は、どこかのタスクが必ず書くこと（書かれないと永遠に真にならない）
- ステージは Primary（辺か入場ルール）と Secondary（入場ルールだけ。入ると必ず割り込む）。Required のステージが終わらないとケースは終わらない
- **Exit ルールは動いているタスクを止めない**。Exit で終えた Required のステージは「完了」に数えないので、後ろで受けるか Exit the case と組にする
- 再入場で動かすかのフラグは、ドキュメントに `runOnlyOnce`（新しい）と `runOnReentry`（古い）が混ざり意味が逆。値を明示する
- Case Manager エージェントの出力は `caseManagerDecisions` の形でないと**黙って無視される**
- `uip maestro case debug` は JSON の前にログの行を出す（`debug.mjs` は最初の `{` の行から読む）。Case は内部で BPMN にされ、`CaseRulesEvaluatorNode`（ルールの評価）、`CaseManagerNode`、ステージごとの SLA のイベントサブプロセスなどが動く。ステージは `Stage_<id>`、タスクは `t<id>` という要素になる
- 実行するアカウントに Triggers.view と Triggers.create が無いと、wait-for-trigger の段で 403（実行時にしか出ない）
- `action` にアプリを指定しないと 170004。QuickForm は SDK で書けず、`caseplan.json` と `.hitl.json` を手で足すと動いた（docs/maestro-tenant-resources.md）

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
| 抽出の出力は `ExtractionResult` か `result` か | 2026-07 に `result` に変わった（リリースノート）。未確認 |
| BPMN の multi-instance で今の要素は `iterator.item` か（SDK とドキュメント） | **`itemVar: "iterator[0]"` と `inputs: { cur: "=iterator[0].item" }`、スクリプトでは `cur`**（`BpmnTour`）。SDK の「inputs の名前はスクリプトから読めない」も、この場合は当たらない |
| Inclusive の合流は「動いた辺だけ待つ」か | 当たった道と `default` の道が全部動き、合流は全部を待って進んだ（`BpmnEvents`） |
| Automate のプロジェクトが本当に Automate として扱われるか | Studio Web で「製品: Maestro Automate」と出た（`operate.json` の `Lite`） |
## 10. デプロイして確かめたこと（2026-11-13、個人ワークスペース）

見本は `samples/maestro/deploy/`。1 つのソリューション（Flow 2 本・BPMN・rules プロジェクト）にまとめてデプロイし、確かめたあと片付けた（キューの削除 → `deploy uninstall` → 公開した版の `packages delete`）。

### 流れ

```bash
uip solution init <名前>                                   # その中で
uip maestro flow init <Flow> --automate                    # 入れ物を作り、verify.mjs --out の .flow を入れる
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
- **`flow init --automate` でソリューションに足すと、process の resource の `runtimeProfile` は `Standard` のまま**。Studio Web で作った Automate のソリューションも `Standard` だったので、Automate かどうかは project の `operate.json` の `profile: "Lite"` で決まると見ている
- `deploy run` は `--folder-name` が要る（`--personal-workspace` でも）。フォルダは `<個人ワークスペース>/<フォルダ名>`。`rules` のコマンドはこのフォルダをパスで見つけられず（Folder not found）、`--folder-key` なら通った。フォルダの Key は `uip or jobs get <ジョブ>` の `FolderKey`
- **BPMN の Call activity（`startAgenticProcess`）で、デプロイ済みの別の BPMN を呼んで待てた**（要素の種類は `CallActivity`）。入力は `input: { n: 21 }`、戻りは `outputs: { whole: "=result", doubled: "=result.doubled" }` で `{ doubled: 42 }` と `42` が入った
- **BPMN が値を返すには、終了イベントに mapping が要る**。SDK の `.output("doubled", …)` は宣言（`<uipath:output id elementId="done">`）だけで、それだけだとジョブの出力は `{}`。Studio Web で終了イベントに「引数」を足すと、終了イベントに `<uipath:mapping><uipath:type value="BPMN.Variables"/><uipath:output name source var custom="true"/></uipath:mapping>` が入る。SDK では `endEvent("done", { payload: { type: "BPMN.Variables", outputRows: [{ name: "doubled", type: "number", source: "=vars.value", var: "doubled", custom: true }] } })`。`source` は普通の変数（`.var()`）を指す（出力の名前を指すと `VARIABLE_DOES_NOT_EXIST`）
- **キュー**：`queueItem({ queue, folderPath, key: <キューの Key>, reference, item })` で項目ができた（`uip or queue-items list` で `New`）。試しのキューは `uip or queues create <名前> --folder-path …` で作り、`uip or queues delete <Key> --yes --force` で消した。Flow の SDK にはキューのトリガー、BPMN の SDK にはキューの開始イベントが無い
- **ビジネスルール（DMN）**：`uip rules init` が DMN（`Business rule.dmn`、デシジョン テーブル）と `entry-points.json`（`type: "BusinessRules"`、出力は `x-uipath-decision-keyed`）を作る。デシジョン テーブルの行を書き換え、`rules validate` → `refresh` → ソリューションでデプロイまでは通り、`uip rules list` に出た。**ただし評価は通らなかった**：BPMN の `businessRule` は `Data at the root level is invalid. Line 1, position 1.`、`uip rules debug` は `403 Forbidden`（トークンに `BusinessRules` のスコープはある）。テナントかアカウントの権限（Business Rules は Preview）の問題と見ている。Orchestrator の権限の一覧（`uip or roles permissions`）にはルールの権限が 1 つも無く、ロールを足して直るものではなさそう。その後、さらに切り分けた：Orchestrator には「ビジネス ルール（プレビュー）」の画面があり、デプロイしたルールも版 1.0.0 で出る（機能自体は有効）。ルールのファイル名の空白（`Business rule.dmn` → `Tier.dmn`）を外しても同じ。**Studio Web でこの rules プロジェクトを開くと「Unsupported DMN version 1.5」**：`uip rules init` が書く DMN は 1.5（名前空間 `https://www.omg.org/spec/DMN/20230324/MODEL/`）で、このテナントのエディタは読めない。1.3（`.../20191111/MODEL/`）に変えると、エディタが `Cannot read properties of undefined (reading '$type')` で落ち、呼んでも同じエラー。Studio Web の「ソリューションに追加」にもビジネス ルールの項目が無い。CLI の雛形がテナントより先に進んでいる（または rules のオーサリングがテナントで未提供）と見ている。確かめるには、テナント側でビジネス ルールのオーサリングが使えるようになってから、Studio Web で作った DMN を書き出して比べる。見本は `samples/maestro/deploy/Tier/` と `RuleCall.bpmn.ts`
- **コネクタのイベントのトリガー（Data Fabric のレコード作成）**：デプロイで `ConnectedEventTrigger` を作るところで `Failed to receive access token / invalid_grant` になり、デプロイが失敗した。接続（`uip is connections list --all-folders` の Data Fabric の接続）のサインインが切れている。接続を入れ直せば確かめられる（人がサインインする）。見本は `DfEvent.flow.ts`

### まだのもの

- コネクタのイベント：Data Fabric の接続のサインインが要る
- ビジネスルールの評価：テナントかアカウントの権限が要る
- 文書の抽出（IXP のモデルが無い）、要約・一括変換（プランの制限）、音声（電話番号と課金のある発信）
