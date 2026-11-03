# プロパティの網羅

`node tools/ir/coverage.ts` が生成する。手で直さない。

カタログ（非推奨・非表示を除く）の全プロパティを、IR で書けるかで分けた。「サンプルで使用」は `samples/ir/**` の IR で実際に書いたプロパティ。「Coded」は `mappings/` の対応表の状態。

| パッケージ | アクティビティ | プロパティ | 書ける | 書けない | サンプルで使用 | Coded 対応表あり / C# の構文 / API なし / 未作成 |
| --- | --- | --- | --- | --- | --- | --- |
| System.Activities | 123 | 662 | 628 | 34 | 39 | 2 / 13 / 0 / 108 |
| UiPath.Excel.Activities | 121 | 682 | 682 | 0 | 487 | 71 / 0 / 29 / 21 |
| UiPath.Persistence.Activities | 20 | 235 | 232 | 3 | 226 | 0 / 0 / 20 / 0 |
| UiPath.System.Activities | 171 | 1032 | 1032 | 0 | 962 | 81 / 16 / 67 / 7 |
| UiPath.UIAutomation.Activities | 108 | 1576 | 1575 | 1 | 907 | 36 / 0 / 70 / 2 |

読み取り専用（public の setter が無い）のプロパティ 48 件は、そもそも XAML に書けないので上の数に入れていない（読み取り専用。`--activity` では「書けない」と出る）。

## 書けないプロパティ（理由別）

| 理由 | 数 | 方針 |
| --- | --- | --- |
| コレクション | 15 | List / Collection / 配列の値。要素構文（`<Prop><scg:List>…</scg:List></Prop>`）が要る。IR では JSON の配列で書き、生成器が要素構文にする方針。必要になったアクティビティのイシューで対応する |
| ActivityFunc | 15 | 戻り値のある delegate（RetryScope.Condition など）。IR に `func` の書き方を足す必要がある |
| オブジェクト | 8 | CultureInfo、フィルター設定などの複合型。型ごとに XAML の書き方を get-default-xaml で確かめてから対応する |

理由と、対応しないものの判断は [coverage-gaps.md](coverage-gaps.md)。

対応済みの書き方: Dictionary<String, Argument> は IR の `dicts`、System.Type は型名の文字列（`{x:Type}` で出す）、Nullable<T> は属性。

## アクティビティごと

