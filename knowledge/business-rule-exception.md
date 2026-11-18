# 業務上の例外（BusinessRuleException）

サイトのメンテナンス中、データが無いなど、「もう一度動かしても直らない、業務の都合で止める」ときに投げる例外。Orchestrator では「ビジネス例外」になり、システムの例外（UI 要素が見つからない、タイムアウトなど）と分けて見られる。

## 型の場所

- **`UiPath.Core.BusinessRuleException`**（アセンブリ `UiPath.System.Activities`）
- `UiPath.Core.Activities.BusinessRuleException` ではない。こう書くと、Portable（クロスプラットフォーム）のプロジェクトで「型または名前空間の名前 'BusinessRuleException' が名前空間 'UiPath.Core.Activities' に存在しません」になった（moneyforward_cs、2026-11-18）
- 確かめ方：UiPath.System.Activities 25.10.0 の Windows（`runtime.windows/…/net6.0-windows7.0`）と Portable（`runtime.portable/…/net6.0`）の `UiPath.System.Activities.dll` のメタデータ（`System.Reflection.Metadata` の TypeDefinitions）で、どちらも名前空間が `UiPath.Core`
- アクティビティではないので、カタログ（`catalog/`）には無い。`tools/ir/types-xaml.ts` の表に足してある（`BusinessRuleException`、`UiPath.Core.BusinessRuleException` のどちらの名前でも引ける）

## IR での書き方

`Throw` の `Exception` に C# の式で書く（Coded も XAML も同じ。完全名で書けば imports は要らない）：

```json
{ "act": "Throw", "name": "メンテナンス中で止める",
  "props": { "Exception": { "cs": "new UiPath.Core.BusinessRuleException(\"MoneyForward がメンテナンス中のため、ログインできません\")" } } }
```

変数や `TryCatch` の catch の型に使うときは、IR の型名に `BusinessRuleException` と書く（XAML では `ucore:BusinessRuleException`）。
