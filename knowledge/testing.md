# Testing（UiPath.Testing.Activities 25.10.1）で分かったこと

AUT-1113。サンプルは `samples/ir/UiPath.Testing.Activities/`、対応表は `mappings/UiPath.Testing.Activities/`。

## 書き方

- `VerifyExpressionWithOperator` / `VerifyRange` の値（`FirstExpression`、`Expression`、`LowerLimit` など）は型引数の無い `InArgument`。ノードに `typeArg`（`Int32`、`String`、`Double` など）を書くと、全部その型の `InArgument` になる
- 検証系の Coded は、省略できる引数の無い長い形（`ContinueOnFailure` などを全部渡す形）を使う。IR に無いものは既定 XAML と同じ値（`ContinueOnFailure` は True、スクリーンショットは False）、文字列は null
- `KeepScreenshots` / `ScreenshotsPath` は Coded の引数が無い（NO_CODED_API）
- `OutputMessageFormat` の差し込みは `{Expression}`、`{Result}` などで効く（`{LeftExpression}` は効かなかった）

## 落とし穴

- **`VerificationType`（VerifyRange）と `TestDataQueueItemStatus` は、表示名で読み書きする TypeConverter が付いている**。Studio の既定 XAML は `VerificationType="次の範囲内:"` と日本語の表示名で書く。生成器が `VerificationType="IsNotWithin"` と書くと読めず、範囲内として動いた（エラーにならない）。カタログの `enumConverter` を見て、`{x:Static uta:VerificationType.IsNotWithin}` で書く。System・UIAutomation・Excel にはこの形の enum は無かった
- 検証のログの式の部分は、XAML では式の文字列（`1 > 2`）、C# では `Verify Expression` になる。期待ログには XAML と C# で同じになる行だけを書く
- C# では値が `object` で渡るので、`VerifyRange` の値と上限・下限は同じ型にそろえる（`0.5` と `1` ではなく `1.0`）
- `Address` の国は `USA` のような表記（パッケージのデータ `Country|City|State|PostalCode|StreetName|StreetNumber`）。`United States` は KeyNotFoundException
- `RandomValue` のファイルは 1 行目を見出しとして読む。値だけの 1 行のファイルだと空文字になる

## テストデータキュー、AttachDocument、VerifyControlAttribute（2026-11-07、AUT-1155）

確かめた環境：既定の版（Testing 25.10.1、`out/verify/tda-run/`）と、v24 のテンプレート（Testing 23.4.1、`out/verify/tda2-v24-run/`、`out/verify/tda-v24-run/`）。

| アクティビティ | 25.10.1 | 23.4.1 |
| --- | --- | --- |
| NewAddTestDataQueueItem、BulkAddTestDataQueue、GetTestDataQueueItem、GetTestDataQueueItems、DeleteTestDataQueueItems | XAML も C# も build OK。XAML は Test Manager のテストセットで流して OK（下を見る）。手元の run はしない | 同じ（C# は XAML 経由） |
| AttachDocument | XAML も C# も run OK（テストケースの外でもエラーにならない）。XAML はテストセットで添付が付くのを確かめた | 同じ（C# は XAML 経由） |
| VerifyControlAttribute | XAML も C# も run OK（C# は NApplicationCard ごと XAML 経由） | **build NG**：「選択したアクティビティには出力引数がありません」 |

