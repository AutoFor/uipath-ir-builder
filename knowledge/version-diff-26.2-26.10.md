# 版の差分：System 26.2.6 → 26.10.0、UIAutomation 25.10.33 → 26.10.6

`node tools/catalog-diff.ts <パッケージ> <旧版> <新版> --impact` の出力をまとめたもの（AUT-612）。版を上げるときの手順は `docs/version-upgrade.md`。この表は手で直さない。カタログを作り直したら出し直す。

## 先に読むこと

- 古いカタログ（System 26.2.6、UIAutomation 25.10.33）は、`readOnly`、`services`（Coded API）、out の `Result`、基底クラスの `Description` を抽出する前に作ったまま。DLL が手元に無く、作り直していない。そのため「増えた」の多くは版の差ではなく抽出の差。差分ツールは、そう見えるものを「抽出器の違いかもしれないもの」に分けて出す
- **Coded API（services）は比べられない**。古いカタログに `services` が無い。新しい版の API が前の版からどう変わったかは、古い版の DLL を取り直さない限りわからない
- 現在のサンプルと対応表は新しい版（System 26.10.0、UIAutomation 26.10.6）で作ってある。影響判定は「古い版から新しい版に上げるとき、このサンプルと対応表がどうなるか」を見ている。結果は下の通りで、直さないと落ちるもの（error）は 0 件
- AUT-612 の本文は「必須になった」と書くが、System の必須の変化 2 件（`AddTransactionItem.TransactionInformation`、`UploadStorageFile.Destination`）は **必須でなくなった**（true → false）。代わりに `TransactionInformationVariable`、`FileName` が増えている。また本文の「型の変化 5 件」は、種類（prop → in）の変化 5 件で、型（`type`）が変わったものは 0 件

## 要点

| | System 26.2.6 → 26.10.0 | UIAutomation 25.10.33 → 26.10.6 |
| --- | --- | --- |
| アクティビティ | +1（`ProcessJobOutput`）/ -0 | +9 / -0（`NAccessibilityCheck`、`NAutonomousTestExecution`、`NExtractUIData`、`NHideStatusWindow`、`NSetCVServer`、`NSetProjectSetting`、`NShowStatusMessage`、`NShowStatusWindow`、`NUIExploratoryTesting`） |
| 消えたプロパティ | 0 | 0 |
| 本当に増えたプロパティ | 25（`RunJob` / `StartJobAndGetReference` の `EntryPointPath`・`Priority`・`RuntimeType`、`DeadlineUtc`、`Elevated`、`SetAsset.JsonValue` など） | 13（`NUITask` の `ActivateBefore`・`CursorMotionType`・`DelayBetweenKeys`・`EmptyFieldMode`・`OutputSchema`、`NClosePopup` / `NFillForm` / `NSetValue` などの `AgentType`、`ExpandTree.ExpandedElement` など） |
| 必須の変化 | 2 件とも必須でなくなった。ほかに必須で増えたのは `DeleteFileX.FileResource`、`DeleteFolderX.FolderResource`、`SetAsset.JsonValue`（どれも別の書き方の選択肢で、片方で足りる） | なし |
| enum | 変化なし | `WebDriverMode` に `DevTools` / `DevToolsHeadless`（`NApplicationCard`、`NSAPLogon`）、`NUITask.AgentType` に 10 値 |
| obsolete | `WaitForJob.Timeout` が obsolete に | `MicrosoftOCR` が obsolete に |
| 抽出器の違いかもしれないもの | 47 件 | 84 件 |
| 影響（error / warn / info） | 0 / 0 / 9 | 0 / 0 / 3 |

以降は、ツールの出力そのまま。

## カタログの差分：UiPath.System.Activities 26.2.6 → 26.10.0

`node tools/catalog-diff.ts` が作った。「本当の差分」と「抽出器の違いかもしれないもの」を分けている。

### 要約

