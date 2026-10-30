# プロパティの網羅

`node tools/ir/coverage.ts` が生成する。手で直さない。

カタログ（非推奨・非表示を除く）の全プロパティを、IR で書けるかで分けた。「サンプルで使用」は `samples/ir/**` の IR で実際に書いたプロパティ。「Coded」は `mappings/` の対応表の状態。

| パッケージ | アクティビティ | プロパティ | 書ける | 書けない | サンプルで使用 | Coded 対応表あり / C# の構文 / API なし / 未作成 |
| --- | --- | --- | --- | --- | --- | --- |
| System.Activities | 123 | 606 | 562 | 44 | 28 | 2 / 11 / 0 / 110 |
| UiPath.Excel.Activities | 121 | 722 | 713 | 9 | 58 | 8 / 0 / 0 / 113 |
| UiPath.System.Activities | 171 | 1054 | 1012 | 42 | 292 | 29 / 5 / 11 / 126 |
| UiPath.UIAutomation.Activities | 108 | 1581 | 1559 | 22 | 53 | 4 / 0 / 1 / 103 |

## 書けないプロパティ（理由別）

| 理由 | 数 | 方針 |
| --- | --- | --- |
| コレクション | 44 | List / Collection / 配列の値。要素構文（`<Prop><scg:List>…</scg:List></Prop>`）が要る。IR では JSON の配列で書き、生成器が要素構文にする方針。必要になったアクティビティのイシューで対応する |
| オブジェクト | 31 | CultureInfo、フィルター設定などの複合型。型ごとに XAML の書き方を get-default-xaml で確かめてから対応する |
| Studio の内部 | 23 |  |
| ActivityFunc | 19 | 戻り値のある delegate（RetryScope.Condition など）。IR に `func` の書き方を足す必要がある |

対応済みの書き方: Dictionary<String, Argument> は IR の `dicts`、System.Type は型名の文字列（`{x:Type}` で出す）、Nullable<T> は属性。

## アクティビティごと

