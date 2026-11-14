# API ワークフロー（Studio Web の API workflow）

API ワークフローを生成器で作って動かしたときに分かったこと（2026-11-14）。

- **形式**：JSON。CNCF Serverless Workflow DSL 1.0.0 に UiPath の拡張を足したもの。
- **動く場所**：サーバーレス（ロボットは要らない）。
- **課金**：実行 1 回で 0.05 Platform Units。中で使うコネクタと HTTP Request は課金されない。
- **公式文書**：`C:\Users\seiya\Documents\UiPath\studio-web-docs\`（Studio Web のガイドを 1 ページずつ取ったもの）。中でも次の 4 つ。
  - `about-api-workflows.md`
  - `managing-api-workflows.md`
  - `api-workflows-licensing.md`
  - `consuming-api-workflows.md`

## 作り方

```bash
uip solution init <ソリューション>; cd <ソリューション>
uip api-workflow init <プロジェクト>                             # project.uiproj・Workflow.json・entry-points.json・bindings_v2.json。.uipx にも足す
node tools/apiwf/gen.ts <ir.json> --project <プロジェクト>        # Workflow.json と entry-points.json の input / output を書く（stub は --profile <名前> も）
uip api-workflow validate <プロジェクト>/Workflow.json           # オフラインの検証
uip api-workflow run <プロジェクト>/Workflow.json --no-auth --input-arguments '{…}'   # 手元で動かす（コネクタとファイルはログインして --no-auth なし）
uip solution pack . <出力> --name <名前> --version 1.0.0; uip solution publish <zip>
uip solution deploy run -n <名前> --package-name <名前> --package-version 1.0.0 --folder-name <フォルダ> --parent-folder-path Shared
uip or jobs start <プロセスの Key> --input-arguments '{…}'        # Orchestrator のジョブ（ProcessType: Api）
```

`uip api-workflow init` を使わずに手で `project.json` を作ると、run と pack は通るが Studio Web が開けない（`invalid_project_folder`）。

## IR（`tools/apiwf/gen.ts`）

見本は `samples/apiwf/` にある。

| 見本 | 中身 | 確かめたこと |
| --- | --- | --- |
| `ControlTour.json` | JavaScript、ForEach、If、Break、Assign、DoWhile、Try/Catch、Wait、Response | 手元の run（`--no-auth`）、デプロイして Orchestrator のジョブ、Studio Web の Debug |
| `HttpTour.json` | HTTP Request の GET と POST（GET の結果を POST の本文に入れる） | 手元の run（`--no-auth`） |
| `ConnectorTour.json` | Integration Service のコネクタ（Data Fabric の Query Entity Records）。会社のテナントの接続 | 手元の run（ログイン） |
| `FileTour.json` | File to Base64、Base64 to File（参照から・文字列から） | 手元の run（ログイン、`--input-file` / `--output-dir`）。元のファイルと同じ中身に戻った |

### IR の書き方

```json
{ "inputs": { "items": "array", "doc": "file" }, "outputs": { "total": "number" },
  "variables": { "total": { "type": "number", "default": 0 } },
  "body": [ { "id": "pick", "name": "表示名", "js": "return …;" }, … ] }
