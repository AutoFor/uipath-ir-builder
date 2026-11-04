# Coded Workflow で分かったこと

`samples/coded/CodedMain.cs` を `uip rpa run --file-path CodedMain.cs` で動かして確かめた（System 26.10.0、Robot 26.0、net8）。

## API のありか

- Coded から呼ぶサービスは、アクティビティ本体とは別の DLL にある
  - System：`UiPath.System.Activities.Api.dll` の `UiPath.Core.Activities.API.ISystemService`（`system.`、150メソッド）
  - UIAutomation：`UiPath.UIAutomationNext.API.dll` の `UiPath.UIAutomationNext.API.Contracts.*`（`uiAutomation.` の `IUIAService` 48、`IUiAutomationAppService` 72 など）
- カタログ抽出器は `<名前空間>.API` 配下の公開インターフェース `I*Service` を `services` として書き出す
- ログと別ワークフローの呼び出しは `system` ではなく `CodedWorkflow` の基底クラス側（`Log`、`RunWorkflow`）

## つまずいたところ

- `LogLevel` は `UiPath.Core.Activities.LogLevel` と `UiPath.CodedWorkflows.LogLevel` の両方があり、`using UiPath.Core.Activities;` と一緒だとあいまいでビルドエラー。生成するときは完全名で書く
- `system.WriteTextFile(text, file)` の `file` に `(ILocalResource)system.GetResourceForLocalPath(...)` を渡すと、ビルドは通るが実行時に「どのオーバーロード グループでも…構成されていません」で落ちる。`LocalResource.FromPath("...")` を渡すと動く。build だけでは足りず run まで確かめる必要がある例

## 方針

- 制御フロー（If、ループ、TryCatch、Switch、代入など）は C# の構文で書けるので、Coded 側に IR は要らない
- UI 操作や Excel のように、設定が多い・リソースの渡し方に癖があるアクティビティは、Coded 側も IR から生成して、カタログ（`services`）で検証する

## ワークフローの引数（uip rpa build の生成コードで確かめた）

Studio は `.cs` ごとに `.local/install/<フォルダ>/<クラス>+<クラス>Activity.cs` を生成し、`Execute` のシグネチャから XAML の引数を作る。

- In 引数：`Execute` の引数（名前もそのまま）
- Out 引数：戻り値。1つなら `public string Execute(...)` で、引数名は `Output` になる。2つ以上なら名前付きタプル `public (string out_Message, int out_Length) Execute(...)` で、要素名が引数名になる
- `ref` / `out` の引数は使えない（生成コードが `out` / `ref` を付けずに呼ぶので CS1620 でコンパイルが落ちる）。InOut は Coded では書けない
- `RunWorkflow("coded/Greet.cs", 引数の辞書)` で別の Coded ワークフローを呼べる。戻り値の辞書のキーは上の引数名（Out が1つなら `"Output"`）。生成した `Main.cs` が `Greet.cs` を呼び、期待ログ（`samples/ir/Main.expected.log`）どおりに動くことを run で確かめた（2026-11-04）

## サービスの変数名と型

`.local/.codedworkflows/CodedWorkflow.cs`（Studio が依存パッケージから生成する `CodedWorkflow` の部分クラス）に書かれている。

Studio は各パッケージの API DLL の登録クラスからこれを作る。DLL に `[assembly: CodedWorkflowsServiceRegistry(typeof(ExcelRegistry))]` があり、登録クラスの `AutoImportedTypes` が変数名と型の組（`"excel"` → `IExcelService`）、`AutoImportedNamespaces` が `CodedWorkflow.cs` の先頭の using になる。変数名は属性やシグネチャには無く、getter の IL の文字列にしかない。抽出器は IL を読んでカタログの `codedRegistries` に書き出す。System、UIAutomation、Excel、Mail、Testing の5つで、プローブで Studio が生成したファイルと変数名・型・using が一致した。

`tools/coded/check.ts` の変数の決め方：

1. `--project` のプロジェクトに `CodedWorkflow.cs` があれば、それを読む
2. 無ければ、project.json の依存パッケージのカタログの `codedRegistries`。カタログの無い Mail と Testing は、上で確かめた変数名を足す（呼び出しは確かめられず、`NO_CATALOG` の警告だけ）
3. `--project` が無ければ、プローブと同じ依存とみなす

