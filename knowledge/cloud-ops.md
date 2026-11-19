# Automation Cloud の操作：CLI・API・MCP・画面の住み分け

Orchestrator や Automation Cloud（Test Manager、Integration Service、Agents、Data Fabric など）を操作するとき、どの手段を使うかを決める。2026-11-17、`uip` 1.204.x で確かめた範囲。

## 方針：上から順に使う。Chrome はむやみに使わない

1. **CLI（`uip`）**：まずこれ。`uip <製品> --help` で、やりたい操作のコマンドがあるかを先に見る。
2. **API（REST・OData）**：CLI に無い操作だけ。`node tools/platform/cloud-api.mjs` で、`uip` のログインのまま呼ぶ（下の「API の呼び方」）。
3. **画面**：CLI にも API にも無いとき、または人が目で見る・同意する必要があるときだけ。
   - まず人に頼む（何を、どの画面で、なぜ画面が要るか、を書いて渡す）。
   - Chrome（Claude in Chrome）で AI が操作するのは、人がそうしてよいと言ったときだけ。

**Chrome を使わない理由**：遅い、画面が変わると壊れる、操作の記録が残らずやり直せない、人のブラウザのログインのまま動くので取り違えると影響が大きい（2026-11-16 に、会社の組織とトライアルの組織を取り違えた）。CLI と API なら、`--profile` で組織を決め打ちでき、結果が JSON で残る。

## 4 つの手段

| 手段 | 何か | 向いていること | 限り |
| --- | --- | --- | --- |
| CLI `uip` | UiPath 公式の CLI。製品ごとのサブコマンド（`or`・`tm`・`is`・`df`・`agent`・`maestro`・`solution`・`admin`・`tasks` など） | ほとんどの作成・一覧・実行・削除。`--profile` で組織を選べる。結果は `{Result, Code, Data}` の JSON | 製品の機能のうち、CLI に出ていないものがある（下の表） |
| API | 各製品の REST・OData（Orchestrator は `/<組織>/<テナント>/orchestrator_/odata/...`） | CLI に無い操作。CLI の結果に出ない項目を読む | 文書に無いエンドポイントもある（試して確かめる）。書き込みは画面と同じ重さ |
| MCP | 下の 3 種類。**どれも、CLI と API より多くのことはできない** | — | — |
| 画面 | Automation Cloud・Studio Web・Action Center・`agents_` などのブラウザの画面 | 画面にしか無い機能、人の目での確認、OAuth の同意 | AI が操作するのは最後の手段 |

### MCP の 3 種類

- **`uip mcp serve`**：`uip` の CLI を MCP のサーバーにしたもの。道具は `run_command`（「`uip` のコマンドを 1 つ流す」）の 1 つだけ。**できることは CLI と同じ**。シェルの使えない AI のクライアントのためのもので、この PC では CLI を直接使えば済む。
- **AgentHub（Orchestrator）の MCP サーバー**：自分のプロセス・API ワークフロー・エージェントを、MCP の道具としてエージェントに見せるもの（[agents.md](agents.md) の MCP）。**テナントを管理する道具ではない**。
- **この PC の Claude の MCP**：UiPath 用のものはつないでいない。Claude in Chrome は MCP だが、中身は画面の操作（3 番目の手段）。

## 何をどれでやるか（確かめたもの）

○ はその手段で確かめた。「—」は無い・使わない。

### Orchestrator

| 操作 | CLI | API | 画面だけ・注意 |
| --- | --- | --- | --- |
| フォルダ、プロセス、パッケージの上げ下ろし、ジョブの開始・停止・ログ | ○ `uip or folders / processes / packages / jobs` | — | — |
| マシンの枠（Testing・Unattended など） | ○ `uip or machines update --testing-slots` | — | テナントの設定。変える前に人に確かめる |
| 役割（作る・権限を足す・人やロボットに付ける） | ○ `uip or roles create / update / assign / user-roles` | ○ `/odata/Roles`、`Folders/...AssignUsers` | 2026-11-17 は CLI があるのに API で済ませた（`--help` を先に見なかった）。CLI を使う |
| 利用者・ロボットのフォルダへの割り当て | ○ `uip or users assign / list-in-folder` | — | — |
| キュー、アセット、バケット、ストレージのファイル、Webhook、カレンダー、設定 | ○ `uip or queues / assets / buckets / bucket-files / webhooks / calendars / settings` | — | — |
| トリガー（時刻・キュー・API） | ○ `uip or triggers create` | — | タイムゾーンは Windows の ID（[uip-cli.md](uip-cli.md)） |
| Integration Service のイベントのトリガー | — | 未確認 | 画面で作る（[api-workflow.md](api-workflow.md)）。API は試していない |
| テストデータキュー（作る・項目を見る・消す） | — | ○ `POST /odata/TestDataQueues`、`GET /odata/TestDataQueueItems`、`DELETE /api/TestDataQueueActions/DeleteItems`（本文は Id の配列） | CLI が無い（[testing.md](testing.md)） |
| テストケースの実行に付いた添付の一覧 | `uip tm attachment download`（ファイルを落とす） | ○ `GET /odata/TestCaseExecutions(<Id>)?$expand=TestCaseExecutionAttachments`（名前とタグだけ） | — |
| Orchestrator のテストセット | — | — | 廃止。Test Manager を使う |
| 監査ログ | ○ `uip admin audit` | — | — |