### System.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| Add | 5/5 | - | - | 未作成 |
| AddToCollection | 3/3 | - | Collection, Item | あり |
| AddValidationError | 4/4 | - | - | 未作成 |
| And | 4/4 | - | - | 未作成 |
| AndAlso | 4/4 | - | - | 未作成 |
| ArgumentReference | 3/3 | - | - | 未作成 |
| ArgumentValue | 3/3 | - | - | 未作成 |
| ArrayItemReference | 4/4 | - | - | 未作成 |
| ArrayItemValue | 4/4 | - | - | 未作成 |
| As | 3/3 | - | - | 未作成 |
| AssertValidation | 5/5 | - | - | 未作成 |
| Assign | 3/3 | - | DisplayName, To, Value | C# の構文 |
| Assign`1 | 3/3 | - | DisplayName, To, Value | C# の構文 |
| CancellationScope | 4/4 | - | - | 未作成 |
| Cast | 4/4 | - | - | 未作成 |
| ClearCollection | 2/2 | - | - | 未作成 |
| CompensableActivity | 7/7 | - | - | 未作成 |
| Compensate | 2/2 | - | - | 未作成 |
| Confirm | 2/2 | - | - | 未作成 |
| Constraint | 2/2 | - | - | 未作成 |
| CreateBookmarkScope | 2/2 | - | - | 未作成 |
| Delay | 2/2 | - | Duration | あり |
| DelegateArgumentReference | 2/3 | DelegateArgument（オブジェクト） | - | 未作成 |
| DelegateArgumentValue | 2/3 | DelegateArgument（オブジェクト） | - | 未作成 |
| DeleteBookmarkScope | 2/2 | - | - | 未作成 |
| Divide | 4/4 | - | - | 未作成 |
| DoWhile | 4/4 | - | Body, Condition, DisplayName | C# の構文 |
| DynamicActivity | 1/1 | - | - | 未作成 |
| DynamicActivity`1 | 2/2 | - | - | 未作成 |
| EnvironmentLocationReference | 2/2 | - | - | 未作成 |
| EnvironmentLocationValue | 2/2 | - | - | 未作成 |
| Equal | 4/4 | - | - | 未作成 |
| ExistsInCollection`1 | 4/4 | - | - | 未作成 |
| FieldReference | 4/4 | - | - | 未作成 |
| FieldValue | 4/4 | - | - | 未作成 |
| Flowchart | 3/5 | Nodes（コレクション）, StartNode（オブジェクト） | - | 未作成 |
| ForEach`1 | 3/3 | - | - | C# の構文 |
| FuncReference | 2/2 | - | - | 未作成 |
| FuncValue | 2/2 | - | - | 未作成 |
| GetChildSubtree | 3/3 | - | - | 未作成 |
| GetParentChain | 3/3 | - | - | 未作成 |
| GetWorkflowTree | 3/3 | - | - | 未作成 |
| GreaterThan | 4/4 | - | - | 未作成 |
| GreaterThanOrEqual | 4/4 | - | - | 未作成 |
| HandleScope | 3/3 | - | - | 未作成 |
| If | 4/4 | - | Condition, DisplayName, Else, Then | C# の構文 |
| IndexerReference | 3/4 | Indices（コレクション） | - | 未作成 |
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
| InvokeFunc`1 | 3/3 | - | - | 未作成 |
| InvokeFunc`2 | 4/4 | - | - | 未作成 |
| InvokeFunc`3 | 4/5 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`4 | 5/6 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`5 | 6/7 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`6 | 7/8 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`7 | 8/9 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`8 | 9/10 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`9 | 10/11 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`10 | 11/12 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`11 | 12/13 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`12 | 13/14 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`13 | 14/15 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`14 | 15/16 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`15 | 16/17 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`16 | 17/18 | Func（ActivityFunc） | - | 未作成 |
| InvokeFunc`17 | 18/19 | Func（ActivityFunc） | - | 未作成 |
| InvokeMethod`1 | 6/8 | GenericTypeArguments（コレクション）, Parameters（コレクション） | - | 未作成 |
| InvokeMethod | 6/8 | GenericTypeArguments（コレクション）, Parameters（コレクション） | - | 未作成 |
| LambdaReference | 2/2 | - | - | 未作成 |
| LambdaValue | 2/2 | - | - | 未作成 |
| LessThan | 4/4 | - | - | 未作成 |
| LessThanOrEqual | 4/4 | - | - | 未作成 |
| Literal | 2/3 | Value（オブジェクト） | - | 未作成 |
| MultidimensionalArrayItemReference | 3/4 | Indices（コレクション） | - | 未作成 |
| Multiply | 5/5 | - | - | 未作成 |
| New | 2/3 | Arguments（コレクション） | - | 未作成 |
| NewArray | 2/3 | Bounds（コレクション） | - | 未作成 |
| NoPersistScope | 2/2 | - | - | 未作成 |
| Not | 3/3 | - | - | 未作成 |
| NotEqual | 4/4 | - | - | 未作成 |
| Or | 4/4 | - | - | 未作成 |
| OrElse | 4/4 | - | - | 未作成 |
| Parallel | 4/4 | - | Branches, CompletionCondition, DisplayName, Variables | C# の構文 |
| ParallelForEach | 4/4 | - | Body, CompletionCondition, DisplayName, Values | C# の構文 |
| Persist | 1/1 | - | - | 未作成 |
| Pick | 1/2 | Branches（コレクション） | - | 未作成 |
| PropertyReference | 4/4 | - | - | 未作成 |
| PropertyValue | 4/4 | - | - | 未作成 |
| Reference | 2/2 | - | - | 未作成 |
| RemoveFromCollection`1 | 4/4 | - | - | 未作成 |
| Rethrow | 1/1 | - | - | C# の構文 |
| Sequence | 3/3 | - | Activities, DisplayName, Variables | C# の構文 |
| StateMachine | 2/4 | InitialState（オブジェクト）, States（コレクション） | - | 未作成 |
| Subtract | 5/5 | - | - | 未作成 |
| Switch | 4/4 | - | Cases, Default, DisplayName, Expression | C# の構文 |
| TerminateWorkflow | 3/3 | - | - | 未作成 |
| Throw | 2/2 | - | Exception | C# の構文 |
| TransactionScope | 5/5 | - | - | 未作成 |
| TryCatch | 5/5 | - | Catches, DisplayName, Finally, Try | C# の構文 |
| Value | 2/2 | - | - | 未作成 |
| ValueTypeFieldReference | 4/4 | - | - | 未作成 |
| ValueTypeIndexerReference | 3/4 | Indices（コレクション） | - | 未作成 |
| ValueTypePropertyReference | 4/4 | - | - | 未作成 |
| VariableReference | 2/3 | Variable（オブジェクト） | - | 未作成 |
| VariableValue | 2/3 | Variable（オブジェクト） | - | 未作成 |
| While | 4/4 | - | Body, Condition, DisplayName | C# の構文 |
| WriteLine | 3/3 | - | - | 未作成 |

### UiPath.Excel.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| AddSensitivityLabelX | 4/4 | - | DisplayName, Justification, SensitivityLabel, Workbook | あり |
| AppendCsvFile | 6/6 | - | DataTable, Delimitator, DelimitatorForViewModel, DisplayName, Encoding, FilePath | あり |
| AppendRange | 7/7 | - | - | 未作成 |
| AppendRangeX | 8/8 | - | DestinationHasHeaders, DestinationRange, DisplayName, HasHeaders, PasteOptions, SourceRange, StartingColumnName, Transpose | あり |
| AppendWriteCsvFile | 10/10 | - | AddHeaders, CsvAction, DataTable, Delimitator, DelimitatorForViewModel, DisplayName, Encoding, FilePath, PathResource, ShouldQuote | あり |
| AutoFillX | 2/2 | - | DisplayName, StartRange | あり |
| AutoFitX | 4/4 | - | Columns, DisplayName, Range, Rows | あり |
| ChangeDataRangeModification | 2/2 | - | Range | なし（Coded API なし（親の UpdateChartX に同じ。UpdateChartX.json）） |
| ChangePivotTableDataSourceX | 3/3 | - | DisplayName, NewSourceRange, PivotTable | あり |
| ClearRangeX | 3/3 | - | DisplayName, HasHeaders, TargetRange | あり |
| CloseWorkbook | 2/2 | - | - | 未作成 |
| CopyChartToClipboardX | 5/5 | - | Action, Chart, DisplayName, FilePath, ReplaceFile | あり |
| CopyPasteRangeX | 7/7 | - | DestinationRange, DisplayName, ExcludeHeaderFromSourceTable, ExcludeHeaders, PasteOptions, SourceRange, Transpose | あり |
| CreateNewWorkbook | 8/8 | - | - | 未作成 |
| CreatePivotTable | 16/16 | - | - | 未作成 |
| CreatePivotTableXv2 | 7/7 | - | Body, DestinationRange, LayoutRowType, Range, TableName, ValuesMode | あり |
| CreateTableX | 6/6 | - | DisplayName, HasHeaders, OutTableName, Range, ReplaceExisting, TableName | あり |
| DeleteColumnX | 4/4 | - | ColumnName, DisplayName, HasHeaders, Range | あり |
| DeleteRowsX | 5/5 | - | DeleteRowsOption, DisplayName, HasHeaders, Range, RowPositions | あり |
| DeleteSheetX | 2/2 | - | DisplayName, Sheet | あり |
| DuplicateSheetX | 3/3 | - | DisplayName, NewSheetName, SheetToDuplicate | あり |
| ExcelAppendRange | 3/3 | - | DataTable, DisplayName, SheetName | あり |
| ExcelApplicationCard | 18/18 | - | AutoSave, Body, CreateNewFile, EditPassword, KeepExcelFileOpen, Password, ReadFormatting, ReadOnly, ResizeWindow, SecureEditPassword, SecurePassword, SensitivityLabel, SensitivityOperation, TemplatePath, UseTemplate, Visible, WorkbookPath | あり |
| ExcelApplicationScope | 18/18 | - | AutoSave, Body, CreateNewFile, DisplayName, EditPassword, ExistingWorkbook, InstanceCachePeriod, MacroSetting, Password, ReadOnly, SecureEditPassword, SecurePassword, SensitivityLabel, SensitivityOperation, StartAsProcess, Visible, Workbook, WorkbookPath | あり |
| ExcelAutoFillRange | 4/4 | - | DisplayName, FillRange, SheetName, SourceRange | なし（Coded API なし（オートフィルは IWorkHandle の拡張メソッドに無い）） |
| ExcelCloseWorkbook | 2/2 | - | DisplayName, Workbook | なし（Coded API なし（ブックは using の Dispose で閉じる。IWorkHandle に閉じるメソッドは無い）） |
| ExcelCopyPasteRange | 6/6 | - | CopyItems, DestinationCell, DestinationSheet, DisplayName, SheetName, SourceRange | なし（Coded API なし（コピー＆貼り付けは IWorkHandle の拡張メソッドに無い）） |
| ExcelCopySheet | 4/4 | - | DestinationFilePath, DestinationSheetName, DisplayName, SheetName | なし（Coded API なし（シートのコピーは IWorkHandle の拡張メソッドに無い）） |
| ExcelCreatePivotTable | 5/5 | - | DisplayName, Range, SheetName, SourceTableName, TableName | なし（Coded API なし（CreatePivotTable は IPivotTableInfo を取るが、その実体の型がカタログに無く、Excel Application Scope の元の表・範囲から作る形（SourceTableName / Range）に当たるものも無い）） |
| ExcelCreateTable | 4/4 | - | DisplayName, Range, SheetName, TableName | なし（Coded API なし（表の作成は IWorkHandle の拡張メソッドに無い）） |
| ExcelDeleteColumn | 4/4 | - | ColumnName, DisplayName, SheetName, TableName | なし（Coded API なし（表の列の削除は IWorkHandle の拡張メソッドに無い）） |
| ExcelDeleteRange | 5/5 | - | DisplayName, Range, SheetName, ShiftCells, ShiftOption | なし（Coded API なし（削除は IWorkHandle の拡張メソッドに無い）） |
| ExcelFilterTable | 5/5 | - | ColumnName, DisplayName, FilterOptions, SheetName, TableName | なし（Coded API なし（表のフィルターは IWorkHandle の拡張メソッドに無い）） |
| ExcelForEachRowX | 6/6 | - | Body, DisplayName, EmptyRowBehavior, HasHeaders, Range, SaveAfterEachRow | あり |
| ExcelGetCellColor | 4/4 | - | Cell, Color, DisplayName, SheetName | あり |
| ExcelGetSelectedRange | 2/2 | - | DisplayName, Range | なし（Coded API なし（クラシックの選択範囲の取得。IWorkHandle には無い。モダンは IWorkbookQuickHandle.SelectedRange）） |
| ExcelGetTableRange | 5/5 | - | DisplayName, IsPivot, Range, SheetName, TableName | あり |
| ExcelGetWorkbookSheet | 3/3 | - | DisplayName, Index, Sheet | あり |
| ExcelGetWorkbookSheets | 2/2 | - | DisplayName, Sheets | あり |
| ExcelInsertColumn | 5/5 | - | ColumnName, DisplayName, Position, SheetName, TableName | なし（Coded API なし（表の列の挿入は IWorkHandle の拡張メソッドに無い）） |
| ExcelInsertDeleteColumns | 5/5 | - | DisplayName, Mode, NoColumns, Position, SheetName | なし（Coded API なし（列の挿入・削除は IWorkHandle の拡張メソッドに無い）） |
| ExcelInsertDeleteRows | 5/5 | - | DisplayName, Mode, NoRows, Position, SheetName | なし（Coded API なし（行の挿入・削除は IWorkHandle の拡張メソッドに無い）） |
| ExcelLookUpRange | 5/5 | - | DisplayName, Range, Result, SheetName, Value | なし（Coded API なし（LOOKUP は IWorkHandle の拡張メソッドに無い）） |
| ExcelProcessScopeX | 10/10 | - | Body, DisplayAlerts, ExistingProcessAction, FileConflictResolution, LaunchMethod, LaunchTimeout, MacroSettings, ProcessMode, ShowExcelWindow | あり |
| ExcelReadCell | 5/5 | - | Cell, DisplayName, PreserveFormat, Result, SheetName | あり |
| ExcelReadCellFormula | 4/4 | - | Cell, DisplayName, Formula, SheetName | あり |
| ExcelReadColumn | 5/5 | - | DisplayName, PreserveFormat, Result, SheetName, StartingCell | あり |
| ExcelReadRange | 7/7 | - | AddHeaders, DataTable, DisplayName, PreserveFormat, Range, SheetName, UseFilter | あり |
| ExcelReadRow | 5/5 | - | DisplayName, PreserveFormat, Result, SheetName, StartingCell | あり |
| ExcelRefreshPivotTable | 3/3 | - | DisplayName, SheetName, TableName | なし（Coded API なし（ピボットテーブルの更新は IWorkHandle の拡張メソッドに無い）） |
| ExcelRemoveDuplicatesRange | 3/3 | - | DisplayName, Range, SheetName | なし（Coded API なし（重複の削除は IWorkHandle の拡張メソッドに無い）） |
| ExcelSaveWorkbook | 1/1 | - | DisplayName | なし（Coded API なし（IWorkHandle に保存のメソッドは無い。SaveExcelFile は IWorkbookQuickHandle 用でモダンの SaveExcelFileX）） |
| ExcelSelectRange | 3/3 | - | DisplayName, Range, SheetName | なし（Coded API なし（クラシックの選択。IWorkHandle にセルや範囲を選ぶメソッドは無い。モダンは SelectRangeX）） |
| ExcelSetRangeColor | 4/4 | - | Color, DisplayName, Range, SheetName | あり |
| ExcelSortTable | 5/5 | - | ColumnName, DisplayName, Order, SheetName, TableName | なし（Coded API なし（表の並べ替えは IWorkHandle の拡張メソッドに無い）） |
| ExcelWriteCell | 4/4 | - | Cell, DisplayName, SheetName, Text | あり |
| ExcelWriteRange | 5/5 | - | AddHeaders, DataTable, DisplayName, SheetName, StartingCell | あり |
| ExecuteMacro | 8/8 | - | ContinueOnError, DisplayName, MacroName, MacroOutput, MacroParameters | なし（Coded API なし（ExecuteMacro は IWorkbookQuickHandle 用で、クラシックの IWorkHandle（UseWorkBook は Excel を起動しない）からは呼べない。モダンは ExecuteMacroX）） |
| ExecuteMacroX | 5/5 | - | Body, DisplayName, MacroName, Result, Workbook | あり |
| ExportExcelToCsvX | 3/3 | - | DisplayName, FilePath, TargetRange | あり |
| FillRangeX | 3/3 | - | DestinationRange, DisplayName, Value | あり |
| FilterPivotTableX | 5/5 | - | ClearFilter, ColumnName, DisplayName, FilterArgument, Table | あり |
| FilterX | 6/6 | - | ClearFilter, ColumnName, DisplayName, FilterArgument, HasHeaders, Range | あり |
| FindFirstLastDataRowX | 11/11 | - | BlankRowsToSkip, ColumnName, ConfigureLastRowAs, DisplayName, FirstRowIndex, FirstRowOffset, HasHeaders, LastRowIndex, LastRowOffset, Range, VisibleRowsOnly | あり |
| FindReplaceValueX | 9/9 | - | DisplayName, FoundAt, LookIn, MatchCase, MatchEntireCellContents, Operation, ReplaceWith, ValueToFind, WhereToSearch | あり |
| ForEachSheetX | 3/3 | - | Body, DisplayName, Workbook | あり |
| FormatRangeX | 5/5 | - | Alignment, DisplayName, Font, Format, Range | あり |
| GetCellColor | 8/8 | - | - | 未作成 |
| GetCellColorX | 3/3 | - | Cell, DisplayName, OutputColor | あり |
| GetSelectedRangeX | 3/3 | - | DisplayName, Range, Workbook | あり |
| GetSensitivityLabelX | 3/3 | - | DisplayName, SensitivityLabel, Workbook | あり |
| GetSheets | 7/7 | - | - | 未作成 |
| GetTableRange | 9/9 | - | - | 未作成 |
| InsertChart | 17/17 | - | - | 未作成 |
| InsertColumnX | 7/7 | - | ColumnFormat, DisplayName, HasHeaders, NewColumnName, Range, RelativeColumnName, RelativePosition | あり |
| InsertExcelChartX | 10/10 | - | ChartCategory, ChartHeight, ChartType, ChartWidth, InsertIntoSheet, InsertedChart, Left, Range, Top | あり |
| InsertImage | 13/13 | - | - | 未作成 |
| InsertRowsX | 6/6 | - | DisplayName, HasHeaders, InsertPosition, NbOfRows, Range, SpecificIndex | あり |
| InsertSheetX | 4/4 | - | DisplayName, Name, ReferenceNewSheetAs, Workbook | あり |
| InvokeVBA | 5/5 | - | CodeFilePath, DisplayName, EntryMethodName, EntryMethodParameters, OutputValue | なし（Coded API なし（InvokeVBA は IWorkbookQuickHandle 用で、クラシックの IWorkHandle（UseWorkBook は Excel を起動しない）からは呼べない。モダンは InvokeVBAX）） |
| InvokeVBAX | 6/6 | - | Body, CodeFilePath, DisplayName, EntryMethodName, Result, Workbook | あり |
| LookupX | 5/5 | - | DisplayName, Label, ResultRange, SourceRange, Value | あり |
| MatchFunctionX | 5/5 | - | DisplayName, InRange, MatchFunctionType, SaveTo, ValueToMatch | あり |
| ModifyChartTitleModification | 3/3 | - | ShowTitle, Title | なし（Coded API なし（親の UpdateChartX に同じ。UpdateChartX.json）） |
| OpenWorkbook | 5/5 | - | - | 未作成 |
| ProtectSheetX | 6/6 | - | AdditionalPermissions, DisplayName, IsPasswordHidden, Password, SecurePassword, Sheet | あり |
| ReadCell | 9/9 | - | - | 未作成 |
| ReadCellFormula | 8/8 | - | - | 未作成 |
| ReadCellFormulaX | 3/3 | - | Cell, DisplayName, SaveTo | なし（Coded API なし（ReadCellFormula は IWorkHandle＝クラシックの UseWorkBook 用。モダンの UseExcelFile が返す IReadCellRef に対する式の読み取りは無い）） |
| ReadCellValueX | 4/4 | - | Cell, DisplayName, GetFormattedText, SaveTo | あり |
| ReadColumn | 9/9 | - | - | 未作成 |
| ReadCsvFile | 9/9 | - | DataTable, Delimitator, DelimitatorForViewModel, DisplayName, Encoding, FilePath, IgnoreQuotes, IncludeColumnNames, PathResource | あり |
| ReadRange | 10/10 | - | - | 未作成 |
| ReadRangeX | 6/6 | - | DisplayName, HasHeaders, Range, ReadFormatting, SaveTo, VisibleOnly | あり |
| ReadRow | 9/9 | - | - | 未作成 |
| RefreshDataConnectionsX | 2/2 | - | DisplayName, Workbook | あり |
| RefreshPivotTableX | 3/3 | - | DisplayName, LayoutRowType, Table | あり |
| RemoveDuplicatesX | 5/5 | - | Columns, ColumnsCompareMode, DisplayName, HasHeaders, Range | あり |
| RenameSheetX | 3/3 | - | DisplayName, From, To | あり |
| SaveAsPdfX | 7/7 | - | DestinationPdfPath, DisplayName, EndPage, ReplaceExisting, SaveQuality, StartPage, Workbook | あり |
| SaveExcelFileAsX | 5/5 | - | DisplayName, FilePath, ReplaceExisting, SaveAsFileType, Workbook | あり |
| SaveExcelFileX | 2/2 | - | DisplayName, Workbook | あり |
| SelectRangeX | 2/2 | - | DisplayName, Range | あり |
| SequenceX | 3/3 | - | - | 未作成 |
| SetRangeColor | 8/8 | - | - | 未作成 |
| ShowHideDataLabelsModification | 2/2 | - | ShowDataLabels | なし（Coded API なし（親の UpdateChartX に同じ。UpdateChartX.json）） |
| ShowHideLegendModification | 2/2 | - | ShowLegend | なし（Coded API なし（親の UpdateChartX に同じ。UpdateChartX.json）） |
| SortX | 4/4 | - | Body, DisplayName, HasHeaders, Range | あり |
| TextToColumnsX | 14/14 | - | ConsecutiveOperatorsAsOne, DestinationRange, DisplayName, NumberOfCharactersPerColumn, OtherSeparator, ParsingType, SourceRange, SplitByComma, SplitByLineBreak, SplitByOther, SplitBySemicolon, SplitBySpace, SplitByTabs, TextQualifier | あり |
| UnprotectSheetX | 5/5 | - | DisplayName, IsPasswordHidden, Password, SecurePassword, Sheet | あり |
| UpdateAxisBoundsModification | 4/4 | - | Axis, MaxBound, MinBound | なし（Coded API なし（親の UpdateChartX に同じ。UpdateChartX.json）） |
| UpdateAxisTitleModification | 4/4 | - | Axis, ShowTitle, Title | なし（Coded API なし（親の UpdateChartX に同じ。UpdateChartX.json）） |
| UpdateChart | 9/9 | - | - | 未作成 |
| UpdateChartX | 3/3 | - | Body, Chart, DisplayName | なし（Coded API なし（UpdateChart はクラシックの IWorkHandle にしか無く、モダンの IChartRef を渡す形が無い。1回に1種類の変更しか渡せず、複数の子も表せない）） |
| VLookupX | 6/6 | - | ColumnIndex, DisplayName, ExactMatch, Label, SourceRange, Value | あり |
| WithWorkbook | 6/6 | - | - | 未作成 |
| WriteCell | 8/8 | - | - | 未作成 |
| WriteCellX | 4/4 | - | AutoIncrementRow, Cell, Value | あり |
| WriteCsvFile | 8/8 | - | AddHeaders, DataTable, Delimitator, DelimitatorForViewModel, DisplayName, Encoding, FilePath, ShouldQuote | あり |
| WriteRange | 9/9 | - | - | 未作成 |
| WriteRangeX | 6/6 | - | Append, Destination, ExcludeHeaders, IgnoreEmptySource, Source | あり |

### UiPath.Persistence.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| AddQueueItemAndGetReference | 12/12 | - | ContinueOnError, DeferDate, DisplayName, DueDate, FolderPath, ItemInformation, ItemInformationCollection, Priority, QueueItemOutput, QueueName, Reference, TimeoutMs | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| AddTaskComment | 6/6 | - | Comment, ContinueOnError, DisplayName, FolderPath, TaskId, TimeoutMs | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| AssignTasks | 14/14 | - | AssignmentCriteria, ContinueOnError, DisplayName, EnableMultipleAssignments, FailedTaskAssignments, FolderPath, Group, MigrateV144, TaskAssignmentType, TaskId, TaskUserAssignments, TimeoutMs, UserId, UserNameOrEmail | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| CompleteTask | 7/7 | - | Action, ContinueOnError, Data, DisplayName, FolderPath, TaskId, TimeoutMs | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| ConfigureTaskTimer | 16/16 | - | AssignmentCriteria, AutoCompleteOutcome, ContinueOnError, DisplayName, EndCriteria, FolderPath, Outcome, ReassignGroup, ReassignUser, StartCriteria, TaskId, TimeoutMs, TimerDays, TimerDuration, TimerHours, TimerMinutes | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| CreateExternalTask | 14/14 | - | AssignmentCriteria, ContinueOnError, DisplayName, ExternalTag, FolderPath, Group, Labels, TaskCatalog, TaskData, TaskOutput, TaskPriority, TaskTitle, TimeoutMs, UserNameOrEmail | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| CreateFormTask | 34/34 | - | AssignmentCriteria, AutoCompleteOutcome, BucketFolderPath, BucketName, ContinueOnError, DisplayName, EnableBulkEdit, EnableDynamicForms, EnableV2, EndCriteria, ExternalTag, FolderPath, FormData, FormLayout, GenerateInputFields, Group, Labels, Outcome, ReassignCriteria, ReassignGroup, ReassignUser, StartCriteria, TaskOutput, TaskPriority, TaskTimerEnabled, TaskTitle, TimeoutMs, TimerDuration, UserNameOrEmail | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| CreateUserAction | 34/37 | AppActionPropertiesMetadata（コレクション）, State（オブジェクト）, TaskFieldsForDesktop（コレクション） | ActionableNotification, AppActionData, AssignmentCriteria, AutoCompleteOutcome, CurrentAppTaskState, DisplayName, EndCriteria, EnforcePropertyRefresh, ExternalTag, FolderPath, Group, Labels, Outcome, PrimaryActionableOutcome, PrimaryButtonLabel, ReassignCriteria, ReassignGroup, ReassignUser, SecondaryActionableOutcome, SecondaryButtonLabel, SolutionApp, SolutionAppResources, SolutionTaskCatalog, StartCriteria, TaskCatalog, TaskFieldsForWeb, TaskOutput, TaskPriority, TaskTimerEnabled, TaskTitle, TimeoutMs, TimerDuration, UserNameOrEmail | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| ForwardTask | 7/7 | - | Comments, ContinueOnError, DisplayName, FolderPath, TaskId, TimeoutMs, UserNameOrEmail | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| GetAppTasks | 13/13 | - | ContinueOnError, DisplayName, Expand, Filter, FolderPath, OrderBy, Reference, Select, Skip, TaskCatalogName, TaskObjects, TimeoutMs, Top | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| GetFormTasks | 13/13 | - | ContinueOnError, DisplayName, Expand, Filter, FolderPath, OrderBy, Reference, Select, Skip, TaskCatalogName, TaskObjects, TimeoutMs, Top | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| GetTaskData | 6/6 | - | ContinueOnError, DisplayName, FolderPath, TaskId, TaskOutput, TimeoutMs | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| ResumeAfterDelay | 4/4 | - | DisplayName, ResumeTime, StatusMessage, WaitItemDataObject | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| StartJobAndGetReference | 7/7 | - | ContinueOnError, DisplayName, FolderPath, JobArguments, JobOutput, ProcessName, TimeoutMs | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| UpdateTaskLabels | 7/7 | - | AddLabels, ContinueOnError, DeleteLabels, DisplayName, FolderPath, TaskId, TimeoutMs | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| WaitForExternalTaskAndResume | 8/8 | - | ContinueOnError, DisplayName, StatusMessage, TaskAction, TaskInput, TaskOutput, TimeoutMs, WaitItemDataObject | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| WaitForFormTaskAndResume | 8/8 | - | ContinueOnError, DisplayName, StatusMessage, TaskAction, TaskInput, TaskOutput, TimeoutMs, WaitItemDataObject | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| WaitForJobAndResume | 7/7 | - | ContinueOnError, DisplayName, JobInput, JobOutput, StatusMessage, TimeoutMs, WaitItemDataObject | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| WaitForQueueItemAndResume | 7/7 | - | ContinueOnError, DisplayName, QueueItemInput, QueueItemOutput, StatusMessage, TimeoutMs, WaitItemDataObject | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |
| WaitForUserActionAndResume | 8/8 | - | ContinueOnError, DisplayName, StatusMessage, TaskAction, TaskInput, TaskOutput, TimeoutMs, WaitItemDataObject | なし（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件）） |

### UiPath.System.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| AddDataColumn | 9/9 | - | AllowDBNull, AutoIncrement, Column, ColumnName, DataTable, DefaultValue, DisplayName, MaxLength, Unique | あり |
| AddDataRow | 4/4 | - | ArrayRow, DataRow, DataTable, DisplayName | あり |
| AddLogFields | 2/2 | - | DisplayName, Fields | なし（Coded API なし（基底クラスの Log の additionalLogFields で、ログ1件ごとに渡す）） |
| AddOrSubtractFromDate | 6/6 | - | AmountOfTime, DisplayName, Result, SelectedOperation, Source, UnitOfTime | あり |
| AddQueueItem | 11/11 | - | ContinueOnError, DeferDate, DisplayName, DueDate, FolderPath, ItemInformation, ItemInformationCollection, Priority, QueueType, Reference, TimeoutMS | あり |
| AddSubtractTimePeriodDateModification | 4/4 | - | DisplayName, Operation, TimeUnit, Value | なし（Coded API なし（ModifyDate の中に置く加工。ModifyDate 自体に Coded API が無い）） |
| AddTransactionItem | 11/11 | - | ContinueOnError, DisplayName, FolderPath, QueueType, Reference, SpecificData, TimeoutMS, TransactionInformation, TransactionInformationVariable, TransactionItem | あり |
| AppendItemToCollection | 4/4 | - | Collection, DisplayName, Items, Result | あり |
| AppendItemToList | 4/4 | - | DisplayName, ItemIndex, ItemToAppend, List | あり |
| AppendLine | 7/7 | - | ContinueOnError, DisplayName, Encoding, File, FileName, Text, UseDefaultEncoding | あり |
| AskWhenRun | 2/2 | - | - | 未作成 |
| Beep | 1/1 | - | DisplayName | なし（Coded API なし（ISystemService にも基底クラスにも無い）） |
| BeginProcess | 8/8 | - | Arguments, DisplayName, EntryPointPath, FolderPath, ProcessName, TargetSession, UsePackage | なし（Coded API なし（待たずに呼ぶ API は無い。InvokeProcessAsync を await せずに書くことはできるが、引数の受け渡しが InvokeProcess と同じ理由で対応表にできない）） |
| Break | 1/1 | - | DisplayName | C# の構文 |
| BuildCollection | 5/5 | - | DisplayName, FirstItem, Items, NextItems, Result | あり |
| BuildDataTable | 3/3 | - | DataTable, DisplayName, TableInfo | あり |
| BulkAddQueueItems | 8/8 | - | CommitType, ContinueOnError, DisplayName, FolderPath, QueueItemsDataTable, QueueName, Result, TimeoutMS | あり |
| ChangeCase | 4/4 | - | ChangeCaseOptions, DisplayName, Result, Source | あり |
| ChangeType | 4/4 | - | ConvertedValue, DisplayName, SourceValue | C# の構文 |
| CheckFalse | 4/4 | - | DisplayName, ErrorMessage, Expression, Result | C# の構文 |
| CheckTrue | 4/4 | - | DisplayName, ErrorMessage, Expression, Result | C# の構文 |
| ClearDataTable | 2/2 | - | DataTable, DisplayName | あり |
| CollectionToDataTable | 3/3 | - | Collection, DataTable, DisplayName | なし（Coded API なし（ISystemService に CollectionToDataTable が無い）） |
| CombineText | 5/5 | - | DisplayName, Result, Separator, SeparatorKey, Source | あり |
| Comment | 2/2 | - | DisplayName, Text | C# の構文 |
| CommentOut | 2/2 | - | Body, DisplayName | C# の構文 |
| CompressFiles | 13/13 | - | AllowDuplicateContentNames, CodePage, CompressedFileInfo, CompressedFileName, CompressedResource, CompressionLevel, ContentToArchive, DisplayName, EncryptionAlgorithm, OverrideExistingFile, Password, ResourcesToArchive | あり |
| Continue | 1/1 | - | DisplayName | C# の構文 |
| CopyFile | 7/7 | - | ContinueOnError, Destination, DestinationResource, DisplayName, Overwrite, Path, PathResource | あり |
| CopyFolderX | 8/8 | - | ContinueOnError, DisplayName, From, FromResource, IncludeSubfolders, Overwrite, To, ToResource | あり |
| CreateDirectory | 4/4 | - | ContinueOnError, DisplayName, Output, Path | あり |
| CreateFile | 6/6 | - | ContinueOnError, DisplayName, Name, Output, Path, PathResource | あり |
| CreateList | 2/2 | - | DisplayName, NewList | あり |
| CustomInput | 6/6 | - | DisplayName, Height, Result, TopMost, URI, Width | なし（Coded API なし（HTML の入力ダイアログの API が ISystemService に無い）） |
| Delete | 4/4 | - | ContinueOnError, DisplayName, Path, ResourceFile | あり |
| DeleteFileX | 3/3 | - | DisplayName, FileResource, Path | あり |
| DeleteFolderX | 4/4 | - | DisplayName, FolderResource, Path, Recursive | あり |
| DeleteQueueItems | 4/4 | - | ContinueOnError, DisplayName, QueueItems, TimeoutMS | あり |
| DeleteStorageFile | 6/6 | - | ContinueOnError, DisplayName, FolderPath, Path, StorageBucketName, TimeoutMS | あり |
| DisableTrigger | 2/2 | - | DisplayName, TriggerId | なし（Coded API なし（トリガーは ISystemService に無い）） |
| DownloadFileFromUrl | 9/9 | - | ConflictResolution, ContinueOnError, DisplayName, FileName, ResponseAttachment, Timeout, Url, UserAgentHeader | あり |
| DownloadStorageFile | 8/8 | - | ContinueOnError, Destination, DisplayName, FolderPath, Path, Result, StorageBucketName, TimeoutMS | あり |
| EnableTrigger | 2/2 | - | DisplayName, TriggerId | なし（Coded API なし（トリガーは ISystemService に無い）） |
| EvaluateBusinessRule | 11/11 | - | Arguments, ArgumentsVariable, BusinessRule, ContinueOnError, DisplayName, FolderPath, Output, RuleNeedsMigration, RuleRequiresService, TimeoutMS | なし（Coded API なし（ビジネスルールの評価 API が ISystemService に無い）） |
| ExecutePowerShell | 7/7 | - | - | 未作成 |
| ExistsInCollection`1 | 5/5 | - | Collection, DisplayName, Exists, Index, Item | あり |
| ExtractDateTime | 6/6 | - | DisplayName, Format, LocalizationCode, Result, Results, Source | あり |
| ExtractFiles | 11/11 | - | CodePage, ConflictResolution, Content, DestinationFolder, DestinationFolderInfo, DisplayName, ExtractToADedicatedFolder, File, FileToExtract, Password, SkipUnsupportedFiles | あり |
| ExtractText | 11/11 | - | DisplayName, EndingText, ExtractBaseURLOnly, ExtractOptions, FirstMatch, IgnoreDuplicates, MatchCase, Results, Source, StartingText | あり |
| FileChangeTrigger | 6/6 | - | - | 未作成 |
| FileChangeTriggerV2 | 9/9 | - | Body, ChangeType, ContinueMonitoring, ContinueOnError, DisplayName, FileName, IncludeSubdirectories, NotifyFilters, Path | なし（Coded API なし（トリガーは ISystemService に無い）） |
| FileChangeTriggerV3 | 9/9 | - | ChangeType, DisplayName, Enabled, FileNameFilter, IncludeSubdirectories, NotifyFilters, Path, SchedulingMode, TriggerId | なし（Coded API なし（トリガーは ISystemService に無い。Coded ではイベントハンドラーで自分で書く）） |
| FileExistsX | 3/3 | - | DisplayName, Exists, Path | あり |
| FilterCollection | 5/5 | - | Collection, DisplayName, Filter, FilterAction, Result | なし（Coded API なし（ISystemService に FilterCollection が無い。公開の CollectionFilterSettingsExtensions.ApplyFilters は ActivityContext を取るので Coded から呼べない。C# では LINQ で書く）） |
| FilterDataTable | 7/7 | - | DataTable, DisplayName, FilterRowsMode, Filters, OutputDataTable, SelectColumns, SelectColumnsMode | なし（Coded API なし（ISystemService に FilterDataTable が無い。条件の List は DataView.RowFilter などで書き直すことになり、同じ挙動の保証がない）） |
| FindAndReplace | 6/6 | - | DisplayName, MatchCase, ReplaceWith, Result, Source, ValueToFind | あり |
| FindDayOfWeekDateModification | 3/3 | - | Day, Direction, DisplayName | なし（Coded API なし（ModifyDate の中に置く加工。ModifyDate 自体に Coded API が無い）） |
| FindStartEndDateModification | 3/3 | - | DisplayName, Location, TimeUnit | なし（Coded API なし（ModifyDate の中に置く加工。ModifyDate 自体に Coded API が無い）） |
| FolderExistsX | 3/3 | - | DisplayName, Exists, Path | あり |
| ForEach`1 | 6/6 | - | Body, CurrentIndex, DisplayName, MaxIterations, Values | C# の構文 |
| ForEachFileX | 7/7 | - | Body, DisplayName, Filter, Folder, IncludeSubDirectories, OrderBy, SkipFolderWithoutPermission | なし（Coded API なし（ファイルの列挙は System.IO.Directory.EnumerateFiles などの .NET の機能。サービスにメソッドが無い）） |
| ForEachFolderX | 7/7 | - | Body, DisplayName, FilterByName, Folder, IncludeSubFolders, OrderBy, SkipFoldersWithoutPermission | なし（Coded API なし（フォルダーの列挙は System.IO.Directory.EnumerateDirectories などの .NET の機能。サービスにメソッドが無い）） |
| ForEachRow | 10/10 | - | Body, CurrentIndex, DataTable, DisplayName, MaxIterations | C# の構文 |
| FormatDateAsText | 5/5 | - | DisplayName, Format, LocalizationCode, Result, Source | あり |
| FormatValue | 3/3 | - | DisplayName, Format, Value | なし（Coded API なし（ISystemService に該当するメソッドが無い）） |
| GenerateDataTable | 15/15 | - | AllowMisalignedColumns, AutoDetectTypes, CSVParsing, ColumnSeparators, ContinueOnError, DataTable, DisplayName, Input, NewLineSeparator, PreserveNewLines, PreserveStrings, UseColumnHeader, UseRowHeader | なし（Coded API なし（ISystemService に GenerateDataTable が無い）） |
| GetCurrentJobInfo | 2/2 | - | DisplayName, Result | なし（Coded API なし（ISystemService に GetCurrentJobInfo が無い。docs の Notes には「Coded 対応」とあるが、26.10.0 のサービス API には出ていない）） |
| GetEnvironmentFolder | 3/3 | - | DisplayName, FolderPath, SpecialFolder | あり |
| GetEnvironmentVariable | 4/4 | - | DisplayName, TargetFramework, Variable, VariableValue | あり |
| GetFileInfoX | 3/3 | - | DisplayName, FilePath, Output | なし（Coded API なし（FileInfo は System.IO の型。サービスにメソッドが無い）） |
| GetFolderInfoX | 4/4 | - | DisplayName, FolderPath, Output, ThrowIfNotExists | なし（Coded API なし（DirectoryInfo は System.IO の型。サービスにメソッドが無い）） |
| GetJobs | 9/9 | - | ContinueOnError, DisplayName, Filter, FolderPath, Result, Skip, TimeoutMS, Top | あり |
| GetLastDownloadedFile | 7/7 | - | Body, DisplayName, DownloadFolder, File, FileResource, IgnoreFiles, Timeout | なし（Coded API なし（ISystemService に Get Last Downloaded File 相当が無い。Body の中で起きたダウンロードを待つ ActivityAction 型）） |
| GetProcesses | 3/3 | - | ContinueOnError, DisplayName, Processes | あり |
| GetQueueItem | 9/9 | - | ContinueOnError, DisplayName, FilterStrategy, FolderPath, QueueType, Reference, SpecificData, TimeoutMS, TransactionItem | あり |
| GetQueueItems | 20/20 | - | ContinueOnError, ConvertDatesToLocalTime, DisplayName, Duration, FilterByCurrentRobot, FilterStrategy, FolderPath, From, Priority, QueueItemStates, QueueName, Reference, Result, Skip, TimeoutMS, To, Top | あり |
| GetRobotAsset | 6/6 | - | AssetName, CacheStrategy, DisplayName, FolderPath, TimeoutMS, Value | あり |
| GetRobotCredential | 7/7 | - | AssetName, CacheStrategy, DisplayName, FolderPath, Password, TimeoutMS, Username | あり |
| GetRowItem | 6/6 | - | Column, ColumnIndex, ColumnName, DisplayName, Row, Value | あり |
| GetSecret | 5/5 | - | AssetName, DisplayName, FolderPath, Secret, TimeoutMS | なし（Coded API なし（ISystemService に GetSecret が無い）） |
| GetTransactionItem | 7/7 | - | - | 未作成 |
| GetUsernamePasswordX | 8/8 | - | AutosubmitTimeoutSeconds, Credential, CredentialName, CredentialsSource, DisplayName, OrchestratorCredentialName, OrchestratorFolderPath, TimeoutInSeconds | なし（Coded API なし（ISystemService に対応するメソッドが無い。認証情報の入力ダイアログを開く XAML 専用のアクティビティ）） |
| GlobalVariableChangedTrigger | 5/5 | - | DisplayName, Enabled, SchedulingMode, TriggerId, VariableName | なし（Coded API なし（トリガーは ISystemService に無い）） |
| IfElseIfV2 | 5/5 | - | - | 未作成 |
| InputDialog | 8/8 | - | DisplayName, IsPassword, Label, Options, Result, Title, TopMost | なし（Coded API なし（入力ダイアログの API が ISystemService に無い）） |
| InterruptibleDoWhile | 5/5 | - | Body, Condition, CurrentIndex, DisplayName, MaxIterations | C# の構文 |
| InterruptibleWhile | 5/5 | - | Body, Condition, CurrentIndex, DisplayName, MaxIterations | C# の構文 |
| InvokeCode | 5/5 | - | Arguments, Code, ContinueOnError, DisplayName, Language | なし（Coded では C# をそのまま書くので InvokeCode は要らない） |
| InvokeComMethod | 8/8 | - | Arguments, BindingFlags, CLSID, ContinueOnError, DisplayName, MethodName, ProgID, Result | なし（Coded API なし（ISystemService にも基底クラスにも無い。Type.GetTypeFromProgID と InvokeMember を直接使って書く）） |
| InvokePowerShell | 8/8 | - | CommandText, ContinueOnError, DisplayName, IsScript, Output, Parameters, PowerShellProcess, PowerShellVariables | なし（Coded API なし（ISystemService にも基底クラスにも無い。System.Management.Automation を直接使って書く）） |
| InvokeProcess | 15/15 | - | Arguments, ContinueOnError, DisplayName, EntryPointPath, FolderPath, Level, LogEntry, LogExit, OutputArguments, ProcessName, TargetSession, Timeout, UsePackage | あり |
| InvokeVBScript | 9/9 | - | Arguments, DisplayName, FileName, KillOnTimeout, Result, RunInBatchMode, TimeoutMS, UnicodeSupport, WaitForOutput | なし（Coded API なし（ISystemService にも基底クラスにも無い。cscript を System.Diagnostics.Process で起動して書く）） |
| InvokeWorkflowFile | 13/13 | - | Arguments, ArgumentsVariable, ContinueOnError, DisplayName, Elevated, Level, LogEntry, LogExit, TargetSession, Timeout, UnSafe, WorkflowFileName | あり |
| InvokeWorkflowInteractive | 18/18 | - | Arguments, ArgumentsVariable, AssemblyName, ContinueOnError, Depth, DisplayName, Elevated, Height, KeepSessionConnected, Level, LogEntry, LogExit, LoginToConsole, TargetSession, Timeout, UnSafe, Width, WorkflowFileName | なし（Coded API なし（対話セッションでのワークフロー呼び出しの API が無い）） |
| IsMatch | 9/9 | - | BuilderPattern, DisplayName, Input, IsBuilderTabModified, Pattern, RegexOption, Result, TimeoutMS | なし（Coded API なし（ISystemService に IsMatch が無い。正規表現は System.Text.RegularExpressions.Regex で書ける）） |
| JoinDataTables | 6/6 | - | Arguments, DataTable1, DataTable2, DisplayName, JoinType, OutputDataTable | なし（Coded API なし（ISystemService に JoinDataTables が無い）） |
| KillProcess | 5/5 | - | AppliesTo, ContinueOnError, DisplayName, Process, ProcessName | あり |
| ListStorageFiles | 9/9 | - | ContinueOnError, Directory, DisplayName, Filter, FolderPath, Recursive, Result, StorageBucketName, TimeoutMS | あり |
| LookupDataTable | 11/11 | - | CellValue, DataTable, DisplayName, LookupColumnIndex, LookupColumnName, LookupDataColumn, LookupValue, RowIndex, TargetColumnIndex, TargetColumnName, TargetDataColumn | あり |
| ManualTrigger | 2/2 | - | DisplayName, Result | なし（Coded API なし（トリガーは ISystemService に無い）） |
| Matches | 10/10 | - | BuilderPattern, DisplayName, FirstMatch, Input, IsBuilderTabModified, Pattern, RegexOption, Result, TimeoutMS | なし（Coded API なし（ISystemService に Matches が無い。正規表現は System.Text.RegularExpressions.Regex で書ける）） |
| MergeCollections | 4/4 | - | Collection, DisplayName, Result, SecondCollection | あり |
| MergeDataTable | 4/4 | - | Destination, DisplayName, MissingSchemaAction, Source | あり |
| ModifyDate | 9/9 | - | Body, CustomDateFormat, DisplayName, FormatAsText, OutDate, OutText, PredefinedDateFormat, SourceDate, UseCustomDateFormat | なし（Coded API なし（ISystemService に該当するメソッドが無い。個々の加工は AddOrSubtractFromDate などで書き分ける）） |
| ModifyText | 4/4 | - | Body, DisplayName, OutputText, SourceText | なし（Coded API なし（ISystemService に該当するメソッドが無い。個々の加工は ChangeCase / FindAndReplace などで書き分ける）） |
| MoveFile | 7/7 | - | ContinueOnError, Destination, DestinationResource, DisplayName, Overwrite, Path, PathResource | あり |
| MoveFolderX | 4/4 | - | DisplayName, From, Overwrite, To | なし（Coded API なし（サービスの MoveFile はファイルのリソース用で、フォルダーの移動は無い）） |
| MultipleAssign | 2/2 | - | AssignOperations, DisplayName | C# の構文 |
| NotifyGlobalVariableChanged | 2/2 | - | DisplayName, VariableName | なし（Coded API なし（グローバル変数の通知 API が無い）） |
| OrchestratorHttpRequest | 10/10 | - | ContinueOnError, DisplayName, FolderPath, JSONPayload, Method, RelativeEndpoint, ResponseHeaders, Result, StatusCode, TimeoutMS | あり |
| OutputDataTable | 3/3 | - | DataTable, DisplayName, Text | あり |
| PathExists | 5/5 | - | DisplayName, Exists, Path, PathType, Resource | あり |
| Placeholder | 2/2 | - | Description, DisplayName | C# の構文 |
| PostponeTransactionItem | 6/6 | - | ContinueOnError, DeferDate, DisplayName, DueDate, TimeoutMS, TransactionItem | あり |
| ProcessEndTrigger | 5/5 | - | Body, ContinueMonitoring, ContinueOnError, DisplayName, ProcessName | なし（Coded API なし（トリガーは ISystemService に無い）） |
| ProcessEndTriggerV2 | 5/5 | - | - | 未作成 |
| ProcessStartTrigger | 5/5 | - | Body, ContinueMonitoring, ContinueOnError, DisplayName, ProcessName | なし（Coded API なし（トリガーは ISystemService に無い）） |
| ProcessStartTriggerV2 | 5/5 | - | - | 未作成 |
| ProcessTrackingScope | 10/10 | - | DisplayName, ObjectId, ObjectInteraction, ObjectType, ProcessCaseName, ProcessCaseNameToSwitchTo, ProcessLogMode, ScopeId, Sequence, TaskName | なし（Coded API なし（ISystemService に Process Tracking Scope が無い）） |
| QueueTrigger | 8/8 | - | DisplayName, ExtractedQueueItem, FolderPath, ItemsActivationThreshold, ItemsPerJobActivationTarget, MaxJobsForActivation, QueueName, TransactionItem | なし（Coded API なし（トリガーは ISystemService に無い）） |
| RaiseAlert | 6/6 | - | ContinueOnError, DisplayName, FolderPath, Notification, Severity, TimeoutMS | あり |
| ReadListItem | 4/4 | - | DisplayName, ItemIndex, List, Value | あり |
| ReadStorageText | 8/8 | - | ContinueOnError, DisplayName, Encoding, FolderPath, Path, Result, StorageBucketName, TimeoutMS | あり |
| ReadTextFile | 7/7 | - | Content, ContinueOnError, DisplayName, Encoding, File, FileName | あり |
| RemoveDataColumn | 5/5 | - | Column, ColumnIndex, ColumnName, DataTable, DisplayName | あり |
| RemoveDataRow | 4/4 | - | DataTable, DisplayName, Row, RowIndex | あり |
| RemoveDuplicateRows | 3/3 | - | DataTable, DisplayName, OutputDataTable | あり |
| RemoveFromCollection`1 | 6/6 | - | Collection, DisplayName, Index, Item, RemoveAllElements, Result | あり |
| RemoveLogFields | 2/2 | - | DisplayName, Fields | なし（Coded API なし（基底クラスの Log の additionalLogFields はログ1件ごとに渡す形で、AddLogFields のように以降のログへ残る項目も、それを消す API も無い）） |
| RenameFileX | 6/6 | - | DisplayName, FilePath, FileResource, KeepExtension, NewName, OutputFileResource | なし（Coded API なし（名前の変更はサービスにメソッドが無い）） |
| RenameFolderX | 3/3 | - | DisplayName, FolderPath, NewName | なし（Coded API なし（名前の変更はサービスにメソッドが無い）） |
| RepeatNumberOfTimesX | 4/4 | - | Body, DisplayName, NumberOfTimes, StartAt | C# の構文 |
| RepeatTrigger | 5/5 | - | DisplayName, Enabled, Interval, SchedulingMode, TriggerId | なし（Coded API なし（トリガーは ISystemService に無い）） |
| Replace | 10/10 | - | BuilderPattern, DisplayName, Input, IsBuilderTabModified, Pattern, RegexOption, Replacement, Result, TimeoutMS | あり |
| ReportStatus | 2/2 | - | DisplayName, StatusText | なし（Coded API なし（ISystemService に ReportStatus が無い）） |
| ResetTimer | 2/2 | - | DisplayName, Timer | なし（Coded API なし（UiPath.Core.Timer をリセットする API が無い）） |
| ResumeTimer | 2/2 | - | DisplayName, Timer | なし（Coded API なし（UiPath.Core.Timer を再開する API が無い）） |
| RetryScope | 8/8 | - | ActivityBody, DisplayName, NumberOfRetries, RetryInterval | C# の構文 |
| Return | 1/1 | - | DisplayName | C# の構文 |
| RunJob | 16/16 | - | Account, Arguments, ContinueOnError, DisplayName, EntryPointPath, ExecutionMode, FailWhenFaulted, FolderPath, Input, Job, Machine, Output, Priority, ProcessName, RuntimeType, TimeoutMS | あり |
| SelectFile | 6/6 | - | DisplayName, Filter, InitialDirectory, Multiselect, SelectedFile, SelectedFiles | なし（Coded API なし（ファイル選択ダイアログの API が ISystemService に無い）） |
| SelectFolder | 2/2 | - | DisplayName, SelectedFolder | なし（Coded API なし（フォルダー選択ダイアログの API が ISystemService に無い）） |
| SendEmailNotification | 7/7 | - | Body, Cc, ContinueOnError, DisplayName, Recipients, Subject, TimeoutMS | なし（Coded API なし（ISystemService に SendEmailNotification が無い）） |
| SetAsset | 7/7 | - | AssetName, ContinueOnError, DisplayName, FolderPath, JsonValue, TimeoutMS, Value | あり |
| SetCredential | 8/8 | - | ContinueOnError, CredentialName, DisplayName, FolderPath, Password, SecurePassword, TimeoutMS, UserName | あり |
| SetEnvironmentVariable | 4/4 | - | DisplayName, Name, TargetFramework, Value | あり |
| SetSecret | 7/7 | - | AssetName, ContinueOnError, DisplayName, FolderPath, SecretValue, SecureSecretValue, TimeoutMS | なし（Coded API なし（ISystemService に SetSecret が無い）） |
| SetTaskStatus | 3/3 | - | DisplayName, Status, TaskGuid | なし（Coded API なし（ISystemService に SetTaskStatus が無い）） |
| SetTraceStatus | 3/3 | - | DisplayName, Status, TraceGuid | なし（Coded API なし（ISystemService に SetTraceStatus が無い）） |
| SetTransactionProgress | 5/5 | - | ContinueOnError, DisplayName, Progress, TimeoutMS, TransactionItem | あり |
| SetTransactionStatus | 13/13 | - | Analytics, AnalyticsVariable, ContinueOnError, Details, DisplayName, ErrorType, Output, OutputVariable, Reason, Status, TimeoutMS, TransactionItem | あり |
| ShouldStop | 2/2 | - | DisplayName, Result | なし（Coded API なし（ジョブの停止要求を調べる API が ISystemService / CodedWorkflow に無い）） |
| SortDataTable | 7/7 | - | ColumnIndex, ColumnName, DataColumn, DataTable, DisplayName, OutputDataTable, SortOrder | あり |
| SplitText | 6/6 | - | DisplayName, Results, Separator, SeparatorKey, Source | あり |
| StartJob | 13/13 | - | Arguments, ArgumentsVariable, ContinueOnError, DisplayName, FolderPath, JobId, JobPriority, Key, ModernFolder, NumberOfRobots, ProcessName, ResumeOnSameContext, TimeoutMS | あり |
| StartTimer | 2/2 | - | DisplayName, Timer | なし（Coded API なし（UiPath.Core.Timer を作る・測る API が無い）） |
| StartTriggers | 13/13 | - | Arguments, ArgumentsVariable, AssemblyName, ContinueOnError, DisplayName, Elevated, Level, LogEntry, LogExit, TargetSession, Timeout, UnSafe, WorkflowFileName | なし（Coded API なし（トリガーは ISystemService に無い）） |
| StopJob | 5/5 | - | ContinueOnError, DisplayName, Job, Strategy, TimeoutMS | あり |
| StopTimer | 2/2 | - | DisplayName, Timer | なし（Coded API なし（UiPath.Core.Timer を止める API が無い）） |
| StopTriggers | 2/2 | - | DisplayName, ShouldStop | なし（Coded API なし（トリガーは ISystemService に無い）） |
| TextToLeftRight | 8/8 | - | CaseSensitiveSeparator, CustomSeparatorEnabled, DisplayName, FullText, Separator, SeparatorKey, TextToLeft, TextToRight | なし（Coded API なし（ISystemService に該当するメソッドが無い）） |
| TimeoutScope | 4/4 | - | Body, DisplayName, ThrowExceptionAfter, TimeoutMessage | なし（Coded API なし（時間切れで中の処理を打ち切って例外にする API が無い。Task と CancellationToken で自分で組むことになり、同じ意味の機械的な変換にならない）） |
| TimeTrigger | 17/17 | - | CronExpression, DailyRepeat, DailyStartingTime, DaysOfMonthToRunOn, DisplayName, Frequency, HourlyRepeat, HourlyStartingMinutes, MinuteByMinuteRepeat, MonthDaySelection, MonthlyDaysToRunOn, MonthlyRepeat, MonthlyStartingTime, Result, TimeZone, WeeklyDaysToRunOn, WeeklyStartingTime | なし（Coded API なし（トリガーは ISystemService に無い）） |
| TrackObject | 7/7 | - | DisplayName, ObjectId, ObjectInteraction, ObjectProperties, ObjectPropertiesV2, ObjectType, UseObjectPropertiesV2 | なし（Coded API なし（ISystemService に Process Tracking が無い）） |
| TriggerScope | 6/6 | - | Action, ContinueOnError, DisplayName, SchedulingMode, Triggers, Variables | なし（Coded API なし（トリガーは ISystemService に無い）） |
| UpdateListItem | 4/4 | - | DisplayName, ItemIndex, List, Value | あり |
| UpdateRowItem | 5/5 | - | ColumnIndex, ColumnName, DisplayName, Row, Value | あり |
| UploadStorageFile | 9/9 | - | ContinueOnError, Destination, DisplayName, FileName, FileResource, FolderPath, Path, StorageBucketName, TimeoutMS | あり |
| WaitQueueItem | 10/10 | - | ContinueOnError, ConvertDatesToLocalTime, DisplayName, FilterStrategy, FolderPath, PollTimeMS, QueueName, Reference, Result, TimeoutMS | あり |
| WriteStorageText | 8/8 | - | ContinueOnError, DisplayName, Encoding, FolderPath, Path, StorageBucketName, Text, TimeoutMS | あり |
| WriteTextFile | 7/7 | - | ContinueOnError, DisplayName, Encoding, File, FileName, Output, Text | あり |

