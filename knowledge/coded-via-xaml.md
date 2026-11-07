# Coded で対応表の無いアクティビティを XAML 経由で呼ぶ

Coded（C#）の生成器（`tools/ir/gen-coded.ts`、`tools/ir/generate-coded.ts`）は、対応表（`mappings/<pkg>/<Class>.json`）の無いアクティビティを、以前はエラー（`NO_MAPPING`）にしていた。今は、そのノードだけを置いた XAML を作り、C# からは基底クラスの `RunWorkflow` で呼ぶ。部品は `tools/ir/coded-via-xaml.ts`。

## いつ XAML 経由になるか

| 場合 | 動き |
| --- | --- |
| 対応表がある（API で書ける） | これまでどおり API を呼ぶ（対応表を優先） |
| 対応表が無い | XAML 経由（注意 `CODED_VIA_XAML`） |
| 選んだ版のカタログに `services`（Coded API）が無いパッケージで、対応表が API を呼ぶ（例 Testing 23.4.1 の `VerifyExpression`） | XAML 経由（その版では API が無いので、対応表は使えない） |
| 対応表が `"coded": null`、または形ごとの `reason`（`InvokeWorkflowFile` の `Level` など）で「Coded API なし」（Classic の UI 操作、Persistence など） | XAML 経由 |
| 対応表で書いた C# が、選んだ版の API に無いメソッド・合わないオーバーロードを呼ぶ（例 System 24.10.7 の `DeleteQueueItems` に `timeoutMS` が無い、UIAutomation 26.10.3 に `BlockUserInput` が無い） | XAML 経由。gen-coded.ts がノードごとに `tools/coded/check.ts` にかけ、`UNKNOWN_METHOD` / `NO_OVERLOAD` なら書いた C# を捨てる（`viaXaml.apiCheck`） |
| 選んだ版が、対応表の `viaXamlBefore.version` より前（API の形は同じで、実行したときだけ落ちるもの。例 System 24.10.7 の `WriteTextFile` は、まだ無いファイルに書けない） | XAML 経由。理由は `viaXamlBefore.reason` |
| XAML 経由にする子が、スコープ（`ExcelApplicationCard`、`NApplicationCard` など）の外では検証を通らない、またはスコープの変数（ブックのハンドル `IWorkHandle` など）を XAML の引数にできない | そのスコープごと XAML 経由（外側へ、通るところまで上がる） |
| 制御フロー（Sequence、If、ForEach など、生成器の組み込み） | これまでどおり C# の構文 |

版の違いで API が実行時だけ違うものは、生成時のチェック（apiCheck）では分からない。run で見つけたら、対応表に `"viaXamlBefore": { "version": "<動くと確かめた版>", "reason": "..." }` を書く。版の境目が分からないときは、動くと確かめた版を書く（間の版も XAML 経由になるが、動く側に倒す）。
- `WriteTextFile`：24.10.7 は、まだ無いファイルを `LocalResource.FromPath` で渡すと「... doesn't exist」で落ちる。26.10.0 では書ける（2026-11-07、`out/exp/WriteNew.json` に毎回別の名前のファイルを書かせて確かめた）。`viaXamlBefore` は 26.10.0。v24 で WriteTextFile を使う System の 46 件：80 件 OK、SKIP 2、NG 10（NG は全部、24.10.7 に無いプロパティ（`Output`、`FileResource` など）を使うサンプルの生成エラー）。前に落ちていた Copy・Delete・Move 系、ForEachFileX、RenameFileX の C# は OK になった

`--no-via-xaml` を付けると XAML 経由にせず、`NO_MAPPING` / `NO_CODED_API` のエラーにする。`generateCoded` は `viaXaml` を渡したときだけ XAML 経由にする（渡さなければ以前と同じ）。

Coded API の無いパッケージは `versions.ts` の `noCodedApiPackages`（選んだカタログに `services` が無いもの。`System.Activities` と Coded の基底クラスは除く）。2026-11 の時点では Mail 1.21.1、Office 365 2.2.7、WebAPI 1.20.1、SAP BAPI 3.0.1、Data Service 26.10.1、Testing 23.4.1、Persistence 1.13.0。

## 作るもの

XAML は 2 種類。子の無いノードは「1つのアクティビティだけの汎用の XAML」（`_activities/`）、それ以外は「その場の部分木の XAML」（`_xaml/`）。

### 1つのアクティビティだけの汎用の XAML（`_activities/`）

子（body、slots など）・`lists`・`args`・`assigns`・変数を持たないノードは、こちらにする（`coded-via-xaml.ts` の `genericActivity`）。