### System.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| Add | 4/4 | - | - | 未作成 |
| AddToCollection | 3/3 | - | Collection, Item | あり |
| AddValidationError | 4/4 | - | - | 未作成 |
| And | 3/3 | - | - | 未作成 |
| AndAlso | 4/4 | - | - | 未作成 |
| ArgumentReference | 2/3 | LocationReference（オブジェクト） | - | 未作成 |
| ArgumentValue | 2/3 | LocationReference（オブジェクト） | - | 未作成 |
| ArrayItemReference | 3/3 | - | - | 未作成 |
| ArrayItemValue | 3/3 | - | - | 未作成 |
| As | 2/2 | - | - | 未作成 |
| AssertValidation | 5/5 | - | - | 未作成 |
| Assign | 3/3 | - | DisplayName, To, Value | C# の構文 |
| Assign`1 | 3/3 | - | DisplayName, To, Value | C# の構文 |
| CancellationScope | 4/4 | - | - | 未作成 |
| Cast | 3/3 | - | - | 未作成 |
| ClearCollection | 2/2 | - | - | 未作成 |
| CompensableActivity | 7/7 | - | - | 未作成 |
| Compensate | 2/2 | - | - | 未作成 |
| Confirm | 2/2 | - | - | 未作成 |
| Constraint | 2/2 | - | - | 未作成 |
| CreateBookmarkScope | 2/2 | - | - | 未作成 |
| Delay | 2/2 | - | Duration | あり |
| DelegateArgumentReference | 1/3 | DelegateArgument（オブジェクト）, LocationReference（オブジェクト） | - | 未作成 |
| DelegateArgumentValue | 1/3 | DelegateArgument（オブジェクト）, LocationReference（オブジェクト） | - | 未作成 |
| DeleteBookmarkScope | 2/2 | - | - | 未作成 |
| Divide | 3/3 | - | - | 未作成 |
| DoWhile | 4/4 | - | Body, Condition, DisplayName | C# の構文 |
| DynamicActivity | 1/1 | - | - | 未作成 |
| DynamicActivity`1 | 1/1 | - | - | 未作成 |
| EnvironmentLocationReference | 1/2 | LocationReference（オブジェクト） | - | 未作成 |
| EnvironmentLocationValue | 1/2 | LocationReference（オブジェクト） | - | 未作成 |
| Equal | 3/3 | - | - | 未作成 |
| ExistsInCollection`1 | 3/3 | - | - | 未作成 |
| FieldReference | 3/3 | - | - | 未作成 |
| FieldValue | 3/3 | - | - | 未作成 |
| Flowchart | 3/5 | Nodes（コレクション）, StartNode（オブジェクト） | - | 未作成 |
| ForEach`1 | 3/3 | - | - | C# の構文 |
| FuncReference | 1/1 | - | - | 未作成 |
| FuncValue | 1/1 | - | - | 未作成 |
| GetChildSubtree | 3/3 | - | - | 未作成 |
| GetParentChain | 3/3 | - | - | 未作成 |
| GetWorkflowTree | 3/3 | - | - | 未作成 |
| GreaterThan | 3/3 | - | - | 未作成 |
| GreaterThanOrEqual | 3/3 | - | - | 未作成 |
| HandleScope | 3/3 | - | - | 未作成 |
| If | 4/4 | - | Condition, DisplayName, Else, Then | C# の構文 |
| IndexerReference | 2/3 | Indices（コレクション） | - | 未作成 |
| InvokeAction | 2/2 | - | - | 未作成 |
| InvokeAction`1 | 3/3 | - | - | 未作成 |
| InvokeAction`2 | 4/4 | - | - | 未作成 |
| InvokeAction`3 | 5/5 | - | - | 未作成 |
| InvokeAction`4 | 6/6 | - | - | 未作成 |
| InvokeAction`5 | 7/7 | - | - | 未作成 |
| InvokeAction`6 | 8/8 | - | - | 未作成 |
| InvokeAction`7 | 9/9 | - | - | 未作成 |
| InvokeAction`8 | 10/10 | - | - | 未作成 |
| InvokeAction`9 | 11/11 | - | - | 未作成 |
| InvokeAction`10 | 12/12 | - | - | 未作成 |
| InvokeAction`11 | 13/13 | - | - | 未作成 |
| InvokeAction`12 | 14/14 | - | - | 未作成 |
| InvokeAction`13 | 15/15 | - | - | 未作成 |
| InvokeAction`14 | 16/16 | - | - | 未作成 |
| InvokeAction`15 | 17/17 | - | - | 未作成 |
| InvokeAction`16 | 18/18 | - | - | 未作成 |
| InvokeDelegate | 4/4 | - | - | 未作成 |
| InvokeFunc`1 | 1/2 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`2 | 2/3 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`3 | 3/4 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`4 | 4/5 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`5 | 5/6 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`6 | 6/7 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`7 | 7/8 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`8 | 8/9 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`9 | 9/10 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`10 | 10/11 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`11 | 11/12 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`12 | 12/13 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`13 | 13/14 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`14 | 14/15 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`15 | 15/16 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`16 | 16/17 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`17 | 17/18 | Func（ActivityFunc） | - | 未作成 |
| InvokeMethod`1 | 5/7 | GenericTypeArguments（コレクション）, Parameters（コレクション） | - | 未作成 |
| InvokeMethod | 6/8 | GenericTypeArguments（コレクション）, Parameters（コレクション） | - | 未作成 |
| LambdaReference | 1/1 | - | - | 未作成 |
| LambdaValue | 1/1 | - | - | 未作成 |
| LessThan | 3/3 | - | - | 未作成 |
| LessThanOrEqual | 3/3 | - | - | 未作成 |
| Literal | 1/2 | Value（オブジェクト） | - | 未作成 |
| MultidimensionalArrayItemReference | 2/3 | Indices（コレクション） | - | 未作成 |
| Multiply | 4/4 | - | - | 未作成 |
| New | 1/2 | Arguments（コレクション） | - | 未作成 |
| NewArray | 1/2 | Bounds（コレクション） | - | 未作成 |
| NoPersistScope | 2/2 | - | - | 未作成 |
| Not | 2/2 | - | - | 未作成 |
| NotEqual | 3/3 | - | - | 未作成 |
| Or | 3/3 | - | - | 未作成 |
| OrElse | 4/4 | - | - | 未作成 |
| Parallel | 4/4 | - | - | 未作成 |
| ParallelForEach | 4/4 | - | - | 未作成 |
| Persist | 1/1 | - | - | 未作成 |
| Pick | 1/2 | Branches（コレクション） | - | 未作成 |
| PropertyReference | 3/3 | - | - | 未作成 |
| PropertyValue | 3/3 | - | - | 未作成 |
| Reference | 1/1 | - | - | 未作成 |
| RemoveFromCollection`1 | 3/3 | - | - | 未作成 |
| Rethrow | 1/1 | - | - | C# の構文 |
| Sequence | 3/3 | - | - | C# の構文 |
| StateMachine | 2/4 | InitialState（オブジェクト）, States（コレクション） | - | 未作成 |
| Subtract | 4/4 | - | - | 未作成 |
| Switch | 4/4 | - | Cases, Default, DisplayName, Expression | C# の構文 |
| TerminateWorkflow | 3/3 | - | - | 未作成 |
| Throw | 2/2 | - | Exception | C# の構文 |
| TransactionScope | 5/5 | - | - | 未作成 |
| TryCatch | 5/5 | - | Catches, DisplayName, Finally, Try | C# の構文 |
| Value | 1/1 | - | - | 未作成 |
| ValueTypeFieldReference | 3/3 | - | - | 未作成 |
| ValueTypeIndexerReference | 2/3 | Indices（コレクション） | - | 未作成 |
| ValueTypePropertyReference | 3/3 | - | - | 未作成 |
| VariableReference | 1/3 | LocationReference（オブジェクト）, Variable（オブジェクト） | - | 未作成 |
| VariableValue | 1/3 | LocationReference（オブジェクト）, Variable（オブジェクト） | - | 未作成 |
| While | 4/4 | - | Body, Condition, DisplayName | C# の構文 |
| WriteLine | 3/3 | - | - | 未作成 |

### UiPath.Excel.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| AddSensitivityLabelX | 4/4 | - | - | 未作成 |
| AppendCsvFile | 6/6 | - | - | 未作成 |
| AppendRange | 8/8 | - | - | 未作成 |
| AppendRangeX | 8/8 | - | - | 未作成 |
| AppendWriteCsvFile | 10/10 | - | - | 未作成 |
| AutoFillX | 2/2 | - | - | 未作成 |
| AutoFitX | 4/4 | - | - | 未作成 |
| ChangeDataRangeModification | 2/2 | - | - | 未作成 |
| ChangePivotTableDataSourceX | 3/3 | - | - | 未作成 |
| ClearRangeX | 3/3 | - | - | 未作成 |
| CloseWorkbook | 2/2 | - | - | 未作成 |
| CopyChartToClipboardX | 5/5 | - | - | 未作成 |
| CopyPasteRangeX | 7/7 | - | - | 未作成 |
| CreateNewWorkbook | 9/9 | - | - | 未作成 |
| CreatePivotTable | 16/17 | PivotTableFields（コレクション） | - | 未作成 |
| CreatePivotTableXv2 | 9/9 | - | - | 未作成 |
| CreateTableX | 6/6 | - | - | 未作成 |
| DeleteColumnX | 4/4 | - | - | 未作成 |
| DeleteRowsX | 5/5 | - | - | 未作成 |
| DeleteSheetX | 2/2 | - | - | 未作成 |
| DuplicateSheetX | 3/3 | - | - | 未作成 |
| ExcelAppendRange | 4/4 | - | - | 未作成 |
| ExcelApplicationCard | 18/18 | - | AutoSave, Body, CreateNewFile, EditPassword, KeepExcelFileOpen, Password, ReadFormatting, ReadOnly, ResizeWindow, SecureEditPassword, SecurePassword, SensitivityLabel, SensitivityOperation, TemplatePath, UseTemplate, Visible, WorkbookPath | あり |
| ExcelApplicationScope | 18/18 | - | AutoSave, Body, CreateNewFile, DisplayName, EditPassword, ExistingWorkbook, InstanceCachePeriod, MacroSetting, Password, ReadOnly, SecureEditPassword, SecurePassword, SensitivityLabel, SensitivityOperation, StartAsProcess, Visible, Workbook, WorkbookPath | あり |
| ExcelAutoFillRange | 5/5 | - | - | 未作成 |
| ExcelCloseWorkbook | 2/2 | - | - | 未作成 |
| ExcelCopyPasteRange | 7/7 | - | - | 未作成 |
| ExcelCopySheet | 5/5 | - | - | 未作成 |
| ExcelCreatePivotTable | 6/6 | - | - | 未作成 |
| ExcelCreateTable | 5/5 | - | - | 未作成 |
| ExcelDeleteColumn | 5/5 | - | - | 未作成 |
| ExcelDeleteRange | 6/6 | - | - | 未作成 |
| ExcelFilterTable | 6/6 | - | - | 未作成 |
| ExcelForEachRowX | 6/6 | - | - | 未作成 |
| ExcelGetCellColor | 5/5 | - | - | 未作成 |
| ExcelGetSelectedRange | 2/2 | - | - | 未作成 |
| ExcelGetTableRange | 6/6 | - | - | 未作成 |
| ExcelGetWorkbookSheet | 3/3 | - | - | 未作成 |
| ExcelGetWorkbookSheets | 2/2 | - | - | 未作成 |
| ExcelInsertColumn | 6/6 | - | - | 未作成 |
| ExcelInsertDeleteColumns | 6/6 | - | - | 未作成 |
| ExcelInsertDeleteRows | 6/6 | - | - | 未作成 |
| ExcelLookUpRange | 5/5 | - | - | 未作成 |
| ExcelProcessScopeX | 10/10 | - | - | あり |
| ExcelReadCell | 5/5 | - | Cell, DisplayName, PreserveFormat, Result, SheetName | あり |
| ExcelReadCellFormula | 5/5 | - | - | 未作成 |
| ExcelReadColumn | 5/5 | - | - | 未作成 |
| ExcelReadRange | 8/8 | - | - | 未作成 |
| ExcelReadRow | 5/5 | - | - | 未作成 |
| ExcelRefreshPivotTable | 4/4 | - | - | 未作成 |
| ExcelRemoveDuplicatesRange | 4/4 | - | - | 未作成 |
| ExcelSaveWorkbook | 1/1 | - | - | 未作成 |
| ExcelSelectRange | 4/4 | - | - | 未作成 |
| ExcelSetRangeColor | 5/5 | - | - | 未作成 |
| ExcelSortTable | 6/6 | - | - | 未作成 |
| ExcelWriteCell | 5/5 | - | - | 未作成 |
| ExcelWriteRange | 6/6 | - | - | 未作成 |
| ExecuteMacro | 8/8 | - | - | 未作成 |
| ExecuteMacroX | 6/6 | - | - | 未作成 |
| ExportExcelToCsvX | 3/3 | - | - | 未作成 |
| FillRangeX | 3/3 | - | - | 未作成 |
| FilterPivotTableX | 4/5 | FilterArgument（オブジェクト） | - | 未作成 |
| FilterX | 5/6 | FilterArgument（オブジェクト） | - | 未作成 |
| FindFirstLastDataRowX | 11/11 | - | - | 未作成 |
| FindReplaceValueX | 9/9 | - | - | 未作成 |
| ForEachSheetX | 3/3 | - | - | 未作成 |
| FormatRangeX | 2/5 | Alignment（オブジェクト）, Font（オブジェクト）, Format（オブジェクト） | - | 未作成 |
| GetCellColor | 9/9 | - | - | 未作成 |
| GetCellColorX | 3/3 | - | - | 未作成 |
| GetSelectedRangeX | 3/3 | - | - | 未作成 |
| GetSensitivityLabelX | 3/3 | - | - | 未作成 |
| GetSheets | 7/7 | - | - | 未作成 |
| GetTableRange | 10/10 | - | - | 未作成 |
| InsertChart | 18/18 | - | - | 未作成 |
| InsertColumnX | 6/7 | ColumnFormat（オブジェクト） | - | 未作成 |
| InsertExcelChartX | 10/10 | - | - | 未作成 |
| InsertImage | 14/14 | - | - | 未作成 |
| InsertRowsX | 6/6 | - | - | 未作成 |
| InsertSheetX | 4/4 | - | - | 未作成 |
| InvokeVBA | 5/5 | - | - | 未作成 |
| InvokeVBAX | 7/7 | - | - | 未作成 |
| LookupX | 5/5 | - | - | 未作成 |
| MatchFunctionX | 5/5 | - | - | 未作成 |
| ModifyChartTitleModification | 3/3 | - | - | 未作成 |
| OpenWorkbook | 5/5 | - | - | 未作成 |
| ProtectSheetX | 6/6 | - | - | 未作成 |
| ReadCell | 9/9 | - | - | 未作成 |
| ReadCellFormula | 8/8 | - | - | 未作成 |
| ReadCellFormulaX | 3/3 | - | - | 未作成 |
| ReadCellValueX | 4/4 | - | Cell, DisplayName, GetFormattedText, SaveTo | あり |
| ReadColumn | 9/9 | - | - | 未作成 |
| ReadCsvFile | 9/9 | - | - | 未作成 |
| ReadRange | 11/11 | - | - | 未作成 |
| ReadRangeX | 6/6 | - | DisplayName, HasHeaders, Range, ReadFormatting, SaveTo, VisibleOnly | あり |
| ReadRow | 9/9 | - | - | 未作成 |
| RefreshDataConnectionsX | 2/2 | - | - | 未作成 |
| RefreshPivotTableX | 3/3 | - | - | 未作成 |
| RemoveDuplicatesX | 4/5 | Columns（コレクション） | - | 未作成 |
| RenameSheetX | 3/3 | - | - | 未作成 |
| SaveAsPdfX | 7/7 | - | - | 未作成 |
| SaveExcelFileAsX | 5/5 | - | - | 未作成 |
| SaveExcelFileX | 2/2 | - | - | 未作成 |
| SelectRangeX | 2/2 | - | - | 未作成 |
| SequenceX | 3/3 | - | - | 未作成 |
| SetRangeColor | 9/9 | - | - | 未作成 |
| ShowHideDataLabelsModification | 2/2 | - | - | 未作成 |
| ShowHideLegendModification | 2/2 | - | - | 未作成 |
| SortX | 5/5 | - | - | 未作成 |
| TextToColumnsX | 14/14 | - | - | 未作成 |
| UnprotectSheetX | 5/5 | - | - | 未作成 |
| UpdateAxisBoundsModification | 4/4 | - | - | 未作成 |
| UpdateAxisTitleModification | 4/4 | - | - | 未作成 |
| UpdateChart | 8/9 | Modifications（コレクション） | - | 未作成 |
| UpdateChartX | 4/4 | - | - | 未作成 |
| VLookupX | 6/6 | - | - | 未作成 |
| WithWorkbook | 6/6 | - | - | 未作成 |
| WriteCell | 9/9 | - | - | 未作成 |
| WriteCellX | 4/4 | - | AutoIncrementRow, Cell, Value | あり |
| WriteCsvFile | 8/8 | - | - | 未作成 |
| WriteRange | 10/10 | - | - | 未作成 |
| WriteRangeX | 6/6 | - | Append, Destination, ExcludeHeaders, IgnoreEmptySource, Source | あり |

### UiPath.System.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| AddDataColumn | 9/9 | - | - | 未作成 |
| AddDataRow | 4/4 | - | - | 未作成 |
| AddLogFields | 2/2 | - | DisplayName, Fields | なし（Coded API なし（基底クラスの Log の additionalLogFields で、ログ1件ごとに渡す）） |
| AddOrSubtractFromDate | 6/6 | - | - | 未作成 |
| AddQueueItem | 11/12 | BindingsKey（Studio の内部） | ContinueOnError, DeferDate, DisplayName, DueDate, FolderPath, ItemInformation, ItemInformationCollection, Priority, QueueType, Reference, TimeoutMS | あり |
| AddSubtractTimePeriodDateModification | 4/4 | - | - | 未作成 |
| AddTransactionItem | 11/12 | BindingsKey（Studio の内部） | ContinueOnError, DisplayName, FolderPath, QueueType, Reference, SpecificData, TimeoutMS, TransactionInformation, TransactionInformationVariable, TransactionItem | あり |
| AppendItemToCollection | 2/3 | Items（コレクション） | - | 未作成 |
| AppendItemToList | 4/4 | - | - | 未作成 |
| AppendLine | 7/7 | - | - | 未作成 |
| AskWhenRun | 1/1 | - | - | 未作成 |
| Beep | 1/1 | - | - | 未作成 |
| BeginProcess | 8/8 | - | - | 未作成 |
| Break | 1/1 | - | - | C# の構文 |
| BuildCollection | 3/4 | NextItems（コレクション） | - | 未作成 |
| BuildDataTable | 3/3 | - | - | 未作成 |
| BulkAddQueueItems | 8/9 | BindingsKey（Studio の内部） | CommitType, ContinueOnError, DisplayName, FolderPath, QueueItemsDataTable, QueueName, Result, TimeoutMS | あり |
| ChangeCase | 4/4 | - | - | 未作成 |
| ChangeType | 3/4 | Format（オブジェクト） | - | 未作成 |
| CheckFalse | 4/4 | - | - | 未作成 |
| CheckTrue | 4/4 | - | - | 未作成 |
| ClearDataTable | 2/2 | - | - | 未作成 |
| CollectionToDataTable | 3/3 | - | - | 未作成 |
| CombineText | 5/5 | - | - | 未作成 |
| Comment | 2/2 | - | - | 未作成 |
| CommentOut | 2/2 | - | - | 未作成 |
| CompressFiles | 13/14 | ContentToArchive（コレクション） | - | 未作成 |
| Continue | 1/1 | - | - | C# の構文 |
| CopyFile | 7/7 | - | - | 未作成 |
| CopyFolderX | 8/8 | - | - | 未作成 |
| CreateDirectory | 4/4 | - | - | 未作成 |
| CreateFile | 6/6 | - | - | 未作成 |
| CreateList | 2/2 | - | - | 未作成 |
| CustomInput | 6/6 | - | - | 未作成 |
| Delete | 4/4 | - | - | 未作成 |
| DeleteFileX | 3/3 | - | - | 未作成 |
| DeleteFolderX | 4/4 | - | - | 未作成 |
| DeleteQueueItems | 4/4 | - | ContinueOnError, DisplayName, QueueItems, TimeoutMS | あり |
| DeleteStorageFile | 6/7 | BindingsKey（Studio の内部） | ContinueOnError, DisplayName, FolderPath, Path, StorageBucketName, TimeoutMS | あり |
| DisableTrigger | 2/2 | - | - | 未作成 |
| DownloadFileFromUrl | 8/8 | - | - | 未作成 |
| DownloadStorageFile | 8/9 | BindingsKey（Studio の内部） | ContinueOnError, Destination, DisplayName, FolderPath, Path, Result, StorageBucketName, TimeoutMS | あり |
| EnableTrigger | 2/2 | - | - | 未作成 |
| EvaluateBusinessRule | 11/12 | BindingsKey（Studio の内部） | - | 未作成 |
| ExecutePowerShell | 7/7 | - | - | 未作成 |
| ExistsInCollection`1 | 5/5 | - | - | 未作成 |
| ExtractDateTime | 5/6 | LocalizationCode（オブジェクト） | - | 未作成 |
| ExtractFiles | 12/12 | - | - | 未作成 |
| ExtractText | 11/11 | - | - | 未作成 |
| FileChangeTrigger | 6/6 | - | - | 未作成 |
| FileChangeTriggerV2 | 9/9 | - | - | 未作成 |
| FileChangeTriggerV3 | 9/9 | - | - | 未作成 |
| FileExistsX | 3/3 | - | - | 未作成 |
| FilterCollection | 3/4 | Filter（オブジェクト） | - | 未作成 |
| FilterDataTable | 5/7 | Filters（コレクション）, SelectColumns（コレクション） | - | 未作成 |
| FindAndReplace | 6/6 | - | - | 未作成 |
| FindDayOfWeekDateModification | 3/3 | - | - | 未作成 |
| FindStartEndDateModification | 3/3 | - | - | 未作成 |
| FolderExistsX | 3/3 | - | - | 未作成 |
| ForEach`1 | 6/6 | - | Body, DisplayName, Values | C# の構文 |
| ForEachFileX | 7/7 | - | - | 未作成 |
| ForEachFolderX | 7/7 | - | - | 未作成 |
| ForEachRow | 10/10 | - | - | 未作成 |
| FormatDateAsText | 4/5 | LocalizationCode（オブジェクト） | - | 未作成 |
| FormatValue | 2/3 | Format（オブジェクト） | - | 未作成 |
| GenerateDataTable | 16/16 | - | - | 未作成 |
| GetCurrentJobInfo | 2/2 | - | DisplayName, Result | なし（Coded API なし（ISystemService に GetCurrentJobInfo が無い。docs の Notes には「Coded 対応」とあるが、26.10.0 のサービス API には出ていない）） |
| GetEnvironmentFolder | 3/3 | - | - | 未作成 |
| GetEnvironmentVariable | 4/4 | - | - | 未作成 |
| GetFileInfoX | 3/3 | - | - | 未作成 |
| GetFolderInfoX | 4/4 | - | - | 未作成 |
| GetJobs | 8/9 | FilterBuilder（オブジェクト） | ContinueOnError, DisplayName, Filter, FolderPath, Result, Skip, TimeoutMS, Top | あり |
| GetLastDownloadedFile | 7/7 | - | - | 未作成 |
| GetProcesses | 3/3 | - | - | 未作成 |
| GetQueueItem | 9/10 | BindingsKey（Studio の内部） | ContinueOnError, DisplayName, FilterStrategy, FolderPath, QueueType, Reference, SpecificData, TimeoutMS, TransactionItem | あり |
| GetQueueItems | 19/21 | BindingsKey（Studio の内部）, FilterBuilder（オブジェクト） | ContinueOnError, ConvertDatesToLocalTime, DisplayName, Duration, FilterByCurrentRobot, FilterStrategy, FolderPath, From, Priority, QueueItemStates, QueueName, Reference, Result, Skip, TimeoutMS, To, Top | あり |
| GetRobotAsset | 6/7 | BindingsKey（Studio の内部） | AssetName, CacheStrategy, DisplayName, FolderPath, TimeoutMS, Value | あり |
| GetRobotCredential | 7/8 | BindingsKey（Studio の内部） | AssetName, CacheStrategy, DisplayName, FolderPath, Password, TimeoutMS, Username | あり |
| GetRowItem | 6/6 | - | - | 未作成 |
| GetSecret | 5/6 | BindingsKey（Studio の内部） | AssetName, DisplayName, FolderPath, Secret, TimeoutMS | なし（Coded API なし（ISystemService に GetSecret が無い）） |
| GetTransactionItem | 7/7 | - | - | 未作成 |
| GetUsernamePasswordX | 8/8 | - | AutosubmitTimeoutSeconds, Credential, CredentialName, CredentialsSource, DisplayName, OrchestratorCredentialName, OrchestratorFolderPath, TimeoutInSeconds | なし（Coded API なし（ISystemService に対応するメソッドが無い。認証情報の入力ダイアログを開く XAML 専用のアクティビティ）） |
| GlobalVariableChangedTrigger | 5/5 | - | - | 未作成 |
| IfElseIfV2 | 5/5 | - | - | 未作成 |
| InputDialog | 8/8 | - | - | 未作成 |
| InterruptibleDoWhile | 5/5 | - | - | 未作成 |
| InterruptibleWhile | 5/5 | - | - | 未作成 |
| InvokeCode | 5/5 | - | Arguments, Code, DisplayName, Language | なし（Coded では C# をそのまま書くので InvokeCode は要らない） |
| InvokeComMethod | 8/8 | - | - | 未作成 |
| InvokePowerShell | 8/8 | - | - | 未作成 |
| InvokeProcess | 15/16 | BindingsKey（Studio の内部） | - | 未作成 |
| InvokeVBScript | 8/9 | Arguments（コレクション） | - | 未作成 |
| InvokeWorkflowFile | 13/13 | - | Arguments, DisplayName, WorkflowFileName | あり |
| InvokeWorkflowInteractive | 18/18 | - | - | 未作成 |
| IsMatch | 9/9 | - | - | 未作成 |
| JoinDataTables | 5/6 | Arguments（コレクション） | - | 未作成 |
| KillProcess | 5/5 | - | - | 未作成 |
| ListStorageFiles | 9/10 | BindingsKey（Studio の内部） | ContinueOnError, Directory, DisplayName, Filter, FolderPath, Recursive, Result, StorageBucketName, TimeoutMS | あり |
| LookupDataTable | 11/11 | - | - | 未作成 |
| ManualTrigger | 2/2 | - | - | 未作成 |
| Matches | 10/10 | - | - | 未作成 |
| MergeCollections | 3/3 | - | - | 未作成 |
| MergeDataTable | 4/4 | - | - | 未作成 |
| ModifyDate | 10/10 | - | - | 未作成 |
| ModifyText | 5/5 | - | - | 未作成 |
| MoveFile | 7/7 | - | - | 未作成 |
| MoveFolderX | 4/4 | - | - | 未作成 |
| MultipleAssign | 2/2 | - | AssignOperations, DisplayName | C# の構文 |
| NotifyGlobalVariableChanged | 2/2 | - | - | 未作成 |
| OrchestratorHttpRequest | 10/10 | - | ContinueOnError, DisplayName, FolderPath, JSONPayload, Method, RelativeEndpoint, ResponseHeaders, Result, StatusCode, TimeoutMS | あり |
| OutputDataTable | 3/3 | - | - | 未作成 |
| PathExists | 5/5 | - | - | 未作成 |
| Placeholder | 2/2 | - | - | 未作成 |
| PostponeTransactionItem | 6/6 | - | ContinueOnError, DeferDate, DisplayName, DueDate, TimeoutMS, TransactionItem | あり |
| ProcessEndTrigger | 5/5 | - | - | 未作成 |
| ProcessEndTriggerV2 | 5/5 | - | - | 未作成 |
| ProcessStartTrigger | 5/5 | - | - | 未作成 |
| ProcessStartTriggerV2 | 5/5 | - | - | 未作成 |
| ProcessTrackingScope | 10/10 | - | DisplayName, ProcessCaseName, ProcessLogMode, ScopeId, Sequence, TaskName | なし（Coded API なし（ISystemService に Process Tracking Scope が無い）） |
| QueueTrigger | 8/9 | BindingsKey（Studio の内部） | - | 未作成 |
| RaiseAlert | 6/6 | - | ContinueOnError, DisplayName, FolderPath, Notification, Severity, TimeoutMS | あり |
| ReadListItem | 4/4 | - | - | 未作成 |
| ReadStorageText | 8/9 | BindingsKey（Studio の内部） | ContinueOnError, DisplayName, Encoding, FolderPath, Path, Result, StorageBucketName, TimeoutMS | あり |
| ReadTextFile | 6/6 | - | Content, FileName | あり |
| RemoveDataColumn | 5/5 | - | - | 未作成 |
| RemoveDataRow | 4/4 | - | - | 未作成 |
| RemoveDuplicateRows | 3/3 | - | - | 未作成 |
| RemoveFromCollection`1 | 5/5 | - | - | 未作成 |
| RemoveLogFields | 1/2 | Fields（コレクション） | - | 未作成 |
| RenameFileX | 6/6 | - | - | 未作成 |
| RenameFolderX | 3/3 | - | - | 未作成 |
| RepeatNumberOfTimesX | 4/4 | - | - | 未作成 |
| RepeatTrigger | 5/5 | - | - | 未作成 |
| Replace | 10/10 | - | - | 未作成 |
| ReportStatus | 2/2 | - | DisplayName, StatusText | なし（Coded API なし（ISystemService に ReportStatus が無い）） |
| ResetTimer | 2/2 | - | - | 未作成 |
| ResumeTimer | 2/2 | - | - | 未作成 |
| RetryScope | 8/9 | Condition（ActivityFunc） | ActivityBody, DisplayName, NumberOfRetries, RetryInterval | C# の構文 |
| Return | 1/1 | - | - | 未作成 |
| RunJob | 16/17 | BindingsKey（Studio の内部） | Account, Arguments, ContinueOnError, DisplayName, EntryPointPath, ExecutionMode, FailWhenFaulted, FolderPath, Input, Job, Machine, Output, Priority, ProcessName, RuntimeType, TimeoutMS | あり |
| SelectFile | 6/6 | - | - | 未作成 |
| SelectFolder | 2/2 | - | - | 未作成 |
| SendEmailNotification | 7/7 | - | Body, Cc, ContinueOnError, DisplayName, Recipients, Subject, TimeoutMS | なし（Coded API なし（ISystemService に SendEmailNotification が無い）） |
| SetAsset | 7/8 | BindingsKey（Studio の内部） | AssetName, ContinueOnError, DisplayName, FolderPath, JsonValue, TimeoutMS, Value | あり |
| SetCredential | 8/9 | BindingsKey（Studio の内部） | ContinueOnError, CredentialName, DisplayName, FolderPath, Password, SecurePassword, TimeoutMS, UserName | あり |
| SetEnvironmentVariable | 4/4 | - | - | 未作成 |
| SetSecret | 7/8 | BindingsKey（Studio の内部） | AssetName, ContinueOnError, DisplayName, FolderPath, SecretValue, SecureSecretValue, TimeoutMS | なし（Coded API なし（ISystemService に SetSecret が無い）） |
| SetTaskStatus | 3/3 | - | DisplayName, Status, TaskGuid | なし（Coded API なし（ISystemService に SetTaskStatus が無い）） |
| SetTraceStatus | 3/3 | - | DisplayName, Status, TraceGuid | なし（Coded API なし（ISystemService に SetTraceStatus が無い）） |
| SetTransactionProgress | 5/5 | - | ContinueOnError, DisplayName, Progress, TimeoutMS, TransactionItem | あり |
| SetTransactionStatus | 13/13 | - | Analytics, AnalyticsVariable, ContinueOnError, Details, DisplayName, ErrorType, Output, OutputVariable, Reason, Status, TimeoutMS, TransactionItem | あり |
| ShouldStop | 2/2 | - | - | 未作成 |
| SortDataTable | 7/7 | - | - | 未作成 |
| SplitText | 6/6 | - | - | 未作成 |
| StartJob | 13/14 | BindingsKey（Studio の内部） | Arguments, ArgumentsVariable, ContinueOnError, DisplayName, FolderPath, JobId, JobPriority, Key, ModernFolder, NumberOfRobots, ProcessName, ResumeOnSameContext, TimeoutMS | あり |
| StartTimer | 2/2 | - | - | 未作成 |
| StartTriggers | 13/13 | - | - | 未作成 |
| StopJob | 5/5 | - | ContinueOnError, DisplayName, Job, Strategy, TimeoutMS | あり |
| StopTimer | 2/2 | - | - | 未作成 |
| StopTriggers | 2/2 | - | - | 未作成 |
| TextToLeftRight | 8/8 | - | - | 未作成 |
| TimeoutScope | 4/4 | - | - | 未作成 |
| TimeTrigger | 14/17 | DaysOfMonthToRunOn（コレクション）, MonthlyDaysToRunOn（コレクション）, WeeklyDaysToRunOn（コレクション） | - | 未作成 |
| TrackObject | 7/7 | - | - | 未作成 |
| TriggerScope | 7/7 | - | - | 未作成 |
| UpdateListItem | 4/4 | - | - | 未作成 |
| UpdateRowItem | 5/5 | - | - | 未作成 |
| UploadStorageFile | 9/10 | BindingsKey（Studio の内部） | ContinueOnError, Destination, DisplayName, FileName, FileResource, FolderPath, Path, StorageBucketName, TimeoutMS | あり |
| WaitQueueItem | 10/11 | BindingsKey（Studio の内部） | ContinueOnError, ConvertDatesToLocalTime, DisplayName, FilterStrategy, FolderPath, PollTimeMS, QueueName, Reference, Result, TimeoutMS | あり |
| WriteStorageText | 8/9 | BindingsKey（Studio の内部） | ContinueOnError, DisplayName, Encoding, FolderPath, Path, StorageBucketName, Text, TimeoutMS | あり |
| WriteTextFile | 7/7 | - | DisplayName, FileName, Text | あり |

