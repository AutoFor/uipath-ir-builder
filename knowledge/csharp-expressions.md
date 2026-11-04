# 式の言語が C# のプロジェクト向けの XAML で分かったこと

環境：Studio 26.10、`uip rpa build` / `uip rpa run`（窓口 `queue-run.mjs` 経由）。テンプレートは Studio で作った C# の空のプロジェクト `C:\Users\Public\uipath-ir-probe-cs`（BlankTemplate、`expressionLanguage: CSharp`、依存は VB のテンプレートと同じ版）。

生成器の使い方は `docs/worker-guide.md` の「10. 式の言語が C# のプロジェクト」。

## Studio の C# の XAML の形

`uipath-ir-probe-cs/Main.xaml`（Studio が作ったまま）と VB のテンプレートの違い：

| | VB | C# |
| --- | --- | --- |
| ルートの属性 | `mva:VisualBasic.Settings="{x:Null}"` | `sap2010:ExpressionActivityEditor.ExpressionActivityEditor="C#"`（`mva` の xmlns も無い） |
| imports | — | `System.Xml` の後に `System.Text` が入る |
| AssemblyReference | `System.Activities` から始まる | 先頭に `Microsoft.CSharp`、`System`、`System.Linq`、`System.Core`、`System.Activities`、`System.Data`、`System.Data.Common`、`System.Runtime.Serialization`、`System.ServiceModel`、`System.ServiceModel.Activities`、`System.Xaml` が足され、その後は VB と同じ並び（`System.Activities` などが2回出る。Studio のまま） |
| 式 | `Message="[式]"`（VisualBasicValue の略記）、`<InArgument>[式]</InArgument>` | 要素で書く：`<InArgument x:TypeArguments="x:Object"><mca:CSharpValue x:TypeArguments="x:Object">式</mca:CSharpValue></InArgument>`。出力は `CSharpReference`。`xmlns:mca="clr-namespace:Microsoft.CSharp.Activities;assembly=System.Activities"` |

生成器（`generate.ts` の `language: "CSharp"`）はこの形で書く。

- ルート：上の属性と、C# の BlankTemplate の imports / AssemblyReference（`--project` のときはそのプロジェクトの main の XAML から読む。今までどおり）
- 属性に書いていた式：プロパティの型の要素にする。型はカタログのプロパティの型（`InArgument<T>` の T。`T`・`TResult` などの型引数はノードの `typeArg`）。`Activity<T>` のプロパティ（`While.Condition` など）は `InArgument` で包まずに `CSharpValue` を置く
- 型引数の無い `InArgument`（Assign など）、`InvokeWorkflowFile` の引数、lists、MultipleAssign、辞書：今まで `[式]` を入れていた要素の中身を `<mca:CSharpValue>` / `<mca:CSharpReference>` にする
- 変数の既定値：`<Variable x:TypeArguments="T" Name="n"><Variable.Default><mca:CSharpValue x:TypeArguments="T">式</mca:CSharpValue></Variable.Default></Variable>`
- リテラル（`{ lit }` の String、数値、真偽値、enum の名前）は属性のまま。String 以外に渡す `{ lit }` は C# の文字列リテラル（`"..."`、`\` と `"` を逃がす）
- get-default-xaml の既定値が VB の式（`[...]`）のものは、C# に直して要素にする
- カタログの型は完全名で来るので、`types-xaml.ts` は表の項目の完全名（xmlns の clr-namespace + 名前）でも引けるようにした。足した型：`System.Collections.IEnumerable`、`Nullable<T>`、`UiPath.CV.CvDescriptor`、`UiPath.CV.CvString`、`UiPath.Core.EventInfo`

## build / run で確かめた形

`out/cs-forms/` に手で書いた XAML（C# のテンプレート、`verify.mjs` に `*.xaml` を渡す）。

2026-11-04、`out/verify/cs-forms-run/`、`out/verify/cs-forms2-run/`、`out/verify/cs-vbfile-run/`。