### UiPath.UIAutomation.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| AnchorBase | 5/5 | - | Action, AnchorPosition, AnchorProvider, ContinueOnError, DisplayName | なし（Coded API なし（Classic のアンカー。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）で、アンカーは Anchors で別の形）） |
| AnchorContextAware | 6/6 | - | AnchorProvider, ContinueOnError, DesignAnchor, DesignTarget, DisplayName, TargetProvider | なし（Coded API なし（Classic のアンカー（Anchor2Data）。Coded の API なし）） |
| BlockUserInput | 10/10 | - | BlockType, Body, ContinueOnError, DisplayName, KeyModifiers, Keys, SendTelemetryOnlyOnFailure, SpecialKey, TimeoutMS | なし（Coded API なし（Classic の入力ブロック。Coded の uiAutomation.BlockUserInput は Modern（NBlockUserInput）のオプションで、Classic の Body を持つ形とは対応しない）） |
| CallTransaction | 6/6 | - | ContinueOnError, DisplayName, SendTelemetryOnlyOnFailure, Target, Transaction | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| CellScope | 12/12 | - | Body, ColumnName, ColumnNames, ContinueOnError, RowNumber, SendTelemetryOnlyOnFailure, Target | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| ClickImageTriggerV2 | 14/14 | - | BlockEvent, Enabled, Image, KeyModifiers, MouseButton, SchedulingMode, Selector, TriggerId, TriggerMode | なし（Coded API なし（トリガー。Coded の uiAutomation にトリガーは無い）） |
| ClickPictureOnScreen | 10/10 | - | ClickType, ContinueOnError, DelayBefore, DelayMS, KeyModifiers, PictureOffsetX, PictureOffsetY, SendWindowMessages, Target | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| ClickToolbarButton | 8/8 | - | AlterIfDisabled, ContinueOnError, DelayAfter, DelayBefore, Item, Items, Target | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| ClickTriggerV2 | 14/14 | - | BlockEvent, Enabled, IncludeChildren, KeyModifiers, MouseButton, SchedulingMode, Selector, TriggerId, TriggerMode | なし（Coded API なし（トリガー。Coded の uiAutomation にトリガーは無い）） |
| CloseTab | 5/5 | - | Browser, ContinueOnError, DisplayName | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| CloseWindow | 11/11 | - | ContinueOnError, DisplayName, Selector, TimeoutMS, UseWindow, WaitForReady | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| ExpandALVHierarchicalTable | 15/15 | - | AllColumns, ColumnNameLevel0, ColumnNameLevel1, ColumnValueLevel0, ColumnValueLevel1, ColumnsLevel0, ColumnsLevel1, ContinueOnError, FocusedColumn, SelectLevel1, SendTelemetryOnlyOnFailure, Target | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| ExpandALVTree | 6/6 | - | ContinueOnError, Path, SendTelemetryOnlyOnFailure, Target | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| ExpandTree | 9/9 | - | AlterIfDisabled, ContinueOnError, DelayAfter, DelayBefore, Item, Items, Target | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| ExportUiTree | 14/14 | - | ContinueOnError, DestinationFile, DisplayName, ExportedString, Format, IncludeScreenshots, OperationTimeoutMS, Overwrite, Priority, Target, UiFramework | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| GetActiveWindow | 7/7 | - | ApplicationWindow, Body, ContinueOnError, DisplayName | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| GetPassword | 4/4 | - | DisplayName, Password, ProtectedPassword, Result | なし（Coded API なし（Classic の入力ダイアログ。Coded の API なし）） |
| GetSourceElementV2 | 3/3 | - | EventInfo | なし（Coded API なし（Classic のイベント・待機。Coded の uiAutomation が扱うのは Modern のターゲットだけ）） |
| GoBack | 5/5 | - | Browser, ContinueOnError, DisplayName | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| GoForward | 5/5 | - | Browser, ContinueOnError, DisplayName | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| GoHome | 5/5 | - | Browser, ContinueOnError, DisplayName | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| HideWindow | 5/5 | - | ContinueOnError, DisplayName, Window | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| HotkeyTriggerV2 | 8/8 | - | BlockEvent, Enabled, Key, KeyModifiers, SchedulingMode, TriggerId, UseWindowsHotKey | なし（Coded API なし（トリガー。Coded の uiAutomation にトリガーは無い）） |
| IndicateOnScreen | 7/7 | - | ContinueOnError, DisplayName, HidePreview, SelectScreenRegion, SelectedUiElement, SendTelemetryOnlyOnFailure | なし（Coded API なし（Classic の画面上の指示（人の操作を待つ）。Coded の API なし）） |
| KeyPressTriggerV2 | 13/13 | - | BlockEvent, Enabled, IncludeChildren, Key, KeyModifiers, SchedulingMode, Selector, TriggerId, TriggerMode | なし（Coded API なし（トリガー。Coded の uiAutomation にトリガーは無い）） |
| LoadImage | 6/6 | - | ContinueOnError, DisplayName, FileName, Image | なし（Coded API なし（Classic の画像の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| Login | 14/14 | - | Client, ContinueOnError, IsSecure, Language, MultiLogonOptionToChoose, Password, SecurePassword, SendTelemetryOnlyOnFailure, Target, Timeout, Username, Window | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| MaximizeWindow | 5/5 | - | ContinueOnError, DisplayName, Window | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| MinimizeWindow | 5/5 | - | ContinueOnError, DisplayName, Window | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| MouseTriggerV2 | 7/7 | - | BlockEvent, Enabled, KeyModifiers, MouseButton, SchedulingMode, TriggerId | なし（Coded API なし（トリガー。Coded の uiAutomation にトリガーは無い）） |
| MoveWindow | 9/9 | - | ContinueOnError, DisplayName, Height, Width, Window, X, Y | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| NAccessibilityCheck | 17/17 | - | AccessibilityResults, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Target, Timeout, WaitForReady | なし（Coded API なし（GetAccessibilityCheck は結果を JSON の文字列で返し、XAML の AccessibilityCheckResult と型が違う）） |
| NavigateTo | 6/6 | - | Browser, ContinueOnError, DisplayName, Url | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| NBlockUserInput | 21/21 | - | Allow3rdPartyApps, BlockType, Body, ContinueOnError, DelayAfter, DelayBefore, DisableUnblock, DisplayName, HealingAgentBehavior, KeyModifiers, Keys, Timeout | あり |
| NBrowserDialogScope | 21/21 | - | Body, ContinueOnError, DelayAfter, DelayBefore, DialogMessage, DialogResponse, DialogScopeType, DisplayName, HealingAgentBehavior, PromptDialogResponseText, Target, Timeout, WaitForDialogToAppearTimeout | なし（Coded API なし（スコープの API が無い。ダイアログは TargetAppOptions.DialogHandling で一括して自動応答する形で、メッセージを受け取る DialogMessage は無い）） |
| NBrowserFilePickerScope | 20/20 | - | Body, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Mode, MultiFilePaths, SingleFilePath, Target, Timeout, WaitForDialogToAppearTimeout | なし（Coded API なし（ファイル選択ダイアログを扱う API が無い）） |
| NCheck | 17/17 | - | Action, AlterIfDisabled, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Target, Timeout | あり |
| NCheckElement | 16/16 | - | DelayBefore, DisplayName, Result, Target, Timeout | なし（Coded API なし（結果が「要素がある」を表す NCheckElement に当たるメソッドが UiTargetApp に無い。IsEnabled / WaitState は意味が違う）） |
| NCheckState | 25/25 | - | CheckVisibility, DelayBefore, DisplayName, Exists, HealingAgentBehavior, IfExists, IfNotExists, Mode, Target, Timeout | あり |
| NClick | 25/25 | - | ActivateBefore, AlterIfDisabled, ClickType, ContinueOnError, CursorMotionType, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, InteractionMode, KeyModifiers, MouseButton, Target, Timeout, UnblockInput, VerifyOptions | あり |
| NClosePopup | 21/21 | - | AgentType, ContinueOnError, DelayAfter, DelayBefore, DisplayName, EnableAI, HealingAgentBehavior, PopupAppearTimeout, PopupException, PopupHandled, PreferredButtons, Target, Timeout | なし（Coded API なし（ClosePopup は戻り値が無く、XAML の PopupHandled（NotFound / Handled など）を受け取れない。同じ結果にならないので対応させない）） |
| NDragAndDrop | 25/25 | - | ContinueOnError, CursorMotionType, DelayAfter, DelayBefore, DelayBetweenActions, DestinationTarget, DisplayName, HealingAgentBehavior, KeyModifiers, MouseButton, PointOffset, SecondaryPointOffset, Target, Timeout, UseSourceHover | あり |
| NElementScope | 19/19 | - | Body, DisplayName, InteractionMode, IsLoose, Target, Timeout | なし（Coded API なし（要素スコープに当たる using 形式の API が無い。UiTargetApp.GetUiElement は要素を返すだけ）） |
| NExtractData | 24/24 | - | AppendResults, DataTable, DelayBetweenPages, DisplayName, ExtractDataSettings, ExtractMetadata, InteractionMode, LimitExtractionTo, MaximumResults, Target, Timeout | あり |
| NExtractDataGeneric | 25/25 | - | - | 未作成 |
| NExtractFormDataGeneric | 18/18 | - | AgentType, ContinueOnError, DelayAfter, DelayBefore, DisplayName, FieldMappings, FormData, HealingAgentBehavior, Target, Timeout | なし（Coded API なし（セマンティックな「フォームデータを抽出」に当たる API が IUiAutomationAppService / UiTargetApp に無い。UiTargetApp.ExtractData は「データの抽出」（NExtractData）の方）） |
| NExtractUIData | 21/21 | - | AgentType, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, IsDOMEnabled, Queries, Target, Timeout, UIData, UIDataTable | なし（Coded API なし（セマンティックな「UI データを抽出」に当たる API が無い）） |
| NFillForm | 19/19 | - | AgentType, ContinueOnError, DataSource, DelayAfter, DelayBefore, DisplayName, EnableValidation, HealingAgentBehavior, InteractionMode, Target, Timeout | あり |
| NFindElements | 18/18 | - | Children, DisplayName, FilterTarget, Mode, Target, Timeout | なし（Coded API なし（UiTargetApp.GetChildren(TargetAnchorableModel, GetChildrenOptions) は Web のターゲットで System.ArgumentException「Value does not fall within the expected range」になる。run で確認済み。Timeout の有無でも同じ）） |
| NForEachUiElement | 24/25 | VariablesMetadata（コレクション） | Body, DelayBetweenPages, DisplayName, ExtractDataSettings, ExtractMetadata, InteractionMode, LimitExtractionTo, MaximumResults, Target, Timeout | なし（Coded API なし（UI 要素を繰り返す API が UiTargetApp に無い。ExtractData か GetChildren と foreach で書き直す）） |
| NGetAttributeGeneric | 17/17 | - | Attribute, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Result, Target, Timeout | あり |
| NGetBrowserData | 20/20 | - | BrowserType, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, SessionData, SourceUserDataFolder, Target, Timeout, UserProfile | なし（Coded API なし（ブラウザのセッション データを読む API が無い）。利用者の Cookie などの実データを読むので run もしない） |
| NGetClipboard | 16/16 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Result, Target, Timeout | あり |
| NGetText | 21/21 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, ScrapingMethod, Target, TextString, Timeout | あり |
| NGetUrl | 17/17 | - | CurrentUrl, DisplayName, Target, Timeout, WaitForReady | あり |
| NGoToUrl | 17/17 | - | DisplayName, Mode, Target, Timeout, Url | あり |
| NHideStatusWindow | 15/15 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Target, Timeout | あり |
| NHighlight | 18/18 | - | Color, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, HighlightMode, HighlightTime, Target, Timeout | あり |
| NHover | 20/20 | - | ContinueOnError, CursorMotionType, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, HoverTime, InteractionMode, PointOffset, Target, Timeout, VerifyOptions | あり |
| NInjectJsScript | 19/19 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, ExecutionWorld, HealingAgentBehavior, InputParameter, ScriptCode, ScriptOutput, Target, Timeout | なし（Coded API なし（InjectJsScriptOptions は ScriptCodePath＝スクリプトのファイルのパスで、ScriptCode の文字列を渡せない。ScriptOutput の受け方も XAML と違う）） |
| NKeyboardShortcuts | 24/24 | - | ActivateBefore, ClickBeforeMode, ContinueOnError, DelayAfter, DelayBefore, DelayBetweenKeys, DelayBetweenShortcuts, DisplayName, HealingAgentBehavior, InteractionMode, PointOffset, ShortcutsArgument, Target, Timeout, VerifyOptions | あり |
| NMouseScroll | 22/22 | - | ContinueOnError, CursorMotionType, DelayAfter, DelayBefore, Direction, DisplayName, HealingAgentBehavior, InteractionMode, KeyModifiers, MovementUnits, PointOffset, SearchedElement, Target, Timeout | あり |
| NNavigateBrowser | 16/16 | - | Action, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Target, Timeout | なし（Coded API なし（UiTargetApp に前に戻る・進む・再読み込みなどのメソッドが無い。GoToUrl と GetUrl だけ）） |
| NSAPCallTransaction | 17/17 | - | ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, ForceRefreshView, HealingAgentBehavior, Prefix, Target, Timeout, Transaction | あり |
| NSAPClickPictureOnScreen | 20/20 | - | ActivateBefore, AlterIfDisabled, ClickType, ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, ForceRefreshView, HealingAgentBehavior, KeyModifiers, PointOffset, Target, Timeout | なし（Coded API なし（UiTargetApp に SAPClickPictureOnScreen が無い）） |
| NSAPClickToolbarButton | 18/18 | - | AlterIfDisabled, ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, ForceRefreshView, HealingAgentBehavior, Item, Items, Target, Timeout | あり |
| NSAPExpandALVHierarchicalTable | 22/22 | - | AllColumns, ColumnNameLevel0, ColumnNameLevel1, ColumnValueLevel0, ColumnValueLevel1, ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, FocusedColumn, ForceRefreshView, HealingAgentBehavior, SelectLevel1, Target, Timeout | なし（Coded API なし（UiTargetApp に SAPExpandALVHierarchicalTable が無い）） |
| NSAPExpandALVTree | 16/16 | - | ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, ForceRefreshView, HealingAgentBehavior, Path, Target, Timeout | あり |
| NSAPExpandTree | 19/19 | - | AlterIfDisabled, ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, ForceRefreshView, HealingAgentBehavior, Item, Items, Target, Timeout | あり |
| NSAPLogin | 22/22 | - | Client, ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, ForceRefreshView, HealingAgentBehavior, IsSecure, Language, Option, Password, Target, Timeout, Username | なし（Coded API なし（UiTargetApp に SAPLogin が無い）） |
| NSAPLogon | 30/30 | - | AttachMode, Body, CloseMode, ConnectionId, ConnectionName, ContinueOnError, DelayBetweenRetries, Description, DisplayName, HealingAgentBehavior, InteractionMode, IsAuthenticationRequired, IsIndicateOnDesktopEnabled, OpenMode, Retries, TargetApp, Timeout, WindowResize | なし（Coded API なし（UiTargetApp に SAPLogon が無い。SAP Logon の起動は uiAutomation.Open で近い動きになるが、別の API なので対応させない）） |
| NSAPReadStatusbar | 20/20 | - | ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, ForceRefreshView, HealingAgentBehavior, MessageData, MessageId, MessageNumber, MessageText, MessageType, Target, Timeout | あり |
| NSAPSelectDatesInCalendar | 21/21 | - | ContinueOnError, Date, DelayAfter, DelayBefore, Description, DisplayName, EndDate, ForceRefreshView, HealingAgentBehavior, SelectType, StartDate, Target, Timeout, Week, Year | あり |
| NSAPSelectMenuItem | 18/18 | - | AlterIfDisabled, ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, ForceRefreshView, HealingAgentBehavior, Item, Items, Target, Timeout | あり |
| NSAPTableCellScope | 22/22 | - | Body, ColumnName, ColumnNames, ContinueOnError, DelayAfter, DelayBefore, Description, DisplayName, ForceRefreshView, HealingAgentBehavior, RowIndex, RowType, Target, Timeout | なし（Coded API なし（UiTargetApp に SAPTableCellScope が無い）） |
| NSaveImage | 18/18 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, FileName, HealingAgentBehavior, Image, OutFile, Target, Timeout | なし（Coded API なし（画像を保存する API が無い。TakeScreenshot の FileName が近いが、UiPath.Core.Image を受け取れない）） |
| NSelectItem | 18/18 | - | AlterIfDisabled, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Item, Items, Target, Timeout | あり |
| NSetBrowserData | 17/17 | - | Browser, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, SessionData, Target, Timeout | なし（Coded API なし（ブラウザのセッション データを書く API が無い）。利用者の Cookie などの実データを書き換えるので run もしない） |
| NSetClipboard | 16/16 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Target, Text, Timeout | あり |
| NSetCVServer | 18/18 | - | ApiKey, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Server, Timeout, UseLocalServer | あり |
| NSetFocus | 15/15 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Target, Timeout | なし（Coded API なし（UiTargetApp に SetFocus / Focus のメソッドが無い）） |
| NSetProjectSetting | 17/17 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Key, Timeout, Value | あり |
| NSetRuntimeBrowser | 16/16 | - | BrowserType, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Timeout | あり |
| NSetText | 18/18 | - | AlterIfDisabled, CacheTargetElement, ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Target, Text, Timeout | なし（Coded API なし（UiTargetApp.SetValue は「UI 要素を更新」（セマンティック）に当たり、セレクタのターゲットでは UnsupportedTargetException になる。run で確認済み。文字列の入力は NTypeInto を使う）） |
| NSetValue | 19/19 | - | AgentType, ContinueOnError, DelayAfter, DelayBefore, DisplayName, EnableValidation, HealingAgentBehavior, InteractionMode, Target, Timeout, Value | あり |
| NShowStatusMessage | 19/19 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Level, Message, Progress, Target, Timeout, Title | あり |
| NShowStatusWindow | 24/24 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, HistoryCount, Message, Opacity, Position, ShowTimestamps, Target, Theme, Timeout, Title, X, Y | あり |
| NTakeScreenshot | 23/23 | - | ContinueOnError, DelayAfter, DelayBefore, DelayBeforeScreenshot, DisplayName, FileName, FileNameMode, HealingAgentBehavior, IsDesktop, OutFile, OutImage, SaveScreenshotTo, SavedTo, Target, Timeout | あり |
| NTypeInto | 29/29 | - | ActivateBefore, AlterIfDisabled, ClickBeforeMode, ClipboardMode, ContinueOnError, DelayAfter, DelayBefore, DelayBetweenKeys, DeselectAfter, DisplayName, EmptyFieldMode, HealingAgentBehavior, InteractionMode, Target, Text, Timeout, VerifyOptions | あり |
| NUITask | 33/33 | - | - | 未作成 |
| NUnblockUserInput | 15/15 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Timeout | あり |
| NWindowOperation | 20/20 | - | ContinueOnError, DelayAfter, DelayBefore, DisplayName, HealingAgentBehavior, Height, Operation, Timeout, Width, X, Y | あり |
| OpenApplication | 14/14 | - | ApplicationWindow, Arguments, Body, ContinueOnError, DisplayName, FileName, Selector, TimeoutMS, WorkingDirectory | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| ReadStatusbar | 8/8 | - | ContinueOnError, MessageData, MessageId, MessageNumber, MessageText, MessageType, Target | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| RefreshBrowser | 5/5 | - | Browser, ContinueOnError, DisplayName | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| ReplayUserEventV2 | 2/2 | - | EventInfo | なし（Coded API なし（Classic のイベント・待機。Coded の uiAutomation が扱うのは Modern のターゲットだけ）） |
| RestoreWindow | 5/5 | - | ContinueOnError, DisplayName, Window | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| SapSessionTrigger | 5/5 | - | Attributes, Enabled, SchedulingMode, TriggerId | なし（Coded API なし（トリガー。Coded の uiAutomation にトリガーは無い）） |
| SaveImage | 6/6 | - | ContinueOnError, DisplayName, FileName, Image | なし（Coded API なし（Classic の画像の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| SelectDatesInCalendar | 11/11 | - | ContinueOnError, Date, EndDate, SelectType, SendTelemetryOnlyOnFailure, StartDate, Target, Week, Year | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| SelectMenuItem | 8/8 | - | AlterIfDisabled, ContinueOnError, DelayAfter, DelayBefore, Item, Items, Target | なし（Coded API なし（Classic の SAP 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ。Modern の SAP は NSAP* で別）） |
| SetClippingRegion | 8/8 | - | ContinueOnError, Direction, DisplayName, Element, Region | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| SetToClipboard | 5/5 | - | ContinueOnError, DisplayName, SendTelemetryOnlyOnFailure, Text | なし（Coded API なし（Classic のクリップボード操作。Coded の uiAutomation.SetClipboard は Modern（NSetClipboard）のオプションで、Classic とは対応しない）） |
| ShowWindow | 5/5 | - | ContinueOnError, DisplayName, Window | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| StartProcess | 9/9 | - | Arguments, ContinueOnError, DisplayName, FileName, StartType, Timeout, WorkingDirectory | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| SystemTriggerV2 | 6/6 | - | BlockEvent, Enabled, SchedulingMode, TriggerId, TriggerInput | なし（Coded API なし（トリガー。Coded の uiAutomation にトリガーは無い）） |
| WaitAttribute | 8/8 | - | Attribute, AttributeValue, ContinueOnError, DisplayName, Element, TimeoutMS | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
| WindowScope | 13/13 | - | ApplicationWindow, Body, ContinueOnError, DisplayName, Selector, TimeoutMS, Window | なし（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ）） |