- **Test Manager のテストセットで流して確かめた（25.10.1、2026-11-17、Sorahane Trial）**。見本は `samples/ir/UiPath.Testing.Activities/TestCase.tdq.json`（流したものに、C# で状態を渡せるよう `TimeoutMs` を足した形。`MarkConsumed` は既定の True なので書かない。書いても XAML から取り込むと既定値として消え、C# の形が変わる）。流し方は下の「データ駆動のテスト」の Test Manager の項と同じ（Portable のテスト用プロジェクト、クラウドのロボット）。
  - テストデータキュー `IRTestDataQueue` を Shared に作り（CLI が無いので Orchestrator の API `POST /odata/TestDataQueues`。スキーマは `customer` が string、`count` が integer）、1 つのテストケースで次を流した。どれも検証が通った。
    - NewAddTestDataQueueItem：`ItemInformation` の Int32 の値は JSON の数値で入る（ログ `{"customer":"A-001","count":3}`）
    - BulkAddTestDataQueue：DataTable の列名がスキーマの名前になる（2 行で `Number of items added: 2.`）
    - GetTestDataQueueItems：`All` で 3 件、使用済みを 1 件作った後の `OnlyNotConsumed` で 2 件。表示名の TypeConverter が付いた `TestDataQueueItemStatus` も、生成器の書き方で効いた
    - GetTestDataQueueItem（`MarkConsumed`）：`Dictionary<String, Object>` に入り、`item("count")` は 3
    - DeleteTestDataQueueItems：全件を消して 0 件
  - **DeleteTestDataQueueItems は、ロボットに `TestDataQueueItems.Delete` の権限が要る**。クラウドのロボット（`default robot`）の組み込みの役割 `Automation User` には Create・Edit・View しか無く、「You are not authorized!」で落ちた。Delete だけのフォルダーの役割を一時的に足すと通った。
  - AttachDocument：テストケースの実行（Orchestrator の `TestCaseExecutions` の `TestCaseExecutionAttachments`）に `uta-attach.txt`（`text/plain`、タグ `ir`・`sample`）が付いた。クロスプラットフォームのロボットでも `Path.GetTempPath()` に書いたファイルを添付できた。
- Coded（25.10.1）の対応表：`testing.AddTestDataQueueItem`、`BulkAddTestDataQueueItems`、`GetTestDataQueueItem`、`GetTestDataQueueItems`、`DeleteTestDataQueueItems`、`AttachDocument`。VerifyControlAttribute は Coded API が無い
- テストデータキューの型 `UiPath.Testing.Core.TestDataQueueItem` は `UiPath.Testing.dll` にある（`types-xaml.ts` に足した）。IR の変数は `List<UiPath.Testing.Core.TestDataQueueItem>`
- `GetTestDataQueueItems` の IdFilter・TestDataQueueItemStatus・Skip・Top を Coded で渡す形は timeoutMs も要る。C# にするときは TimeoutMs も書く
- **VerifyControlAttribute の形**（Studio のお手本は無い。25.10.1 で run して通った形）：`ActivityToTest` に確かめるアクティビティ（例 NGetText。出力を変数 `txt` に入れる）、`ArgumentsBridgeActivity` に `ArgumentsBridge`（`Input` にその変数）、`OutputArgument` に出力のプロパティ名（`TextString`）、`Expression` は型引数の無い InArgument なので `typeArg` を書く
- **23.4.1 の VerifyControlAttribute** は、次の 3 通りとも同じ検証エラーで、原因は分かっていない（`out/verify/vca-Vca{B,C,D}-run/`）。
  - TextString の受け先も ArgumentsBridge も外す
  - ArgumentsBridge だけを外す
  - ArgumentsBridge の Input を外す

  Modern の NGetText（UIAutomation 26.10.3）の出力を 23.4.1 が見つけられないのかもしれない。Studio で作った XAML と比べる必要がある。1 つの XAML の検証エラーでプロジェクト全体の build が落ちるので、23.4.1 のプロジェクトでは今は使わない

## テストケース（XAML と Coded）（2026-11-16）

IR に `"testCase"` を書くと、テストケースとして作る。見本は `samples/ir/UiPath.Testing.Activities/TestCase.gwt.json`、仕組みは `tools/ir/testcase.ts`。

```json
{
  "workflow": "TestCase_Gwt",
  "testCase": { "status": "Publishable" },
  "variables": [{ "name": "total", "type": "Int32" }],
  "given": [ … ],
  "when":  [ … ],
  "then":  [ { "act": "VerifyExpressionWithOperator", "typeArg": "Int32", "props": { … } } ]
}
```

- `"testCase": true` か `{ "id": "<GUID>", "status": "Publishable" | "InProgress" }`。
  - `status` は既定で `Publishable`。`InProgress` のテストケースは publish したパッケージに入らない。
  - `id` は Test Manager とつなぐ `testCaseId`。書かなければ、project.json にある値を引き継ぎ、無ければ新しい GUID を振る（作り直しても変わらない）。
