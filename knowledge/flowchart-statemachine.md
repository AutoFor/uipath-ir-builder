# Flowchart・StateMachine・Pick（図）の IR

IR はアクティビティを入れ子の木で持つが、Flowchart と StateMachine はノードどうしが指し合う図なので、**ノードに `id` を付け、矢印を行き先の `id` で書く**（AUT-1216）。Pick は木で書けるが、`PickBranch` の形が要るので同じ時に足した。

- 型：`tools/ir/types.ts`（`FlowchartDecl`・`StateMachineDecl`・`BranchDecl`）
- 共通の部品（子のたどり方、配置）：`tools/ir/graph.ts`
- 手本：`samples/ir/System.Activities/Flowchart.*.json`・`StateMachine.*.json`・`Pick.*.json`（期待ログ付き）

## 書き方

### Flowchart

```json
{ "act": "Flowchart", "name": "数える", "variables": [{ "name": "count", "type": "Int32", "default": "0" }],
  "flowchart": { "start": "Inc", "nodes": [
    { "id": "Inc", "act": "Assign", "props": { "To": "count", "Value": "count + 1" }, "next": "Check" },
    { "id": "Check", "decision": "count < 3", "name": "3 未満か", "true": "Show", "false": "Kind" },
    { "id": "Show", "act": "LogMessage", "props": { "Level": "Info", "Message": "count.ToString" }, "next": "Inc" },
    { "id": "Kind", "switch": "count", "typeArg": "Int32", "cases": { "3": "Three" }, "default": "Other" },
    { "id": "Three", "act": "LogMessage", "props": { "Level": "Info", "Message": { "lit": "three" } } },
    { "id": "Other", "act": "LogMessage", "props": { "Level": "Info", "Message": { "lit": "other" } } } ] } }
```

| ノード | 書くもの |
| --- | --- |
| FlowStep | アクティビティのノードそのものに `id` と `next` を足す。`next` が無ければそこで終わり。1 ステップに複数のアクティビティを置くなら Sequence で包む |
| FlowDecision | `decision`（真偽の式）、`true` / `false`（行き先）、`name` |
| FlowSwitch | `switch`（式）、`typeArg`（式の型。既定 `String`）、`cases`（キーは値の文字列表記、値は行き先）、`default`、`name` |

- ループ（前のノードに戻る矢印）も書ける
- `TrueLabel` / `FalseLabel` / `DefaultCaseDisplayName` は書けない。UiPath の System.Activities（CoreWF）の `FlowDecision` / `FlowSwitch` に無い（書くと analyze が「Cannot set unknown member」で落とした）

### StateMachine

```json
{ "act": "StateMachine", "variables": [{ "name": "n", "type": "Int32", "default": "0" }],
  "stateMachine": { "initial": "Init", "states": [
    { "id": "Init", "entry": [ ... ], "exit": [ ... ], "transitions": [{ "to": "Work", "name": "開始", "trigger": [ ... ], "action": [ ... ] }] },
    { "id": "Work", "variables": [ ... ], "entry": [ ... ], "transitions": [
      { "to": "Work", "condition": "n < 3" },
      { "to": "Done", "condition": "n >= 3" } ] },
    { "id": "Done", "name": "終わり", "final": true, "entry": [ ... ] } ] } }
```

- 状態：`id`、`name`（DisplayName。無ければ `id`）、`final`、`variables`、`entry`、`exit`、`transitions`
- 遷移：`to`、`name`、`trigger`（終わるのを待つアクティビティ）、`condition`（真偽の式）、`action`
- 終わりの状態（`final: true`）は遷移と `exit` を持てない。それ以外の状態には遷移が要る。終わりの状態が1つは要る

### Pick

```json
{ "act": "Pick", "branches": [
  { "name": "速い", "variables": [ ... ], "trigger": [{ "act": "Delay", "props": { "Duration": "TimeSpan.FromMilliseconds(50)" } }], "action": [ ... ] },
  { "name": "遅い", "trigger": [ ... ], "action": [ ... ] } ] }
```

最初に `trigger` が終わった分岐の `action` だけが動き、ほかの `trigger` は取り消される。

### id

- `id` は XAML の `x:Name` になる。文字か `_` で始め、文字・数字・`_` だけ（日本語も可）。ワークフローの中で重ねない（図が2つあっても）
- 矢印は `<x:Reference>id</x:Reference>`。後ろのノードを指してよい

## 検証（validate.ts）

