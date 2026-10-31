# Coded に置き換えると値が捨てられるプロパティ

`node tools/ir/migrate-report.ts --dropped-props` が `mappings/**/*.json` から作る。手で直さない（対応表を直して作り直す）。

XAML にこのプロパティの値があると、C# には反映されない。実際の XAML でどれに当たるかは `node tools/ir/migrate-report.ts <file.xaml>` で見る。

対応表 465 件のうち 80 件に 241 個（形ごとの指定を含む）。

## UiPath.Excel.Activities

| アクティビティ | 捨てられるプロパティ | 形ごとの指定 | 対応表のメモ |
| --- | --- | --- | --- |
| AddSensitivityLabelX | Justification |  | ExcelOperations.AddSensitivityLabel(this IWorkbookQuickHandle handle, IExcelLabelObject label)。理由（Justification）は IExcelLabelObject.Justification に入れる値なので、API の引数には無く捨てる。SensitivityLabel は Object 型なので IExcelLabelObject にキャストする |
| AppendCsvFile | DelimitatorForViewModel |  | ExcelOperations.AppendCsvFile(filePath, data, delimiter, encodingStr) |
| AppendRangeX | DestinationHasHeaders |  | ExcelOperations.AppendRange の 3 つのオーバーロードのうち、StartingColumnName があれば columnName 付き（destinationHasHeaders もここで渡す）、無ければ transpose / pasteOptions / excludeSourceHeaders だけの形。HasHeaders（元の範囲に見出しがある）は excludeSourceHeaders に対応させた（見出し行を貼り付けから外す）。DestinationHasHeaders は StartingColumnName が無い形では Coded に渡す先が無いので捨てる |
| AppendWriteCsvFile | DelimitatorForViewModel |  | Coded には Write と Append が別の API（WriteCsvFile / AppendCsvFile）。CsvAction で呼び分ける。AppendCsvFile には addHeaders と shouldQuote が無いので、Append のときは捨てる |
| CopyChartToClipboardX |  | 全部: Action, ReplaceFile |  |
| ExcelApplicationCard | Visible, UseTemplate, TemplatePath |  | using (var Excel = excel.UseExcelFile(new UseOptions { ... })) { 子 } にする。変数名は IR の item（Studio の既定は Excel）。AutoSave / CreateNewFile はアクティビティの既定（true）を defaults で明示する（UseOptions の既定に頼らない）。Excel Process Scope の中なら ExcelProcess にそのスコープの変数を渡す（{@IExcelProcess}）。Visible / UseTemplate / TemplatePath は Studio に出ない（Browsable=false）プロパティで、UseOptions に対応が無いので捨てる |
| ExcelApplicationScope | AutoSave, Visible, ReadOnly, MacroSetting, StartAsProcess, InstanceCachePeriod, EditPassword, SecureEditPassword, SensitivityOperation, SensitivityLabel, Workbook |  | using (var ExcelWorkbookScope = excel.UseWorkBook(new WorkbookOptions { ... })) { 子 }。中のクラシックのアクティビティは {@IWorkHandle} でこの変数を使う（ExcelReadCell.json など）。UseWorkBook は Excel を起動せずにブックを読み書きする。そのため Excel の起動や表示に関するもの（Visible / MacroSetting / StartAsProcess / InstanceCachePeriod）、保存の仕方（AutoSave / ReadOnly）、編集パスワード・秘密度ラベルは WorkbookOptions に無く、捨てる。Workbook（出力の WorkbookApplication）も Coded には無い。ExistingWorkbook（開いているブックを使う）の形は Coded API が無い（2つめの形。生成すると NO_CODED_API で C# を作らない） |
| ExcelReadRange | UseFilter |  | ExcelOperations.ReadRange(this IWorkHandle, string sheetName, string range, bool addHeaders, bool preserveFormat)。UseFilter（フィルターで見えている行だけ読む）は API に無いので捨てる（フィルターをかけたブックの結果が XAML と変わる）。AddHeaders の既定はアクティビティと同じ true |
| FilterX |  | 全部: HasHeaders | FilterArgument は BasicFilter / AdvancedFilter に直す（tools/ir/excel.ts） |
| PivotTableFieldX |  | when Type=Column: Type, Function / when Type=Filter: Type, Function / when Type=Value: Type / 全部: Type, Function | CreatePivotTableXv2 の子。Type の既定は Row |
| ProtectSheetX | IsPasswordHidden |  | IsPasswordHidden は Studio の画面で伏せるための属性なので Coded では捨てる。パスワードが無いときは password: null |
| ReadCsvFile | DelimitatorForViewModel |  | ExcelOperations.ReadCsvFile(filePath, delimiter, includeColumnNames, encodingStr, ignoreQuotes) |
| UnprotectSheetX | IsPasswordHidden |  | IsPasswordHidden は Coded では捨てる |
| WriteCellX | AutoIncrementRow |  | ExcelOperations.WriteCell(this IReadWriteCellRef cell, object value)。Cell は Excel.Sheet["Sheet1"].Cell["A1"]。AutoIncrementRow（繰り返しの中で書くたびに1行下へずらす）は Coded に同じものが無い（WriteCell(cell, value, rowOffset) で行のずれを自分で数える）ので捨てる。false のときだけ意味が同じ |
| WriteCsvFile | DelimitatorForViewModel |  | ExcelOperations.WriteCsvFile は拡張メソッドではない static のメソッド。DelimitatorForViewModel は画面用の同じ値なので捨てる |

