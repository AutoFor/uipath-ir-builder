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
- CLI に無い操作を API や画面でどうするか（住み分け）は [cloud-ops.md](cloud-ops.md)。

## ほかの UiPath の CLI と使い分け

`uipcli`（UiPath.CLI.Windows）、Python の `uipath`、`UiPath.Studio.CommandLine.exe`、`UiRobot.exe` の入れ方と使い分けは [uipath-clis.md](uipath-clis.md)。この道具では、テナントの操作は `uip`、build の前の式のコンパイルの確認は `uipcli package analyze`（`tools/verify/analyze.mjs`）を使う。

## ログインとテナント

- 既定のログインは会社の組織（autofor / DefaultTenant）。
- トライアルの組織は `uip login --profile trial` で別にログインし、コマンドごとに `--profile trial` を付ける。付け忘れると会社のテナントに対して動く。
- `uip login status` で、どの組織・テナントかを確かめる。
- **ログインの資格情報は、今のフォルダから上へたどって探す**（`./.uipath/`、その親…、最後に `~/.uipath/`）。`uip codedapp pack` は既定で `./.uipath/` に書くので、その下で `uip` を動かすと、探す先が変わるおそれがある。どれが使われるかは `uip login which`（文書。AUT-1207 の 24）。
- **版の決まり方**：`~/.uipath/config.json` の `core.version` に正確な版を書くと固定、`MAJOR.MINOR`（この PC は `1.204`）ならその系列のパッチを自動で追う、書かなければ最新。固定するなら `uip config set version 1.204.0`（文書。AUT-1207 の 22）。
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
  - 失敗の `Result` は `Failure` のほか、`ConfigError`・`AuthenticationError`・`ValidationError`・`TimeoutError` がある。終了コードは `Result` で決まる（0〜4、取り消しは 130。文書の exit-codes）。手元で見たのは Success 0、Failure 1、ValidationError 3。例外は `uip tm wait` で、時間切れでも 2 を返す。
  - 失敗にはいつも `ErrorCode`（`not_found`・`invalid_argument`・`rate_limited` など）と `Retry`（`RetryWillNotFix` など）が付き、`Context`・`Warning`・`Log` が付くこともある。理由は `Message` と `Instructions` に出る。終了コードだけで判断しない。
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
- **`df entities delete` は `--confirm` と `--reason` が要る**（`--yes` ではない。1.204 の help で確かめた）。`entities update` でフィールドを消すときも `--reason` が要る（文書）。
- **`df entities list` の既定はテナントの表だけ**。フォルダの表は `--folder-key <GUID>`、両方なら `--include-folders`（2 つは一緒に使えない）。
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
### デプロイの落とし穴（AUT-1196。文書は Solutions Management の user-guide、CLI は 1.204 の `--help` で確かめた）

- **`deploy run` は Success でも有効になっていないことがある**。資源に Orchestrator での設定が要るときは `ActivationStatus: NeedsSetupToActivate` と、残りの資源・手順を返す。もう一度 deploy しない。設定してから `uip solution deploy activate <名前>`。
  - `--skip-activate` で「Inactive (Ready to activate)」のまま置ける。状態は `uip solution deploy status <名前か Key>`。
  - 同じ `--name` で `run` すると、そのデプロイを上書きする（版を変えるなら `upgrade`）。
- **版の変更（upgrade・downgrade）の前に、画面の「Deactivate solution」でトリガーと動いているジョブを止める**（文書）。
  - 新しい版に無い部品は、環境からも消える。ロールバックしてもデータは戻らない。
  - downgrade では、エンティティ・選択肢・Webhook は消えない。
  - 資源が消える版の変更は、画面では「Delete and deploy」の確認が要る。文書は API に `--acknowledge-permanent-deletion` があると書くが、1.204 の `deploy upgrade --help` には無い（資源が消える upgrade は試していない）。
  - 前に断られた upgrade の下書きが残っていると、次の upgrade が止まる。`deploy upgrade --discard-draft` で捨てる。
- **デプロイの状態ごとにできること**（文書）：「Inactive (Needs setup to activate)」は upgrade できない。Draft は install か削除だけ。失敗すると自動でロールバックし、それも失敗すると「Failed rollback」になる。
- **ソリューションに入らないもの**（文書）：
  - API トリガーと、Integration Service のイベントのトリガー。デプロイしたあと、別に作る（下の「トリガー」、[api-workflow.md](api-workflow.md)）。
  - Studio Web で作るときの Webhook と、Orchestrator のライブラリ。
  - テナントの Data Fabric の表（フォルダの表だけ入る）。
  - 接続の資格情報（接続そのものは入るが、行き先で接続し直す）。
  - トリガーは、エントリーポイント 1 つに 1 つまで。
