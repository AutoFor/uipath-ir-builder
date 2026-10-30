# Coded Workflow で分かったこと

`samples/coded/CodedMain.cs` を `uip rpa run --file-path CodedMain.cs` で動かして確かめた（System 26.10.0、Robot 26.0、net8）。

## API のありか

- Coded から呼ぶサービスは、アクティビティ本体とは別の DLL にある
  - System：`UiPath.System.Activities.Api.dll` の `UiPath.Core.Activities.API.ISystemService`（`system.`、150メソッド）
  - UIAutomation：`UiPath.UIAutomationNext.API.dll` の `UiPath.UIAutomationNext.API.Contracts.*`（`uiAutomation.` の `IUIAService` 48、`IUiAutomationAppService` 72 など）
- カタログ抽出器は `<名前空間>.API` 配下の公開インターフェース `I*Service` を `services` として書き出す
- ログと別ワークフローの呼び出しは `system` ではなく `CodedWorkflow` の基底クラス側（`Log`、`RunWorkflow`）

## つまずいたところ

- `LogLevel` は `UiPath.Core.Activities.LogLevel` と `UiPath.CodedWorkflows.LogLevel` の両方があり、`using UiPath.Core.Activities;` と一緒だとあいまいでビルドエラー。生成するときは完全名で書く
- `system.WriteTextFile(text, file)` の `file` に `(ILocalResource)system.GetResourceForLocalPath(...)` を渡すと、ビルドは通るが実行時に「どのオーバーロード グループでも…構成されていません」で落ちる。`LocalResource.FromPath("...")` を渡すと動く。build だけでは足りず run まで確かめる必要がある例

## 方針

- 制御フロー（If、ループ、TryCatch、Switch、代入など）は C# の構文で書けるので、Coded 側に IR は要らない
- UI 操作や Excel のように、設定が多い・リソースの渡し方に癖があるアクティビティは、Coded 側も IR から生成して、カタログ（`services`）で検証する
