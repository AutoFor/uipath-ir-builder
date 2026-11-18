# Connector Builder（Integration Service の自作コネクタ）

カタログに無い API（例：LINE Messaging API）を、Integration Service のコネクタとして自作するときに分かったこと（2026-11-19、moneyforward_cs の LINE 通知で調べた）。

- **何ができるか**：REST API をコネクタにし、接続（Connection）で認証情報を持ち、Studio・Studio Web・API ワークフローのアクティビティとして使う。トークンをアセットに置いて HTTP を自分で書く代わりになる。
- **作る場所**：画面（Integration Service → コネクタ → コネクタを構築）と、CLI（`uip is connectors builder`）。**生成器では CLI を使う**（下）。
- **状態**：作ると「design」（下書き。キーは `design-{組織}-{名前}`）。`import` でテナントに上げ、`publish` でテナント全体の CUSTOM コネクタになる（Studio Web に出るまで 5〜10 分）。

## CLI の流れ（確かめた）

```bash
export UIPATH_CLI_DISABLE_VERSION_SYNC=1 MSYS_NO_PATHCONV=1   # Git Bash では MSYS_NO_PATHCONV が要る（下の落とし穴）
uip is connectors builder init --name 'LINE Messaging API' --description '…' --categories Messaging --base-url https://api.line.me
uip is connectors builder auth set --auth-type customApiKey --api-key-param-name Authorization --api-key-prefix 'Bearer ' --key-config-display-name 'チャネルアクセストークン'
uip is connectors builder activity create --name push_message --display-name 'プッシュメッセージを送る' \
    --vendor-path /v2/bot/message/push --methods POST --fields-file fields.json
uip is connectors builder validate          # エラーがあると終了コードが 0 以外
uip is connectors import                    # テナントに上げる（初回は作成、2回目からは更新）
uip is connectors publish --wait            # テナント全体に公開
```

- `init` は今のフォルダの下に `periodic-design-{組織}-{名前}/` を作り、`.uip-connector.json` に覚える。以後のコマンドは `--connector-dir` を省くとそれを使う。
- `--organization` を省くとログイン中の組織（`autofor`）になる。
- `validate` まで（init・auth・activity・validate）はローカルだけで動く（テナントに何も上げない）。`import` と `publish` はまだ試していない。
- コマンドの一覧と使いどころは各 `--help` の USE WHEN / NEVER USE FOR が詳しい。`uip is connectors builder activity field schema` で、フィールドの書き方（キー・型・例）が出る。

### 落とし穴

- **Git Bash のパスの書き換え**：`--vendor-path /v2/bot/message/push` が `C:/Program Files/Git/v2/bot/message/push` になる。`MSYS_NO_PATHCONV=1` を付けるか PowerShell で呼ぶ。
- **`required` はメソッドの下**：フィールドの `required` を上に書くと警告（そのまま通る）。`"method": { "POST": { "request": true, "required": true } }` と書く。
- **画面で作った PAT は暗号化されない**：画面で「Personal Access Token (PAT)」を選ぶと、トークンの欄は `TEXTFIELD_1000`・`encrypt:false`（既定値 `Bearer mytoken`）。CLI の `customApiKey` に `--api-key-prefix 'Bearer '` を付けると、欄は `PASSWORD`・`encrypt:true` になり、ヘッダーは `Bearer ${configuration.custom.api.key}`。**Bearer トークンの API は customApiKey にする**。
- **認証の確かめの API**：`customApiKey` などでは `validate` が「provisionAuthValidation が無い」と警告する。接続を作るときに読み取りだけの API を呼んで確かめるもの。`auth set --validation-vendor-path <パス>`（GET）で足す。LINE なら `/v2/bot/info`。
- **下書きは `connectors list` に出ない**：`uip is connectors list --filter` はカタログ（公開済み）だけ。下書きはキー（`design-{組織}-{名前}`。名前は小文字・記号なし）を組み立てて `uip is connectors download <キー> --connector-dir <dir>` で取れる。

## ファイルの形（`app/element/`）

| ファイル | 中身 |
| --- | --- |
| `element.json` | コネクタ全体：`authentication.type`、`configuration[]`（接続の欄。base.url、認証の欄、ページングなど）、`resources[]`（API の呼び出し。path・vendorPath・method・parameters）、`parameters[]`（すべての呼び出しに付くヘッダー） |
| `element-metadata.json` | 名前・説明・キー・lifecycleStage・カテゴリなど |
| `standard-resources/<名前>.json` | アクティビティの見た目（`fields`：画面に出す項目。`messages[*].text` のような書き方、per-method の request / response） |
| `image.svg`、`package.json`、`app/package.json` | アイコンとパッケージの情報（CLI が作る） |