- 中身はアクティビティ 1 つだけ。IR に書いた入力（`in`）と、出力・入出力（`out` / `inout`）を XAML の引数にし、値は書かない。値は C# から引数の辞書で渡し、出力は戻りの辞書から受ける
  - 引数の名前：`in_<Prop>`、`out_<Prop>`、`io_<Prop>`。型の付いた辞書の項目は `in_<Prop>_<項目名>` など
  - IR に書いていない入力は引数にしない。全部を引数にすると、渡さなかったものに 0 や null が入り、アクティビティの既定値（TimeoutMs の 30000 など）が効かなくなるため
  - 出力・入出力は、IR に無くてもいつも引数にする。C# が受け取らなければ値は捨てられるだけ。入出力のプロパティ（全カタログで 39 個）に既定値のあるものは無いので、渡さなくても引数にしないときと同じ null になる
    - ただし、型の決まらないもの（Object・型引数で決まるもの）、オーバーロードの組のあるもの、古いもの・隠れたものは、IR に書いたときだけ引数にする
- 引数にできない値は XAML に書く。値ごとに別のファイルになる。
  - 属性（`kind: prop`）、enum の名前、`System.Type`
  - 中が全部リテラルの `objs`
  - 型の無い辞書の項目
- ファイル名
  - 必須の入力と「いつも引数」の出力・入出力だけで、引数にできない値も辞書も `typeArg` も無いもの：`<ClassName>.xaml`（例 `_activities/AttachDocument.xaml`、`_activities/GetCurrentJobInfo.xaml`）。出力を受けても受けなくても同じファイル
    - 必須の入力がオーバーロードの組で分かれるもの（RenameFileX の FilePath と FileResource など）は、カタログで最初の組の形だけがこの名前。ほかの組はハッシュ付き
  - それ以外：`<ClassName>_<形のハッシュ 6 桁>.xaml`
  - 形は次のもので決まる。同じ形なら、どこから呼んでも、どのワークフローからでも同じファイルになる
    - 使うプロパティと引数の型
    - 引数にできない値
    - objs
    - 辞書
  - ハッシュは FNV-1a。props と辞書の項目は名前順に並べるので、IR に書いた順には左右されない
- その位置から外すと検証を通らないもの（UI のスコープの中でしか動かないものなど）は、汎用の XAML にせず、次の部分木の XAML にする

```csharp
// AttachDocument はこのパッケージの版に Coded API が無いので XAML 経由（coded/_activities/AttachDocument.xaml）
RunWorkflow("coded/_activities/AttachDocument.xaml", new Dictionary<string, object> { ["in_FilePath"] = path });
```

### その場の部分木の XAML（`_xaml/`）

子のあるノード（スコープ、If など）、式を含む `objs` や `lists` のあるノード、汎用の XAML が検証を通らないノードは、子も含めた部分木を 1 つの XAML にする。その場の値はそのまま中に書かれる。

- 置き場所：`<--out>/_xaml/<ワークフロー名>_<連番>.xaml`。連番は C# のワークフローの中で部分木にしたものの順（1 から）。x:Class もファイル名と同じ
- `RunWorkflow` に渡すパスは、プロジェクトからの相対パス。`--project` があり `--out` がその中なら `relative(project, out)/_xaml/...`、無ければ `--invoke-dir`（verify.mjs は `coded`）、どちらも無ければ `--out` をプロジェクトのフォルダとみなして `_xaml/...`
- XAML は `generate.ts` で作る。式の言語は `--project` の `expressionLanguage`（gen.ts の `--project` と同じ。C# のプロジェクトなら C# の XAML）、ルートの imports もプロジェクトの XAML から取る
- verify.mjs は gen-coded.ts に `--out <作業用>/coded --invoke-dir coded` を渡すので、XAML は `coded/_xaml/` に置かれ、build / run にそのまま入る。注意は report.md に「XAML 経由 n 件」と出る
- スナップショットは `samples/generated-coded/<pkg>/_activities/` と `samples/generated-coded/<pkg>/_xaml/`

C# はこうなる（`samples/generated-coded/UiPath.System.Activities/IfElseIfV2_Min.cs`）：

```csharp
// IfElseIfV2 は対応表が無いので XAML 経由（coded/_xaml/IfElseIfV2_Min_1.xaml）
var __xaml1 = RunWorkflow("coded/_xaml/IfElseIfV2_Min_1.xaml", new Dictionary<string, object> { ["count"] = count, ["label"] = label });
label = (String)__xaml1["label"];
```

## 部分木の XAML の引数の決め方

アクティビティ名では分岐しない。部分木の式を読んで決める（`viaXamlArgs`）。

