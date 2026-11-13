# Document Understanding（Extract Document Data）

UiPath.DocumentUnderstanding.Activities の「Extract Document Data」を IR で書いて動かしたときに分かったこと（2026-11-14、3.3.0、トライアルのテナント）。

## 確かめたこと

- 見本は `samples/ir/UiPath.DocumentUnderstanding.Activities/ExtractDocumentDataWithDocumentData.min.json`。
  - 使ったモデル：Document Understanding の既定のモデル（Predefined の Invoices）。
  - 確かめ方：Studio Web のクロスプラットフォームのプロジェクトに入れ、クラウドのロボットで Debug した。
  - 結果：架空の請求書から、`Invoice Number=INV-1001`、`Document Date=2026-10-05`、`Total Amount=8100`、`currency=JPY`、`Vendor Name=Acme Trading Ltd.` が取れた。
- Flow の「Extract document（Preview）」は、実行時に INVALID_DOCUMENT で落ちる（knowledge/maestro.md の 10 節）。同じ請求書でも、この形なら動く。

## 書き方

- クラス名は `ExtractDocumentDataWithDocumentData`。型引数が要る。
  - `ExtractDocumentData` は browsable が false の古いもの。使わない。
- **型引数は `UiPath.IntelligentOCR.StudioWeb.Activities.DataExtraction.DictionaryData`**。プロパティは `GenerateData` を `False` にする。
  - Studio Web の既定は「Generate data type」がオン。このとき型引数は Studio が作るクラス（例 `...SWEntities.ExtendedExtractionResultsForDocumentData.Invoices.Bundle.Invoices`）になる。
  - そのクラスは、プロジェクトの `.entities/EntitiesBundle.*.zip` と `.project/JitCustomTypes*.json` にある。生成器では作れない。
- 出力は `ExtractionResults`。変数の型は `UiPath.IntelligentOCR.StudioWeb.Activities.DataExtraction.IDocumentData(Of ...DictionaryData)`。
- 入力 `FileInput` は `IResource`。Studio Web のファイルの引数（Entrypoint arguments で付ける）をそのまま渡せる。
- モデルの指定は文字列のプロパティでする。Predefined の Invoices の値：

  | プロパティ | 値 |
  | --- | --- |
  | `ProjectId` | `00000000-0000-0000-0000-000000000000` |
  | `ProjectName` | `Predefined` |
  | `ProjectTag` / `ProjectVersionName` | `Production` |
  | `ProjectVersionNumber` | `0` |
  | `DocType` / `ModernDocumentTypeId` | `invoices` |
  | `ModernDocumentTypeName` / `ExtractorName` | `Invoices` |
  | `ActivityMajorVersion` | `2` |

  ほかのモデルの値は、Studio Web で選んで `uip solution download --extract` で読む。
  - プロジェクトの一覧には、IXP のプロジェクト（`ixp_trial_invoices`）も出る。Flow の Extract ノードで作ったモデル（`Extract document (Preview)`、`InvoiceExtract`）も出る。
- 結果の読み方は `docData.Data` の `DictionaryData` のメソッドで読む。
  - メソッド：`GetFields()`（`ResultsDataPoint[]`。`FieldName` と `Values(0).Value`）、`GetFieldValue("Total Amount").Value`、`GetTables()`。
  - `JsonConvert.SerializeObject(docData.Data)` は `{"Handler":{}}` になり、中身が出ない。
- ルートの imports は、Studio Web が作った XAML から取る（`--imports-from`）。
  - BlankTemplate の並びだと `UiPath.Platform.ResourceHandling` が無く、Studio Web が「Type 'IResource' is missing」と言う。
  - `uip rpa build` は通ってしまうので、build だけでは分からない。

## 生成器に足したもの

- カタログ：`catalog/UiPath.DocumentUnderstanding.Activities/3.3.0.json` と `.portable.json`。
  - DLL は `lib/net6.0/UiPath.IntelligentOCR.StudioWeb.Activities.dll` と `UiPath.IntelligentOCR.dll`。
  - NuGet のキャッシュに入れるには、依存に足した作業用プロジェクトを build する。
- 型（`types-xaml.ts`）：`DictionaryData`、`IDocumentData`。
- 式で使えるようにする設定：`EXPRESSION_IMPORTS` に入れた xmlns の型を変数・引数に使うと、ルートの imports と AssemblyReference に名前空間とアセンブリを足す。
  - 足さないと build が `BC30002: Type 'IDocumentData' is not defined` で落ちる。
  - どの型にも足す形にすると、既存のスナップショットが変わる。なので表にした。

## Flow から呼ぶ

- `samples/maestro/deploy/DuViaRpa.flow.ts`：Flow のファイルの入力を `rpaWorkflow` の `inputs` で RPA の `IResource` の引数（`in_Invoice`）にそのまま渡す。RPA の出力の引数（`out_InvoiceNumber`、`out_Total`）は `$vars.<id>.output` に入る。
- 2026-11-14 に `debug.mjs --automate --profile trial` で、`{"out_InvoiceNumber":"INV-1001","out_Total":"8100"}` が返り、全部 Completed。
- RPA は Studio Web の Deploy で Shared/Solution 1 に出した（クラウドのロボットで動く）。key は `uip or processes list --all-folders --process-type Process` の Key。`registry search "rpa-workflow"` は 0 件だった。

## Flow の Extract ノードで作ったモデル（Preview）を、このアクティビティで呼ぶ

- Studio Web のプロジェクトの一覧で「Extract document (Preview)」を選ぶと、次の値になる。
  - `ProjectId`：モデルのプロジェクトの ID
  - `ProjectName`：`Extract document (Preview)`
  - `ProjectTag` / `ProjectVersionName`：`live`
  - `ProjectVersionNumber`：`1`
  - `DocType`：`default_extractor`
  - `ModernDocumentTypeId`：`00000000-0000-0000-0000-000000000000`
  - `ModernDocumentTypeName`：`Default`
  - `ExtractorName`：`IXP Default Extractor`
- 項目はフィールド グループの下（`Default.SalesOrder` など）。
- 2026-11-14 に 3.3.0 で run すると、抽出が `Internal Server Error ... [UnexpectedInternalServerError]` で落ちた。
- 公式の文書は 3.6.0-preview 以降を求める。Studio Web で依存を 3.6.0-preview にすると、「Installing dependencies」から 5 分以上進まず、試せなかった。
- Flow のノードで実行したときの INVALID_DOCUMENT と合わせると、Preview のモデルは実行時に呼ぶ経路がまだ通らない。
