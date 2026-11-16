# Healing Agent と ScreenPlay

UI 操作の AI の機能 2 つ。公式の文書（agents の user-guide-ha・user-guide-screenplay とリリースノート）を 2026-11-15 に突き合わせた結果（AUT-1205）。まだテナントで試していない。番号は AUT-1205 の一覧の番号。

## Healing Agent（UI の失敗を直す・直し方を提案する）

- **有効にする場所**（10）：本体は Orchestrator のプロセスかジョブの「Enable Healing Agent」と self-healing のチェック。Enterprise と Community の既定は「有効で提案だけ」。まとめて変えるなら `PUT /odata/Releases({key})` の `ProcessSettingsDto.AutopilotForRobots`（[cloud-ops.md](cloud-ops.md) の API）。ジョブとして動かしたプロセスだけが対象。
- **アクティビティの `HealingAgentBehavior`**（10）：`Disabled`、`Job`（ジョブの設定に従う。NApplicationCard の既定）、`RecommendationOnly`（提案だけ）、`SameAsCard`（カードに従う。子の既定）。Orchestrator で全部切っていれば、アクティビティの設定は効かない。
- **課金**（11）：1 回 3 Platform Units（提案も直したときも同じ）。同じジョブで同じアクティビティは 1 回だけ。直せなかったときは課金しない。Basic のプランでは使えない。Community は月のプール。既定で「提案だけ」が有効なので、試しのジョブで UI が失敗するだけで使う。
- **効かないもの**（15）：Go To URL・Get URL・Navigate Browser・Inject Js Script・Browser Dialog Scope・Extract Form Data・Fill Form・Close Popup・Get/Set Browser Data・Set Runtime Browser・Get/Set Clipboard・SAP の一部・ScreenPlay（どれもカタログでは `HealingAgentBehavior` を持つ）。Windows - Legacy と Classic のアクティビティ、CV だけのターゲットも対象外。RDP・Citrix・VMware ではダイアログを検出できない。サーバーレスのロボットではアラートを検出できない。
- **前提**（30）：UIAutomation 25.10.2 以上と Robot 2024.10 以上。クラウドの自動化で Modern のアクティビティだけ。プレビューの版の Orchestrator のパネルは 2025-11-01 で止まった。
- **管理側**（31）：Automation Ops の Robot のランタイムのポリシー（提案・self-healing・スクリーンショット・対象のアプリ）。AI Trust Layer の「Enable Healing Agent」（AI を使わない Levenshtein だけにもできる）。BYOM は Product「Healing Agent」・Feature「Workflow Recovery」。
- **直せなかった理由はロボットのログに出る**（32、2026-06-24 から）：`uip or jobs logs <ジョブ>` で拾える（例「Healing agent could not recover the activity. Self-healing is disabled.」）。
- **提案を Studio で取り込む**（16）：ジョブの詳細の「Healing Agent」から debug ファイルを取り、Studio 2026.10 の Observability のパネルで開いて「Apply」でターゲットを書き換える。**この道具は XAML を IR から作り直すので、Apply で変わった XAML・`.objects` は次の生成で消える**。`import-xaml.ts` と `objrepo.ts import` で IR に戻してから生成する。
- **Test Manager**（36）：test set の Configuration で有効にできる（権利は App Test Heals。Automation Cloud の Heals とは別）。

## ScreenPlay（`NUITask`。指示の文で UI を操作する）

- **クラス**（12）：`UiPath.Semantic.Activities.NUITask`。NApplicationCard の中に置く。UIAutomation 2025.10.20 以上が要る。カタログにはあり（`coverage.ts --activity NUITask` で 33/33 書ける）が、見本と Coded の対応表はまだ無い（UI を動かす run と課金が要るため）。
- **既定のモデル**（13）：新しく置いた ScreenPlay の既定は Screen Agent（GPT-5.4、Standard）。Standard は 1 run 0.20 Platform Units、Basic（Gemini 2.5 Flash）は 0.05 なので、既定のままだと 4 倍。Gemini 2.0 Flash は 2026-02-05 に廃止され、実行時にエラー。IR で `AgentType` を省いたときの値は、既定 XAML で確かめる。
- **課金**（14）：1 run は UI の操作 5 回まで。Enterprise と Advanced には年 5 万 runs が含まれる。設計時のデバッグは利用者の月の AI のプール、本番は含まれる runs。BYOM は無料。60 日の試用（5,000 runs）。
- **BYOM とモデル**（33）：AI Trust Layer の LLM configurations で Product「UI Automation」・Feature「ScreenPlay」。Azure OpenAI・OpenAI・Amazon Bedrock（Anthropic Computer Use）・Google Vertex・OpenAI V1 互換。
- **トレース**（17）：`TraceAttachMode`（OnFailure / Always / Never）で HTML のトレースをジョブに添付する。Orchestrator でも見られる。出力 `TraceFiles` で受け取れる。手元では Studio の Logs の `ScreenPlay` フォルダに `.html`。
- **Variable Security**（19）：プロンプトの `{{変数}}` の中身を、指示ではなく文字として扱う。`IsVariableSecurityDisabled` は既定 false で、本番は false のまま（オフにすると、外から来た文章が指示として効く）。
- **動きの変更**（18・34）：2026-06-24 から、渡したスコープの外（ほかのタブ・アプリ）でも動く。2025-12-19 から、デスクトップのアプリでも DOM を使う（戻すなら `IsDOMEnabled` を false）。
- **Coded**（20）：2026-06-24 から、Coded の ScreenPlay も `SecureString` と `ScreenPlayImage` を受ける。対応表を作るときの根拠。
- **入れ方の考え方**（21）：決まった処理（RPA）を基本にして、ScreenPlay は壊れやすいところに少しだけ。1 つで 1〜2 の操作。同じ画面の入力をまとめるなら「見えている欄を一度に入れてから送信する」とプロンプトに書く。画面の流れが変わる所（確認のダイアログが増える など）は Healing Agent では直せないので、ScreenPlay を使う。
