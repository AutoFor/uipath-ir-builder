# プロパティの網羅

`node tools/ir/coverage.ts` が生成する。手で直さない。

カタログ（非推奨・非表示を除く）の全プロパティを、IR で書けるかで分けた。「サンプルで使用」は `samples/ir/**` の IR で実際に書いたプロパティ。「Coded」は `mappings/` の対応表の状態。

| パッケージ | アクティビティ | プロパティ | 書ける | 書けない | サンプルで使用 | Coded 対応表あり / C# の構文 / API なし / 未作成 |
| --- | --- | --- | --- | --- | --- | --- |
| System.Activities | 123 | 599 | 555 | 44 | 28 | 2 / 11 / 0 / 110 |
| UiPath.System.Activities | 171 | 1032 | 1013 | 19 | 22 | 3 / 5 / 2 / 161 |
| UiPath.UIAutomation.Activities | 108 | 1575 | 1458 | 117 | 0 | 0 / 0 / 0 / 108 |

## 書けないプロパティ（理由別）

| 理由 | 数 | 方針 |
| --- | --- | --- |
| UI のターゲット | 89 | Target / TargetAnchorable / ClickOffset など。UIAutomation の設計を担当するワーカーが IR の形を決める（後で追記） |
| コレクション | 41 | List / Collection / 配列の値。要素構文（`<Prop><scg:List>…</scg:List></Prop>`）が要る。IR では JSON の配列で書き、生成器が要素構文にする方針。必要になったアクティビティのイシューで対応する |
| オブジェクト | 31 | CultureInfo、フィルター設定などの複合型。型ごとに XAML の書き方を get-default-xaml で確かめてから対応する |
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
| AndAlso | 3/3 | - | - | 未作成 |
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
| CompensableActivity | 6/6 | - | - | 未作成 |
| Compensate | 2/2 | - | - | 未作成 |
| Confirm | 2/2 | - | - | 未作成 |
| Constraint | 2/2 | - | - | 未作成 |
| CreateBookmarkScope | 1/1 | - | - | 未作成 |
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
| GetChildSubtree | 2/2 | - | - | 未作成 |
| GetParentChain | 2/2 | - | - | 未作成 |
| GetWorkflowTree | 2/2 | - | - | 未作成 |
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
| OrElse | 3/3 | - | - | 未作成 |
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