- 部分木の式に出てくる名前のうち、その位置で見えている変数・引数を、宣言の型で引数にする
- 書き込まれるもの（カタログで `out` / `inout` のプロパティ、`Assign.To`、`MultipleAssign` の `to`、Out / InOut の引数の辞書）は `InOut`、読むだけなら `In`。`InOut` は戻りの辞書から変数に戻す
- 部分木の中で宣言されたもの（Sequence の変数、ForEach などの `item`、ActivityFunc の引数、Catch の変数）は数えない
- 数えないもの：文字列リテラルの中（VB の `""`、C# の `\"`、`@"..."`）、`.名前`（メンバー）と `!名前`、`名前:=`（名前付き引数）、VB の文字リテラル `"a"c` の `c`。`$"...{式}..."` の `{}` の中は数える
- 式として読まないプロパティ：属性に書く値（`kind: prop`）、`System.Type`、enum のメンバー名
- VB と同じく大文字小文字を区別しない（引数の名前は宣言の名前）
- 型が XAML に書けない（`types-xaml.ts` に無い）ものは `CODED_VIA_XAML_TYPE` のエラー

その位置から外したことで検証を通らなくなるもの（Modern の UI 操作を `NApplicationCard` の外に出す、など）は、作った XAML のワークフローを `validate` にかけて `CODED_VIA_XAML_INVALID` のエラーにする。C# の XAML の式に直せないものは、そのノードの場所の `CS_EXPR` になる。

## 確かめた結果

2026-11-06、v24 のテンプレート（`C:\Users\Public\uipath-ir-probe-v24`。VB、Windows、net8。System 24.10.7、UIAutomation 26.10.3、Testing 23.4.1、Mail 1.21.1、Office 365 2.2.7、WebAPI 1.20.1、SAP BAPI 3.0.1、Data Service 26.10.1）で `queue-run.mjs --use-project` で流した。

XAML 経由の C#（`CODED_VIA_XAML`）：

| 対象 | 結果 |
| --- | --- |
| WebAPI 7 件（DeserializeJson、DeserializeJsonArray、DeserializeXml、ExecuteXPath、GetNodes、GetXMLNodes、GetXMLNodeAttributes） | XAML も C# も run で期待ログ一致（Coded API の無いパッケージ） |
| System の IfElseIfV2（Coded API はあるが対応表が無い） | XAML も C# も run で期待ログ一致（InOut の戻りも確かめた） |
| Testing 16 件（23.4.1 は Coded API が無い。対応表のある VerifyExpression なども XAML 経由） | XAML も C# も run で期待ログ一致（32 / 32） |
| Mail の SendMail、Office 365 のスコープ＋GetMail、SAP BAPI のスコープ、WebAPI の HttpClient | XAML も C# も build OK（外部サービスが要るので run しない） |
| Data Service の DeleteEntityRecord | XAML も C# も build NG（`TEntity` にエンティティの型が要る。生成器のせいではない） |

既存のサンプルを v24 で（対応表のある C# の確認を兼ねる）：

- System（`samples/ir/` 直下と System.Activities を含む 320 件。v24 のカタログで検証を通らない 50 件は除いた。24.10.7 に無いアクティビティ・プロパティ、必須の違い（CopyFile の Path など）、`.objects.json` に Filter の型が無い、の版の違い）
  - XAML：run 227 件 OK、93 件は noRun（build だけ）、NG 0
  - C#：138 件 OK、166 件 SKIP（`NO_CODED_API` と noRun）、NG 16。うち 5 件は 24.10.7 の API に引数が無い（`DeleteQueueItems` などの `timeoutMS`。チェッカーの `NO_OVERLOAD`）、11 件は Copy / Delete / Move 系のサンプルで、最初の `system.WriteTextFile(file: LocalResource.FromPath(...))` が「... doesn't exist」で落ちる（26.10.0 では通る。24.10.7 の API は無いファイルに書けない。対応表の版の差で、XAML 経由とは関係ない）
- UIAutomation（build だけ。369 件のうち 24 件は除いた：OCR / CV の 23 件は「UiPath.CoreIPC 2.0.1 以上を入れる」で build が落ちる（テンプレートの依存の問題）、CellScope_Full は「Value is not in list or the entered selector is invalid」（未調査。26.10.3 の既定 XAML を取っていない））
  - XAML：345 件 build OK
  - C#：64 件 build OK、277 件 SKIP（Classic など `NO_CODED_API`）、NG 4（`BlockUserInput` / `UnblockUserInput` が 26.10.3 の API に無い）

「Coded API なし」と版の API の違いも XAML 経由にしてから（2026-11-06、`out/verify/via3-run/`、同じ v24 のテンプレート）：

