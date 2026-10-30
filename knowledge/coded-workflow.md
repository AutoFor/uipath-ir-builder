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

## ワークフローの引数（uip rpa build の生成コードで確かめた）

Studio は `.cs` ごとに `.local/install/<フォルダ>/<クラス>+<クラス>Activity.cs` を生成し、`Execute` のシグネチャから XAML の引数を作る。

- In 引数：`Execute` の引数（名前もそのまま）
- Out 引数：戻り値。1つなら `public string Execute(...)` で、引数名は `Output` になる。2つ以上なら名前付きタプル `public (string out_Message, int out_Length) Execute(...)` で、要素名が引数名になる
- `ref` / `out` の引数は使えない（生成コードが `out` / `ref` を付けずに呼ぶので CS1620 でコンパイルが落ちる）。InOut は Coded では書けない
- `RunWorkflow("coded/Greet.cs", 引数の辞書)` と書くと build は通る（run で呼べるかはまだ確かめていない）。戻り値の辞書のキーは上の引数名（Out が1つなら `"Output"`）

## サービスの変数名と型

`.local/.codedworkflows/CodedWorkflow.cs`（Studio が依存パッケージから生成する `CodedWorkflow` の部分クラス）に書かれている。プローブ プロジェクトでは：

| 変数 | 型 |
| --- | --- |
| `system` | `UiPath.Core.Activities.API.ISystemService` |
| `uiAutomation` | `UiPath.UIAutomationNext.API.Contracts.IUiAutomationAppService` |
| `excel` | `UiPath.Excel.Activities.API.IExcelService` |
| `mail` | `UiPath.Mail.Activities.Api.IMailService` |
| `testing` | `UiPath.Testing.API.ITestingService` |
| `workflows` | プロジェクトごとの `WorkflowRunnerService`（ワークフローを型付きで呼ぶ） |

基底クラス `UiPath.CodedWorkflows.CodedWorkflowBase`（UiPath.CodedWorkflows 24.10.3）の `Log` / `RunWorkflow` / `Delay` / `BuildClient` などは、カタログ抽出器が `catalog/UiPath.CodedWorkflows/24.10.3.json` に書き出す。

## XAML と C# で動きが違うもの（run で分かった）

サンプルはどちらでも同じログになる形にしてある。XAML から Coded に置き換えるときは、次の違いに注意する。

- `ChangeType`：Int32 から String への変換は、XAML だと `"7.00"`、C# だと `"7"` になる
- `ParallelForEach`：XAML は c, b, a の順、C# は a, b, c の順で回る
- `system.FindAndReplace`：引数名 `valueToFind` と `source` が実装と逆（先頭が対象の文字列、2つ目が検索語として動く）。対応表で入れ替えてある