### UiPath.UIAutomation.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| AnchorBase | 5/5 | - | - | 未作成 |
| AnchorContextAware | 6/6 | - | - | 未作成 |
| BlockUserInput | 10/10 | - | - | 未作成 |
| CallTransaction | 6/6 | - | - | 未作成 |
| CellScope | 11/12 | ColumnNames（コレクション） | - | 未作成 |
| ClickImageTriggerV2 | 14/14 | - | - | 未作成 |
| ClickPictureOnScreen | 10/10 | - | - | 未作成 |
| ClickToolbarButton | 7/8 | Items（コレクション） | - | 未作成 |
| ClickTriggerV2 | 14/14 | - | - | 未作成 |
| CloseTab | 5/5 | - | DisplayName | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| CloseWindow | 11/11 | - | - | 未作成 |
| ExpandALVHierarchicalTable | 13/16 | AllColumns（コレクション）, ColumnsLevel0（コレクション）, ColumnsLevel1（コレクション） | - | 未作成 |
| ExpandALVTree | 6/6 | - | - | 未作成 |
| ExpandTree | 8/9 | Items（コレクション） | - | 未作成 |
| ExportUiTree | 15/15 | - | - | 未作成 |
| GetActiveWindow | 7/7 | - | - | 未作成 |
| GetPassword | 4/4 | - | - | 未作成 |
| GetSourceElementV2 | 3/3 | - | - | 未作成 |
| GoBack | 5/5 | - | - | 未作成 |
| GoForward | 5/5 | - | - | 未作成 |
| GoHome | 5/5 | - | - | 未作成 |
| HideWindow | 5/5 | - | - | 未作成 |
| HotkeyTriggerV2 | 8/8 | - | - | 未作成 |
| IndicateOnScreen | 8/8 | - | - | 未作成 |
| KeyPressTriggerV2 | 13/13 | - | - | 未作成 |
| LoadImage | 7/7 | - | - | 未作成 |
| Login | 15/15 | - | - | 未作成 |
| MaximizeWindow | 5/5 | - | - | 未作成 |
| MinimizeWindow | 5/5 | - | - | 未作成 |
| MouseTriggerV2 | 7/7 | - | - | 未作成 |
| MoveWindow | 9/9 | - | - | 未作成 |
| NAccessibilityCheck | 17/17 | - | - | 未作成 |
| NavigateTo | 6/6 | - | - | 未作成 |
| NBlockUserInput | 21/21 | - | - | 未作成 |
| NBrowserDialogScope | 21/21 | - | - | 未作成 |
| NBrowserFilePickerScope | 20/20 | - | - | 未作成 |
| NCheck | 17/17 | - | - | 未作成 |
| NCheckElement | 16/16 | - | - | 未作成 |
| NCheckState | 24/24 | - | CheckVisibility, DelayBefore, DisplayName, Exists, HealingAgentBehavior, IfExists, IfNotExists, Mode, Target, Timeout | あり |
| NClick | 25/25 | - | ActivateBefore, AlterIfDisabled, ClickType, ContinueOnError, CursorMotionType, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, InteractionMode, KeyModifiers, MouseButton, Target, Timeout, UnblockInput, VerifyOptions | あり |
| NClosePopup | 21/21 | - | - | 未作成 |
| NDragAndDrop | 25/25 | - | - | 未作成 |
| NElementScope | 19/19 | - | - | 未作成 |
| NExtractData | 24/24 | - | - | 未作成 |
| NExtractDataGeneric | 25/25 | - | - | 未作成 |
| NExtractFormDataGeneric | 17/18 | FieldMappings（コレクション） | - | 未作成 |
| NExtractUIData | 19/21 | FieldMappings（コレクション）, Queries（コレクション） | - | 未作成 |
| NFillForm | 19/19 | - | - | 未作成 |
| NFindElements | 18/18 | - | - | 未作成 |
| NForEachUiElement | 23/25 | Filter（オブジェクト）, VariablesMetadata（コレクション） | - | 未作成 |
| NGetAttributeGeneric | 17/17 | - | - | 未作成 |
| NGetBrowserData | 20/20 | - | - | 未作成 |
| NGetClipboard | 16/16 | - | - | 未作成 |
| NGetText | 21/21 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, ScrapingMethod, Target, TextString, Timeout | あり |
| NGetUrl | 17/17 | - | - | 未作成 |
| NGoToUrl | 17/17 | - | - | 未作成 |
| NHideStatusWindow | 15/15 | - | - | 未作成 |
| NHighlight | 17/18 | Color（オブジェクト） | - | 未作成 |
| NHover | 20/20 | - | - | 未作成 |
| NInjectJsScript | 19/19 | - | - | 未作成 |
| NKeyboardShortcuts | 24/24 | - | - | 未作成 |
| NMouseScroll | 22/22 | - | - | 未作成 |
| NNavigateBrowser | 16/16 | - | - | 未作成 |
| NSAPCallTransaction | 17/17 | - | - | 未作成 |
| NSAPClickPictureOnScreen | 20/20 | - | - | 未作成 |
| NSAPClickToolbarButton | 17/18 | Items（コレクション） | - | 未作成 |
| NSAPExpandALVHierarchicalTable | 21/22 | AllColumns（コレクション） | - | 未作成 |
| NSAPExpandALVTree | 16/16 | - | - | 未作成 |
| NSAPExpandTree | 18/19 | Items（コレクション） | - | 未作成 |
| NSAPLogin | 22/22 | - | - | 未作成 |
| NSAPLogon | 29/31 | AutoGenerationOptions（オブジェクト）, OCREngine（ActivityFunc） | - | 未作成 |
| NSAPReadStatusbar | 20/20 | - | - | 未作成 |
| NSAPSelectDatesInCalendar | 21/21 | - | - | 未作成 |
| NSAPSelectMenuItem | 17/18 | Items（コレクション） | - | 未作成 |
| NSAPTableCellScope | 21/22 | ColumnNames（コレクション） | - | 未作成 |
| NSaveImage | 18/18 | - | - | 未作成 |
| NSelectItem | 17/18 | Items（コレクション） | - | 未作成 |
| NSetBrowserData | 17/17 | - | - | 未作成 |
| NSetClipboard | 16/16 | - | - | 未作成 |
| NSetCVServer | 18/18 | - | - | 未作成 |
| NSetFocus | 15/15 | - | - | 未作成 |
| NSetProjectSetting | 17/17 | - | - | 未作成 |
| NSetRuntimeBrowser | 16/16 | - | - | 未作成 |
| NSetText | 18/18 | - | - | 未作成 |
| NSetValue | 19/19 | - | - | 未作成 |
| NShowStatusMessage | 19/19 | - | - | 未作成 |
| NShowStatusWindow | 24/24 | - | - | 未作成 |
| NTakeScreenshot | 23/23 | - | - | 未作成 |
| NTypeInto | 29/29 | - | ActivateBefore, AlterIfDisabled, ClickBeforeMode, ClipboardMode, ContinueOnError, DelayAfter, DelayBefore, DelayBetweenKeys, DeselectAfter, DisplayName, EmptyFieldMode, HealingAgentBehavior, InteractionMode, Target, Text, Timeout, VerifyOptions | あり |
| NUITask | 32/33 | Prompt（コレクション） | - | 未作成 |
| NUnblockUserInput | 15/15 | - | - | 未作成 |
| NWindowOperation | 20/20 | - | - | 未作成 |
| OpenApplication | 14/14 | - | - | 未作成 |
| ReadStatusbar | 8/8 | - | - | 未作成 |
| RefreshBrowser | 5/5 | - | - | 未作成 |
| ReplayUserEventV2 | 2/2 | - | - | 未作成 |
| RestoreWindow | 5/5 | - | - | 未作成 |
| SapSessionTrigger | 5/5 | - | - | 未作成 |
| SaveImage | 6/6 | - | - | 未作成 |
| SelectDatesInCalendar | 11/11 | - | - | 未作成 |
| SelectMenuItem | 7/8 | Items（コレクション） | - | 未作成 |
| SetClippingRegion | 8/8 | - | - | 未作成 |
| SetToClipboard | 5/5 | - | - | 未作成 |
| ShowWindow | 5/5 | - | - | 未作成 |
| StartProcess | 9/9 | - | - | 未作成 |
| SystemTriggerV2 | 6/6 | - | - | 未作成 |
| WaitAttribute | 8/8 | - | - | 未作成 |
| WindowScope | 13/13 | - | - | 未作成 |
