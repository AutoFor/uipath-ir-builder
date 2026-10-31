# Maestro：テナントの資源を指すノード

イシュー：AUT-1079。環境：`uip` 1.204.0、`@uipath/maestro-builder-sdk` 6.66.5、2026-10-31 時点のテナント `autofor/DefaultTenant`。

**読み取りの範囲で調べた。公開、デプロイ、テナントへの書き込み、実行（`debug`）はしていない。** なので、ここに書いた「通る」は、どれもローカルの検証の話で、動くという意味ではない。使った読み取りは、`registry pull`、`registry search/get/list`、`registry prepare`（スキーマを読むだけ。`--resolve` は使っていない）、`or processes list`、`is connections list`、`solution resources list`。

## 結論

- **書き方は4種類とも SDK にある**。RPA とコネクタは実在の資源で、3形式ともローカルの検証を通した
- **エージェントと Action App は、このテナントに実在の相手が無く（下の表）、架空の名前でしか試せていない**。形が正しいかは分からない
- **`check`、`compile`、`validate` は、テナントに無い資源を指していても通る**（コネクタの入力欄を除く）。これを止めるため、窓口に `--tenant` を足した

## テナントにあるもの

| 資源 | 見つかったもの | 備考 |
| --- | --- | --- |
| RPA | 21 件（`uipath.core.rpa-workflow.<キー>`） | 試したのは `Common/TestHelloWorld` |
| コネクタ | ノード 2571、接続 14 件（うち `Failed` 2 件） | 試したのは Outlook の `get-email-by-id`（読み取り） |
| API ワークフロー、公開済みエージェント、Agentic Process | 0 件 | |
| Action App | 確認できず | アプリは3件あるが、Action App かは見ていない（`solution resources list --kind App` は種類を区別しない） |
| IxP | 0 件 | |

レジストリの全体は 4248 件で、大半は `uipath.connector`（2571）と、エージェント用の `uipath.agent.resource`（1608）。

## 書き方と、確かめた範囲

サンプルは `tools/maestro/fixtures/tenant/`。

| 資源 | Flow | BPMN | Case | 確かめた範囲 |
| --- | --- | --- | --- | --- |
| RPA | `rpaWorkflow({ key, name, folderPath })` | `.startProcess(id, { process, folder })` | `.rpa(name, { folder })` | 実在のもので、3形式とも全工程と `--tenant` を通した |
| コネクタ | `connector(key, action, inputs, { connection, folder })` | `.connector(id, key, action, inputs, opts)` | `.connector(key, action, inputs, opts)` | 実在の接続で、3形式とも全工程と `--tenant` を通した |
| エージェント | `agent({ key, name, folderPath, inputs })` | 未確認（`.startAgent` がある） | 未確認（`.agent` がある） | Flow を架空の名前で。ローカルは通り、`--tenant` が止める |
| Action App | `hitl({ variant: "action-app", app: { name, key, folderPath } })` | 未確認 | `.action({ app: { name, folder } })` | 架空の名前で。同上 |

### キーの要る場所が違う

Flow の RPA は、リリースのキーがノードの型に入る（`uipath.core.rpa-workflow.<キー>`）。BPMN と Case は名前とフォルダだけで指す。SDK の文書によると、実行時に実際に使うのは名前とフォルダ。**RPA のキーは、デプロイし直すと変わるかもしれない**（未確認）。

### コネクタは手順が1つ増える

```bash
# uip が PATH に要る（prepare が中で呼ぶ）。無いと "spawn uip ENOENT" で落ちる
export PATH="$PATH:$(cygpath "$APPDATA")/npm"
uip maestro registry prepare uipath-microsoft-outlook365 --action get-email-by-id \
  --connection "<接続名>" --bind-connection outlook \
  --bindings <dir>/.flow-sdk/bindings.json --out <dir>/.flow-sdk/connectors-local --json-only
node tools/maestro/verify.mjs --tenant --workspace <dir> tools/maestro/fixtures/tenant/Connector.flow.ts
```

- ソースには `outlook`、`shared` という記号名だけを書き、実際の ID は `bindings.json` に入る。**`bindings.json` は接続の ID を含むのでコミットしない**
- `prepare` しないと `compile` は warning `CONNECTION_STUB` を出し、`.flow` に記号名をそのまま書く。SDK の文で「実行すると `invalid GUID` で落ちる」とある。**warning なので、`--strict` か `--tenant` を付けないと通る**
- `prepare` すると `check` が入力欄の名前を見る（`messageId` と書いたら `did you mean "id"?` で止まった）。これはテナントのスキーマで検査できる唯一のもの
- ID を選ぶ欄（Slack の `channel` など）は `lookup()` で書き、`check` が `LOOKUP_UNRESOLVED` で止める（確認した）。解決は `prepare --resolve` で、接続先のデータを読むので今回は流していない

### Case の人のタスク

AUT-1071 で残した「Case の `action` はフォームをどう書くのか」は、半分分かった。

- SDK の `.action()` は `app: { name, folder }` と、`inputs` / `outputs`（欄の宣言）を取る。**Flow の QuickForm にあたるものは Case には見当たらない**（SDK の型と文書を読んだ範囲）。実際のフォームは Action App が持つ形に見える
- `app` を省くと warning `STRICT_BINDINGS_ABSENT`。`--strict` で止まる
- `actionCatalogName` はアプリではないと文書にある。試していない

## `--tenant`

`verify.mjs --tenant` は、成果物から資源への参照を取り出して、テナントの一覧と比べる（`tools/maestro/tenant-refs.mjs`）。

| 照合 | 診断 |
| --- | --- |
| プロセス（RPA、エージェントなど）の名前 | `REF_NOT_FOUND` |
| 名前はあるがフォルダが違う（プロセス、アプリ） | `REF_WRONG_FOLDER` |
| Flow のノードの型に入ったキー | `REF_NOT_FOUND` |
| アプリのキー | `REF_NOT_FOUND` |
| 接続の ID | `REF_NOT_FOUND`。`Enabled` でなければ warning `REF_CONNECTION_STATE` |
| 一覧が読めない | `TENANT_UNREADABLE`（OK にしない） |

テナントを読むので既定では流さない。一覧は1回の実行で1度だけ読む。

見ていないもの：権限（ログインした人に見えても、実行するアカウントに見えるとは限らない）、引数の名前と型、フォルダのパスの表記の揺れ（入れ子のフォルダは試していない）。

## 残り

- **実際に動くか**：どの資源も動かしていない。AUT-1080 で、まず `Rpa.flow.ts` のように副作用の無いものから当てるのがよい。SDK の文書には、`check`、`compile`、`validate` を通ったのにクラウドで `170009` で落ちた例が書かれている
- **エージェントと Action App の実物**：テナントに公開されたら、架空の名前の例を実物に置き換える。Flow の `action-app` の成果物には `inputSchema` / `outputSchema` が入らなかった（Skill の文書の例には入っている）。要るかは未確認
- **BPMN のエージェントと Action App、Case のエージェント**：書いていない
- **`prepare --resolve`**：流していない