| コード | 中身 |
| --- | --- |
| `GRAPH_NO_START` | `start` / `initial` のノードが無い |
| `GRAPH_BAD_REF` | 矢印の行き先の `id` が無い |
| `GRAPH_UNREACHABLE` | `start` / `initial` からたどり着けないノード |
| `GRAPH_DUPLICATE_ID` / `GRAPH_BAD_ID` | `id` の重なり、`x:Name` に書けない `id` |
| `GRAPH_BAD_NODE` | `act`・`decision`・`switch` のどれか1つではない、FlowDecision に `next` など |
| `GRAPH_UNKNOWN_KEY` | 図のオブジェクトに書けないキー（`trueLabel`、`when` など） |
| `GRAPH_EMPTY` | ノード・状態・分岐が1つも無い |
| `SM_NO_FINAL` / `SM_NO_TRANSITION` / `SM_FINAL_TRANSITION` | 終わりの状態が無い、遷移の無い状態、終わりの状態に遷移や exit |
| `PICK_NO_TRIGGER` | 分岐に `trigger` が無い |

`props` に `Nodes` などを書くと `UNSUPPORTED_PROP`。例は `samples/ir-invalid/Flowchart*.json`・`StateMachine*.json`・`Pick*.json`。

## 生成する XAML（generate.ts）

- ノードは `x:Name` を付けてコンテンツ（Nodes / States）に IR の順で平らに並べ、`StartNode` / `InitialState`・`Next`・`True` などはプロパティ要素の中の `<x:Reference>`。FlowSwitch の分岐は `<x:Reference x:Key="値">id</x:Reference>`
- VB は条件を属性 `Condition="[式]"`、C# は `<FlowDecision.Condition><mca:CSharpValue …>` の要素
- ワークフローの `body` が図1つだけで、ワークフローの `variables` が無ければ、Studio と同じくその図を XAML のルートにする（Sequence で包まない）
- **ViewState**：Studio で図として並ぶよう、`ShapeLocation` と `ShapeSize`（`av:Point` / `av:Size`）を IR だけから決めて出す。start から幅優先でたどった深さを行、行の中の順を列にする。矢印の経路（`ConnectorLocation`）は出さず、Studio に引かせる
- Coded（gen-coded.ts）は対応表を作らない。図ごと `_xaml/<ワークフロー名>_<連番>.xaml` にして `RunWorkflow` で呼ぶ（[coded-via-xaml.md](coded-via-xaml.md)）。図の中で読み書きする外の変数は引数になる（`Flowchart.full.json` の `total`）

## 取り込み（import-xaml.ts）

- Studio はノードを最初に指した場所（`StartNode`、`Next`、`Transition.To` など）に中身ごと書き、2 回目からは `<x:Reference>__ReferenceID<n></x:Reference>` で指す。`{x:Reference …}` の属性、`<x:Reference>名前<x:Key>キー</x:Key></x:Reference>` も読む
- `id` は意味のある `x:Name` ならそのまま。Studio の `__ReferenceID<n>` なら表示名（FlowStep は中のアクティビティの DisplayName）から作る（空白などは `_`、重なれば `_2`）
- **Studio で並べた位置（ViewState）は捨てる**。IR から作り直すと、上の決まりで並べ直す
- 往復の比べ方（`canonLines`）は、図を「start からたどった番号」で比べるので、Studio の書き方と生成器の書き方の違いは差にならない
- 図のノード（FlowStep・State など）が図の外に出てきたら `UNSUPPORTED_FLOWCHART` / `UNSUPPORTED_STATEMACHINE` / `UNSUPPORTED_PICK`
- 見本：`samples/xaml-import/StudioFlowchart.xaml`・`StudioStateMachine.xaml`（Studio の書き方をまねて書いたもの。Studio が保存した実物ではない）

## 確かめたこと（2026-11-17、DESKTOP）

- `samples/ir/System.Activities/` の6つ：XAML（VB）と Coded（XAML 経由）を build・run し、期待ログと一致
- `samples/ir-csharp/FlowchartCs.json`・`StateMachineCs.json`・`PickCs.json`：C# の式のプロジェクト（`uipath-ir-probe-cs`）で build・run し、期待ログと一致
- 確かめていないもの：**Studio（デスクトップ）で開いて図として表示されるか**（このマシンには Helm しか無い）。Studio が保存した実物の Flowchart / StateMachine の取り込み（REFramework など）
