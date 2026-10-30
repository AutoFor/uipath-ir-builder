# IR で書けないプロパティの理由

[coverage.md](coverage.md) の「書けない」と「読み取り専用」の中身と、対応しない理由をまとめる。coverage.md は生成物なので、理由はここに書く。

## 読み取り専用（44 件。書けないのが正しい）

抽出器が、public の setter が無いプロパティに `readOnly: true` を付ける（コレクションは、XAML が既存のものに要素を足せるので付けない）。`writable` が「書けない」と判定し、props に書くと検証で `UNSUPPORTED_PROP` になる。coverage.md の数からは外している。

| プロパティ | 件数 |
| --- | --- |
| `BindingsKey`（Orchestrator 系、ストレージ系） | 23 |
| `AllowedItemType`（ModifyText、ModifyDate、RetryScope、TriggerScope、SortX、InvokeVBAX、ExecuteMacroX、CreatePivotTableXv2、UpdateChartX） | 9 |
| `LocationReference`（ArgumentValue、VariableValue などの System.Activities の式） | 8 |
| `FilterFiles`（CompressFiles、ExtractFiles） | 2 |
| `NSAPLogon.ConnectorType` | 1 |
| `CreatePivotTableXv2.HasHeaders` | 1 |

`coverage.ts --activity` では「書けない」と理由が出る。

## 残っているもの（36 件）

| プロパティ | 理由 | 方針 |
| --- | --- | --- |
| `InvokeFunc.Func`（2〜17 引数の 15 種類） | 引数が2つ以上の `ActivityFunc`。生成器は引数 0 か 1 だけ扱う。型が開いたジェネリック（`T1`, ...）で、Studio の画面にも出ない | 使う場面が出てから |
| `Flowchart.Nodes` / `StartNode`、`StateMachine.States` / `InitialState` | ノードどうしの参照（`x:Reference`）が要る。IR に Flowchart / StateMachine の形が無い | IR の設計から要る（`docs/worker-guide.md` の 9.） |
| `Pick.Branches` | `PickBranch` を子に持つ。IR に形が無い | Flowchart と同じ |
| `InvokeMethod.Parameters` / `GenericTypeArguments`（各2）、`New.Arguments`、`NewArray.Bounds`、`IndexerReference.Indices`、`ValueTypeIndexerReference.Indices`、`MultidimensionalArrayItemReference.Indices` | `Collection<Argument>` / `Collection<Type>`。向きと型を要素ごとに持つ。式（`New Foo(...)`、`a(0)`）で書けるので、System.Activities の低レベルの部品としては使わなくて済む | `InvokeMethod` のイシューで対応する |
| `VariableValue.Variable`、`VariableReference.Variable`、`DelegateArgumentValue.DelegateArgument`、`DelegateArgumentReference.DelegateArgument`、`Literal.Value` | XAML の式の内部表現。IR は VB の式の文字列で書く | 対応しない |
| `FilterCollection.Filter` | `CollectionFilterSettings.Filters` の `Filter` がジェネリック（`Value` が `TProperty`）で、`Operator` が抽象クラス | System のコレクションのイシューで形を確かめて足す |
| `NForEachUiElement.VariablesMetadata` | `Dictionary<String, List<VariableMetadata>>`。Studio の既定 XAML は空の辞書を置く | 中身を確かめてから |

`CreateUserAction` の `AppActionPropertiesMetadata`、`CurrentAppTaskState`、`State`、`TaskFieldsForDesktop` も残っている（形を確かめられない。[persistence.md](persistence.md)）。

## objs で書けるようにしたが、中身に制限があるもの

- `GetQueueItems.FilterBuilder`：`LogicalOperator` だけ書ける。`Filters` の要素の型（`QueueItemFilterElement`）が公開されていない。条件は `Filter`（OData の文字列）で書く
- `Target.SemanticTexts`（`String[]`）、`Target.OwnerTarget`、`TargetApp.SapInfo`、`CvDescriptor.Anchors`（配列）：`objs` の中で値を書けない
- `FilterX` / `FilterPivotTableX` の `FilterArgument`、`GetJobs.FilterBuilder`、`GetQueueItems.FilterBuilder`、`NForEachUiElement.Filter`、`NSAPLogon.AutoGenerationOptions`：XAML の build まで確かめた。run と Coded はまだ（使うと `MAPPING_UNUSED_PROP`。各アクティビティのイシューで対応表に足す）
- `RetryScope.Condition`：XAML の build まで確かめた。Coded は `CODED_UNSUPPORTED`

## 形をどう確かめたか

`get-default-xaml` は、これらのプロパティをほとんど `{x:Null}` で返すので、形は分からない。次のやり方で確かめた。

- `uip rpa build` は XAML を読み込む。値の形が違えば落ちる（`Rectangle="abc"` は「Failed to create a 'Rectangle'」、`List<String>` に `x:Int32` を入れると「Add value to collection」で落ちた）。正しい形は通った
- `Rectangle` は既定 XAML の `Area="0, 0, 0, 0"` と同じ形
- **run はしていない**。読み込めることは確かめたが、実行時の動きは確かめていない

## カタログの作り直し

抽出器を変えたら、次の4つを作り直す（`Program.cs` の `--dll` は README と同じ）。`objects.json` は `--types` の正規表現ごとに別に作るので、作り直さない。

| カタログ | DLL |
| --- | --- |
| `UiPath.System.Activities/26.10.0` | `uipath.system.activities.runtime.windows/26.10.0/lib/net6.0-windows7.0/`：`UiPath.System.Activities.dll`、`UiPath.System.Activities.Api.dll` |
| `UiPath.UIAutomation.Activities/26.10.6` | `uipath.uiautomation.activities.runtime/26.10.6/lib/net6.0-windows7.0/`：`UiPath.UIAutomationNext.Activities.dll`、`UiPath.UiAutomation.Activities.dll`、`UiPath.CV.Activities.dll`、`UiPath.UIAutomationNext.API.dll` |
| `UiPath.Excel.Activities/3.6.1` | README の `--follow-returns` の例 |
| `System.Activities/6.0.0` | `uipath.uiautomation.activities.runtime.design/26.10.6/build/net6.0-windows/System.Activities.dll` |

`UiPath.System.Activities/26.2.6` と `UiPath.UIAutomation.Activities/25.10.33` は DLL が手元に無いので作り直していない（生成器もテストも読まない）。
