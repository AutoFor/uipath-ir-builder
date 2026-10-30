# uipath-ir-builder

UiPath の XAML / Coded Workflow を、AI に直接書かせずに作るための道具。AI は小さな型付きの中間表現（IR）だけを書き、XAML は機械的に生成する。方針は [docs/plan.md](docs/plan.md)。

## いまあるもの

### カタログ抽出器（`tools/catalog-extractor`）

アクティビティの DLL から、型情報をリフレクションで抜き出して JSON にする。`MetadataLoadContext` で読むだけなので、Studio も UiPath の実行環境もいらない。

取れるもの：ClassName、xmlns、ジェネリックの数、プロパティごとの In/Out の向き・型・`[RequiredArgument]`・`[DefaultValue]`・enum の値・カテゴリ・表示名・OverloadGroup。

```bash
dotnet build -c Release tools/catalog-extractor

N=~/.nuget/packages
tools/catalog-extractor/bin/Release/net9.0/CatalogExtractor.exe \
  --package UiPath.System.Activities --version 26.2.6 \
  --dll $N/uipath.system.activities.runtime.windows/26.2.6/lib/net6.0-windows7.0/UiPath.System.Activities.dll \
  --out catalog/UiPath.System.Activities/26.2.6.json
```

DLL はデザイン用パッケージ（`uipath.system.activities`）ではなく、ランタイム用パッケージ（`*.runtime.windows` / `*.runtime`）の `lib/` にある。

Coded の基底クラス（`Log`、`RunWorkflow`、`Delay` など）は `UiPath.CodedWorkflows.dll` から取る：

```bash
tools/catalog-extractor/bin/Release/net9.0/CatalogExtractor.exe --package UiPath.CodedWorkflows --version 24.10.3 \
  --dll $N/uipath.codedworkflows/24.10.3/lib/net6.0-windows7.0/UiPath.CodedWorkflows.dll --out catalog/UiPath.CodedWorkflows/24.10.3.json
```

Excel のように Coded の API が「サービスが返す型（handle）のメソッドや拡張メソッド」になっているパッケージは `--follow-returns` を付ける。サービスのメソッドが返す型をたどって `handles`（プロパティ・インデクサー・メソッド）、`*.API` 名前空間の拡張メソッドを `extensions`、出てきた enum を `enums` に書き出す：

```bash
E=$N/uipath.excel.activities/3.6.1/lib/net6.0-windows7.0
tools/catalog-extractor/bin/Release/net9.0/CatalogExtractor.exe --package UiPath.Excel.Activities --version 3.6.1   --dll $E/UiPath.Excel.Activities.dll --dll $E/UiPath.Excel.Activities.API.dll --follow-returns --out catalog/UiPath.Excel.Activities/3.6.1.json
```

### カタログ（`catalog/`）

| パッケージ | バージョン | アクティビティ数 |
| --- | --- | --- |
| UiPath.System.Activities | 26.2.6 | 185 |
| UiPath.System.Activities | 26.10.0 | 186 |
| UiPath.UIAutomation.Activities | 25.10.33 | 202 |
| UiPath.UIAutomation.Activities | 26.10.6 | 211 |
| UiPath.CodedWorkflows | 24.10.3 | 0（Coded の基底クラス `CodedWorkflowBase` のメソッドだけ） |
| UiPath.Excel.Activities | 3.6.1 | 128（Coded の `IExcelService` と、`--follow-returns` で取った handles / extensions / enums も） |

### get-default-xaml との突き合わせ（`tools/compare-default-xaml.mjs`）

`uip rpa activities get-default-xaml` の出力を `knowledge/default-xaml/` に保存し、カタログと比べる。結果は [knowledge/default-xaml-compare.md](knowledge/default-xaml-compare.md)。

```bash
node tools/compare-default-xaml.mjs catalog/UiPath.System.Activities/26.10.0.json \
  catalog/UiPath.UIAutomation.Activities/26.10.6.json > knowledge/default-xaml-compare.md
```

12アクティビティで比べた結果：

- default に出た48プロパティは、すべてカタログにあった
- default に出ない out 引数をカタログは持っている（`NGetText` の `Text` / `TextString` / `WordsInfo` など）
- default で空のままの必須プロパティを、カタログは必須として持っている（`ForEach.Values`）