Mail の API の名前空間は `UiPath.Mail.Activities.Api`（`API` ではない）なので、今の抽出器ではサービスとして拾われない。Mail のカタログを作るときに直す。

プローブ プロジェクトでは：

| 変数 | 型 |
| --- | --- |
| `system` | `UiPath.Core.Activities.API.ISystemService` |
| `uiAutomation` | `UiPath.UIAutomationNext.API.Contracts.IUiAutomationAppService` |
| `excel` | `UiPath.Excel.Activities.API.IExcelService` |
| `mail` | `UiPath.Mail.Activities.Api.IMailService` |
| `testing` | `UiPath.Testing.API.ITestingService` |
| `workflows` | プロジェクトごとの `WorkflowRunnerService`（ワークフローを型付きで呼ぶ） |

基底クラス `UiPath.CodedWorkflows.CodedWorkflowBase` の `Log` / `RunWorkflow` / `Delay` / `BuildClient` などは、カタログ抽出器が `catalog/UiPath.CodedWorkflows/<版>.json` に書き出す。

## UiPath.CodedWorkflows の版

project.json には書かれず、アクティビティのパッケージの依存として NuGet が決める（依存の下限のうち最も高い版）。プローブ（net8）の `.local/AllDependencies.json` では：

| 依存元 | 求める版 |
| --- | --- |
| UiPath.UIAutomation.Activities.Runtime 26.10.6 | 24.10.3 |
| UiPath.System.Activities 26.10.0（net8.0-windows7.0） | 24.10.1 |
| UiPath.Excel.Activities 3.6.1 | 24.10.1 |
| UiPath.Testing.Activities 25.10.1 | 24.10.1 |
| UiPath.Mail.Activities 2.12.10 | 24.10.0 |

なので UIAutomation を入れると 24.10.3、System と Excel だけなら 24.10.1 になる。System 26.10.0 の net6.0 系の依存は 24.10.3 で、net8 と違う。

24.10.0〜24.10.3 の基底クラスのメソッドは12個で、シグネチャも同じ（4つの版のカタログを比べた）。なので `tools/ir/versions.ts` は、project.json に書かれていなければ 24.10.3 のカタログを使う。この扱いで困るのは、基底クラスの API が違う版（24.10 系の外）を引くプロジェクトだけ。

## XAML と C# で動きが違うもの（run で分かった）

サンプルはどちらでも同じログになる形にしてある。XAML から Coded に置き換えるときは、次の違いに注意する。

- `ChangeType`：Int32 から String への変換は、XAML だと `"7.00"`、C# だと `"7"` になる
- `ParallelForEach`：XAML は c, b, a の順、C# は a, b, c の順で回る
- `system.FindAndReplace`：引数名 `valueToFind` と `source` が実装と逆（先頭が対象の文字列、2つ目が検索語として動く）。対応表で入れ替えてある

次は run の比較ではなく、生成器（`tools/ir/generate-coded.ts`）の直し方から分かる違い。置き換えたら `*.expected.log` で確かめる。

- `Switch`：C# では if / else if と `Equals` になる（中の `break` がループを抜けるようにするため）
- `RetryScope`：C# では for と try / catch になる。回数は `NumberOfRetries` の合計で、`RetryInterval` の待ちは `Delay`。回数の数え方とログの出方が XAML と違うことがある（期待ログで確かめる）。`Condition` は未対応
- `ContinueOnError`：C# では try / catch で包み、式が真のとき例外を握りつぶす。ログの出方が XAML と違うことがある（期待ログで確かめる）
- `Parallel`：C# では枝を宣言順に1つずつ実行する。待ちのある枝が交互に進むことはない
- `InterruptibleWhile`：ジョブの停止による割り込みは C# では扱えない
- `InterruptibleDoWhile`：ジョブの停止による割り込みは C# では扱えない
- `CommentOut`：C# では中のアクティビティを生成しない（XAML でも実行されない）

`tools/ir/migrate-report.ts` はこの節の箇条書き（`` - `名前`：説明 ``）を読んで警告に出す。名前はクラス名、プロパティ名、`system.メソッド名`のどれか。

