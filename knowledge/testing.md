# Testing（UiPath.Testing.Activities 25.10.1）で分かったこと

AUT-1113。サンプルは `samples/ir/UiPath.Testing.Activities/`、対応表は `mappings/UiPath.Testing.Activities/`。

## 書き方

- `VerifyExpressionWithOperator` / `VerifyRange` の値（`FirstExpression`、`Expression`、`LowerLimit` など）は型引数の無い `InArgument`。ノードに `typeArg`（`Int32`、`String`、`Double` など）を書くと、全部その型の `InArgument` になる
- 検証系の Coded は、省略できる引数の無い長い形（`ContinueOnFailure` などを全部渡す形）を使う。IR に無いものは既定 XAML と同じ値（`ContinueOnFailure` は True、スクリーンショットは False）、文字列は null
- `KeepScreenshots` / `ScreenshotsPath` は Coded の引数が無い（NO_CODED_API）
- `OutputMessageFormat` の差し込みは `{Expression}`、`{Result}` などで効く（`{LeftExpression}` は効かなかった）

## 落とし穴

- **`VerificationType`（VerifyRange）と `TestDataQueueItemStatus` は、表示名で読み書きする TypeConverter が付いている**。Studio の既定 XAML は `VerificationType="次の範囲内:"` と日本語の表示名で書く。生成器が `VerificationType="IsNotWithin"` と書くと読めず、範囲内として動いた（エラーにならない）。カタログの `enumConverter` を見て、`{x:Static uta:VerificationType.IsNotWithin}` で書く。System・UIAutomation・Excel にはこの形の enum は無かった
- 検証のログの式の部分は、XAML では式の文字列（`1 > 2`）、C# では `Verify Expression` になる。期待ログには XAML と C# で同じになる行だけを書く
- C# では値が `object` で渡るので、`VerifyRange` の値と上限・下限は同じ型にそろえる（`0.5` と `1` ではなく `1.0`）
- `Address` の国は `USA` のような表記（パッケージのデータ `Country|City|State|PostalCode|StreetName|StreetNumber`）。`United States` は KeyNotFoundException
- `RandomValue` のファイルは 1 行目を見出しとして読む。値だけの 1 行のファイルだと空文字になる