| 項目 | 件数 |
| --- | --- |
| アクティビティが増えた | 1 |
| アクティビティが消えた | 0 |
| プロパティが消えた（本当の差分） | 0 |
| 型が変わった（本当の差分） | 0 |
| 必須が変わった（本当の差分） | 2 |
| enum の値が消えた（本当の差分） | 0 |
| enum の値が増えた（本当の差分） | 0 |
| 種類（in / out / prop）が変わった（本当の差分） | 0 |
| obsolete が変わった（本当の差分） | 1 |
| アクティビティの obsolete が変わった（本当の差分） | 0 |
| browsable が変わった（本当の差分） | 1 |
| アクティビティの browsable が変わった（本当の差分） | 2 |
| overloadGroups が変わった（本当の差分） | 0 |
| default が変わった（本当の差分） | 0 |
| プロパティが増えた（本当の差分） | 25 |
| 抽出器の違いかもしれないもの | 47 |
| readOnly が付いたプロパティ（比べない） | 29 |

### アクティビティの増減

増えた：

- `ProcessJobOutput`（UiPath.Activities.System.Jobs.ProcessJobOutput、プロパティ 5 個）

消えたものはない。

### 必須が変わった（2）

| アクティビティ | プロパティ | 内容 |
| --- | --- | --- |
| AddTransactionItem | TransactionInformation | true → false |
| UploadStorageFile | Destination | true → false |

### obsolete が変わった（1）

| アクティビティ | プロパティ | 内容 |
| --- | --- | --- |
| WaitForJob | Timeout | false → true |

### browsable が変わった（1）

| アクティビティ | プロパティ | 内容 |
| --- | --- | --- |
| WaitForJob | Timeout | true → false |

### アクティビティの browsable が変わった（2）

| アクティビティ | プロパティ | 内容 |
| --- | --- | --- |
| BeginProcess |  | false → true |
| InvokeCode |  | false → true |

### プロパティが増えた（25）

| アクティビティ | プロパティ | 内容 |
| --- | --- | --- |
| AddTransactionItem | TransactionInformationVariable | in System.Collections.Generic.Dictionary<System.String, System.Object> |
| BeginProcess | ArgumentsVariable | in System.Collections.Generic.Dictionary<System.String, System.Object> |
| DeleteFileX | FileResource | in UiPath.Platform.ResourceHandling.IResource 必須 |
| DeleteFolderX | FolderResource | in UiPath.Platform.ResourceHandling.IResource 必須 |
| EvaluateBusinessRule | Output | out System.Activities.OutArgument |
| EvaluateBusinessRule | RuleFormat | prop System.Nullable<UiPath.Core.Activities.BusinessRuleFormat> |
| EvaluateBusinessRule | RuleNeedsMigration | prop System.Boolean |
| EvaluateBusinessRule | RuleRequiresService | prop System.Boolean |
| GetQueueItems | ConvertDatesToLocalTime | in System.Boolean |
| InvokeProcess | Elevated | prop System.Boolean |
| InvokeWorkflowFile | Elevated | prop System.Boolean |
| InvokeWorkflowInteractive | Elevated | prop System.Boolean |
| RunJob | EntryPointPath | in System.String |
| RunJob | Priority | in UiPath.Activities.System.Jobs.JobPriorityV2 |
| RunJob | RuntimeType | in UiPath.Activities.System.Jobs.JobRuntimeType |
| SetAsset | JsonValue | in System.String 必須 |
| StartJobAndGetReference | DeadlineUtc | in System.DateTime |
| StartJobAndGetReference | EntryPointPath | in System.String |
| StartJobAndGetReference | Priority | in UiPath.Activities.System.Jobs.JobPriorityV2 |
| StartJobAndGetReference | RuntimeType | in UiPath.Activities.System.Jobs.JobRuntimeType |
| StartTriggers | Elevated | prop System.Boolean |
| UploadStorageFile | FileName | in System.String |
| WaitForJob | DeadlineUtc | in System.DateTime |
| WaitForJobAndResume | DeadlineUtc | in System.DateTime |
| WaitQueueItem | ConvertDatesToLocalTime | in System.Boolean |