## IR に無い props の意味（既定値）

XAML → IR → C# の通しの確認で、`CopyChartToClipboardX_Full` の C# だけが「画像ファイルはすでに存在します」で落ちた。取り込みが既定値と同じ `ReplaceFile="True"` を IR から落とし、対応表の `{ReplaceFile:-false}` が効いたため。手書きの IR でも同じことが起きる（XAML は True、C# は false）。

**決めたこと：IR に無い props は、XAML でも C# でも既定 XAML の値として扱う。**

- `generate.ts` は既定 XAML の値を XAML に足す。`generate-coded.ts` は同じ値を C# に補う（`xamlDefaultProps`）。`when` の形選びも既定値を見る。ただし「Coded API なし」の形は IR に書かれたときだけ選び、IR に書かれた値を扱えない形は選ばない
- 優先の順は、IR の値 → 既定 XAML → 対応表の `defaults` と `{Prop:-既定}`
- 取り込みは既定値と同じ属性を IR から落とす。意味は変わらないので、対応表を見て残す処理はやめた

取り込みで値を残す案を選ばなかった理由：手書きの IR は直らない。また `new ClickOptions { }` のように省いたときの C# 側の値は対応表からは見えないので、値を残すだけでは「IR に無いとき」の食い違いを見つけられない。

既定 XAML に出ないものは補えない。`[DefaultValue]` やコンストラクタの値と同じ値は Studio が書き出さないため。そこは対応表の値が効くので、`tools/ir/coded-defaults.test.ts` がカタログの `DefaultValue` と比べる。違うものは直すか、`knowledge/coded-default-allow.json` に理由を書く（一覧は `node tools/ir/coded-defaults.ts`）。

見つかって直した食い違い（XAML / 直す前の C#）：

| どこ | XAML | 直す前の C# | 直し方 |
| --- | --- | --- | --- |
| `CopyChartToClipboardX.ReplaceFile` | True | false | 対応表と補完 |
| `ExcelForEachRowX.EmptyRowBehavior` | Stop | StopAfterThreeConsecutiveEmptyRows | 対応表と補完 |
| `SaveAsPdfX` / `SaveExcelFileAsX` / `CreateTableX` の `ReplaceExisting` | True（ctor） | false | 対応表 |
| `CopyPasteRangeX.ExcludeHeaderFromSourceTable` | True（ctor） | false | 対応表 |
| `RemoveDuplicatesX.ColumnsCompareMode`（Columns あり） | IndividualColumns（ctor） | AllColumns | 対応表 |
| `Replace.RegexOption` | IgnoreCase, Compiled | 引数なし（API の値） | 補完 |
| `MatchFunctionX.MatchFunctionType`、`SortDataTable.SortOrder`、`MergeDataTable.MissingSchemaAction` | 既定 XAML の値 | 引数なし（API の値） | 補完 |
| `FormatDateAsText` / `ExtractDateTime` の `LocalizationCode` | ja-JP | CurrentCulture | 補完 |
| UI の `AttachMode`、`HealingAgentBehavior`、`ActivateBefore`、`ClickBeforeMode`、`EmptyFieldMode` など、Excel の `ResizeWindow` など | 既定 XAML の値 | オプションのクラスの値 | 補完 |

最後の行は値を明示するようになっただけで、動きが変わったかは確かめていない（UI のオプションのクラスの初期値は読めなかった。`BlockUserInputOptions`、`TextToColumnsOptions`、Excel の `UseOptions` は既定 XAML と同じだった）。

気をつけること：

- `LocalizationCode` の既定 XAML の `ja-JP` は、取った PC のロケール。XAML も C# も同じ値になるが、別のロケールで作り直すと変わる
- `InvokeProcess.UsePackage` は ctor が True で、既定 XAML は false（Studio が置くときに入れる値）。生成器は既定 XAML に合わせる。実物の XAML に属性が無いときの値は ctor の方なので、取り込み直すと意味が変わる可能性がある（未確認）
- 元の IR の C# と取り込んだ IR の C# の違いは、順番と書き方（`object` / `Object`、`@""` / `""`、`Convert.ToString`）だけ。`{ vb, cs }` の `cs` は XAML に無いので vb2cs の結果になる
