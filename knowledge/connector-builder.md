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
- Coded：公式文書では、接続を `connections.<コネクタ>.<接続名>` で取り、そのサービスの Coded の API を呼ぶ（Gmail などの例。自作コネクタは出ない。下の「Studio・Coded から呼ぶ」）。`UiPath.CodedWorkflows` 24.10.3 には `Connnections.ConnectionBase`・`CodedWorkflowsConnectionsAttribute` があり、`UiPath.IntegrationService.Activities` 1.36.0 の Runtime には `CodedWorkflows.ConnectorRequest`（Path / Query / Body / Header の各パラメーター）・`ConnectorResponse`（Output / Items）・`CodedConnectorConfiguration`（ConnectorKey・HttpMethod・Path など）が public である（呼ぶ側の `IntegrationConnectorService` は internal）。**自作コネクタを Coded から呼べるかは、まだ確かめていない**（公開して接続を作り、Studio がプロジェクトに作る `ConnectionsManager` を見る）。呼べなければ、その呼び出しだけ小さな XAML にする（[coded-via-xaml.md](coded-via-xaml.md)）。

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
  "version": "1.0.1",
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
        { "name": "text", "label": "本文", "required": true, "primary": true }
      ],
      "response": [
        { "name": "sentMessages[*].id", "label": "送ったメッセージの ID" }
      ],
      "hooks": {
        "preRequest": [
          "const b = request_body_map || {};",
          "done({ request_vendor_body: { to: b.to, messages: [{ type: 'text', text: b.text }] } });"
        ]
      }
    }
  ]
}
```

- `auth.type`：`apiKey`（customApiKey。Bearer もこれ）・`oauth2`・`basic`・`none` から始める。
- フィールドは `request` / `response` に分けて書き、生成器が per-method の `method` に直す（`required` もメソッドの下へ。同じ名前は1つにまとめる）。`primary: true` は画面で最初から出す項目。
- `auth.validate` は接続を作るときに GET で呼ぶ読み取りだけの API（`provisionAuthValidation` のリソースになる）。
- `version`：公開する版（`publish --version` に渡す）。**公開し直すときは前より上げる**。同じ版だと publish のジョブが「Invalid version: 1.0.0 provided. The version must be higher than the existing version」で FAILURE になる（理由は `uip is connectors publish-status <publishId>` で見える）。`init` に版の選択肢は無い。
- `hooks`：アクティビティの JS のフック（`preRequest` / `postRequest`。文字列か行の配列）。生成器は `activity hook create --resource-name <name> --method <M> --hook-type <型> --custom-code-file` で置く。ファイルは `app/element/hooks/resource-<name>-<M>-<型>.js`、`element.json` の `resources[].hooks` に `contextParams`（本文で使った変数）付きで登録される。返すのは `return` ではなく `done({...})`（check がこれを調べる）。使える変数は `uip is connectors builder activity hook create --help` の HOOK BODY CONTEXT。
- **配列の本文は平らな欄＋フックにする**（下の「Studio に配列の欄が出ない」）。LINE は `to`・`text` の2つの欄にし、preRequest で `request_body_map`（Studio から来た本文）を `request_vendor_body`（LINE に送る本文）の `messages: [{type:'text', text}]` に組み立てる。
- まだ扱っていないもの：GET のクエリの引数、ページング、パスの引数（`/items/{id}`）、トリガー。

## テナントに上げて呼ぶ（確かめた。2026-11-19）

```bash
node tools/connector/gen.ts samples/connector/line-messaging.json --out <空のフォルダ> --import --publish
uip is connectors list --refresh                          # 公開したものは custom-{組織}-{名前}（下書きは design-…）
uip is connections list custom-autofor-linemessagingapi --all-folders --refresh   # 接続（フォルダを指定しないと見つからない）
uip is resources list custom-autofor-linemessagingapi     # オブジェクト（= アクティビティの name）と操作
uip is resources run create custom-autofor-linemessagingapi push_message --connection-id <接続の Id> --body '<JSON>'
```

- `--publish` は `--wait` で待つ。終わるとすぐ `connectors list` に出る（`custom-…` のキー）。下書き（`design-…`）は画面で作ったものがあっても、同じキーなら上書きされる。
- **接続はトークンを入れるので画面で作る**：Integration Service → フォルダ（例 Common）→ コネクタ → 「<名前> に接続」。customApiKey の欄に入れるのはトークンだけ（`Bearer ` は prefix で付く）。保存のとき `auth.validate` の API が呼ばれる。
- `resources run create` で、接続を使って API を呼べる（LINE のプッシュ送信が届いた。返り値は `sentMessages[*].id`）。ロボットや Studio を使わずに、コネクタと接続の確かめができる。
- **アクティビティの見え方**：`uip is activities list` では、汎用の「Insert Record」「List Records」（`IsCurated: No`）だけが出る。push_message は「Insert Record」でオブジェクトに選ぶ形。SR の `metadata.method.POST.curated`（名前・表示名）は CLI が作っているが、単独のアクティビティにはなっていない（`connectors metadata` の `HasMethods: false`）。単独のアクティビティにする方法はまだ分かっていない。

## Studio・Coded から呼ぶ（調べた。2026-11-19、使い捨てのクロスプラットフォームのプロジェクト）

- `uip rpa packages install`（`UiPath.IntegrationService.Activities` 1.36.0）を入れると、`uip rpa activities find --query "<コネクタ名>"` で動的なアクティビティが出る：`UiPath.IntegrationService.Activities.Runtime.Activities.ConnectorActivity`、`isDynamicActivity: true`、`configuration` は `{"connectorKey":"custom-…","activityType":"Generic","operation":"Create"}`（Insert Record）と `"List"`（List Records）。`activityTypeId` は GUID（コネクタ・操作ごと）。
- `uip rpa activities get-default-xaml --activity-type-id <GUID> --connection-id <接続>` は、`<isactr:ConnectorActivity ConnectionId=… UiPathActivityTypeId=… Configuration="{x:Null}">` と空の `FieldObjects` だけを返す。**オブジェクト（push_message）とフィールドは入らない**（`--object-name` は「No dynamic-activities service is registered」で落ちる。パッケージを入れる前は TypeLoadException）。オブジェクトとフィールドは Studio のデザイナーで選んだときに `Configuration` に入る。形は下の「Studio の XAML（Insert Record）」。
- **Coded**：プロジェクトの `connections`（`ConnectionsManager`）に、自作コネクタのメンバーは無い（`connections.LINE_Messaging_API` などは CS1061）。`ConnectionsManager` はどのパッケージの DLL にも無く、Studio が作るもの。GSuite・Office365 のように、Coded の API を持つパッケージ（`CodedWorkflowsConnectionsAttribute`）のコネクタだけが出るらしい。**自作コネクタは Coded から直接は呼べない**（呼ぶならその部分だけ XAML。[coded-via-xaml.md](coded-via-xaml.md)）。

## Studio の XAML（Insert Record）（確かめた。2026-11-19、Studio 26.10・UiPath.IntegrationService.Activities 1.36.0）

Studio（C#・Portable のプロジェクト）で「LINE Messaging API」→「Insert Record」を置き、接続（Common の LINE）とオブジェクト push_message を選んで保存した XAML：

```xml
<isactr:ConnectorActivity Configuration="H4sIAAAA…" ConnectionId="<接続の Id>" DisplayName="Insert Record"
    sap2010:WorkflowViewState.IdRef="ConnectorActivity_2" UiPathActivityTypeId="e2c7639a-829c-322b-bd62-a896f4b6f881">
  <isactr:ConnectorActivity.FieldObjects>
    <isactr:FieldObject Name="_to" Type="FieldArgument">
      <isactr:FieldObject.Value><InArgument x:TypeArguments="x:String">…</InArgument></isactr:FieldObject.Value>
    </isactr:FieldObject>
    <isactr:FieldObject Name="out_sentMessages_array_sub_id" Type="FieldArgument" />
  </isactr:ConnectorActivity.FieldObjects>