### UiPath.System.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| AddDataColumn | 9/9 | - | - | 未作成 |
| AddDataRow | 4/4 | - | - | 未作成 |
| AddLogFields | 2/2 | - | DisplayName, Fields | なし（Coded API なし（基底クラスの Log の additionalLogFields で、ログ1件ごとに渡す）） |
| AddOrSubtractFromDate | 5/5 | - | - | 未作成 |
| AddQueueItem | 12/12 | - | - | 未作成 |
| AddSubtractTimePeriodDateModification | 4/4 | - | - | 未作成 |
| AddTransactionItem | 12/12 | - | - | 未作成 |
| AppendItemToCollection | 2/3 | Items（コレクション） | - | 未作成 |
| AppendItemToList | 4/4 | - | - | 未作成 |
| AppendLine | 7/7 | - | - | 未作成 |
| AskWhenRun | 1/1 | - | - | 未作成 |
| Beep | 1/1 | - | - | 未作成 |
| BeginProcess | 8/8 | - | - | 未作成 |
| Break | 1/1 | - | - | C# の構文 |
| BuildCollection | 3/4 | NextItems（コレクション） | - | 未作成 |
| BuildDataTable | 3/3 | - | - | 未作成 |
| BulkAddQueueItems | 8/8 | - | - | 未作成 |
| ChangeCase | 3/3 | - | - | 未作成 |
| ChangeType | 3/4 | Format（オブジェクト） | - | 未作成 |
| CheckFalse | 4/4 | - | - | 未作成 |
| CheckTrue | 4/4 | - | - | 未作成 |
| ClearDataTable | 2/2 | - | - | 未作成 |
| CollectionToDataTable | 3/3 | - | - | 未作成 |
| CombineText | 4/4 | - | - | 未作成 |
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
| DeleteQueueItems | 4/4 | - | - | 未作成 |
| DeleteStorageFile | 7/7 | - | - | 未作成 |
| DisableTrigger | 2/2 | - | - | 未作成 |
| DownloadFileFromUrl | 8/8 | - | - | 未作成 |
| DownloadStorageFile | 8/8 | - | - | 未作成 |
| EnableTrigger | 2/2 | - | - | 未作成 |
| EvaluateBusinessRule | 12/12 | - | - | 未作成 |
| ExecutePowerShell | 7/7 | - | - | 未作成 |
| ExistsInCollection`1 | 5/5 | - | - | 未作成 |
| ExtractDateTime | 4/5 | LocalizationCode（オブジェクト） | - | 未作成 |
| ExtractFiles | 12/12 | - | - | 未作成 |
| ExtractText | 10/10 | - | - | 未作成 |
| FileChangeTrigger | 6/6 | - | - | 未作成 |
| FileChangeTriggerV2 | 9/9 | - | - | 未作成 |
| FileChangeTriggerV3 | 9/9 | - | - | 未作成 |
| FileExistsX | 3/3 | - | - | 未作成 |
| FilterCollection | 3/4 | Filter（オブジェクト） | - | 未作成 |
| FilterDataTable | 5/7 | Filters（コレクション）, SelectColumns（コレクション） | - | 未作成 |
| FindAndReplace | 5/5 | - | - | 未作成 |
| FindDayOfWeekDateModification | 3/3 | - | - | 未作成 |
| FindStartEndDateModification | 3/3 | - | - | 未作成 |
| FolderExistsX | 3/3 | - | - | 未作成 |
| ForEach`1 | 6/6 | - | Body, DisplayName, Values | C# の構文 |
| ForEachFileX | 7/7 | - | - | 未作成 |
| ForEachFolderX | 7/7 | - | - | 未作成 |
| ForEachRow | 10/10 | - | - | 未作成 |
| FormatDateAsText | 3/4 | LocalizationCode（オブジェクト） | - | 未作成 |
| FormatValue | 2/3 | Format（オブジェクト） | - | 未作成 |
| GenerateDataTable | 15/15 | - | - | 未作成 |
| GetCurrentJobInfo | 2/2 | - | - | 未作成 |
| GetEnvironmentFolder | 3/3 | - | - | 未作成 |
| GetEnvironmentVariable | 4/4 | - | - | 未作成 |
| GetFileInfoX | 3/3 | - | - | 未作成 |
| GetFolderInfoX | 4/4 | - | - | 未作成 |
| GetJobs | 7/8 | FilterBuilder（オブジェクト） | - | 未作成 |
| GetLastDownloadedFile | 7/7 | - | - | 未作成 |
| GetProcesses | 3/3 | - | - | 未作成 |
| GetQueueItem | 10/10 | - | - | 未作成 |
| GetQueueItems | 19/20 | FilterBuilder（オブジェクト） | - | 未作成 |
| GetRobotAsset | 7/7 | - | - | 未作成 |
| GetRobotCredential | 8/8 | - | - | 未作成 |
| GetRowItem | 6/6 | - | - | 未作成 |
| GetSecret | 6/6 | - | - | 未作成 |
| GetTransactionItem | 7/7 | - | - | 未作成 |
| GetUsernamePasswordX | 8/8 | - | - | 未作成 |
| GlobalVariableChangedTrigger | 5/5 | - | - | 未作成 |
| IfElseIfV2 | 5/5 | - | - | 未作成 |
| InputDialog | 8/8 | - | - | 未作成 |
| InterruptibleDoWhile | 5/5 | - | - | 未作成 |
| InterruptibleWhile | 5/5 | - | - | 未作成 |
| InvokeCode | 5/5 | - | Arguments, Code, DisplayName, Language | なし（Coded では C# をそのまま書くので InvokeCode は要らない） |
| InvokeComMethod | 7/7 | - | - | 未作成 |
| InvokePowerShell | 8/8 | - | - | 未作成 |
| InvokeProcess | 16/16 | - | - | 未作成 |
| InvokeVBScript | 8/9 | Arguments（コレクション） | - | 未作成 |
| InvokeWorkflowFile | 13/13 | - | Arguments, DisplayName, WorkflowFileName | あり |
| InvokeWorkflowInteractive | 18/18 | - | - | 未作成 |
| IsMatch | 8/8 | - | - | 未作成 |
| JoinDataTables | 5/6 | Arguments（コレクション） | - | 未作成 |
| KillProcess | 5/5 | - | - | 未作成 |
| ListStorageFiles | 9/9 | - | - | 未作成 |
| LookupDataTable | 11/11 | - | - | 未作成 |
| ManualTrigger | 2/2 | - | - | 未作成 |
| Matches | 9/9 | - | - | 未作成 |
| MergeCollections | 3/3 | - | - | 未作成 |
| MergeDataTable | 4/4 | - | - | 未作成 |
| ModifyDate | 10/10 | - | - | 未作成 |
| ModifyText | 5/5 | - | - | 未作成 |
| MoveFile | 7/7 | - | - | 未作成 |
| MoveFolderX | 4/4 | - | - | 未作成 |
| MultipleAssign | 2/2 | - | AssignOperations, DisplayName | C# の構文 |
| NotifyGlobalVariableChanged | 2/2 | - | - | 未作成 |
| OrchestratorHttpRequest | 9/9 | - | - | 未作成 |
| OutputDataTable | 3/3 | - | - | 未作成 |
| PathExists | 5/5 | - | - | 未作成 |
| Placeholder | 2/2 | - | - | 未作成 |
| PostponeTransactionItem | 6/6 | - | - | 未作成 |
| ProcessEndTrigger | 5/5 | - | - | 未作成 |
| ProcessEndTriggerV2 | 5/5 | - | - | 未作成 |
| ProcessStartTrigger | 5/5 | - | - | 未作成 |
| ProcessStartTriggerV2 | 5/5 | - | - | 未作成 |
| ProcessTrackingScope | 10/10 | - | - | 未作成 |
| QueueTrigger | 9/9 | - | - | 未作成 |
| RaiseAlert | 6/6 | - | - | 未作成 |
| ReadListItem | 4/4 | - | - | 未作成 |
| ReadStorageText | 8/8 | - | - | 未作成 |
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
| Replace | 9/9 | - | - | 未作成 |
| ReportStatus | 2/2 | - | - | 未作成 |
| ResetTimer | 2/2 | - | - | 未作成 |
| ResumeTimer | 2/2 | - | - | 未作成 |
| RetryScope | 8/9 | Condition（ActivityFunc） | ActivityBody, DisplayName, NumberOfRetries, RetryInterval | C# の構文 |
| Return | 1/1 | - | - | 未作成 |
| RunJob | 17/17 | - | - | 未作成 |
| SelectFile | 6/6 | - | - | 未作成 |
| SelectFolder | 2/2 | - | - | 未作成 |
| SendEmailNotification | 7/7 | - | - | 未作成 |
| SetAsset | 8/8 | - | - | 未作成 |
| SetCredential | 9/9 | - | - | 未作成 |
| SetEnvironmentVariable | 4/4 | - | - | 未作成 |
| SetSecret | 8/8 | - | - | 未作成 |
| SetTaskStatus | 3/3 | - | - | 未作成 |
| SetTraceStatus | 3/3 | - | - | 未作成 |
| SetTransactionProgress | 5/5 | - | - | 未作成 |
| SetTransactionStatus | 13/13 | - | - | 未作成 |
| ShouldStop | 1/1 | - | - | 未作成 |
| SortDataTable | 7/7 | - | - | 未作成 |
| SplitText | 5/5 | - | - | 未作成 |
| StartJob | 14/14 | - | - | 未作成 |
| StartTimer | 2/2 | - | - | 未作成 |
| StartTriggers | 13/13 | - | - | 未作成 |
| StopJob | 5/5 | - | - | 未作成 |
| StopTimer | 2/2 | - | - | 未作成 |
| StopTriggers | 2/2 | - | - | 未作成 |
| TextToLeftRight | 8/8 | - | - | 未作成 |
| TimeoutScope | 4/4 | - | - | 未作成 |
| TimeTrigger | 14/17 | DaysOfMonthToRunOn（コレクション）, MonthlyDaysToRunOn（コレクション）, WeeklyDaysToRunOn（コレクション） | - | 未作成 |
| TrackObject | 7/7 | - | - | 未作成 |
| TriggerScope | 7/7 | - | - | 未作成 |
| UpdateListItem | 4/4 | - | - | 未作成 |
| UpdateRowItem | 5/5 | - | - | 未作成 |
| UploadStorageFile | 10/10 | - | - | 未作成 |
| WaitQueueItem | 10/10 | - | - | 未作成 |
| WriteStorageText | 9/9 | - | - | 未作成 |
| WriteTextFile | 7/7 | - | FileName, Text | あり |

