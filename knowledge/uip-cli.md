# uip（UiPath の CLI）の使い方と落とし穴

`uip`（npm の `@uipath/cli`）を使ってきて分かったことを、製品をまたいでまとめる。版は 1.204.0（2026-11-14）。

- コマンドの一覧と引数は `uip <コマンド> --help` を見る。ここには写さない。
- 製品ごとの手順は各ページにある。
  - [api-workflow.md](api-workflow.md)
  - [maestro.md](maestro.md)
  - [apps.md](apps.md)
  - [dataservice.md](dataservice.md)
  - [persistence.md](persistence.md)
- ここに書くのは、製品をまたいで何度もつまずいたことだけ。

## ほかの UiPath の CLI と使い分け

`uipcli`（UiPath.CLI.Windows）、Python の `uipath`、`UiPath.Studio.CommandLine.exe`、`UiRobot.exe` の入れ方と使い分けは [uipath-clis.md](uipath-clis.md)。この道具では、テナントの操作は `uip`、build の前の式のコンパイルの確認は `uipcli package analyze`（`tools/verify/analyze.mjs`）を使う。

## ログインとテナント

- 既定のログインは会社の組織（autofor / DefaultTenant）。
- トライアルの組織は `uip login --profile trial` で別にログインし、コマンドごとに `--profile trial` を付ける。付け忘れると会社のテナントに対して動く。
- `uip login status` で、どの組織・テナントかを確かめる。
- プロファイルの中身（`~/.uipath/profiles/<名前>/.auth`）にはトークンがある。表示しない・コミットしない。
- テナントにサービスが無いと `Service: du not found` などになる。`uip admin tenants services list` で確かめる（[maestro.md](maestro.md) の IXP の節）。

## フォルダ

- **会社のテナントに `Shared` は無い**。試しに置くのは `1_Test` の下（`--parent-folder-path 1_Test`）。トライアルのテナントは `Shared`。
- 個人ワークスペースは `--personal-workspace` か、そのフォルダの Key で指す。
- `--folder-path` を受け取らないコマンドがある。
  - `uip or jobs get <ジョブ>` は Key だけで引ける（`--folder-path` を付けると落ちる）。
  - `triggers list` / `create` / `get` / `update` / `delete` は `--folder-path` か `--folder-key` が要る（`--all-folders` は無い）。
- `uip is connections list` はフォルダごと。見つからなければ `--all-folders` を付ける。

## 出力の読み方

- `--output json` の結果は `{ Result, Code, Data, Message, Instructions }` の形。
  - 失敗は `Result: "Failure"`。理由は `Message` と `Instructions` に出る。終了コードだけで判断しない。
- **`Data` のキーは PascalCase にそろえる**（文書の global-options の仕様）。元のデータのキーも変わる（`uip api-workflow run` の Response、`uip tasks get` の値、`bpmn debug` の結果）。`--output-filter` で付けた名前も変わる（`{n:Name}` → `N`）。
  - 元のキーの大文字小文字が要るなら、別の所から読む。
    - API ワークフロー：デバッグのログ、またはジョブの `OutputArguments`。
    - タスク：`components` の中身。
- 一部のコマンドは JSON の前にログの行を出す（`maestro case debug` など）。最初の `{` から読む。
- `--output-filter` で JMESPath を当てられる（例：`--limit 200 --output-filter "[?contains(Name,'x')].{n:Name,k:Key}"`）。
  - **1.200.0 から、`--limit` に既定値のあるコマンド（多くの list は 50）では `--limit` を明示しないと `ValidationError`（`invalid_argument`、「--output-filter requires an explicit --limit」）で断られる**（1.204.0 の `or folders list` で確かめた）。絞り込みは読んだ分にしか効かないので、全件を見たいなら十分大きい `--limit` を付ける。
  - 無い項目を指すと、空の結果と `[WARN] … Available fields: …` が出る（項目名は PascalCase）。

## 消す・壊すコマンド

- 取り返しのつかないコマンドは `--yes` が要る。付けないと「Confirmation required」の Failure になり、何も起きない。
  - 対象の例：`triggers delete`、`solution deploy uninstall`、`solution packages delete`、`is connections delete`。
- **`df records delete` は `--yes` に加えて `--reason "<理由>"` も要る**。
- 消すのは自分が作った試しのものだけ。人のもの・前からあるものを消すときは、先に人に確かめる。

## ソリューション（pack・publish・deploy）

```bash
uip solution pack <ソリューションのフォルダ> <出力先> --name <名前> --version 1.0.0
uip solution publish <出力先>/<名前>_1.0.0.zip [--personal-workspace]
uip solution deploy run -n <名前> --package-name <名前> --package-version 1.0.0 --folder-name <フォルダ> --parent-folder-path <親>
uip solution deploy list                                       # Key と NewPackageVersionAvailable を見る
uip solution deploy upgrade <Key> --version 1.0.1              # --package-version ではない
uip solution deploy uninstall <名前> --yes
uip solution packages delete <名前> <版> --yes
```