### 抽出器の違いかもしれないもの（47）

古いカタログは今の抽出器で作り直していないので、版の差ではなく抽出の差かもしれない。理由ごとにまとめる。

- **プロパティが増えた：out の Result は古い抽出器が拾っていない**（32 件）：`AddOrSubtractFromDate.Result`, `AppendItemToCollection.Result`, `AskWhenRun.Result`, `BuildCollection.Result`, `BulkAddQueueItems.Result`, `ChangeCase.Result`, `CombineText.Result`, `DownloadFileFromUrl.Result` ほか 24 件
- **種類（in / out / prop）が変わった：prop ⇄ in/out は抽出器の判定の違いかもしれない**（5 件）：`AddQueueItem.Priority`, `AddTransactionItem.FilterStrategy`, `BulkAddQueueItems.CommitType`, `GetQueueItem.FilterStrategy`, `WaitQueueItem.FilterStrategy`
- **default が変わった：default の有無は抽出器の違いかもしれない**（7 件）：`AddQueueItem.Priority`, `AddTransactionItem.FilterStrategy`, `DeleteFolderX.Recursive`, `RunJob.ExecutionMode`, `RunJob.FailWhenFaulted`, `WaitForJob.Timeout`, `WaitQueueItem.FilterStrategy`
- **overloadGroups が変わった：古い抽出器が overloadGroups を出していない**（3 件）：`DeleteFileX.Path`, `DeleteFolderX.Path`, `SetAsset.Value`

### Coded API（services）

比較できない：26.2.6 のカタログに services が無い（Coded API の抽出より前に作ったカタログ）。26.10.0 には 1 サービスある。

### 影響判定（26.2.6 → 26.10.0 に上げたとき）

見たもの：サンプル（IR）のアクティビティ 4609 個、対応表 465 個。

error 0 件（直さないと build / 生成が落ちる）、warn 0 件（確かめる）、info 9 件（抽出器の違いの可能性）。

| 重さ | ファイル | アクティビティ | プロパティ | 内容 |
| --- | --- | --- | --- | --- |
| info | mappings/UiPath.System.Activities/AddQueueItem.json | AddQueueItem | Priority | 種類が変わった prop → in（抽出器の違いかもしれない：prop ⇄ in/out は抽出器の判定の違いかもしれない） |
| info | mappings/UiPath.System.Activities/BulkAddQueueItems.json | BulkAddQueueItems | CommitType | 種類が変わった prop → in（抽出器の違いかもしれない：prop ⇄ in/out は抽出器の判定の違いかもしれない） |
| info | mappings/UiPath.System.Activities/GetQueueItem.json | GetQueueItem | FilterStrategy | 種類が変わった prop → in（抽出器の違いかもしれない：prop ⇄ in/out は抽出器の判定の違いかもしれない） |
| info | mappings/UiPath.System.Activities/WaitQueueItem.json | WaitQueueItem | FilterStrategy | 種類が変わった prop → in（抽出器の違いかもしれない：prop ⇄ in/out は抽出器の判定の違いかもしれない） |
| info | samples/ir/UiPath.System.Activities/AddQueueItem.full.json | AddQueueItem | Priority | 種類が変わった prop → in（抽出器の違いかもしれない：prop ⇄ in/out は抽出器の判定の違いかもしれない） |
| info | samples/ir/UiPath.System.Activities/AddQueueItem.var.json | AddQueueItem | Priority | 種類が変わった prop → in（抽出器の違いかもしれない：prop ⇄ in/out は抽出器の判定の違いかもしれない） |
| info | samples/ir/UiPath.System.Activities/BulkAddQueueItems.full.json | BulkAddQueueItems | CommitType | 種類が変わった prop → in（抽出器の違いかもしれない：prop ⇄ in/out は抽出器の判定の違いかもしれない） |
| info | samples/ir/UiPath.System.Activities/GetQueueItem.full.json | GetQueueItem | FilterStrategy | 種類が変わった prop → in（抽出器の違いかもしれない：prop ⇄ in/out は抽出器の判定の違いかもしれない） |
| info | samples/ir/UiPath.System.Activities/WaitQueueItem.full.json | WaitQueueItem | FilterStrategy | 種類が変わった prop → in（抽出器の違いかもしれない：prop ⇄ in/out は抽出器の判定の違いかもしれない） |



