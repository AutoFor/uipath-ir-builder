# 試作：Coded ＋ Playwright（C#）をプロセスとして動かす（AUT-1214）

> 2026-11-19：AUT-1219 で Playwright は TypeScript で書くと決めた。C# 版 Playwright はこれからは使わない。この試作は記録として残す。
画面でしかできない Cloud の操作を、オブジェクトリポジトリではなく DOM ＋ Playwright で作れるかを見るための試作。Test Manager のテストではなく、Orchestrator のプロセス（ジョブ）として動かす。2026-11-19 に確かめた。

- プロジェクト：Portable（クロスプラットフォーム）、C#、net8.0、依存は `UiPath.System.Activities 26.10.0` と `Microsoft.Playwright 1.65.0`
- 処理：`in_Url` を開いてタイトルを読み、ログに出して `out_Title` / `out_Info` で返す。`in_Headless` でヘッドレスかどうかを選ぶ
- ブラウザー：Playwright 用のものは落とさず、`Channel = "chrome"`（ロボットの Chrome）。だめなら `ExecutablePath`
- 作業用のプロジェクトは `C:\Users\Public\uipath-cloud-ui\PwServerlessProbe`。ここにはソースの写し（`Main.cs`・`project.json`・`project.uiproj`）だけを置く

## 結果

| どこで | ヘッドレス | ヘッドあり | 理由 |
| --- | --- | --- | --- |
| DESKTOP の Windows のロボット（`queue-run.mjs`） | ○ Example Domain（Chrome 157、4 秒） | ○ 同じ | — |
| Sorahane Trial の Default Serverless（Linux のコンテナー） | × | ×（試していない。画面が無い） | 下の 1〜3 |
| Sorahane Trial の Windows のサーバーレス（`requiresUserInteraction: true`） | 動かない（Pending のまま） | 試していない | 下の「Windows のサーバーレス」 |

### Linux のサーバーレスで落ちた理由（順に）

1. **ディスクが足りない**（ロボットの大きさ Small の既定）：`System.IO.IOException: No space left on device`。Microsoft.Playwright の nupkg は、5 つの OS の node を全部含む。プロセスの `--robot-size Large` にすると展開は通った
2. **driver が見つからない**：ロボットは DLL を NuGet のキャッシュ（`/tmp/home/.nuget/packages/microsoft.playwright/1.65.0/lib/netstandard2.0/`）から読む。driver（`.playwright`）はパッケージの根元にあり、DLL の横には無い。`Process exited`（`TargetClosedException`）で落ちる。`PLAYWRIGHT_DRIVER_SEARCH_PATH` にパッケージの根元を入れると見つかる。NuGet の展開では Linux の実行の権限も付かないので、`File.SetUnixFileMode` で付ける（`Main.cs` に入れた。Windows でもこの直し方で動いた）
3. **node が起動しない**：`node: error while loading shared libraries: libatomic.so.1`（exit 127）。`Playwright.CreateAsync` は落ちずに止まったままになる（`Main.cs` では 90 秒で打ち切る）
4. **ブラウザーが無い**：`/usr/bin/google-chrome`・`chromium` などはどれも無い。ルートは読み取り専用（`/dev/vdc / ext4 ro`）なので、入れることもできない

→ Linux のサーバーレスは、Playwright には使えない。Windows のサーバーレスか、Chrome のある Unattended のロボットで動かす。

### Windows のサーバーレス

1. Default Serverless の Unattended の枠が 0 だと、ジョブを始めた時点で `409 Unattended runtime license selected. There are no Unattended runtimes configured on the templates in this folder.`
2. 利用者の了承を得て、枠を 1 にした（`uip or machines update d9bea126-afe7-4c19-bc29-e090f9e68dcd --unattended-slots 1 --profile trial`）。テナントの Unattended のライセンスは 2 で、使用は 0 だった（`uip or licenses info`）
3. ジョブ（1.0.5、ヘッドレス、chrome）はできたが、Pending のまま 10 分以上動かない。`uip or jobs get` の `PendingReasons` は次のとおり
   - `This job can run only under an account with credentials defined and there is none assigned to this folder.`
   - `TemplateNoHostsAvailable`、`RobotNoCredentials`、`DynamicJobAccountCredentialsInvalid`
   - Windows のサーバーレスの Unattended は、フォルダに割り当てた、資格情報（Windows のパスワード）のあるアカウントで動く。パスワードは AI が入れないので、ここで止めた
4. ジョブを Kill し、枠を 0 に戻した（`--unattended-slots 0`）

→ 続けるには、人がフォルダ Shared のロボットのアカウント（または利用者）に Windows の資格情報を設定する。そのあと枠を 1 にして、3 本（ヘッドレス chrome・ヘッドあり chrome・msedge）を流す。Chrome が無いときの Edge（`in_Channel = "msedge"`）は 1.0.5 に入れてある

## パッケージに入るもの

- `uip rpa pack` のパッケージ（36 KB）には、自分の DLL だけが入る。Microsoft.Playwright は nuspec の依存（`[1.65.0]`）で、ロボットが実行の前に NuGet から取る。driver（node）もそのパッケージの中にある
- pack は「Dependency package Microsoft.Playwright is not used」と注意を出すが、依存は消えない

## Trial に作ったもの（残してある）

- パッケージ `PwServerlessProbe` 1.0.1〜1.0.5、Shared のプロセス `PwServerlessProbe`（Key `27179f31-ed74-41f3-a485-12ff73d39f33`、ロボットの大きさ Large、今は 1.0.5）
- 1.0.5 は `requiresUserInteraction: true` に、引数 `in_Channel`（`chrome` / `msedge`）を足した版。ジョブ `3f383b1a…` は Pending のまま止めた（Stopped）
- ジョブ：`9e9360b9…`（ディスク）、`fa899010…`（driver が無い）、`f42dde30…`（止まった。Kill した）、`b6cfe293…`（libatomic）
- 1.0.2 は `requiresUserInteraction: true` の版（Windows のサーバーレス用。409 でジョブにならなかった）

## 動かし方

```bash
uip rpa pack --project-dir C:\Users\Public\uipath-cloud-ui\PwServerlessProbe --output-path C:\Users\Public\uipath-cloud-ui\PwOut --package-version 1.0.5
uip or packages upload C:\Users\Public\uipath-cloud-ui\PwOut\PwServerlessProbe.1.0.5.nupkg --profile trial
uip or processes update-version 27179f31-ed74-41f3-a485-12ff73d39f33 --package-version 1.0.5 --folder-path Shared --profile trial
uip or jobs start 27179f31-ed74-41f3-a485-12ff73d39f33 --folder-path Shared --profile trial --input-arguments '{"in_Url":"https://example.com/","in_Headless":true,"in_Channel":"chrome"}' --wait-for-completion
uip or jobs logs <ジョブの Key> --profile trial
```

- `uip or jobs start` の引数はプロセスの Key（GUID）。名前を渡すと `HTTP 400: Undefined process`
- `uip or jobs logs` / `stop` は `--folder-path` を受け付けない
- DESKTOP で動かすときは `node tools/verify/queue-run.mjs --name <名前>-run --template <プロジェクト> --use-project --no-coded <Main.cs>`（`Main.verify.json` に `args`）
