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

## テナントで動かした結果（2026-11-02）

`flow debug` / `bpmn debug` / `case debug` で確かめた。上の節は読み取りだけの時点の記録で、ここがその後の結果。エージェントと Action App は個人ワークスペースに作った（AUT-1079）。

| ノード | Flow | BPMN | Case |
| --- | --- | --- | --- |
| RPA（`Rpa.*`、`Common/TestHelloWorld`） | Completed | Completed | Completed |
| コネクタ（`Slack.*`、ユーザーグループの一覧） | Completed | Completed | Completed |
| エージェント（`Agent.*`） | Completed | Completed | Completed（`.inputs()` を付けた後） |
| Action App（`App.*`） | タスクができた | タスクができた（**書き換えが要る**） | タスクができた |

Action App の3つとも、**人が完了して先へ進むところは未確認**（タスクは未完了のまま）。

資源：

| 資源 | 名前 | 場所 | 中身 |
| --- | --- | --- | --- |
| エージェント | `uipath-ir-test-agent`（ソリューションのパッケージ `uipath-ir-test-agentSolution` 1.0.0） | 個人ワークスペース配下の `uipath-ir-test-agent` | `gpt-4o-mini`。語を大文字で返すだけ。`maxTokens` 32 |
| Coded Action App | `uipath-ir-test-approval` 1.0.0（URL のパスは `ir-test-approval`） | 個人ワークスペース | 入力 `note`、出力 `comment`、Approve / Reject |

ソースは `tools/maestro/fixtures/resources/`。

### 分かったこと

- **Case の 170004 は Action App を指定すると消えた**。`.action({ app: { name, folder } })` でタスク（`AppTask`）ができる
- **Case の QuickForm は SDK では書けないが、`caseplan.json` と `.hitl.json` を手で足すと動く**（`QuickFormTask` ができた）。Skill の `hitl-casetask-action.md` の Path 1 の形。`data.outputs[]` に `id` が無いと `validate` が `CASE_MGMT_OUTPUT_ID_MISSING` で止める。`id` を足すと `validate` は通るが、足した形での実行はしていない（実行したのは `id` なしの形）
- **BPMN の `humanTask({ app })` はそのままでは動かない**。SDK が作る `Actions.HITL` v1 + `appId` は `170000 Failure in the AppTasks request` で落ちた（アプリの ID、システム名、`appVersion`、`key` の組み合わせを4通り）。Case の compile が作る BPMN と同じ v2 + `name` / `folderPath` の binding に直すと動く。`validate` はどちらも通すので、止まらない
- **`tools/maestro/bpmn-app-task.mjs`** がこの書き換えをする。format の後に流し、`entry-points.json` を消して `bpmn refresh`
- **Case のエージェントは `.inputs()` を付けないと落ちる**。`AGENT_STARTUP.INPUT_VALIDATION_ERROR`。`validate --strict` と `--tenant` は通す（引数は見ていない）
- **Flow の `app.inputs` の値は式として読まれる**。`"Flow から"` は `=js:Flow から` になって落ちる。文字列は `"'Flow から'"` と書く。BPMN と Case は文字列のまま
- **失敗の理由は `bpmn debug` と `case debug` の結果に出ない**。`uip traces spans get <インスタンスの ID>` の `Incident` のスパンに出る。`instance incidents` は空だった
- **Faulted のインスタンスの job は `Running` のまま残る**（`uip or jobs list` で見えた）
- **コネクタは接続先で落ちることがある**。ノードの形とは別の話：Outlook は `MailboxNotEnabledForRESTAPI`、OneDrive は `Tenant does not have a SPO license`（Flow で確認。この Microsoft 365 のテナントの事情）、Google Drive は `parentID: "root"` が 404
- **個人ワークスペースの Teams の接続は、Flow では通るが BPMN では 404**（`Missing instance ... and folder cb95b4b9...`）。Case も同じ接続で Faulted（Case では理由を読めていない）。`0_Prd` の Slack の接続は3形式とも通るので、形式の問題ではなく接続の置き場所の問題だと推定する。原因は未確認
- **`codedapp deploy` はパス名に `uipath-` で始まる名前を拒む**（`This name is reserved`。`codedapp validate` は空きと答える。`uipath` を含むのが理由だというのは推定）。`--path-name` で別の名前を渡す
- **`solution publish` と `codedapp publish` は既定でテナントのフィードに出す**。個人ワークスペースには `--personal-workspace` が要る。`deploy run --personal-workspace` は個人ワークスペースのフィードしか見ない
- **`solution resources list --kind App` に出るまで少し時間がかかる**（デプロイの直後は 0 件で、数分後に出た）

未確認：人が完了した後の分岐と出力、アプリの画面に `note` が出るか（`uip tasks get` は `Note` と大文字で見せる。CLI の表記か、実際のキーかは分かっていない）、`solution deploy` したプロセスとしての実行（どれも debug）。

## 残り

- **人の操作**：Action App のタスクを画面で完了して、再開と出力を確かめる
- **`prepare --resolve`**：流していない