| 形 | 結果 |
| --- | --- |
| `<InArgument x:TypeArguments="x:Object"><mca:CSharpValue x:TypeArguments="x:Object">…</mca:CSharpValue></InArgument>`（生成器の形） | 通る（サンプルの run で確かめた） |
| `<ui:LogMessage.Message>` に `InArgument` で包まずに `<mca:CSharpValue x:TypeArguments="x:Object">` | **落ちる**。「プロパティ 'UiPath.Core.Activities.LogMessage.Message' の Set で例外がスローされました」（XAML を読めない） |
| 型引数がプロパティと違う（`InArgument<Object>` のプロパティに `InArgument x:TypeArguments="x:String"`） | **落ちる**。同じ「Set で例外」。型はカタログのプロパティの型に合わせる必要がある |
| C# のワークフローで `Message="[&quot;bracket&quot; + &quot;-attr&quot;]"` | 通るが、**中身は VB の式**として読まれる。`[… &amp; …]`（VB だけの書き方）は通り、`[….Split(new[] { ',' })[1]]`（C# だけの書き方）は BC30203 / BC30198 / BC30182（VB のコンパイラのエラー）で落ちる。つまり `[...]` は C# のワークフローでも VisualBasicValue で、C# の式は書けない |
| C# のプロジェクトに、VB の XAML（`mva:VisualBasic.Settings`、`[式]`）をそのまま置く | 通る（Main + Greet が期待ログどおり）。式の言語はファイルごとに決まる |
| `"a,b".Split(',')[1]`（省略可能な引数を省いた呼び出し）を CSharpValue に | **落ちる**。CS0854（次の節） |

## 式の変換（VB → C#）

IR の素の文字列は VB の式。C# では `tools/ir/vb2cs.ts` の `vbToCs` で直す（Coded の生成と同じもの）。`{ vb, cs }` は `cs` をそのまま使う。直せない式は推測で書かず、検証エラー `CS_EXPR` にする（`gen.ts` は `NG` を出して終了コード 1。`--check` でも出る）。直し方は、その値を `{ "vb": "...", "cs": "..." }` にして両方を書く。

C# の XAML の式（CSharpValue）は**式ツリー**にコンパイルされるので、Coded の C# より書けるものが少ない。build のエラー：

| 書いたもの | エラー | 生成器の扱い（`vbToCs` の `tree: true`） |
| --- | --- | --- |
| 省略可能な引数を省いた呼び出し（`Strings.InStr(s, ",")`、`s.Split(',')`。.NET の `String.Split(char, StringSplitOptions options = None)` も） | CS0854「省略可能な引数を使用する呼び出しを式ツリーに含めることはできません」 | VB の組み込み関数（InStr / InStrRev / Replace / Split / Join / Format / DateDiff / Weekday）は省いた引数の既定値を書き足す。`x.Split(1つ)` は `x.Split(new[] { ',' })`（文字）/ `x.Split(new[] { "," }, StringSplitOptions.None)`（文字列）。文字か文字列か分からない引数、既定値を決められない数（InStr の3つ）は CS_EXPR |
| 名前付き引数（`count: 1`） | CS0853「名前付き引数の指定を式ツリーに含めることはできません」 | CS_EXPR |

式ツリーではほかに、`?.`、代入、文のラムダ、`out var`、タプルなども書けない（C# の仕様）。`vbToCs` はこれらを出さない。`{ vb, cs }` の `cs` に書くときは気をつける（生成器は `cs` を確かめない）。

`samples/ir/VbExpressions.json` の「Named=」の行（`s.Split({","c}, count:=1)`）は C# の XAML にできない（CS_EXPR）。その行を `{ vb, cs }` にした版が `samples/ir-csharp/VbExpressionsCs.json`（VB の出力は元と同じ。C# のテストと run に使う）。

## サンプルを C# のテンプレートで流した結果

2026-11-04。`queue-run.mjs --template 'C:\Users\Public\uipath-ir-probe-cs' --use-project --no-coded`（40 件ずつ）。結果は `out/verify/cs*-run/report.md`。OK は期待ログ（`*.expected.log`）どおりに run できたもの。