- **`deploy run` の親フォルダが無いと HTTP 404**（「Operation returned invalid status code 'NotFound'」）。フォルダの名前を確かめる。
- **ソリューションに複数のプロジェクトがあると、全部が一緒にデプロイされる**。1 つだけ出したいときは、そのプロジェクトだけを入れた写しを作り、`.uipx` の `Projects` も絞ってから pack する。
- 直したら版を上げて pack・publish し、`deploy upgrade` で入れ替える。
- `deploy upgrade` は `<Key>` を渡せば、名前やパッケージは自動で引く。
- Studio Web との出し入れ：
  - 取り込みは `uip solution upload <ファイル>.uis`（フォルダを渡すと `.local` が落ちる。[apps.md](apps.md)）。
  - 取り出しは `uip solution download <ソリューションの Id> -d <dir> --extract`。Studio Web で足した活動の JSON の形を知るのに使える。

## プロセスとジョブ

```bash
uip or processes list --folder-path <フォルダ>                 # Key（= release key）と ProcessType
uip or jobs start <プロセスの Key> --folder-path <フォルダ> --input-arguments '{…}'
uip or jobs list --folder-path <フォルダ>                      # Source で起動の元が分かる
uip or jobs get <ジョブ>                                       # State、InputArguments、OutputArguments（JSON の文字列）
uip or jobs logs <ジョブ>                                      # ロボットのログ（Log Message や console.log もここ）
```

- ジョブの `Source` で何が起動したか分かる。
  - `Schedule` は時刻のトリガー。
  - `HttpTrigger` は API のトリガー。
  - `IntegrationTrigger` は Integration Service のイベント。
  - `ProcessOrchestration` は Maestro から。
- Maestro の失敗の理由はジョブには出ない。`uip traces spans get <インスタンス>` の Incident のスパンを見る（[maestro.md](maestro.md)）。

## トリガー

```bash
uip or triggers create --type time --name <名前> --release-key <Key> --folder-path <フォルダ> --cron "0 0/1 * 1/1 * ? *" --time-zone "Tokyo Standard Time" --runtime-type Serverless
uip or triggers create --type api  --name <名前> --release-key <Key> --folder-path <フォルダ> --slug <slug> --method Post --calling-mode AsyncRequestReply --runtime-type Serverless
uip or triggers get <Key> [--type api] --folder-path <フォルダ>
uip or triggers delete <Key> [--type api] --folder-path <フォルダ> --yes
```

- **`--time-zone` は Windows の ID**（`Tokyo Standard Time`）。ヘルプは IANA（`Asia/Tokyo`）と書くが、IANA は HTTP 400 になる。
- `--cron` は Quartz の形（秒から始まる 6〜7 項目）。Unix の 5 項目は通らない。
- API のトリガーは `get` / `delete` / `list` に `--type api` が要る。付けないと見つからない。
- `--runtime-type` は動く場所に合わせる。
  - API ワークフローは `Serverless`。
  - この PC のロボットで動かすときは `Development`（[persistence.md](persistence.md)）。
- **Integration Service のイベントのトリガーは `uip` では作れない**（`--type` は time・queue・api だけ）。
  - Orchestrator の画面で作る。
  - `triggers list` にも出ない。
  - 作り方と、入力に来るキーは [api-workflow.md](api-workflow.md) の「トリガー」。

## Integration Service（コネクタ・接続）

- 接続を使う前に `uip is connections ping <Id>` で確かめる。一覧で Enabled でも、動かすと 401 のことがある。
- 接続を新しく作るのは OAuth の同意を伴うので、人に確かめてから（画面か `uip is connections create`）。
- コネクタの Key は推測しない。`uip is connectors list --filter "<製品名>"` で引く（例：Data Fabric は `uipath-uipath-dataservice`）。
- イベントの対象は `uip is triggers objects <コネクタ> CREATED --connection-id <Id>` で見られる。

## Data Fabric

- 表は名前ではなく Id で指す（`uip df entities list` の `Id`）。テナントごとに Id が違う。
- レコードを足すのは `uip df records insert <表の Id> --body '{…}'`。返る `Id` は大文字。イベントの入力に来る Id は小文字。
- 数値の列は `DECIMAL`。`INTEGER` は `uip df` が断る（[dataservice.md](dataservice.md)）。

## このマシン（DESKTOP）での注意

- **`uip rpa build` / `run` と `tools/verify/verify.mjs` を SSH から直接動かさない**。
  - SSH は High の権限・セッション 0 で、run が落ちる。
  - `tools/verify/queue-run.mjs` に置き換える。画面のセッションの窓口が動かす。
- `uip` の Orchestrator・ソリューション・`api-workflow run` などの、ロボットを使わないコマンドは SSH から動く。
- `uip maestro registry prepare` は `uip` が PATH に要る。また `tools/maestro`（SDK のあるフォルダ）で動かす。
- 手元の `uip api-workflow run` をリポジトリのフォルダで流すと、`MODULE_NOT_FOUND`（`[worker eval]`）が出る。結果は Success なので気にしない。

## ヘルプと実際が食い違っていたもの

| コマンド | ヘルプ・スキルの記述 | 実際 |
| --- | --- | --- |
| `or triggers create --time-zone` | IANA の ID | Windows の ID だけ通る |
| `or triggers list` | Integration Service のイベントも見られる（スキル） | 出ない |
| `api-workflow validate` | — | Studio Web の `LogMessage` と、Studio Web が保存した Break の `set` を Failure にする。`run` とクラウドでは動く |
| `solution deploy upgrade` | — | 版は `--version`（`deploy run` は `--package-version`） |
