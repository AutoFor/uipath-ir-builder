# 長時間実行の図（Studio の Long Running Workflow。UiPath.FlowchartBuilder.Activities）

Studio Desktop の「Long Running Automation」テンプレート（新規 > Long Running Workflow）で作る、BPMN 風の図のワークフロー。
XAML のルートは `UiPath.Process.Activities.ProcessDiagram`、パッケージは `UiPath.FlowchartBuilder.Activities`（ランタイムは
`UiPath.FlowchartBuilder.Activities.Runtime` の `UiPath.Process.Activities.dll`）。2026-11-21 に 1.1.3 で調べた（AUT 番号なし、`work/long-running`）。

## 1. 何であって、何でないか（docs.uipath.com、2026-11-21）

- **ふつうの RPA プロセス**。Orchestrator のフィードにパブリッシュし、ロボットのジョブで動く。project.json は `supportsPersistence: true`・
  `requiresUserInteraction: false`（ふつうのプロセスとの違いはこの 2 つだけ。手元の「空のプロセス」と比べた）
- **Maestro ではない**。Maestro（Flow・BPMN・Case、Maestro Automate）にパブリッシュする手段も、`.flow` / `.bpmn` に変える手段も、公式には無い。
  Maestro を作る手段は Studio Web・VS Code の Maestro 拡張・コーディングエージェントの 3 つだけ（ways-to-build-with-maestro）
- つなぐなら、パブリッシュしたこのプロセスを Maestro から呼ぶ（Flow の `rpaWorkflow`、BPMN の「RPA を起動して待つ」。[maestro.md](maestro.md)）
- Studio Desktop は `.bpmn` を取り込める（対応しない要素は警告と検証エラー）。Maestro の `.bpmn` と往復できるとは書かれていない
- 使い分け（公式は Long Running Workflow と Maestro の使い分けを書いていない。下は読み）：

| | Long Running Workflow | Maestro Automate | Maestro Orchestrate |
| --- | --- | --- | --- |
| 動く場所 | ロボット（RPA のジョブ） | Maestro のエンジン | Maestro のエンジン |
| 描くもの | BPMN 風の図（XAML） | Flow | Flow・BPMN・Case |
| 向く仕事 | RPA の中で、人の承認や時間待ちを挟む長い処理 | エージェントと API をつなぐ短い処理（1 回 24 時間・同時 50 が目安） | 1 日以上待つ、実行中に人が手を入れる、同時 50 超、BPMN・Case が要る |

- 変更履歴：FlowchartBuilder 1.0.1（2025-02-26）が最初。1.1.0（2025-10-20）で BPMN の名前を RPA の用語に（Task → Sequence など）。
  Studio 2025.10.1 で正式に登場（Windows とクロスプラットフォームのみ）

## 2. XAML の形（Studio が保存した Main.xaml と、Design の DLL の雛形）

```xml
<upa:ProcessDiagram DisplayName="Long Running Workflow">
  <upa:ProcessDiagram.StartNode><x:Reference>__ReferenceID0</x:Reference></upa:ProcessDiagram.StartNode>
  <upa:EventNode x:Name="__ReferenceID0" DisplayName="Manual Trigger">
    <upa:EventNode.Behavior>
      <upa:StartBehavior><upa:StartBehavior.DesignerMetadata><upas:DesignerMetadata NodeType="StartEvent.Interrupting.None" /></upa:StartBehavior.DesignerMetadata></upa:StartBehavior>
    </upa:EventNode.Behavior>
    <sap:WorkflowViewStateService.ViewState>… ShapeLocation 530,40 / ShapeSize 40,40 …</sap:WorkflowViewStateService.ViewState>
  </upa:EventNode>
</upa:ProcessDiagram>
```

- Flowchart と違い、Studio は **StartNode を x:Reference にして、ノードをコンテンツ（Nodes）に平らに並べる**（最初に指した場所に中身を書かない）
- 接頭辞は `upa`（`UiPath.Process.Activities`）と `upas`（`UiPath.Process.Activities.Shared`）
- ノードの型（カタログ `catalog/UiPath.FlowchartBuilder.Activities/1.1.3.objects.json`）：EventNode・TaskNode・DecisionNode・SwitchNode<T>・SplitNode・
  MergeNode・EndNode・BoundaryNode（TaskNode.BoundaryNodes の中）・EventSubProcessNode（ProcessDiagram.EventSubProcesses の中）