- **RPA アプリを含むソリューション**：アプリはテナントのフィードにだけ publish できる。アプリを activate しないと、ソリューションの activation が失敗する（文書）。
- **uninstall で消えないもの**（文書。AUT-1204 の 8）：エンティティ・選択肢・Webhook は消えない。uninstall のあとも、デプロイは Inactive のまま一覧に残る（消すには Delete。CLI は `uip solution deploy delete`）。2026-10-13 から、動いているジョブ（Pending・Running・Suspended など）があると「Uninstall validation failed」で始まらない（Force Uninstall はジョブを止めない）。
- **既にあるリソースにつなぐ**（10）：デプロイのとき、同じ名前の Asset・Storage bucket・Webhook・Queue があると、つなぐか・足りない項目だけ足すか・名前を変えるかを選ぶ。CLI では `deploy config link`（下の「まだ使っていないコマンド」）。前の版が入れたリソースをつなぎ替えると、元のリソースとデータは消える。
- **デバッグのデプロイ**（18）：Studio Web のデバッグは個人ワークスペースに `Debug_<ソリューション名>` を作る。30 日続けて使わないと、自動で uninstall される（戻せない）。
- **フォルダのフィード**（19、2026-10-14）：ソリューションを、テナントでなくフォルダのフィードに publish・deploy できる（CLI は「今後対応」）。そのパッケージは、そのフォルダの下にだけデプロイできる。
- **権限**（20）：テナントの役割が要る（フォルダの権限だけでは足りない）。Solutions Administrator はデプロイまで、Solutions Contributor はパッケージの管理だけ。publish は `SolutionPackages.Create`（テナント）か `FolderSolutionPackages.Create`（個人・フォルダ）、deploy は `SolutionDeployments.Create` か入れる先の `FolderSolutionDeployments.Create`、uninstall は Delete と Edit の両方。
- **Data Fabric の表**（21）：フォルダの表とソリューションの連携は 2026-09-23 に GA。テナントの表・選択肢がソリューションに入るのは「publish した VB の App の依存」としてだけ。
- **デプロイしたあとの値**（23）：Orchestrator で直接直すと Solutions の記録とずれる。画面の Edit configuration で直す（パッケージで configurable にした項目だけ）。
- **使っている版のパッケージは消せない**（24）：`solution packages delete` は、先に uninstall しないと落ちるはず。
- **別のテナントに移す**（30）：入れる先のテナントで、パッケージの中の全部のリソースのサービスが有効なこと（有効にしたら 30 分待って upload）。Orchestrator の Solutions > Projects（Solutions builder）なら、publish 済みのものを集めてソリューションを作れる（Webhook とライブラリはこちらでしか入らない）。バインディングの解決は Orchestrator の Package Requirements のタブだけ。
- **1 プロジェクトだけ publish**（31）：Studio Web では RPA とアプリのプロジェクトを右クリックの「Publish project」で NuGet にできる。
- **2026-04-13 の修正**（35）：新しい版に、今のデプロイが既に入れたリソースが含まれていると upgrade が落ちていた。今は publish のときに衝突を調べ、どのリソースかを出す（外して publish し直す）。
- 画面のデプロイの「Activate immediately」と「Set up runtime」はどちらも既定で on。Set up runtime は、テナントに既定の実行マシンが無いと Serverless の実行環境を用意する（Default Serverless のテンプレートがフォルダに付く）。CLI では、前者は `--skip-activate` を付けないときに当たる。後者に当たる選択肢は `deploy run --help` に無い。

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
- **`uip or triggers history <Key> --folder-path <フォルダ>`** は、起動に失敗した記録（ライセンスが無い、マシンが無い など）を返す。文書では、イベントのトリガーにも効く（Key から種類を判断する。1.204 の help にある。試していない）。

## Integration Service（コネクタ・接続）