</isactr:ConnectorActivity>
```

- **Configuration**：JSON を gzip して base64 にしたもの（`H4sI` で始まる）。中身は `FieldsContainer`（`InputFields`・`OutputFields`。名前・表示名・説明・型・`Design.Position`・`Required`・`FieldLocation`）、`InstanceParameters`（`ConnectorKey: custom-autofor-linemessagingapi`、`ActivityType: Generic`、`Operation: Create`）、`CachedLookupValues.ObjectName`、`ConnectorName`・`ConnectorVersion`、`ObjectName: push_message`、`HttpMethod: POST`、`Path: /push_message`（Integration Service の内部のパス。LINE のパスではない）、`Language: ja`、`PackageVersion: 1.36.0` など。**すべて IR とコネクタの版から組み立てられる**（生成器の結果は、Studio が保存したものと JSON として一致した。`xaml.test.ts`）。
- **欄の値**：`FieldObjects` の `<isactr:FieldObject Name="<識別子>" Type="FieldArgument">` に `InArgument` で入れる（C# の式は `<mca:CSharpValue>`）。項目があるときは `FieldObject` を直に並べる（空のときだけ `<sco:Collection x:TypeArguments="isactr:FieldObject" />`）。
- **識別子**：ランタイムの `NamingHelper.GetValidDesignPropertyName`。`.` → `_sub_`、`[*]` → `_array`、出力は先頭に `out_`。C# か VB で識別子にできない名前は先頭に `_` を付ける（`to` は VB の予約語なので `_to`、`text` はそのまま）。
- **接続**：`ConnectionId` に Id を直に書く。`bindings_v2.json` は作られず、`.project` も変わらない（`PackageBindingsMetadata.json` の ConnectorActivity は `FromInstanceProperty: BindingsJson` だけ）。保存で増えたのは `entry-points.json` と `.tmh/config.json`。
- **UiPathActivityTypeId**：コネクタと操作ごとの GUID（Insert Record は `e2c7639a-…`、List Records は `0a72ea47-…`）。IR からは作れないので `uip rpa activities find --query "<コネクタ名>"` で引いて渡す。コネクタを 1.0.1 で公開し直しても同じ GUID で動いた。
- List Records（オブジェクトは System）を置くと `Path: /auth_validation`・`HttpMethod: GET` の Configuration になる（`auth.validate` のリソース）。

### Studio に配列の欄が出ない

最初の LINE のコネクタ（欄 `to`・`messages[*].type`・`messages[*].text`）では、Studio の Insert Record に `to` しか出ず、Configuration の `InputFields` にも `to` しか入らなかった（本文が無いので LINE は送れない）。`uip is resources describe` には3つとも出る。

DLL（`UiPath.IntegrationService.Activities.dll` 1.36.0。`ilspycmd` で逆コンパイル）を読むと、デザイナーの `FieldsService` は：

- `IsSupportedField`：`x[*].y` は、親の欄 `x[*]` が欄の一覧にあるときだけ残す。
- `ComputeInputFieldsAsync`：`x[*]` の子をまとめて、`x[*]` の JIT 型（接続ごとに作る型。名前にハッシュが入る）のリストの欄を1つ作る。親の欄が無いと、子を消したうえで飛ばす。

親の欄 `messages[*]` を足す手もあるが、Studio では JIT 型のリストを渡す形になり、XAML に型名が入るので生成しにくい。**平らな欄（`to`・`text`）にして preRequest のフックで配列に組み立てる**ことにした（コネクタ 1.0.1）。

### 生成器（`tools/connector/xaml.ts`）

```bash
uip rpa activities find --query "LINE Messaging"      # Insert Record の activityTypeId を引く（プロジェクトに IS のパッケージが要る）
node tools/connector/xaml.ts samples/connector/line-messaging.json --activity push_message \
  --connection <接続の Id> --type-id <Insert Record の GUID> [--organization autofor] \
  --set to=@in_To --set 'text=本文' --arg in_To --out Main.xaml