- Behavior：StartBehavior・IntermediateBehavior・EndBehavior・BoundaryBehavior・CatchMostSpecificErrorBehavior（ExceptionType）・MergeAllBehavior・
  MergeFirstBehavior・StartSubProcessBehavior・StartOnParentErrorBehavior・NodeBehavior。`DesignerMetadata.NodeType` は図の上の種類で、
  Design の DLL にある値は `StartEvent.Interrupting.None|Message|Timer|…`、`IntermediateEvent.Catch.Timer|Message|…`、`IntermediateEvent.Throw.None|…`、
  `BoundaryEvent.Interrupting.Error|Timer|…`、`EndEvent.None|Error|Terminate|…`、`Task.None|User|Service|Send|Receive|BusinessRule|Agentic|Subprocess|EventSubprocess|Script|Manual`
- 新規の Long Running Workflow の雛形（VB と C#）は `UiPath.Process.Activities.Design.Common.dll` に文字列で入っている（今の Main.xaml と同じ、Manual Trigger だけ）

## 3. IR の書き方

```json
{ "act": "ProcessDiagram", "name": "受注の長時間処理",
  "variables": [{ "name": "amount", "type": "Int32", "default": "1200" }],
  "process": { "start": "start", "nodes": [
    { "id": "start", "node": "EventNode", "name": "Manual Trigger",
      "behavior": { "$type": "StartBehavior", "DesignerMetadata": { "NodeType": { "lit": "StartEvent.Interrupting.None" } } }, "next": "check" },
    { "id": "check", "node": "DecisionNode", "condition": "amount > 1000", "true": "work", "false": "done" },
    { "id": "work", "node": "TaskNode", "action": [ { "act": "LogMessage", "props": { "Message": { "lit": "作業" } } } ], "next": "done" },
    { "id": "done", "node": "EndNode", "behavior": { "$type": "EndBehavior", "DesignerMetadata": { "NodeType": { "lit": "EndEvent.None" } } } } ] } }
```

- ノードのキーは、カタログのノードの型のプロパティから決まる（`tools/ir/process.ts`。名前で分けない）：DisplayName → `name`、行き先（Next・True・False・Default）→ id、
  `branches`（SplitNode）→ id の配列、`cases`（SwitchNode）→ `{ 値: id }`、`condition` / `expression` → 式、`action` → 子、`behavior` → `$type` で選ぶオブジェクト、
  `boundaryNodes` → 中に持つノードの配列
- 見本：`samples/ir/UiPath.FlowchartBuilder.Activities/ProcessDiagram.min.json`（Studio の Main.xaml と同じ）と `.full.json`（全種類のノード）
- Coded：対応表が無いので図ごと XAML 経由（`RunWorkflow("coded/_xaml/…")`）

## 4. プロジェクトのファイル（tools/ir/project.ts）

```bash
node tools/ir/project.ts import --project <P>              # <P>/ir/project.ir.json を作る
node tools/ir/project.ts gen <P>/ir/project.ir.json --out <新しいフォルダ>
node tools/ir/gen.ts <P>/ir/Main.json --project <新しいフォルダ> --out <新しいフォルダ>
node tools/ir/project.ts check --project <P>               # IR にして作り直し、元と比べる
```

- 作るもの：project.json・project.uiproj・entry-points.json・.project/design.json・.tmh/config.json・空の .entities/ .objects/ .templates/
- 作らないもの：`.project/PackageBindingsMetadata.json`（依存から Studio が作る）、`.settings/`（Studio が既定値で作る。ファイル名のハッシュの決まり方が不明）、
  `.local/`（作業用）、Studio が書く AGENTS.md / CLAUDE.md（道具の AGENTS.md の「プロジェクト側に置く AGENTS.md」を置く）
- `kind: "longRunning"` で、runtimeOptions の 2 つを長時間実行の値にする。そのほかの雛形との違いは `overrides` に差分だけ持つ
- XAML がまだ無いとき、`gen.ts --project` はルートの imports を project.ir.json の `rootImports` から取る（Studio の imports に GlobalVariablesNamespace などがあるため）
- 手元の 5 プロジェクト（LongRunningAutomation・空のプロセス 1〜3・オブジェクトリポジトリ確認）で、IR から作り直したものが元と同じだった

## 5. まだのもの

- Studio で開いて図として崩れないか、と validate / run（ノードの大きさ ShapeSize は Manual Trigger の 40x40 以外は推測）
- EventSubProcessNode の中身（Action に何を入れるか）、Human Approval・Business Rule・Invoke Workflow などの Task の中身（Studio で作った実物を見ていない）
- `.bpmn` の取り込み・書き出し