- 接続を使う前に `uip is connections ping <Id>` で確かめる。一覧で Enabled でも、動かすと 401 のことがある。
- 接続を新しく作るのは OAuth の同意を伴うので、人に確かめてから（画面か `uip is connections create`）。
- コネクタの Key は推測しない。`uip is connectors list --filter "<製品名>"` で引く（例：Data Fabric は `uipath-uipath-dataservice`）。
- イベントの対象は `uip is triggers objects <コネクタ> CREATED --connection-id <Id>` で見られる。
- **文書で分かったこと**（AUT-1206。まだ試していない）：
  - **上限**（6）：応答は 12 MB まで（JSON でないファイルは 1 GB）。活動とトリガーは 120 秒で時間切れ。トリガーのイベント 1 件は 12 MB まで。外の側のエラーが 100 回続くとトリガーは自動で止まる（メールが来る。手で再開）。
  - **ロボットには、接続のあるフォルダで Connections.View が要る**（7）。無いと無人のジョブが「The user does not have Connections.View permissions on the connection folder.」で落ちる。フォルダの権限は下のフォルダに伝わる。
  - **接続を消すと、その接続のトリガーも消える**（8）。有効なトリガーがあると「400 Cannot delete connection with one or more triggers assigned」のこともある。片付けはトリガーを先に消す。
  - **トリガーが拾うのは、作ったあとのレコードだけ**（9）。デバッグでは 1 時間さかのぼる。ポーリングの間隔は接続ごとに 1 つ（既定 5 分、1 分〜24 時間）。
  - **ソリューションでは接続の資格情報は運ばれない**（5）：デプロイで Link to existing・Authenticate after deployment・Configurable by users から選ぶ。
  - **課金**（26）：2026-09-18 から活動・HTTP・トリガーは課金されない。GenAI の活動とトリガーは例外で課金される（エージェントの Web Search など）。
  - **管理者が作れる接続の種類を絞れる**（33、2026-10-14）：Automation Ops の Connectivity。`is connections create` が通らないときの原因になりうる。
  - **外のアプリから IS の API を呼ぶ**（34）：どの要求にも `X-UIPATH-FolderKey` と、そのフォルダの Connections.View が要る。`IS.Connections.Read` は利用者のスコープだけ。
  - **変更**：Slack の接続は bot のスコープ `chat:write` が必須（31、2026-05-20）。GenAI の Web Summary が Perplexity の Agent API に移った（32、2026-09-28）。2026-09-07 に、Flow を設定し直すと Data Fabric の活動の表が空になる不具合と、接続を消したあとのアンインストールの CNS1077 が直った（30）。
- **`uip is triggers describe <コネクタ> <CREATED|UPDATED|DELETED> <オブジェクト> [--connection-id <Id>]`** は、イベントの出力の項目、絞り込める項目、polling か webhook かを返す（1.204 の help にある）。入力に来るキーを、動かす前に調べられる。

## Data Fabric

- 表は名前ではなく Id で指す（`uip df entities list` の `Id`）。テナントごとに Id が違う。
- レコードを足すのは `uip df records insert <表の Id> --body '{…}'`。返る `Id` は大文字。イベントの入力に来る Id は小文字。
- 数値の列は `DECIMAL`。`INTEGER` は `uip df` が断る（[dataservice.md](dataservice.md)）。

## このマシン（DESKTOP）での注意

- **`uip rpa build` / `run` と `tools/verify/verify.mjs` を SSH から直接動かさない**。
  - SSH は High の権限・セッション 0 で、run が落ちる。
  - `tools/verify/queue-run.mjs` に置き換える。画面のセッションの窓口が動かす。
- **`uip rpa run --remote`（Orchestrator の Unattended ロボットで流す）も SSH からは落ちる**（2026-11-17、Sorahane Trial の `Default Serverless` に Unattended の枠を付け、Portable のプロジェクトで確かめた）。
  - `uip rpa remote configure --folder-path Shared --machine "Default Serverless" --remote-run-only` は通る。
  - `run --remote` と `remote exec --command` は、どちらも「アクセスが拒否されました」で落ちた。ジョブはできていない。
  - `--remote` でも、Orchestrator のトークンは**この PC のロボット（`UiPath.Service.UserHost`）から取る**（`StudioOperations.GetAccessToken`）。そのとき、ロボットが Helm のプロセスを開こうとする（`RegisterClientProcess`）。
  - SSH の Helm は管理者・セッション 0 で、ロボットは RDP のセッションで管理者なしなので、開けずに落ちる。ふつうの run と同じ原因。`--profile` のトークンは使われない。
  - **DESKTOP をサービスモード（`UiRobotSvc` を LocalSystem で入れて起動）にしても同じ**（2026-11-17）。Studio の run は、サービスではなく、RDP のセッションの `UserHost`（`AttendedServiceProxy`）に回るため。確かめた後、サービスは外して元に戻した。
  - SSH から run するには、管理者でない Helm を起こすしかない。今は `tools/verify/queue-run.mjs`（RDP の窓口）を使う。