```

- `--set 欄=値`：`@` で始めると C# の式、そうでなければ文字列そのまま。`--arg` は Main の String の入力引数。
- 出すのは Insert Record（POST）を1つ持つ C# の Main。imports と AssemblyReference は Studio が保存したもの（`UiPath.IntegrationService.Activities.Runtime` など）。
- 検査：必須の欄に値が無い・知らない欄・配列の欄（`[*]`。Studio が捨てる）・GUID の形。
- 出力の欄（`out_…`）は値の無い FieldObject だけ置く（変数に受けるのはまだ扱っていない）。

### 実行（確かめた）

`.work/LineConnectorTest`（uipath-ir-builder の下。`.git/info/exclude` でコミットしない）の Main.xaml を生成器で作り、`uip rpa pack --package-id IrTest_LineConnector` → `uip or packages upload` → `uip or processes create --folder-path 1_Test` → `uip or jobs start <Key> --folder-path 1_Test --runtime-type Serverless --input-arguments '{"in_To":"U…"}' --wait-for-completion`。

- ジョブは Successful（7 秒）で、LINE にメッセージが届いた（preRequest のフックが `messages` を組み立てている）。**サーバーレスのロボットから、別のフォルダ（Common）の接続で呼べた**。
- pack（コンパイル）で、生成した ConnectorActivity の XAML が読めることも分かる。
- **グループにも送れる**：push の `to` にグループ ID（`C` で始まる）を渡すと、同じ XAML のままグループに届いた（2026-11-20）。送り先は入力引数にしておけば、人・グループを差し替えられる。

## LINE の送り先の ID を調べる（2026-11-20）

push の `to` は LINE の ID で、表示名や電話番号では送れない。

- **自分（チャネルの管理者）**：LINE Developers のチャネル →「Basic settings」の一番下「Your user ID」（`U` で始まる 33 文字）。
- **他の人・グループ**：画面には出ない。その人やグループで何か起きたとき（友だち追加・招待・発言）に LINE が送る **Webhook の `events[].source`** にだけ入る（`userId`・`groupId`・`roomId`）。受け口（Webhook URL）が要る。
- **グループに入れる**：公式アカウントは既定でグループに入れず、招待しても「退会しました」になる。LINE Official Account Manager の「設定 → アカウント設定 → 機能の利用」で「グループ・複数人トークへの参加を許可する」（LINE Developers の「Allow bot to join group chats」の Edit から行ける）。

### 受け口：Integration Service の HTTP Webhook は、この会社のテナントでは作れなかった

- 公式の手順：Orchestrator のフォルダの「トリガー → イベント → 新しいトリガーを追加」でコネクタ「HTTP Webhook」を選び、その画面で接続を作ると URL が出る。中身はワークフローで「Get Trigger Event Output」に `UiPathEventObjectId` を渡して読む。URL は `uip is webhooks config uipath-http-webhook --connection-id <Id>` でも取れる（UiPath/skills の PR 4443）。JSON だけ、1 分にテナント 500 件・接続 100 件まで。
- 試したこと（1_Test、名前「LINE Webhook」、認証 None、No challenge）：`uip is connections create uipath-http-webhook --no-wait` の AuthUrl、Orchestrator の「コネクションを追加」、Integration Service の HTTP Webhook のページ、イベントトリガーの画面。**4 回とも「successfully created」と出るのに、どの一覧にも出ない**。
- `uip admin audit tenant events --search webhook` では 4 回とも `Create Connection`（1_Test、失敗も削除も無し）と記録されているのに、その ConnectionId で `uip is connections ping` すると「HTTP 404: was not found in any folder visible to this user」（CNS4001）。権限（`uip or roles user-permissions list <ユーザー> --folder-path 1_Test`）は Folder Administrator で Connections・Schedules の Create/View がそろっている。Automation Ops のポリシーで止めているなら、コネクタのページが開けず「disabled by an Automation Ops policy」と出るはずなので、それでもない。**UiPath 側の不具合とみて、サポートに出す材料（ConnectionId・時刻・TraceId）は監査ログで取れる**。
- フォーラムに「Enterprise のテナントでは HTTP Webhook が出ない（Community では出る）」という未解決の質問がある。
- ほかの受け口にならないもの：Connector Builder のトリガーは polling だけ。Orchestrator の API トリガーは Bearer トークンが要り、LINE の Webhook は付けられない。

### 受け口：Google Apps Script（使えた）

1. https://script.new で `doPost(e)` を書き、`e.postData.contents` の `events[].source` から ID だけを取る（本文は残さない）。スコープを使わなければ承認の画面は出ない。
2. 「デプロイ → 新しいデプロイ → ウェブアプリ」、次のユーザーとして実行「自分」、アクセス「全員」。URL（`https://script.google.com/macros/s/…/exec`）を LINE の Webhook URL にし、「Use webhook」をオン。
3. **匿名で呼ばれた Web アプリの `console.log` は「実行数」に出ない**（「Cloud のログ」も押せない）。ID は `CacheService.getScriptCache()` に置き、鍵を付けた `doGet` で読む形にした（版を上げるときは「デプロイを管理 → 編集 → 新バージョン」で URL が変わらない）。
4. LINE の「Verify」は「302 Found」のエラーになるが、Apps Script はいつも 302 を返すためで、doPost は動いている（実際のイベントも届く）。
5. 取れたら、LINE の「Use webhook」をオフにし、Apps Script のデプロイをアーカイブする（URL は 404 になる）。

使ったスクリプトは `.work/line-webhook-gas/Code.gs`（コミットしない）。

## まだ確かめていないこと

- 出力の欄（`sentMessages[*].id`）を変数に受ける XAML の形
- 接続をフォルダごとに差し替える（バインド）。今は ConnectionId を直に書くので、本番は接続の Id を変えて作り直す
- 単独のアクティビティ（curated）として出す方法
- 公開したコネクタを消す