## UiPath.System.Activities

| アクティビティ | 捨てられるプロパティ | 形ごとの指定 | 対応表のメモ |
| --- | --- | --- | --- |
| AddQueueItem | BindingsKey | when ItemInformationCollection, FolderPath, DueDate, DeferDate, Priority, Reference, TimeoutMS: ItemInformation | Coded の AddQueueItem は引数の組が4通り。全部の形は FolderPath・DueDate・DeferDate・Priority・Reference・TimeoutMS がそろっているときだけ。最小の形（QueueType と ItemInformation だけ）は folderPath に null を渡す。ItemInformation（辞書）は new Dictionary<string, object> にする。 |
| AddTransactionItem | BindingsKey, FilterStrategy |  | Coded の AddTransactionItem は引数の組が3通り（queueType / +folderPath / 全部）。全部の形は FolderPath・Reference・TimeoutMS と、TransactionInformation（辞書）か TransactionInformationVariable がそろっているときだけ。SpecificData（out）は戻り値の QueueItem.SpecificContent を代入する。FilterStrategy は XAML 側でも使われない既定値なので捨てる。 |
| AppendLine |  | when FileName: UseDefaultEncoding / when File: UseDefaultEncoding | file は ILocalResource。パスの文字列は LocalResource.FromPath で包む。Encoding が無いときは 2 引数のオーバーロード（UseDefaultEncoding は捨てる） |
| BulkAddQueueItems | BindingsKey |  | Result（追加に失敗した行の DataTable）は戻り値で受ける。全部の形は FolderPath・CommitType・TimeoutMS がそろっているときだけ。 |
| DeleteFolderX | Recursive |  | DeleteFileOrFolder は再帰の指定を取らない（フォルダーは中身ごと消える）。Recursive は無視する（false で中身があるときは XAML だけが失敗する） |
| DeleteStorageFile | BindingsKey |  | BindingsKey は Studio のバインド用で、XAML にも Coded にも書けない（書くと build が落ちる）。FolderPath が無いときは folderPath 引数ごと省く（3 引数の形） |
| DownloadStorageFile | BindingsKey |  | Result（ILocalResource）は戻り値で受ける。Destination か TimeoutMS があるときは 5 引数の形（足りない方は null / 30000） |
| GetEnvironmentVariable | TargetFramework |  | ISystemService には無いので、.NET の Environment.GetEnvironmentVariable を直接呼ぶ（プロセスの環境変数。無ければ null） |
| GetQueueItem | BindingsKey |  | ISystemService.GetQueueItem（戻り値は QueueItem）。全部の形は FolderPath・FilterStrategy・Reference・TimeoutMS がそろっているときだけ。SpecificData は戻り値の SpecificContent を代入する。 |
| GetQueueItems | BindingsKey, ConvertDatesToLocalTime, FilterByCurrentRobot, PropsImportedIntoFilterBuilder |  | Result（IEnumerable<QueueItem>）は戻り値で受ける。全部の形は FolderPath・Duration・From・Priority・QueueItemStates・To・FilterStrategy・Reference・Skip・Top・TimeoutMS がそろっているときだけ。Coded API に無いもの：Filter（OData フィルター。使うと MAPPING_UNUSED_PROP）。ConvertDatesToLocalTime / FilterByCurrentRobot / PropsImportedIntoFilterBuilder は Coded で対応する引数が無いので捨てる（日付は変換されない、現在のロボットによる絞り込みは効かない）。 |
| GetRobotAsset | BindingsKey |  | ISystemService.GetAsset（戻り値は object）。全部の形は FolderPath・CacheStrategy・TimeoutMS がそろっているときだけ。 |
| GetRobotCredential | BindingsKey |  | ISystemService.GetCredential は (string, SecureString) のタプルを返す（out 引数の形は Coded で使えない）ので、分解代入で Username と Password に入れる。 |
| InvokeProcess | BindingsKey, Elevated |  | ISystemService.InvokeProcess（戻り値なし）。引数なしで呼ぶ形だけ。9 引数のオーバーロードは全部渡す（EntryPointPath があるとき）、1〜2 引数のものは ProcessName / FolderPath だけ |
| KillProcess | AppliesTo |  | ISystemService には無いので、Process.Kill を直接呼ぶ。AppliesTo（All / OnlyCurrentUser / OnlyCurrentSession / OnlyCurrentDesktop）の絞り込みは Coded では行わない（名前が合うものを全部止める） |
| ListStorageFiles | BindingsKey |  | いつも 6 引数の形。Recursive の既定は XAML の既定 XAML に合わせて true |
| ReadStorageText | BindingsKey |  | 読んだ文字（Result）は戻り値で受ける。Encoding か TimeoutMS があるときは 5 引数の形 |
| RemoveDataColumn |  | when Column: ColumnName, ColumnIndex | 列名は ISystemService.RemoveDataColumn(ref DataTable, string)。列番号・DataColumn は API に無く、DataTable.Columns.RemoveAt / Remove。Column と ColumnName を両方書いたら Column を使う |
| RemoveFromCollection |  | when RemoveAllElements, Result: Collection / when Item: RemoveAllElements / when Index: RemoveAllElements | サービスの API は無い。C# のコレクション操作で書く（Item は最初の一致だけ消す。全部消すのは Result に新しい空の List を入れる。Result が Collection と同じ変数なら空になる） |
| Replace | TimeoutMS, BuilderPattern, IsBuilderTabModified, Model |  | ISystemService.Replace（正規表現）。TimeoutMS は API の引数に無いので捨てる。BuilderPattern / IsBuilderTabModified / Model はパターンビルダー（デザイナー）用で実行には関係しない |
| RunJob | BindingsKey |  | 戻りのタプル（Job, 出力の JSON 文字列）を Job と Output で受ける。ExecutionMode は None なら doNotWait: true（Suspend は Coded に無いので Busy と同じ扱い）。Arguments（辞書）は inputArguments の Dictionary<string, object> に直す（In 引数のみ。OutArgument は Coded に直せない）。Input は inputArguments にそのまま渡す。Output は JSON 文字列が入るので、String の変数でだけ使える |
| SetAsset | BindingsKey |  | ISystemService.SetAsset(value: object, ...)。JsonValue は文字列として value に渡す（JSON アセットに書けるかは run で確かめていない）。 |
| SetCredential | BindingsKey |  | Coded の password は string。SecurePassword は NetworkCredential で文字列に戻して渡す。 |
| SetEnvironmentVariable | TargetFramework |  | ISystemService には無いので、.NET の Environment.SetEnvironmentVariable を直接呼ぶ（既定のスコープ = 実行中のプロセスだけ。ユーザーの環境変数は変わらない） |
| SetTransactionStatus | FolderPath |  | Coded API に無いもの：AssociatedFilePath（エラー時の画像などの添付。使うと MAPPING_UNUSED_PROP）。全部の形は Details・ErrorType・Reason・TimeoutMS と、Analytics / Output（辞書）か AnalyticsVariable / OutputVariable がそろっているときだけ。 |
| StartJob | BindingsKey, Arguments, ArgumentsVariable, ModernFolder, NumberOfRobots, TimeoutMS |  | いつも 5 引数の形。戻り値の文字列を Key で、out の jobId を JobId で受ける。Coded の StartJob には Arguments / ArgumentsVariable / ModernFolder / NumberOfRobots / TimeoutMS に当たる引数が無いので、これらは ignore（引数付きで起動したいときは system.RunJob の doNotWait: true を使う） |
| UploadStorageFile | BindingsKey |  | Path（ローカルのパス）は LocalResource.FromPath で IResource にする。Coded の destination 引数には FileName に当たるものが無いので、FileName があるときは Destination（末尾が / か \ のディレクトリ）の後ろに FileName を足して渡す |
| WaitQueueItem | BindingsKey, ConvertDatesToLocalTime |  | Result（QueueItem）は戻り値で受ける。全部の形は FolderPath・PollTimeMS・FilterStrategy・Reference・TimeoutMS がそろっているときだけ。ConvertDatesToLocalTime は Coded に対応する引数が無いので捨てる。 |
| WriteStorageText | BindingsKey |  | Encoding か TimeoutMS があるときは 6 引数の形 |