### UiPath.UIAutomation.Activities

| アクティビティ | 書ける | 書けない | サンプルで使用 | Coded |
| --- | --- | --- | --- | --- |
| AnchorBase | 5/5 | - | - | 未作成 |
| AnchorContextAware | 6/6 | - | - | 未作成 |
| BlockUserInput | 10/10 | - | - | 未作成 |
| CallTransaction | 5/6 | Target（UI のターゲット） | - | 未作成 |
| CellScope | 10/12 | ColumnNames（コレクション）, Target（UI のターゲット） | - | 未作成 |
| ClickImageTriggerV2 | 12/14 | ClippingRegion（UI のターゲット）, Image（UI のターゲット） | - | 未作成 |
| ClickPictureOnScreen | 9/10 | Target（UI のターゲット） | - | 未作成 |
| ClickToolbarButton | 6/8 | Items（コレクション）, Target（UI のターゲット） | - | 未作成 |
| ClickTriggerV2 | 13/14 | ClippingRegion（UI のターゲット） | - | 未作成 |
| CloseTab | 5/5 | - | - | 未作成 |
| CloseWindow | 11/11 | - | - | 未作成 |
| ExpandALVHierarchicalTable | 11/15 | AllColumns（コレクション）, ColumnsLevel0（コレクション）, ColumnsLevel1（コレクション）, Target（UI のターゲット） | - | 未作成 |
| ExpandALVTree | 5/6 | Target（UI のターゲット） | - | 未作成 |
| ExpandTree | 7/9 | Items（コレクション）, Target（UI のターゲット） | - | 未作成 |
| ExportUiTree | 13/14 | Target（UI のターゲット） | - | 未作成 |
| GetActiveWindow | 7/7 | - | - | 未作成 |
| GetPassword | 3/3 | - | - | 未作成 |
| GetSourceElementV2 | 3/3 | - | - | 未作成 |
| GoBack | 5/5 | - | - | 未作成 |
| GoForward | 5/5 | - | - | 未作成 |
| GoHome | 5/5 | - | - | 未作成 |
| HideWindow | 5/5 | - | - | 未作成 |
| HotkeyTriggerV2 | 8/8 | - | - | 未作成 |
| IndicateOnScreen | 7/7 | - | - | 未作成 |
| KeyPressTriggerV2 | 13/13 | - | - | 未作成 |
| LoadImage | 6/6 | - | - | 未作成 |
| Login | 13/14 | Target（UI のターゲット） | - | 未作成 |
| MaximizeWindow | 5/5 | - | - | 未作成 |
| MinimizeWindow | 5/5 | - | - | 未作成 |
| MouseTriggerV2 | 7/7 | - | - | 未作成 |
| MoveWindow | 9/9 | - | - | 未作成 |
| NAccessibilityCheck | 16/17 | Target（UI のターゲット） | - | 未作成 |
| NavigateTo | 6/6 | - | - | 未作成 |
| NBlockUserInput | 20/21 | Target（UI のターゲット） | - | 未作成 |
| NBrowserDialogScope | 20/21 | Target（UI のターゲット） | - | 未作成 |
| NBrowserFilePickerScope | 19/20 | Target（UI のターゲット） | - | 未作成 |
| NCheck | 16/17 | Target（UI のターゲット） | - | 未作成 |
| NCheckElement | 15/16 | Target（UI のターゲット） | - | 未作成 |
| NCheckState | 23/24 | Target（UI のターゲット） | - | 未作成 |
| NClick | 22/25 | PointOffset（UI のターゲット）, Target（UI のターゲット）, VerifyOptions（オブジェクト） | - | 未作成 |
| NClosePopup | 20/21 | Target（UI のターゲット） | - | 未作成 |
| NDragAndDrop | 21/25 | DestinationTarget（UI のターゲット）, PointOffset（UI のターゲット）, SecondaryPointOffset（UI のターゲット）, Target（UI のターゲット） | - | 未作成 |
| NElementScope | 18/19 | Target（UI のターゲット） | - | 未作成 |
| NExtractData | 22/24 | NextLink（UI のターゲット）, Target（UI のターゲット） | - | 未作成 |
| NExtractDataGeneric | 23/25 | NextLink（UI のターゲット）, Target（UI のターゲット） | - | 未作成 |
| NExtractFormDataGeneric | 16/18 | FieldMappings（コレクション）, Target（UI のターゲット） | - | 未作成 |
| NExtractUIData | 18/21 | FieldMappings（コレクション）, Queries（コレクション）, Target（UI のターゲット） | - | 未作成 |
| NFillForm | 18/19 | Target（UI のターゲット） | - | 未作成 |
| NFindElements | 16/18 | FilterTarget（UI のターゲット）, Target（UI のターゲット） | - | 未作成 |
| NForEachUiElement | 21/25 | Filter（オブジェクト）, NextLink（UI のターゲット）, Target（UI のターゲット）, VariablesMetadata（コレクション） | - | 未作成 |
| NGetAttributeGeneric | 16/17 | Target（UI のターゲット） | - | 未作成 |
| NGetBrowserData | 19/20 | Target（UI のターゲット） | - | 未作成 |
| NGetClipboard | 15/16 | Target（UI のターゲット） | - | 未作成 |
| NGetText | 20/21 | Target（UI のターゲット） | - | 未作成 |
| NGetUrl | 16/17 | Target（UI のターゲット） | - | 未作成 |
| NGoToUrl | 16/17 | Target（UI のターゲット） | - | 未作成 |
| NHideStatusWindow | 14/15 | Target（UI のターゲット） | - | 未作成 |
| NHighlight | 16/18 | Color（オブジェクト）, Target（UI のターゲット） | - | 未作成 |
| NHover | 17/20 | PointOffset（UI のターゲット）, Target（UI のターゲット）, VerifyOptions（オブジェクト） | - | 未作成 |
| NInjectJsScript | 18/19 | Target（UI のターゲット） | - | 未作成 |
| NKeyboardShortcuts | 21/24 | PointOffset（UI のターゲット）, Target（UI のターゲット）, VerifyOptions（オブジェクト） | - | 未作成 |
| NMouseScroll | 19/22 | PointOffset（UI のターゲット）, SearchedElement（オブジェクト）, Target（UI のターゲット） | - | 未作成 |
| NNavigateBrowser | 15/16 | Target（UI のターゲット） | - | 未作成 |
| NSAPCallTransaction | 16/17 | Target（UI のターゲット） | - | 未作成 |
| NSAPClickPictureOnScreen | 18/20 | PointOffset（UI のターゲット）, Target（UI のターゲット） | - | 未作成 |
| NSAPClickToolbarButton | 16/18 | Items（コレクション）, Target（UI のターゲット） | - | 未作成 |
| NSAPExpandALVHierarchicalTable | 20/22 | AllColumns（コレクション）, Target（UI のターゲット） | - | 未作成 |
| NSAPExpandALVTree | 15/16 | Target（UI のターゲット） | - | 未作成 |
| NSAPExpandTree | 17/19 | Items（コレクション）, Target（UI のターゲット） | - | 未作成 |
| NSAPLogin | 21/22 | Target（UI のターゲット） | - | 未作成 |
| NSAPLogon | 27/31 | AutoGenerationOptions（オブジェクト）, DialogHandling（オブジェクト）, OCREngine（ActivityFunc）, TargetApp（UI のターゲット） | - | 未作成 |
| NSAPReadStatusbar | 19/20 | Target（UI のターゲット） | - | 未作成 |
| NSAPSelectDatesInCalendar | 20/21 | Target（UI のターゲット） | - | 未作成 |
| NSAPSelectMenuItem | 16/18 | Items（コレクション）, Target（UI のターゲット） | - | 未作成 |
| NSAPTableCellScope | 20/22 | ColumnNames（コレクション）, Target（UI のターゲット） | - | 未作成 |
| NSaveImage | 17/18 | Target（UI のターゲット） | - | 未作成 |
| NSelectItem | 16/18 | Items（コレクション）, Target（UI のターゲット） | - | 未作成 |
| NSetBrowserData | 16/17 | Target（UI のターゲット） | - | 未作成 |
| NSetClipboard | 15/16 | Target（UI のターゲット） | - | 未作成 |
| NSetCVServer | 17/18 | Target（UI のターゲット） | - | 未作成 |
| NSetFocus | 14/15 | Target（UI のターゲット） | - | 未作成 |
| NSetProjectSetting | 16/17 | Target（UI のターゲット） | - | 未作成 |
| NSetRuntimeBrowser | 15/16 | Target（UI のターゲット） | - | 未作成 |
| NSetText | 17/18 | Target（UI のターゲット） | - | 未作成 |
| NSetValue | 18/19 | Target（UI のターゲット） | - | 未作成 |
| NShowStatusMessage | 18/19 | Target（UI のターゲット） | - | 未作成 |
| NShowStatusWindow | 23/24 | Target（UI のターゲット） | - | 未作成 |
| NTakeScreenshot | 22/23 | Target（UI のターゲット） | - | 未作成 |
| NTypeInto | 26/29 | PointOffset（UI のターゲット）, Target（UI のターゲット）, VerifyOptions（オブジェクト） | - | 未作成 |
| NUITask | 31/33 | Prompt（コレクション）, Target（UI のターゲット） | - | 未作成 |
| NUnblockUserInput | 14/15 | Target（UI のターゲット） | - | 未作成 |
| NWindowOperation | 19/20 | Target（UI のターゲット） | - | 未作成 |
| OpenApplication | 14/14 | - | - | 未作成 |
| ReadStatusbar | 7/8 | Target（UI のターゲット） | - | 未作成 |
| RefreshBrowser | 5/5 | - | - | 未作成 |
| ReplayUserEventV2 | 2/2 | - | - | 未作成 |
| RestoreWindow | 5/5 | - | - | 未作成 |
| SapSessionTrigger | 5/5 | - | - | 未作成 |
| SaveImage | 6/6 | - | - | 未作成 |
| SelectDatesInCalendar | 10/11 | Target（UI のターゲット） | - | 未作成 |
| SelectMenuItem | 6/8 | Items（コレクション）, Target（UI のターゲット） | - | 未作成 |
| SetClippingRegion | 7/8 | Size（UI のターゲット） | - | 未作成 |
| SetToClipboard | 5/5 | - | - | 未作成 |
| ShowWindow | 5/5 | - | - | 未作成 |
| StartProcess | 9/9 | - | - | 未作成 |
| SystemTriggerV2 | 6/6 | - | - | 未作成 |
| WaitAttribute | 8/8 | - | - | 未作成 |
| WindowScope | 13/13 | - | - | 未作成 |