- `uip` が SSH から起こした Helm（`UiPath.Studio.Helm`、セッション 0）は、終わっても残り、プロジェクトのフォルダ（`.local\.jit`）をつかむ。試しのフォルダを消す前に止める（自分が起こしたものだけ）。
- `uip` の Orchestrator・ソリューション・`api-workflow run` などの、ロボットを使わないコマンドは SSH から動く。
- `uip maestro registry prepare` は `uip` が PATH に要る。また `tools/maestro`（SDK のあるフォルダ）で動かす。
- **SSH から `uip rpa` の `--help` を流しても、管理者の Helm が起きて残る**（2026-11-17。窓口の run が「アクセスが拒否されました」になった）。help を見たあとも、自分が起こした Helm を止める。
- 手元の `uip api-workflow run` をリポジトリのフォルダで流すと、`MODULE_NOT_FOUND`（`[worker eval]`）が出る。結果は Success なので気にしない。

## ヘルプと実際が食い違っていたもの

| コマンド | ヘルプ・スキルの記述 | 実際 |
| --- | --- | --- |
| `or triggers create --time-zone` | IANA の ID | Windows の ID だけ通る |
| `or triggers list` | Integration Service のイベントも見られる（スキル） | 出ない |
| `api-workflow validate` | — | Studio Web の `LogMessage` と、Studio Web が保存した Break の `set` を Failure にする。`run` とクラウドでは動く |
| `solution deploy upgrade` | — | 版は `--version`（`deploy run` は `--package-version`） |
| `tm run --type package`（AUT-1207 の 27） | 文書：上げたパッケージのテストケースを全部流し、失敗なら 1 で終わる | 1.204 に `tm run` は無い。`tm testsets run` ＋ `tm wait` で流す（[testing.md](testing.md)） |
| `solution pack --project`（AUT-1207 の 23） | 文書：ソリューションの中の 1 つのプロジェクトだけを `.nupkg` にする | 1.204 の help に無い。1 つだけ出すときは、今までどおり写しを作るか、`uip rpa pack` ＋ `or packages upload` |
| `df entities delete` | 文書：`-y` と `--reason` | 1.204 は `--confirm` と `--reason` |
| `maestro flow migrate --dry-run`（AUT-1207 の 18） | — | 生成器の `.flow` はもう今の版（1.9 → 1.9）。ノードの任意の移行が 4 つ出た（Triggers の見本） |
| `function publish --feed-id` | — | テナントのフィードに 403。`or packages upload` は通る（[functions.md](functions.md)） |

## 1.204 にあるが、まだ使っていないコマンド（AUT-1207）

文書（uipath-cli の user-guide）と `--help` で、あることだけ確かめたもの。使うときに試して、ここから上の節に移す。

| コマンド | 何に使えるか |
| --- | --- |
| `uip solution deploy config get / set / link / unlink` ＋ `deploy run --config-file` | デプロイで資源を毎回新しく作らず、既にある資源を使う（`config set --all conflictFixingAction UseExisting`）。接続は `authenticationType` を `ConfigurableByUsers` か `AuthenticateAfterDeployment` にできる |
| `uip api-workflow bindings sync --workflow <Workflow.json>` | Studio Web で開かなかった API ワークフローの `bindings_v2.json` を、コネクタの活動から作る（`solution resources refresh` の前） |
| `uip rpa validate --file-path <ファイル> --min-severity error` | ファイルごとの診断を構造化して返す（verify は今、build の生の出力から拾っている）。Helm を使うので窓口を通す |
| `uip maestro flow eval`（evaluator・set・add・simulation・`run start --wait`・results・compare） | Flow の評価セットを CLI で作って流す |
| `uip maestro bpmn debug-instance variables / variables-all / incidents` | BPMN のデバッグの変数と失敗を読む（[maestro.md](maestro.md)） |

- 1.201.0 から `uip maestro bpmn refresh` は Integration Service の接続も足す（`update-metadata` は非推奨）。1.199.0 から `bpmn validate` は Studio Web の canvas の規則も見る（文書のリリースノート）。