## UiPath.UIAutomation.Activities

| アクティビティ | 捨てられるプロパティ | 形ごとの指定 | 対応表のメモ |
| --- | --- | --- | --- |
| NApplicationCard | ScopeGuid, Version |  | using (var app = uiAutomation.Open(TargetAppModel, TargetAppOptions)) { body } にする。中のアクティビティは {app}.Click(...) のように呼ぶ。CloseMode は Dispose で効く。HealingAgentBehavior は型が違う（NHealingAgentBehavior → NChildHealingAgentBehavior）のでメンバー名で写す。InUiElement / OutUiElement（UiElement で開く・返す）、TargetApp.WorkingDirectory はまだ扱わない |
| NBlockUserInput | ScopeIdentifier, Version, Timeout, DelayBefore, DelayAfter, HealingAgentBehavior, DisableUnblock |  | using (uiAutomation.BlockUserInput(options)) { body }（BlockUserInputScope を Dispose すると解除される）。DisableUnblock（スコープを抜けても解除しない）は Coded API に無いので扱わない。Timeout / DelayBefore / DelayAfter / HealingAgentBehavior も Coded 未対応。RDP の入力が止まるので run していない |
| NCheck | ScopeIdentifier, Version |  | NCheck.Action は CheckOptions.CheckType。OutUiElement と InUiElement はまだ扱わない |
| NCheckState | ScopeIdentifier, Version |  | WaitState の戻り値（bool）で IfExists / IfNotExists を if / else にする。CheckWindowActive は CheckStateOptions に無いのでまだ扱わない。InUiElement / OutUiElement も扱わない |
| NClick | ScopeIdentifier, Version |  | ターゲットは TargetAnchorableModel（FullSelectorArgument → PartialSelector、ScopeSelectorArgument → ScopeSelector）。オプションは ClickOptions。OutUiElement と ClickOffset（非推奨）はまだ扱わない |
| NDragAndDrop | ScopeIdentifier, Version, DestinationScopeIdentifier |  | DestinationInScope と InUiElement と OutUiElement はまだ扱わない |
| NExtractData | ScopeIdentifier, Version, AppendResults, DelayBetweenPages, NextLink |  | AppendResults は Coded 未対応。NextLink / DelayBetweenPages は NextPageOptions に直す表がまだ無い |
| NFillForm | ScopeIdentifier, Version, Timeout, DelayBefore, DelayAfter, HealingAgentBehavior, AgentType, InteractionMode, Target |  | uiAutomation.FillForm(FillFormOptions)（Target は取らない。画面全体が対象）。セマンティック（クラウドの AI）が要るので run していない（Coded が動くかは未確認）。AgentType / InteractionMode / Timeout / DelayBefore / DelayAfter / HealingAgentBehavior は Coded 未対応 |
| NGetAttributeGeneric | ScopeIdentifier, Version |  | 型引数 T は string の戻り値で受ける。OutUiElement と InUiElement はまだ扱わない |
| NGetClipboard | ScopeIdentifier, Version, Target |  | クリップボードはターゲットを使わないので Target は捨てる（uiAutomation のサービスを直接呼ぶ） |
| NGetText | ScopeIdentifier, Version |  | 戻り値（string）を TextString か Text で受ける（両方は書けない）。WordsInfo と OutUiElement はまだ扱わない |
| NGetUrl | ScopeIdentifier, Version, Target, WaitForReady |  | GetUrl は対象のブラウザを app から取るので Target は使わない。WaitForReady は GetUrlOptions に無い（Coded 未対応） |
| NGoToUrl | ScopeIdentifier, Version, Target, Mode |  | GoToUrl は対象のブラウザを app から取るので Target は使わない。Mode（OpenInSameTab / OpenInNewTab）は GoToUrlOptions に無い（Coded 未対応） |
| NHideStatusWindow | ScopeIdentifier, Version, Target, Timeout, DelayAfter, DelayBefore, HealingAgentBehavior |  | HideStatusWindow() は引数が無い（Timeout などは Coded 未対応） |
| NHighlight | ScopeIdentifier, Version |  | Color は XAML では Gold のような色名（属性）、Coded では System.Drawing.KnownColor のメンバー |
| NHover | ScopeIdentifier, Version |  | OutUiElement と InUiElement はまだ扱わない |
| NKeyboardShortcuts | ScopeIdentifier, Version, Shortcuts |  | ShortcutsArgument（式）を KeyboardShortcutOptions.Shortcuts に渡す。古い属性 Shortcuts は使わない |
| NMouseScroll | ScopeIdentifier, Version |  | SearchedElement は SearchedElementOptions（Target と Timeout） |
| NSAPCallTransaction | ScopeIdentifier, Version, ForceRefreshView, RequiresInitialization, Target |  | Coded は UiTargetApp.SAPCallTransaction(SAPCallTransactionOptions)。ターゲットを取らないので Target は捨てる（SAP のセッションは Use Application の app）。OutUiElement は扱わない |
| NSAPClickToolbarButton | ScopeIdentifier, Version, ForceRefreshView, RequiresInitialization, Items |  | SelectItemOptions を使う。OutUiElement は扱わない。Items は Browsable(false) の一覧で、入力は Item。Coded のオプションには Item（単数）しか無いので捨てる |
| NSAPExpandALVTree | ScopeIdentifier, Version, ForceRefreshView, RequiresInitialization |  | SAPExpandALVTreeOptions を使う。OutUiElement は扱わない |
| NSAPExpandTree | ScopeIdentifier, Version, ForceRefreshView, RequiresInitialization, AlterIfDisabled, ExpandedNodeElement, Items |  | アクティビティの Item を SAPExpandTreeOptions.Path に写す。AlterIfDisabled（オプションに無い）、ExpandedNodeElement / OutUiElement は Coded 未対応。Items は Browsable(false) の一覧で、入力は Item。Coded のオプションには Item（単数）しか無いので捨てる |
| NSAPReadStatusbar | Description, ScopeIdentifier, Version, ForceRefreshView, RequiresInitialization, Target |  | 戻り値 SAPReadStatusbarResult の5つの項目を out に写す（5つとも IR に要る。IR に無いオプションは Studio の既定 30 / 0.3 / 0.2 / SameAsCard）。ターゲットは取らないので Target は捨てる |
| NSAPSelectDatesInCalendar | ScopeIdentifier, Version, ForceRefreshView, RequiresInitialization |  | SAPSelectDatesInCalendarOptions を使う。OutUiElement は扱わない |
| NSAPSelectMenuItem | ScopeIdentifier, Version, ForceRefreshView, RequiresInitialization, Target, Items |  | SAPSelectMenuItem(SelectItemOptions) を使う。ターゲットは取らないので Target は捨てる。Items は Browsable(false) の一覧で、入力は Item。Coded のオプションには Item（単数）しか無いので捨てる |
| NSelectItem | ScopeIdentifier, Version, Items |  | OutUiElement と InUiElement はまだ扱わない。Items は Browsable(false) の一覧で、入力は Item。Coded のオプションには Item（単数）しか無いので捨てる |
| NSetClipboard | ScopeIdentifier, Version, Target |  | クリップボードはターゲットを使わないので Target は捨てる（uiAutomation のサービスを直接呼ぶ） |
| NSetCVServer | ScopeIdentifier, Version, Timeout, DelayBefore, DelayAfter, HealingAgentBehavior |  | SetCVServer(string server, string apiKey, bool useLocalServer)。3つは「まとめて」適用されるので、IR にも3つ書く（ApiKey / UseLocalServer を省くと引数ごと省かれ、build が落ちる）。CV サーバーが無いので run していない |
| NSetProjectSetting | ScopeIdentifier, Version, Timeout, DelayBefore, DelayAfter, HealingAgentBehavior |  | SetProjectSetting(string, object)。Timeout / DelayBefore / DelayAfter / HealingAgentBehavior は Coded 未対応 |
| NSetRuntimeBrowser | ScopeIdentifier, Version, Timeout, DelayBefore, DelayAfter, HealingAgentBehavior |  | SetRuntimeBrowser(NBrowserType) を使う。Timeout / DelayBefore / DelayAfter / HealingAgentBehavior は Coded 未対応 |
| NSetValue | ScopeIdentifier, Version, Timeout, DelayBefore, DelayAfter, HealingAgentBehavior, AgentType, InteractionMode |  | UiTargetApp.SetValue(target, SetValueOptions)。セマンティック（クラウドの AI）が要るので run していない（Coded が動くかは未確認）。AgentType / InteractionMode / Timeout / DelayBefore / DelayAfter / HealingAgentBehavior は Coded 未対応 |
| NShowStatusMessage | ScopeIdentifier, Version, Target |  | ステータス ウィンドウはターゲットを使わないので Target は捨てる |
| NShowStatusWindow | ScopeIdentifier, Version, Target |  | ステータス ウィンドウはターゲットを使わないので Target は捨てる。HistoryCount は StatusWindowOptions.MaxHistoryCount |
| NTakeScreenshot | ScopeIdentifier, Version, SaveScreenshotTo, IsDesktop, FileNameMode, DelayBeforeScreenshot, OutFile, SavedTo |  | Coded は FileName にファイルとして保存するだけ。SaveScreenshotTo（File 以外）、IsDesktop、FileNameMode、DelayBeforeScreenshot、OutFile、SavedTo は Coded 未対応 |
| NTypeInto | ScopeIdentifier, Version |  | Text / SecureText は TypeIntoOptions に入れる（TypeInto(target, options)）。OutUiElement と ClickOffset（非推奨）はまだ扱わない |
| NUnblockUserInput | ScopeIdentifier, Version, Timeout, DelayBefore, DelayAfter, HealingAgentBehavior |  | uiAutomation.UnblockUserInput()。引数なし。Timeout / DelayBefore / DelayAfter / HealingAgentBehavior は Coded 未対応 |
| NWindowOperation | ScopeIdentifier, Version, Timeout, DelayBefore, DelayAfter, HealingAgentBehavior |  | WindowOperationOptions に無い Timeout / DelayBefore / DelayAfter / ContinueOnError / HealingAgentBehavior は Coded 未対応（ContinueOnError は生成器の try / catch）。OutUiElement と InUiElement はまだ扱わない |