## カタログの差分：UiPath.UIAutomation.Activities 25.10.33 → 26.10.6

`node tools/catalog-diff.ts` が作った。「本当の差分」と「抽出器の違いかもしれないもの」を分けている。

### 要約

| 項目 | 件数 |
| --- | --- |
| アクティビティが増えた | 9 |
| アクティビティが消えた | 0 |
| プロパティが消えた（本当の差分） | 0 |
| 型が変わった（本当の差分） | 0 |
| 必須が変わった（本当の差分） | 0 |
| enum の値が消えた（本当の差分） | 0 |
| enum の値が増えた（本当の差分） | 3 |
| 種類（in / out / prop）が変わった（本当の差分） | 0 |
| obsolete が変わった（本当の差分） | 0 |
| アクティビティの obsolete が変わった（本当の差分） | 1 |
| browsable が変わった（本当の差分） | 0 |
| アクティビティの browsable が変わった（本当の差分） | 0 |
| overloadGroups が変わった（本当の差分） | 0 |
| default が変わった（本当の差分） | 0 |
| プロパティが増えた（本当の差分） | 13 |
| 抽出器の違いかもしれないもの | 84 |
| readOnly が付いたプロパティ（比べない） | 2 |

### アクティビティの増減

増えた：

- `NAccessibilityCheck`（UiPath.UIAutomationNext.Activities.NAccessibilityCheck、プロパティ 17 個）
- `NAutonomousTestExecution`（UiPath.UIAutomationNext.Activities.NAutonomousTestExecution、プロパティ 22 個）
- `NExtractUIData`（UiPath.Semantic.Activities.NExtractUIData、プロパティ 21 個）
- `NHideStatusWindow`（UiPath.UIAutomationNext.Activities.NHideStatusWindow、プロパティ 15 個）
- `NSetCVServer`（UiPath.UIAutomationNext.Activities.NSetCVServer、プロパティ 18 個）
- `NSetProjectSetting`（UiPath.UIAutomationNext.Activities.NSetProjectSetting、プロパティ 17 個）
- `NShowStatusMessage`（UiPath.UIAutomationNext.Activities.NShowStatusMessage、プロパティ 19 個）
- `NShowStatusWindow`（UiPath.UIAutomationNext.Activities.NShowStatusWindow、プロパティ 24 個）
- `NUIExploratoryTesting`（UiPath.UIAutomationNext.Activities.NUIExploratoryTesting、プロパティ 24 個）

消えたものはない。

### enum の値が増えた（3）

| アクティビティ | プロパティ | 内容 |
| --- | --- | --- |
| NApplicationCard | WebDriverMode | `DevTools`, `DevToolsHeadless` |
| NSAPLogon | WebDriverMode | `DevTools`, `DevToolsHeadless` |
| NUITask | AgentType | `GPT54`, `GPT54Mini`, `GPT55`, `GPT56Luna`, `GPT56Terra`, `GPT56Sol`, `UiPathComputerUse`, `GeminiFlash3Preview`, `Kimi2p6`, `GeminiFlash38` |

### アクティビティの obsolete が変わった（1）

| アクティビティ | プロパティ | 内容 |
| --- | --- | --- |
| MicrosoftOCR |  | false → true |

### プロパティが増えた（13）