- 版の API に合わなかった 9 件（DeleteQueueItems、DownloadFileFromUrl、PostponeTransactionItem、SetTransactionProgress、SetTransactionStatus、NBlockUserInput / NUnblockUserInput の min・full）は、すべて XAML 経由になって build が通った。run したのは DownloadFileFromUrl で、期待ログと一致。残りは Orchestrator や入力のブロックが要るので run していない
- 以前 SKIP だった System の 9 件（FilterDataTable の min・full、FormatValue の min・full、CollectionToDataTable、GenerateDataTable、GetFileInfoX、AddLogFields、ForEachFileX）：8 件は C# が run で期待ログと一致。ForEachFileX は前からある 24.10.7 の `WriteTextFile` の件で NG
- Activate.min（Classic。StartProcess と WindowScope を XAML 経由）：画面がロックされていて「前面に移動できません」で NG。XAML でも同じなので、生成器のせいではない
- C# の型 `GenericValue` は既定の using に無いので、`csType` で `UiPath.Core.GenericValue` に直す（FormatValue が C# になって分かった）

## 分かった落とし穴

- **`RunWorkflow` の InOut**：XAML の InOut 引数は、`RunWorkflow` の戻りの辞書に入って返ってくる（IfElseIfV2_Min の `label`、DeserializeJson_Min の `obj` で run して確かめた）。Coded のワークフロー自身の InOut は書けない（knowledge/coded-workflow.md）が、XAML を呼ぶときは使える
- **Coded の名前空間**：Studio はプロジェクト名から名前に使えない文字を**消す**（`uipath-ir-probe-v24` → `uipathirprobev24`。`.local/.codedworkflows/CodedWorkflow.cs` で確かめた）。以前のチェッカーは `_` に置き換えていたので、ハイフンのあるプロジェクトの初回の build で `CodedWorkflow` が見つからなかった。`tools/coded/check.ts` を直した
- **型の名前**：C# の生成器は IR の型名をそのまま書く。既定の using（`System`、`System.Collections.Generic`、`System.Data`、`System.IO`、`System.Linq` など）に無い名前空間の型は、IR に完全名で書く（`System.Xml.Linq.XDocument`、`Newtonsoft.Json.Linq.JObject`）。XAML はどちらでも書ける
- **VB の予約語の変数名**：変数名 `to` は VB の予約語（`For ... To`）なので、XAML の build が `BC30198: ')' expected` で落ちる。1つの XAML の build エラーで、同じ作業用プロジェクトの全ファイルが NG になる
- **for の変数への書き込み**：C# の `foreach` の変数（ForEach の `item`）に XAML 経由で書き込むと、`item = (T)...` が C# のコンパイルエラーになる（`foreach` の変数は読み取り専用）。IR では別の変数に代入する
- **参照型の中身**：In で渡した DataTable などの中身を XAML 側で変えると、C# 側の同じオブジェクトも変わる（同じプロセスで動くため）。変数そのものを差し替える（Assign など）ときだけ InOut になる
- **書き込みだけの変数**も、いったん辞書に入れて渡す（InOut は入力も要る。null で渡してよい）
- **Data Service** のアクティビティは型引数 `TEntity` にテナントのエンティティの型（Studio が `.entities` から作るクラス）が要る。`Object` を入れると build が `violates the constraint of type 'TEntity'` で落ちるので、サンプルは `samples/ir-unbuildable/` に置いた
- **1つのファイルの build エラーで全部 NG**：verify.mjs の build はプロジェクト全体なので、OCR / CV（CoreIPC が要る）のような build できないものを混ぜると、ほかのファイルも全部 NG に見える。除いて流し直す
- **一度に渡すファイルが多すぎる**と（UIAutomation の 369 件）、verify.mjs が gen.ts を起動できず「gen.ts の出力に結果が無い」になる（Windows のコマンドラインの長さ）。120 件ほどに分ける
- **WebAPI 1.20.1 のカタログ**は readOnly のプロパティがたまたま無いので、`versions.ts` の判定では古い形式に見える。対応表（`mappings/<pkg>/`）の無いパッケージは C# でも API を呼ばないので、`--project` での C# の生成をエラーにせず、注意を出して XAML 経由にする（対応表のある古いカタログ、例 System 26.2.6 は今までどおりエラー）

## 汎用の XAML（_activities/）にしてからの確認

2026-11-07、v24 のテンプレートで確かめた（`out/verify/act-v24-run/`）。対象は次の 47 件で、XAML と C# の両方を流した。

- WebAPI 7 件
- Testing 23.4.1 の 28 件（VerifyControlAttribute は除いた）
- System 11 件（FormatValue、FilterDataTable、DownloadFileFromUrl など）
- NBlockUserInput

結果は 70 件 OK、24 件 SKIP（Orchestrator が要るなどの noRun）、NG 0。プロジェクトの `coded/_activities/` には、同じ形のものが 1 つにまとまって置かれた（例 `AttachDocument.xaml`、`GetTestDataQueueItems_5765ff.xaml`）。

このときは出力を IR に書いたときだけ引数にしていた。出力のプロパティ（`Result` など）は必須でないことが多く、出力を受けるものはほとんどが `<ClassName>_<ハッシュ>.xaml` になった。そのため出力・入出力をいつも引数にした（上の「汎用の XAML」）。