## UI のオブジェクト（tools/ir/uia.ts の codedModels で null のもの）

| 型 | 捨てられるプロパティ |
| --- | --- |
| UiPath.UIAutomationNext.Activities.SearchedElement | DisplayName, InUiElement, OutUiElement |
| UiPath.UIAutomationNext.Activities.VerifyExecutionOptions | DisplayName |
| UiPath.UIAutomationNext.Activities.VerifyExecutionTypeIntoOptions | DisplayName |
| UiPath.UIAutomationNext.RegionOffset | Area, IsAreaResolved |
| UiPath.UIAutomationNext.TargetAnchorable | Version, DesignTimeRectangle, DesignTimeScaleFactor, InformativeScreenshot, ContentHash, BrowserURL, IsResponsive |
| UiPath.UIAutomationNext.TargetApp | Version, Area, IconBase64, InformativeScreenshot, ContentHash |

## UI のオブジェクト：書くと C# を作れないもの（CODED_UNSUPPORTED）

| プロパティ | 理由 |
| --- | --- |
| UiPath.UIAutomationNext.TargetAnchorable.Anchors | アンカーは Coded のモデル（TargetAnchorableModel）に無い |
| UiPath.UIAutomationNext.TargetAnchorable.SemanticTextArgument | SemanticTexts（配列）への変換はまだ無い |
| UiPath.UIAutomationNext.TargetApp.WorkingDirectory | Coded では TargetAppOptions.WorkingDirectory。NApplicationCard の対応表ではまだ扱っていない |