- `given` / `when` / `then` は、その名前の Sequence を 3 つ並べた body に開く。`body` と一緒には書けない。`body` だけのテストケースも書ける。
- **テストケースの XAML は、ふつうのワークフローと同じ形**。Studio のテンプレート（`%LOCALAPPDATA%\UiPath\Helm\<版>\ProjectTemplates\Test Automation Project\<Windows|Portable>\<言語>\TestCase.xaml`）も、Comment が 1 つあるだけの Sequence だった。
- **XAML のテストケースかどうかは project.json の `designOptions.fileInfoCollection` で決まる**（`{ editingStatus, testCaseId, fileName }`）。
  - `gen.ts` は、`--out`（かその親、または `--project`）に project.json があれば、ここに載せる。テストケースでなくなった IR は外す。
  - `fileName` はプロジェクトからの相対パスで、区切りは `\`。
  - Studio はテストケースの XAML を、ほかと別の DLL（`<プロジェクト>_<テストケース>.dll`）にする。それでも `uip rpa run` で動く。
  - XAML に印が無いので、XAML を取り込む（`import-xaml.ts`）と `testCase` は戻らない。
  - **テストケースの XAML の式の誤り（未定義の変数など）は、`uipcli package analyze` でも `uip rpa analyze` でも `uip rpa build` でも見つからない**（2026-11-17。ふつうのワークフローなら BC30451 が出る。[uipath-clis.md](uipath-clis.md)）。テストケースは run まで流して確かめる。
- Coded は `[Workflow]` の代わりに `[TestCase]` を付ける。Given / When / Then は名前付きの Sequence なので、`// Given` などの行になる。
  - **Coded のテストケースは fileInfoCollection に載せない**。`coded\TestCase_Gwt.cs` を載せると、Studio が run のために作る包み（`.local\install\coded\<名前>+<名前>Activity.cs`）がクラスを見つけられず、`uip rpa run` が「型または名前空間の名前 'TestCase_Gwt' が名前空間 'CatalogProbeNet8' に存在しません」で落ちた。載せなければ `[TestCase]` だけで run が通った（`out/verify/tcgwt-run/` と `tcgwt2-run/`）。`testCase` の `id` と `status` は Coded では使わない。
- テストのプロジェクト（project.json の `designOptions.outputType` が `Tests`）を作るのは、ほかのプロジェクトと同じく人が Studio で行う。テストケースは Process のプロジェクトにも置ける（verify の作業用プロジェクトは Process で、そこで確かめた）。

### データ駆動のテスト

`testCase.data` に行を書くと、同じテストケースを行ごとの値で流すテストになる。見本は `samples/ir/UiPath.Testing.Activities/TestCase.data.json`。

```json
"testCase": { "data": [ { "price": 120, "quantity": 3, "expected": 360 }, { "price": 50, "quantity": 2, "expected": 100 } ] },
"arguments": [
  { "name": "price", "dir": "In", "type": "Int32" }, { "name": "quantity", "dir": "In", "type": "Int32" }, { "name": "expected", "dir": "In", "type": "Int32" }
]
```

- 行のキーはテストケースの **In 引数の名前**。値は文字列・数値・真偽値・null だけ（Studio のテストデータも基本の型だけ編集できる）。違えば `TESTCASE` のエラー。
- `gen.ts` が行を `.variations\<テストケース>.json` に書き、fileInfoCollection のそのテストケースに `dataVariationFilePath` を付ける。`data` を消すと、この道具が付けた `dataVariationFilePath` を外す（ファイルは残る）。Studio で付けたほかのデータ（Excel から取り込んだものなど）は残す。
- 形の出どころ（Studio が無いマシンなので、Studio に書かせてはいない）：
  - UiPath.Testing.Activities 25.10.1 の XBrowser Test Template。`templates.json` に `"DataVariationFilePath": "XBrowserTemplateDataVariation.json"`、その中身は `[{"Browser":"Chrome"},{"Browser":"Firefox"},{"Browser":"Edge"}]` で、テストケースには In 引数 `Browser` がある。
  - Helm の `UiPath.Project.dll` の `TestCaseFileInfo`（fileInfoCollection の 1 件）は `EditingStatus`・`TestCaseId`・`DataVariationFilePath`・`ExecutionTemplatePath`・`DependentTestCaseIds`・`TestCaseType`（`TestCase` / `TestDataSetup`）・`ExecutionTemplateType`・`ExecutionTemplateInvokeIsolated` を持つ。
  - フォルダ名 `.variations` は、`UiPath.Project.dll` の文字列（`VariationsFolderName` の近く）から取った。Studio の Project パネルでは「Test Data」と出る。
