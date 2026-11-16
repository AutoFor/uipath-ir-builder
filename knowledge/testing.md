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
| NewAddTestDataQueueItem、BulkAddTestDataQueue、GetTestDataQueueItem、GetTestDataQueueItems、DeleteTestDataQueueItems | XAML も C# も build OK（Orchestrator のテストデータキューが要るので run しない） | 同じ（C# は XAML 経由） |
| AttachDocument | XAML も C# も run OK（テストケースの外でもエラーにならない） | 同じ（C# は XAML 経由） |
| VerifyControlAttribute | XAML も C# も run OK（C# は NApplicationCard ごと XAML 経由） | **build NG**：「選択したアクティビティには出力引数がありません」 |

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
- Coded は `[Workflow]` の代わりに `[TestCase]` を付ける。Given / When / Then は名前付きの Sequence なので、`// Given` などの行になる。
  - **Coded のテストケースは fileInfoCollection に載せない**。`coded\TestCase_Gwt.cs` を載せると、Studio が run のために作る包み（`.local\install\coded\<名前>+<名前>Activity.cs`）がクラスを見つけられず、`uip rpa run` が「型または名前空間の名前 'TestCase_Gwt' が名前空間 'CatalogProbeNet8' に存在しません」で落ちた。載せなければ `[TestCase]` だけで run が通った（`out/verify/tcgwt-run/` と `tcgwt2-run/`）。`testCase` の `id` と `status` は Coded では使わない。
- テストのプロジェクト（project.json の `designOptions.outputType` が `Tests`）を作るのは、ほかのプロジェクトと同じく人が Studio で行う。テストケースは Process のプロジェクトにも置ける（verify の作業用プロジェクトは Process で、そこで確かめた）。

確かめていないこと：

- Studio の画面で Coded のテストケースを作ったとき、fileInfoCollection に載るか。載るなら、Studio からは run ではなくテストとして流す前提なのかもしれない。
- データ駆動のテスト（テストデータの変化。Studio は `Tests\Data\` などに JSON を置く）。まだ作れない。
- Test Manager への publish と、Orchestrator のテストセットでの実行。