| サンプル | run | build だけ | 落ちたもの |
| --- | --- | --- | --- |
| `samples/ir/` 直下（Main + Greet、Controls、PropForms） | 4 OK | | VbExpressions は CS_EXPR（名前付き引数）。`samples/ir-csharp/VbExpressionsCs.json` は OK |
| `System.Activities/`（4） | 4 OK | | |
| `UiPath.System.Activities/`（360） | 230 OK | noRun の 127 は OK | ModifyText.full / .min、ToUpperLowerTextModification.min は CS_NAME（変数名 `out`。下）。名前を変えた版 `samples/ir-csharp/*Cs.*.json` は OK |
| `UiPath.Excel.Activities/`（199） | 185 OK | noRun の 14 は OK | 最初は 43 件が「指定したブックを開けません。同じ名前が付いた別のブックが開いていないことをご確認ください」で落ちた（VB のテンプレートでも同じ）。画面のセッションに窓の無い EXCEL.EXE（`/automation -Embedding`）が残っていたため。それが無くなってから流し直して 43 件とも OK（`out/verify/csxl6-run/`）。この形で落ちたら、まず残った EXCEL.EXE を見る |
| `UiPath.Testing.Activities/`（16） | 16 OK | | |
| `UiPath.UIAutomation.Activities/`（378） | | 378 OK | |

流している途中で直したもの：

- `FilterCollection`（Filter<T>.Value）：要素で書くオブジェクト（objs / lists のオブジェクト）がジェネリックのとき、型引数を `$typeArg` から取っていなかった（`InArgument<Object>` になり「Set で例外」）
- `AddOrSubtractFromDate.full`：「.local\install\uipath-ir-probe-cs.dll が別のプロセスで使用中」で build が落ちた。流し直して OK（生成器とは関係ない）

### C# の予約語の変数名（CS_NAME）

変数 `out` を C# の式で参照すると落ちる。`out` のままだと構文エラー（CS1525 など）、`@out` にすると CS0103「現在のコンテキストに 'out' という名前は存在しません」。UiPath のコンパイラが変数を `@` なしで宣言しているためと推定。生成器は、C# の予約語の名前の変数・引数を `CS_NAME`、それを参照する式を `CS_EXPR` にする（名前を変えるしかない）。

## VB の XAML を C# の XAML に変換する（convert-xaml.ts）

`tools/ir/convert-xaml.ts <in.xaml>... --to CSharp --out <dir>`。`import-xaml.ts` で IR に読み、C# で生成し直す。元の imports / AssemblyReference は残し、C# のテンプレートにあるもの（`Microsoft.CSharp`、`System.Text` など）を足す。取り込みで落ちるもの（注釈、IR に持てない import など）は警告に出る。

確かめた例（2026-11-04、`out/verify/cs-convert-run/`）：VB の XAML `samples/generated/{Main,Greet,Controls,PropForms}.xaml` を変換し、C# のテンプレートで run して、4つとも期待ログ（`samples/ir/*.expected.log`）どおり。`verify.mjs` は `*.xaml` をそのまま作業用プロジェクトに写して試せるようにした。

変換できないもの：`samples/generated/VbExpressions.xaml`（名前付き引数で CS_EXPR）、C# の XAML（`CSHARP_EXPR`）、取り込めない XAML（Flowchart など）。

### C# → VB をやらない理由と、要るもの

- `import-xaml.ts` が `CSharpValue` / `CSharpReference` を読めない（`ExpressionActivityEditor=C#` のワークフローは `CSHARP_EXPR` で止める）
- IR の素の文字列は VB の式。C# の式を IR に入れるには `{ vb, cs }` の `vb` が要るが、C# → VB の式の変換が無い（`vb2cs.ts` の逆）

要るもの：(1) `import-xaml.ts` で C# の式の要素を読み、属性の形（`[...]`）と同じ値に戻す。(2) IR に C# だけの式を持たせる形（`{ "cs": "..." }` だけ、またはワークフロー単位の言語）か、C# → VB の変換。(2) が無いと、VB の XAML も Coded も作れない IR になる。