| アクティビティ | プロパティ | 内容 |
| --- | --- | --- |
| ExpandTree | ExpandedElement | out UiPath.Core.UiElement |
| NClosePopup | AgentType | in UiPath.UIAutomationNext.Enums.NClosePopupModel |
| NExtractFormDataGeneric | AgentType | in UiPath.UIAutomationNext.Enums.NExtractFormDataModel |
| NFillForm | AgentType | in UiPath.UIAutomationNext.Enums.NFillFormModel |
| NHighlight | HighlightMode | prop UiPath.UIAutomationNext.Enums.NHighlightMode |
| NSAPClickPictureOnScreen | PointOffset | prop UiPath.UIAutomationNext.PointOffset |
| NSAPExpandTree | ExpandedNodeElement | out UiPath.Core.UiElement |
| NSetValue | AgentType | in UiPath.UIAutomationNext.Enums.NUpdateUIElementModel |
| NUITask | ActivateBefore | in System.Boolean |
| NUITask | CursorMotionType | in UiPath.UIAutomationNext.Enums.CursorMotionType |
| NUITask | DelayBetweenKeys | in System.Double |
| NUITask | EmptyFieldMode | in UiPath.UIAutomationNext.Enums.NEmptyFieldMode |
| NUITask | OutputSchema | in System.String |

### 抽出器の違いかもしれないもの（84）

古いカタログは今の抽出器で作り直していないので、版の差ではなく抽出の差かもしれない。理由ごとにまとめる。

- **プロパティが増えた：out の Result は古い抽出器が拾っていない**（16 件）：`FindOCRText.Result`, `FindText.Result`, `GetEventInfo.Result`, `GetPassword.Result`, `GoogleCloudOCR.Result`, `GoogleOCR.Result`, `ImageFound.Result`, `MicrosoftAzureComputerVisionOCR.Result` ほか 8 件
- **プロパティが増えた：同じプロパティが N 個のアクティビティで一斉に増えた（基底クラスの扱いの違い）**（55 件）：`NApplicationCard.Description`, `NBlockUserInput.Description`, `NBrowserDialogScope.Description`, `NBrowserFilePickerScope.Description`, `NCheck.Description`, `NCheckElement.Description`, `NCheckState.Description`, `NClick.Description` ほか 47 件
- **browsable が変わった：declaredOn も変わっている（継承メンバーの見え方の違い）**（12 件）：`NExtractData.InUiElement`, `NExtractDataGeneric.InUiElement`, `NSAPLogon.CloseMode`, `NSAPLogon.InUiElement`, `NSAPLogon.IsIncognito`, `NSAPLogon.OpenMode`, `NSAPLogon.UserDataFolderMode`, `NSAPLogon.UserDataFolderPath` ほか 4 件
- **default が変わった：default の有無は抽出器の違いかもしれない**（1 件）：`NSAPLogon.AttachMode`

### Coded API（services）

比較できない：25.10.33 のカタログに services が無い（Coded API の抽出より前に作ったカタログ）。26.10.6 には 6 サービスある。

### 影響判定（25.10.33 → 26.10.6 に上げたとき）

見たもの：サンプル（IR）のアクティビティ 4609 個、対応表 465 個。

error 0 件（直さないと build / 生成が落ちる）、warn 0 件（確かめる）、info 3 件（抽出器の違いの可能性）。

| 重さ | ファイル | アクティビティ | プロパティ | 内容 |
| --- | --- | --- | --- | --- |
| info | samples/ir/UiPath.UIAutomation.Activities/NSaveImage.full.json | NSaveImage | Timeout | browsable=false になった（抽出器の違いかもしれない：declaredOn も変わっている（継承メンバーの見え方の違い）） |
| info | samples/ir/UiPath.UIAutomation.Activities/NSetRuntimeBrowser.full.json | NSetRuntimeBrowser | DelayAfter | browsable=false になった（抽出器の違いかもしれない：declaredOn も変わっている（継承メンバーの見え方の違い）） |
| info | samples/ir/UiPath.UIAutomation.Activities/NSetRuntimeBrowser.full.json | NSetRuntimeBrowser | DelayBefore | browsable=false になった（抽出器の違いかもしれない：declaredOn も変わっている（継承メンバーの見え方の違い）） |