`get-default-xaml` は UiPath プロジェクトの中で、`uip login` 済みの状態でないと動かない。初回は Studio 側（Helm）の起動に約10分かかり、2回目からは1件0.5秒ほど。ジェネリックのアクティビティはクラス名に `` `1 `` を付ける（例 ``UiPath.Core.Activities.ForEach`1``）。

### IR → XAML 生成器（`tools/ir`）

AI が書くのは IR（`samples/ir/*.json` の形の JSON）だけ。生成器がカタログで検証してから XAML を書く。Node 24 以上で、npm の依存なしに動く。

```bash
# 検証だけ
node tools/ir/gen.ts samples/ir/Main.json samples/ir/Greet.json --check
# 検証して UiPath プロジェクトに書き出す
node tools/ir/gen.ts samples/ir/Main.json samples/ir/Greet.json --out <プロジェクトのフォルダ>
```

IR の例：

```json
{ "act": "ForEach", "typeArg": "String", "item": "name", "props": { "Values": "names" },
  "body": [ { "act": "LogMessage", "props": { "Level": "Info", "Message": "\"こんにちは \" & name" } } ] }
```

- `props` の文字列は VB の式（`[...]` は生成器が付ける）。文字列リテラルは `{ "lit": "..." }`、enum はメンバー名をそのまま書く
- 子は `body`（既定の置き場所）、`then` / `else`、それ以外は `slots`
- `While` / `DoWhile` の `Condition` のような `Activity<Boolean>` 型の子は、式として `props` に書く
- `Switch` は `cases`（キーごとの子）と `slots.Default`、`TryCatch` は `body`（Try）と `catches`（`{ type, var, body }`）と `slots.Finally`、`MultipleAssign` は `assigns`（`{ to, value }`）
- delegate の引数名は `item`。`ForEachFileX` のように2つ取るものは `["file", "index"]` のように配列で書く
- XAML の xmlns、`x:TypeArguments`、`Assign` の型（代入先の変数の宣言から決める）、IdRef、imports は生成器が付ける
- `get-default-xaml` で取った既定値（`Version=V5` など）は自動で足す

検証で弾くもの：未知のアクティビティ・プロパティ・型、必須の欠け、enum 外の値、宣言されていない出力先、子を置けない場所への子。例は `samples/ir-invalid/Broken.json`。

`samples/ir/Main.json` と `Greet.json`（ForEach / If / Assign / LogMessage / InvokeWorkflowFile）から生成した XAML（`samples/generated/`）は、`uip rpa build` を修正なしで通った（Studio 26.10、System 26.10.0）。`uip rpa run` でも修正なしで動き、If の両方の分岐と InvokeWorkflowFile の Out 引数まで期待どおりのログが出た（net8 のプロジェクト、Robot 26.0、ロボットのサインイン済み）。

```
[Information] こんにちは、太郎 さん
[Information] こんにちは、花子 さん
[Information] こんにちは、Al さん
[Warning] 短すぎる名前: A
[Information] あいさつした人数: 3
```

実行には `uip login` だけでなく、ロボット（Assistant / Studio）のサインインによるライセンスが要る。ないと「ローカル ライセンスが必要です」で止まる。

`samples/ir/Controls.json`（While / DoWhile / MultipleAssign / Switch / TryCatch / Throw / WriteTextFile / ReadTextFile / RetryScope / Delay / ForEach + Break / AddToCollection）も、生成した XAML がそのまま `uip rpa run` で動いた：

```
[Information] 開始: 赤
[Warning] 捕まえた: わざと
[Information] finally を通った
[Information] ファイルの中身: item1,item2,item3
[Information] リトライの中
[Information] 要素: item1
[Information] i=3, total=2
```

OverloadGroup（`WriteTextFile` の `File` か `FileName` のどちらか）は、どれか1つのグループがそろっていれば必須を満たすとみなす。

UI 操作のターゲット（`Target` / `TargetApp` / セレクタ）は、ノードの `objs` に書く（`tools/ir/uia.ts`、手順は [docs/worker-guide.md](docs/worker-guide.md) の 8.）。

まだ書けないものと理由は [knowledge/coverage-gaps.md](knowledge/coverage-gaps.md)。

### Coded Workflow（`samples/coded`）

XAML と同じ処理を C# の Coded Workflow でも書き、`uip rpa run` で同じログが出ることを確かめた（`samples/coded/CodedMain.cs`）。Coded から呼ぶサービスの API（`system.` / `uiAutomation.` のメソッドと引数）は、カタログ抽出器が `services` としてカタログに書き出す。