- 手元の run（`uip rpa run`）はデータを読まない。値は `<名前>.verify.json` の `args` で渡す（見本は 2 行目の値）。行ごとに流すのは Studio の Test Explorer と Orchestrator のテストセット。
- **Coded のテストケースにはつなげない**（fileInfoCollection に載せないので、`dataVariationFilePath` を付ける所が無い）。`gen-coded.ts` は `data` を使わず、注意 `TESTCASE_NO_DATA` を出す。In 引数は `Execute` の引数になる。
- `uip rpa test-data add-variation`（データのファイルをテストケースにつなぐ CLI）は、Studio（GUI）が入っていないと「Studio does not support rpa-tool」で断る（Helm だけのときに確かめた）。
- **Studio 26.10 で開いて確かめた**（2026-11-16、作業用プロジェクト `uipath-ir-probe-tcdata2-run`）：
  - Test Explorer に `TestCase_Data (3)` と 3 行（`(1) price: 120, quantity: 3, expected: 360` など）が出て、3 行とも流れて通った。
  - Studio は `project.json` と `.variations\TestCase_Data.json` を一字も書き換えなかった（生成器の `dataVariationFilePath` の書き方のままでよい）。
  - Studio は開いたときに `.variations\config.json`（`{"dataVariationFileInfo":[{"filePath":".variations\\TestCase_Data.json","dataVariationType":"File"}]}`）を自分で作る。生成器はこのファイルを作らない（Studio が `dataVariationFilePath` から作り直すので要らない）。

- **Test Manager のテストセットで流して確かめた**（2026-11-17、Sorahane Trial、Test Manager のプロジェクト `IRPD`）：
  - `uip rpa pack <プロジェクト> <出力先> --output-type Tests` で作ったパッケージを、テナントのフィードに上げ、Shared にプロセスを作り、`uip tm testcases link-automation` でテストケースにつないで、`uip tm testsets run` で流した。
  - テストケース 1 つが、行ごとに 3 つのテストケース ログ（`VariationId` が `1`・`2`・`3`）と 3 つのジョブに分かれ、3 行とも Passed。ジョブのログは `price=120 quantity=3` → `total=360`、`price=50 quantity=2` → `total=100`、`price=7 quantity=6` → `total=42` で、行の値が In 引数に入った。
  - Orchestrator の画面ではテストセットを作れなかった（Orchestrator の Test Automation は廃止で、Test Manager を使うよう出る）。
  - ジョブの `RuntimeType` は `TestAutomation`。マシンの Testing の枠（`TestAutomationSlots`）が 0 だと保留中のまま。
  - **Windows のプロジェクトのテストは、`Default Serverless`（クラウドのロボット）では流れない**。枠を 1 にしても保留中のままだった。クロスプラットフォーム（`targetFramework: Portable`）のテスト用プロジェクトにすると、すぐ流れた。
  - 使ったプロジェクトは `uip rpa init --template-id TestAutomationProjectTemplate --target-framework Portable` で作った（人に頼まれて作った）。テンプレートは `UiPath.WebAPI.Activities` 2.5.2 と `UiPath.UIAutomation.Activities` を依存に入れ、`TestCase.xaml`（InProgress）を置く。WebAPI のこの版はカタログが無く `gen.ts` が断るので、依存とテンプレートのテストケースを外してから生成した。

確かめていないこと：

- Studio の画面で Coded のテストケースを作ったとき、fileInfoCollection に載るか。載るなら、Studio からは run ではなくテストとして流す前提なのかもしれない。