### そのほかの製品

| 製品 | CLI でできる | 画面だけ・人の操作が要る |
| --- | --- | --- |
| Test Manager | ○ プロジェクト・テストケース・つなぎ（`link-automation`）・テストセット・実行・待つ・結果・添付（`uip tm`） | — |
| Integration Service | ○ コネクタ・接続の一覧と `ping`、活動の型（`uip is`） | 接続を作るときの OAuth の同意（`uip is connections create --no-wait` の URL を人がブラウザで開く） |
| Data Fabric | ○ 表・レコード・選択肢（`uip df`） | — |
| Action Center | ○ タスクの割り当て・完了（`uip tasks`） | Document Validation Task の Validation Station での Submit。人が画面で押して確かめたいとき |
| Agents | ○ 作る・`debug`・`review`・デプロイ・実行時の評価（`uip agent`・`uip eval`） | memory space を作る。作るときの評価を流す（`eval run start` が落ちる）。ソリューションの中のアプリ・MCP サーバーを使うデバッグ、会話型のデバッグ（Studio Web の Debug） |
| Studio Web | ○ ソリューションの upload・download（`uip solution`） | RPA アプリの編集・デバッグ（Assistant の要る Chrome のマシンで） |
| IXP | ○ プロジェクト・ラベル・発行・デプロイ（`uip ixp`） | テナントで初めて使うとき、IXP の画面を一度開く（開くまで API が 401）。入口は `/<org>/<tenant>/reinfer_`（→ `reinfer_/projects-and-datasets/genex/projects`）。`/reinfer_/ixp` は白いまま（2026-11-19） |
| Maestro | ○ 検証・デバッグ・デプロイ（`uip maestro`、`tools/maestro/*.mjs`） | キャンバスを目で見るとき |
| テナント・組織 | ○ サービスの一覧、ライセンス（`uip admin`・`uip or licenses`） | — |
| ログイン | `uip login --profile <名前>` | サインイン・パスワード・確認コードは人が入れる |

## API の呼び方

```bash
node tools/platform/cloud-api.mjs GET  "/odata/TestDataQueues" --profile trial --folder-path Shared
node tools/platform/cloud-api.mjs POST "/odata/TestDataQueues" --profile trial --folder-path Shared --body '{"Name":"Q","ContentJsonSchema":"{}"}'
node tools/platform/cloud-api.mjs DELETE "/api/TestDataQueueActions/DeleteItems" --profile trial --folder-path Shared --body '[1,2]'
```

- トークンは `uip login refresh` から取り、表示しない。組織とテナントは結果の 1 行目に出るので、取り違えていないかを見る。
- `--service` で製品を変える（既定 `orchestrator_`）。
- `--folder-path` / `--folder-key` / `--folder-id` でフォルダを指す（Orchestrator のフォルダの資源には要る。無いと「A folder is required for this action.」）。
- **GET から始める**。書き込み（POST・PUT・PATCH・DELETE）は、何を変えるかを人に確かめてから。テナントの設定（枠・役割・権限）は特に。
- 見つけたエンドポイントは、その製品の knowledge とこのページの表に書く。文書に無いもの（`TestDataQueueActions/DeleteItems` など）は「試して確かめた」と書く。

## 手段の探し方

1. `uip <製品> --help`、`uip <製品> <対象> --help`。
2. UiPath のスキル（`uipath-platform` など）の文書。
3. 製品の API の文書（Orchestrator は `https://cloud.uipath.com/<組織>/<テナント>/orchestrator_/swagger`）。
4. API を GET で試す。
5. どれにも無ければ画面。人に頼む。