いまは、手で書かずに XAML と同じ IR から C# を生成する（下の「IR → Coded（C#）生成器」）。`samples/coded/CodedMain.cs` は手書きの例として残している。分かったことは [knowledge/coded-workflow.md](knowledge/coded-workflow.md)。

### IR → Coded（C#）生成器（`tools/ir/gen-coded.ts`）

XAML と同じ IR から Coded Workflow の `.cs` を作る。制御フローは C# の構文に、アクティビティは対応表（`mappings/<pkg>/<ClassName>.json`、1アクティビティ1ファイル）でサービスのメソッド呼び出しにする。対応表が無いアクティビティはエラーになる。VB の式は `tools/ir/vb2cs.ts` が C# に直し、直せない式は IR に `{ "vb": "...", "cs": "..." }` で書く。

```bash
node tools/ir/gen-coded.ts samples/ir/Main.json --check --print     # 生成して表示（書き出さない）
node tools/ir/gen-coded.ts samples/ir/*.json --out <フォルダ> --invoke-dir coded
```

生成例は `samples/generated-coded/`。In 引数は `Execute` の引数、Out 引数は戻り値（詳しくは [knowledge/coded-workflow.md](knowledge/coded-workflow.md)）。

### Coded のチェッカー（`tools/coded/check.ts`）

`.cs` のサービス呼び出し（`system.X(...)`、`uiAutomation.X(...)`、基底クラスの `Log(...)` など）を、カタログの `services` で検証する。生成した C# にも、手書きの C# にも使える。

```bash
node tools/coded/check.ts samples/coded/CodedMain.cs [--project <UiPathプロジェクト>] [--json]
```

検出するもの：無いメソッド（似た名前を出す）、どのオーバーロードにも合わない引数の数・名前付き引数・out/ref、リテラルの型違い（文字列を `ILocalResource` に渡すなど）、`LogLevel` のあいまいさ、`GetResourceForLocalPath`、`using` の欠け、名前空間の違い、`[Workflow]` の付け忘れ、await していない `*Async`、`Console.WriteLine`。検出しないもの：リテラル以外の式の型、サービスの戻り値に対する呼び出し（`app.Click(...)` など）、C# の文法。わざと壊した例は `samples/coded-invalid/Broken.cs`。

### 一括検証（`tools/verify/verify.mjs`）

IR と `.cs` を作業用の UiPath プロジェクト（`C:\Users\Public\uipath-ir-probe-<名前>`、テンプレートから作る）に置き、ファイルごとに `uip rpa run`（`--build-only` なら build だけ）を流して、結果を `out/verify/<名前>/report.md` / `report.json` に出す。IR 1つにつき XAML と C# の両方を試し、横に置いた `*.expected.log` と実際のログを突き合わせる。

```bash
node tools/verify/verify.mjs --name aut-512 samples/ir/Main.json samples/ir/Greet.json
node tools/verify/verify.mjs --name aut-512 --build-only samples/ir
```

build は作業用プロジェクトごとに並行してよい（4並列で確認）。run はマシン全体で1つずつに並べる。管理者権限のシェルからは run できない（ロボットに「アクセスが拒否されました」と言われる）。詳しくは [docs/worker-guide.md](docs/worker-guide.md)。

### テストと網羅レポート

```bash
node --test "tools/ir/*.test.ts"     # サンプルの検証・スナップショット・不正な例・チェッカー・VB→C#
node tools/ir/coverage.ts            # knowledge/coverage.md（全プロパティを IR で書けるか）
node tools/ir/coverage.ts --activity WriteTextFile
node tools/compare-default-xaml.mjs --generated samples/generated   # 生成した XAML と Studio の既定 XAML を比べる
```

### ワーカー用の手順書

Linear のイシュー（1アクティビティ1件）の進め方、ファイルの置き場所、完了の基準、Linear の更新の雛形は [docs/worker-guide.md](docs/worker-guide.md)。

## わかっている穴

- 既定値は `[DefaultValue]` 属性からしか取れない。コンストラクタで入れる既定値は見えない（`get-default-xaml` に出る `Version=V5` や `HealingAgentBehavior=SameAsCard` などは、カタログには既定値として入っていない）
- 新しめのアクティビティは「必須」を ViewModel 側で持っていそうで、属性だけでは漏れる
- xmlns 定義が見つからないアクティビティは `clr-namespace:` 形式の代わりの値になる（System 44個、UIAutomation 11個）