`element.json` は既定の項目が多い（画面で空白から作っても configuration が 17 個）。**生成器はファイルを直接書かず、CLI のコマンドを組み立てる**。形の正しさ（既定の項目、SR と element.json の同期）は CLI に任せる。

## Coded・XAML から使う

- XAML（Studio）：公開したコネクタは `UiPath.IntegrationService.Activities` のアクティビティとして出る（公式文書）。
- Coded：公式文書では、接続を `connections.<コネクタ>.<接続名>` で取り、そのサービスの Coded の API を呼ぶ（Gmail などの例）。`UiPath.CodedWorkflows` 24.10.3 には `Connnections.ConnectionBase`・`CodedWorkflowsConnectionsAttribute` があり、`UiPath.IntegrationService.Activities` 1.36.0 の Runtime には `CodedWorkflows.ConnectorRequest`（Path / Query / Body / Header の各パラメーター）・`ConnectorResponse`（Output / Items）・`CodedConnectorConfiguration`（ConnectorKey・HttpMethod・Path など）が public である（呼ぶ側の `IntegrationConnectorService` は internal）。**自作コネクタを Coded から呼べるかは、まだ確かめていない**（公開して接続を作り、Studio がプロジェクトに作る `ConnectionsManager` を見る）。呼べなければ、その呼び出しだけ小さな XAML にする（[coded-via-xaml.md](coded-via-xaml.md)）。

## IR と生成器（`tools/connector/gen.ts`）

1つのコネクタを1つの JSON で書き、`tools/connector/gen.ts` が CLI のコマンド（と fields のファイル）にして流す。見本は `samples/connector/line-messaging.json`。

```bash
node tools/connector/gen.ts samples/connector/line-messaging.json --print                     # 流すコマンドを見るだけ
node tools/connector/gen.ts samples/connector/line-messaging.json --out <空のフォルダ>          # ローカルで作って validate まで
node tools/connector/gen.ts <ir.json> --out <空のフォルダ> --import [--publish]                # テナントに上げる・公開する
```

- CLI は `node <@uipath/cli の index.js>` に引数を配列で渡す（シェルを通さないので Git Bash のパスの書き換えが起きない）。
- `--out` は空のフォルダにして毎回作り直す（`import` はキーで更新するので、作り直しても同じコネクタが更新される）。
- テスト（`tools/connector/gen.test.ts`）は、IR の検査・コマンドの組み立てと、見本を実際の CLI でローカルに作って validate が通ること・`element.json` と SR の中身を確かめる（`--organization irtest`。テナントには上げない）。

```json
{
  "connector": "LINE Messaging API",
  "description": "LINE 公式アカウントからプッシュメッセージを送る",
  "categories": ["Messaging"],
  "baseUrl": "https://api.line.me",
  "auth": {
    "type": "apiKey",
    "header": "Authorization",
    "prefix": "Bearer ",
    "label": "チャネルアクセストークン",
    "validate": "/v2/bot/info"
  },
  "activities": [
    {
      "name": "push_message",
      "displayName": "プッシュメッセージを送る",
      "method": "POST",
      "path": "/v2/bot/message/push",
      "request": [
        { "name": "to", "label": "送り先", "required": true, "primary": true },
        { "name": "messages[*].type", "label": "種類", "sample": "text" },
        { "name": "messages[*].text", "label": "本文", "required": true, "primary": true }
      ],
      "response": [
        { "name": "sentMessages[*].id", "label": "送ったメッセージの ID" }
      ]
    }
  ]
}
```

- `auth.type`：`apiKey`（customApiKey。Bearer もこれ）・`oauth2`・`basic`・`none` から始める。
- フィールドは `request` / `response` に分けて書き、生成器が per-method の `method` に直す（`required` もメソッドの下へ。同じ名前は1つにまとめる）。`primary: true` は画面で最初から出す項目。
- `auth.validate` は接続を作るときに GET で呼ぶ読み取りだけの API（`provisionAuthValidation` のリソースになる）。
- まだ扱っていないもの：GET のクエリの引数、ページング、パスの引数（`/items/{id}`）、トリガー、フック。

## まだ確かめていないこと

- `import` と `publish`（テナントに上げる。公開は取り消しにくいので、試すときは名前を分ける）
- 接続を作ってアクティビティを呼ぶ（XAML、Coded）
- サーバーレス（Linux）のロボットから呼ぶ