```

**手順の種類**

| 書き方 | 作る活動 |
| --- | --- |
| `assign` / `value` | Assign |
| `js` | JavaScript |
| `if` / `then` / `else` | If |
| `forEach` / `item` / `index` / `body` | For Each |
| `doWhile` / `body` | Do While |
| `break` | Break |
| `try` / `catch` / `as` | Try Catch |
| `wait` | Wait |
| `response` / `failed` | Response |
| `fileToBase64` | File to Base64 |
| `base64ToFile` / `fileName` / `mimeType` | Base64 to File |
| `sequence` | Sequence |
| `stub` / `inputs` / `connection` / `objectName` | HTTP Request・コネクタ（`uip api-workflow registry stub` を呼ぶ） |
| `raw` | 手で用意した活動をそのまま入れる |

**値の書き方**

- 文字列は JavaScript の式。
- `{ "lit": "…" }` は文字列のリテラル。
- 数・真偽・配列・オブジェクトはその値。
- `@<id>` は `$context.outputs.<その手順のキー>` になる。stub の手順は ExportBucketKey になる（例：`http_request_1`）。
- ループの変数は式の中で `$<名前>`、Catch のエラーは `$<as>` と書く。
- 入力は `$workflow.input.<名前>` で読む。2 番目以降の手順の `$input` は、前の手順の出力になる。

### 生成器が決まった形にしていること（Studio Web の保存で壊れる形を避ける）

- **キー**：活動のキーを通し番号で振る（`Assign_1`、`If_1#Wrapper`、`For_Each_1#Body` など）。ワークフロー全体で重ならない。
- **WorkflowStart**：先頭に置く。形は `uip api-workflow init` の雛形のまま。
- **Assign**：1 つの Assign は 1 変数。文字列のリテラルは `${'…'}` にする。素の `"GOLD"` は、Studio Web が保存で `${GOLD}` にして ReferenceError になる。
- **If・ループ**：If は `#Wrapper` / `#Then` / `#Else`、分岐は `then: "exit"`。ループは `#Body`。ForEach の本体は添字 0 で結果をリセットする export。DoWhile は `for.in: "${ [1] }"`。
- **入れ子のループ**：変数の名前を変える（既定は `currentItem`、`currentItem2`、…）。同じ名前は `SHADOWED_LOOP_NAME` で弾く。
- **Response**：`${{ … }}` の 1 つの式にする。オブジェクトに `${}` を並べる形は、Studio Web が文字列にしてしまう。`markJobAsFailed` は横に置き、`then: "end"` を付ける。
- **Break**：`break: "true"`（文字列）。`set` を付けない。付けると `validate` が落ちる。ループの外は `BREAK_OUTSIDE_LOOP` で弾く。
- **コネクタの入力**：リテラルは素のまま。`${'…'}` にすると Studio Web が保存で消す。式は `${…}`。
- **file の入力・出力**：`#/definitions/job-attachment`（JobAttachment の参照）にする。

## Studio Web の往復で分かったこと

- **開ける**：生成した Workflow.json は Studio Web の設計画面でそのまま開けた（表示名の日本語も出る）。Debug（Browser の実行）も Successful だった。
- **開くと自動で保存され、次の 5 点が書き換わる**。どれも実行の結果は同じ。
  - WorkflowStart の `set`：`$workflow.input` を混ぜない古い形になる。
  - JavaScript の `arguments`：改行が入る。
  - **Break に `set: "${$input}"` が足される**。この形は `uip api-workflow validate` が Failure にするが、`run` は通り、結果も同じ。CLI の検証と Studio Web が食い違っている。Studio Web で保存したファイルを validate にかけるときは、ここを見る。
  - TryCatch に `name` が足される。
  - Wait の 0 の項目が消える。
- **配列の入力**：`items` を持たない `array` は、Studio Web で `String[]` に見え、Debug の入力が JSON の欄だけになる（「Rich UI support is not available」）。オブジェクトの配列は、IR の `inputs` に JSON Schema（`{ "type": "array", "items": { … } }`）で書く。

## 動かすときの注意

- **`--no-auth`**：
  - 制御の流れと HTTP Request（ImplicitConnection）は `--no-auth` で動く。
  - コネクタ（IntSvc）とファイルの変換（Orchestrator の保存先を使う）は、ログインして動かす。
- **コネクタ**：
  - 接続は `uip is connections ping` で確かめる。
  - 出力は `.content.<項目>` で読む。
  - stub は必須の項目を落とすことがある。`Data.Parameters` の `required` を見て、`inputs` に足す。Data Fabric の照会は `entityScope`（`tenant`）と `tenantEntityName` が要る。
- **手元の run のノイズ**：リポジトリのフォルダで動かすと `MODULE_NOT_FOUND`（`[worker eval]`）が出るが、結果は Success。
- **Orchestrator で動かす**：デプロイしたプロセスは `ProcessType: "Api"`。`uip or jobs get <ジョブ>` の `OutputArguments` に Response の値が JSON で入る。
- **課金の集計**：実行の課金は 1 時間ほど遅れて集計される（公式の文書）。
