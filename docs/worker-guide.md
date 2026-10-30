# ワーカー用の作業手順書

Linear のイシュー（1アクティビティ1件）を1つずつ片付けるための手順。何十人かが同時に作業するので、**自分のファイルだけを足し、共有のファイルはできるだけ触らない**。

考え方：AI（ワーカー）が書くのは IR（JSON）と対応表（JSON）だけ。XAML と C# は生成器が作る。

```
IR サンプル（samples/ir/<pkg>/*.json）
  ├─ tools/ir/gen.ts        → XAML  → uip rpa build / run
  └─ tools/ir/gen-coded.ts  → C#    → tools/coded/check.ts → uip rpa build / run
                 ↑ mappings/<pkg>/<ClassName>.json（アクティビティ → Coded のメソッド）
```

## 0. 環境

- リポジトリ：`C:\Users\seiya\ghq\github.com\AutoFor\uipath-ir-builder`。Node 24 以上（npm の依存なし）
- テンプレートの UiPath プロジェクト：`C:\Users\Public\uipath-ir-probe`（net8、System 26.10.0、UIAutomation 26.10.6、Excel 3.6.1）。**直接いじらない**。`tools/verify/verify.mjs` が `C:\Users\Public\uipath-ir-probe-<作業名>` に写して使う
- `uip`：`C:\Users\seiya\AppData\Roaming\npm\uip.cmd`。サインインとロボットのライセンスは済んでいる
- 作業名（`--name`）は自分専用のものにする（例：イシュー番号 `aut-512`）。他のワーカーと同じ名前を使わない

## 1. 1イシューの進め方

例として `UiPath.System.Activities` の `WriteTextFile` を扱う。`<pkg>` はカタログのパッケージ名（`System.Activities` / `UiPath.System.Activities` / `UiPath.UIAutomation.Activities`）。

### 1-1. イシューを読み、カタログを確認する

```bash
node tools/ir/coverage.ts --activity WriteTextFile
```

全プロパティについて、IR で書けるか（書けないなら理由）、必須か、サンプルで使われているか、Coded の対応表があるかが出る。カタログの元データは `catalog/<pkg>/<version>.json`。

### 1-2. Studio の既定 XAML を取って保存する

```powershell
& C:\Users\seiya\AppData\Roaming\npm\uip.cmd rpa activities get-default-xaml `
  --activity-class-name UiPath.Core.Activities.WriteTextFile `
  --project-dir C:\Users\Public\uipath-ir-probe-<作業名> --output json > knowledge/default-xaml/WriteTextFile.json
```

- ジェネリックのクラスは `` `1 `` を付ける（例 ``System.Activities.Statements.AddToCollection`1``）
- 作業用プロジェクトが無ければ、先に一度 `node tools/verify/verify.mjs --name <作業名> --build-only samples/ir/Greet.json` を流すとできる
- 同じ ClassName が別パッケージにある（`ForEach` など）ときは、ファイル名を `<ClassName>.<pkg>.json` にする

### 1-3. IR のサンプルを2つ書く

| ファイル | 中身 |
| --- | --- |
| `samples/ir/<pkg>/<ClassName>.min.json` | 必須のプロパティだけ（最小） |
| `samples/ir/<pkg>/<ClassName>.full.json` | 設定できるプロパティをできるだけ全部（全部入り） |

- `workflow` は `<ClassName>_Min` / `<ClassName>_Full`（生成される XAML / C# の名前になる。全サンプルで重ならないようにする。同名クラスが別パッケージにあるなら頭にパッケージの略を付ける）
- 結果をログで確かめられるよう、アクティビティの出力を `LogMessage` で出す
- run できるものは、期待するログを横に置く：`<ClassName>.min.expected.log`（1行1件、出る順に。`[Information] ...` のようにレベルから書くとレベルも比べる）
- 入力引数が要るときは `<ClassName>.min.verify.json` に `{ "args": { ... } }`。run できない理由があるときは `{ "noRun": "理由" }`
- IR の書き方は README の「IR → XAML 生成器」と `tools/ir/types.ts`。引数の辞書（`InvokeCode.Arguments` など）は `dicts`、`System.Type` は型名の文字列

### 1-4. XAML を生成して検証する

```bash
node tools/ir/gen.ts samples/ir/<pkg>/WriteTextFile.*.json --check
node --test "tools/ir/*.test.ts"          # 初回はスナップショット samples/generated/<pkg>/*.xaml ができる
node tools/compare-default-xaml.mjs --generated samples/generated/<pkg> --activity WriteTextFile
```

- `compare-default-xaml` は、生成した XAML と既定 XAML の食い違い（xmlns、`x:TypeArguments`、属性か要素か、既定 XAML が付ける値）を出す。食い違いは生成器かカタログの判断（`knowledge/default-xaml/` の既定値）で直す
- スナップショットの中身（生成された XAML）は目で読んで、おかしくないか確かめる

### 1-5. 対応表を書く（XAML → C#）

`mappings/<pkg>/<ClassName>.json` を1つ作る。書き方は `tools/ir/mapping.ts` の先頭のコメント。例は `mappings/UiPath.System.Activities/WriteTextFile.json`。

- サービスの API：カタログの `services`（`catalog/<pkg>/<version>.json`）で探す。`system` は `ISystemService`、`uiAutomation` は `IUiAutomationAppService`、`Log` / `RunWorkflow` / `Delay` は基底クラス（`catalog/UiPath.CodedWorkflows/24.10.3.json`）
- API に無いものは `"coded": null, "reason": "Coded API なし（…）"`
- 制御フロー（Sequence / If / ForEach / While / DoWhile / Switch / TryCatch / Assign / MultipleAssign / Break / Continue / Throw / Rethrow / RetryScope）は生成器が C# の構文にするので、対応表は作らない（「C# の構文で書くので対象外」）
- IR にあるのに対応表が扱っていないプロパティは、生成時にエラー（`MAPPING_UNUSED_PROP`）になる。意味がないものだけ `ignore` に書く。`ContinueOnError` は生成器が try / catch で包む

```bash
node tools/ir/gen-coded.ts samples/ir/<pkg>/WriteTextFile.*.json --check --print
```

生成した C# は自動で `tools/coded/check.ts` にかかる（メソッドの有無、引数の数と名前、リテラルの型、既知の落とし穴）。VB の式を C# に直せないときは、IR の値を `{ "vb": "...", "cs": "..." }` にする。

### 1-6. build / run で確かめる

```bash
node tools/verify/verify.mjs --name <作業名> samples/ir/<pkg>/WriteTextFile.min.json samples/ir/<pkg>/WriteTextFile.full.json
# run できないものは
node tools/verify/verify.mjs --name <作業名> --build-only samples/ir/<pkg>/WriteTextFile.*.json
```

- IR 1つにつき XAML と C# の両方を作り、両方を build / run する。期待ログ（`*.expected.log`）は両方と突き合わせる。目で見て OK にはしない
- 結果は `out/verify/<作業名>/report.md`（と `report.json`、`logs/`）。`out/` はコミットしない
- 手書きの `.cs` を試すときも同じコマンドに渡す（チェッカーでエラーが出た `.cs` は写さない。1つでも壊れた `.cs` があるとプロジェクト全体のコンパイルが落ちるため）

### 1-7. テストを通してコミットする

```bash
node --test "tools/ir/*.test.ts"       # コミット前に必ず全部通す
git add samples/ir/<pkg>/ samples/generated/<pkg>/ samples/generated-coded/<pkg>/ mappings/<pkg>/WriteTextFile.json knowledge/default-xaml/WriteTextFile.json
git commit
```

`knowledge/coverage.md` は全員が触ると衝突するので、ワーカーはコミットしない（マネージャーがマージ後に `node tools/ir/coverage.ts` で作り直す）。

### 1-8. Linear を更新する

下の雛形で日本語のコメントを書き、状態を Done にする（書けないものは Canceled）。

## 2. ファイルの置き場所

| 置くもの | 場所 | 備考 |
| --- | --- | --- |
| IR のサンプル | `samples/ir/<pkg>/<ClassName>.min.json`、`.full.json` | 1アクティビティで2つ以上 |
| 期待ログ・実行条件 | `samples/ir/<pkg>/<ClassName>.min.expected.log`、`.min.verify.json` | IR の横 |
| XAML のスナップショット | `samples/generated/<pkg>/<workflow>.xaml` | テストが作る。手で書かない |
| C# のスナップショット | `samples/generated-coded/<pkg>/<workflow>.cs` | テストが作る。手で書かない |
| 対応表 | `mappings/<pkg>/<ClassName>.json` | 1アクティビティ1ファイル |
| 既定 XAML | `knowledge/default-xaml/<ClassName>.json` | get-default-xaml の出力そのまま |
| 手書きの Coded（必要なときだけ） | `samples/coded/<pkg>/<ClassName>.cs` | namespace は `CatalogProbeNet8`、クラス名＝ファイル名 |
| 不正な IR のテスト | `samples/ir-invalid/<名前>.json` と `.expected.json`（`{ "codes": [...] }`） | 検証で弾くべきものを足したとき |
| run で読む入力ファイル（.xlsx など） | `samples/data/<分類>/`（例 `samples/data/excel/Sample.xlsx`）と、それを作るスクリプト | `verify.mjs` が作業用プロジェクトの `data/` に写す。書き出しは `output/`（8-E-4） |

共有のファイル（`tools/`、`catalog/`、README、この手順書）を変えるときは次の節に従う。

## 3. 生成器（tools/ir/*.ts など）を変えるときのルール

- 変更は小さく、汎用に保つ。特定のアクティビティ名で分岐しない（必要なら対応表かカタログの判断に寄せる）
- 変更したら、サンプル全部でテストを流し、**既存のスナップショット（`samples/generated/`、`samples/generated-coded/`）が変わらない**ことを確かめる。変わるなら、その理由をコミットメッセージに書き、変わったサンプルを `verify.mjs` で build（できれば run）し直す
- スナップショットを作り直すのは `UPDATE_SNAPSHOTS=1 node --test "tools/ir/*.test.ts"`（PowerShell は `$env:UPDATE_SNAPSHOTS='1'`）。意図しない差分を一緒に作り直さない
- 検証で新しく弾くようにしたら、`samples/ir-invalid/` に例と `.expected.json` を足す
- run で確かめた形（例：`InvokeWorkflowFile.Arguments` を `<scg:Dictionary>` で包まない）を、build だけの確認で変えない

## 4. 完了の基準

1. **プロパティ**：そのアクティビティの全プロパティを `coverage.ts --activity` で「書ける」にする。書けないものは、理由と、追った別のイシュー（Linear で作る）をコメントに書く
2. **サンプル**：最小と全部入りの2つ以上。両方が `gen.ts --check` とテストを通り、XAML の build が通る
3. **XAML の run**：外部の依存がなく run できるものは、`*.expected.log` を置き、`verify.mjs` で実際のログと一致させる
4. **既定 XAML**：`knowledge/default-xaml/<ClassName>.json` を保存し、`compare-default-xaml --generated` で食い違いがない
5. **Coded**：
   - サービス API にあるもの：対応表を書き、`gen-coded.ts` とチェッカーと build を通し、run できるものは XAML と同じ `*.expected.log` で一致させる
   - API に無いもの：対応表を `"coded": null` と理由で置き、「Coded API なし」と記録する
   - 制御フロー：「C# の構文で書くので対象外」（生成器が直す。対応表は作らない）
6. **run できないもの**（Orchestrator、メール、SAP、外部アプリなど）：「build まで、理由：…」でよい。`*.verify.json` に `noRun` で理由を書く
7. **どうしても書けないもの**（カタログに無い、ドキュメントにしか無いなど）：理由を書いて Linear で Canceled にする
8. `node --test "tools/ir/*.test.ts"` が全部通っている

## 5. Linear の更新

チーム AutoFor、プロジェクト uipath-ir-builder。MCP ツールは ToolSearch で次を読み込んで使う：

```
select:mcp__d5a43609-5944-4c08-940d-b934cbd090ca__save_issue,mcp__d5a43609-5944-4c08-940d-b934cbd090ca__save_comment,mcp__d5a43609-5944-4c08-940d-b934cbd090ca__get_issue
```

- 作業を始めるとき `get_issue` で中身を読む
- 終わったら `save_comment` で結果を書き、`save_issue` で状態を Done（書けないものは Canceled）にする

コメントの雛形：

```markdown
## 結果：完了（XAML run / Coded run）

- ブランチ / コミット：`worker/aut-512` / abc1234
- サンプル：`samples/ir/UiPath.System.Activities/WriteTextFile.min.json`、`WriteTextFile.full.json`
- プロパティ：7 / 7 を IR で書ける（書けないもの：なし）
- XAML：build OK、run OK（期待ログ一致：`WriteTextFile.min.expected.log`）
- Coded：`system.WriteTextFile`（対応表 `mappings/UiPath.System.Activities/WriteTextFile.json`）。チェッカー OK、build OK、run OK（同じ期待ログで一致）
- 既定 XAML との比較：食い違いなし
- 生成器の変更：なし
- 気づいたこと：Output は Coded の戻り値が void なので扱えない（ignore にした）
```

結果の見出しは、状況に合わせて「完了（build まで、理由：Orchestrator が要る）」「完了（Coded API なし）」「中止（理由：…）」などにする。

## 6. git

- 自分のブランチ（例 `worker/aut-512`）かワークツリーで作業し、そこにコミットする。**push はしない**（マージはマネージャーがやる）
- main に直接コミットしない
- コミットメッセージの最後に次を付ける：

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## 7. 並列実行と、よくあるつまずき

### 並列実行

- `uip` は作業用プロジェクトのフォルダごとに Studio のバックエンド（Helm、`UiPath.Studio.Helm.exe`）を1つ起動し、使い回す（`uip rpa instances list` で見える）。1つあたり約 0.8〜1 GB。15〜20 分ほど使わないと自分で終わる
- **build**：作業用プロジェクトが別なら同時に流してよい。4つの作業用プロジェクトで同時に build して、どれも正しく通り、1つのプロジェクトのコンパイルエラーが他に影響しないことを確かめた（初回は Helm の起動で約 30 秒、2回目からは約 10 秒）。**同時に 4 つまで**を目安にする
- **run**：ロボット（Assistant）は1ユーザーに1つなので、`verify.mjs` は `C:\Users\Public\uipath-ir-probe.run.lock` でマシン全体の run を1つずつに並べる（待つ間「run の順番待ち」と出る）。同時に run したときの動きはまだ確かめていない。ロックを外さないこと
- 同じ作業用プロジェクトを2つの `verify.mjs` で同時に使うと、`.verify.lock` で止まる。作業名を分ける

### run が「アクセスが拒否されました」で落ちる

管理者権限（整合性レベル High）のシェルから `uip` を呼ぶと、Helm も管理者権限で起動し、中の権限で動いているロボットに実行を頼めない（`RegisterClientProcess` の `OpenProcess` で拒否される）。`UiRobot.exe execute` を直接呼んでも同じ。

- 確かめ方：`whoami /groups` に `High Mandatory Level` があれば管理者権限
- 直し方：管理者権限でないシェルから `uip` を呼ぶ。すでに管理者権限の Helm が残っていると、そのプロジェクトではそれが使われるので、終わるのを待つ（15〜20 分）か、タスク マネージャーで `UiPath.Studio.Helm.exe` を終わらせる
- build と get-default-xaml はロボットを使わないので、管理者権限でも動く

### その他

- 初回の run / build は Helm の起動と依存の復元で数分かかることがある。`--timeout`（秒、既定 900）で上限を変えられる
- Coded の引数：In は `Execute` の引数、Out は戻り値（1つなら引数名が `Output` になる、2つ以上なら名前付きタプル）。`ref` / `out` 引数は Studio の生成コードがコンパイルできないので使えない（InOut は Coded では未対応）
- `LogLevel` は `UiPath.CodedWorkflows.LogLevel.X` と完全名で書く。ファイルのパスは `LocalResource.FromPath("...")`（詳しくは `knowledge/coded-workflow.md`）

## 8. UI 操作（UIAutomation）と Excel

後で追記（別のワーカーが IR の形と手順を設計する）。それまでは UIAutomation の `Target` / `TargetAnchorable` などは coverage で「UI のターゲット」として書けない扱いになる。

### 8-E. Excel（UiPath.Excel.Activities 3.6.1）

`<pkg>` は `UiPath.Excel.Activities`。カタログは `catalog/UiPath.Excel.Activities/3.6.1.json`、Excel 固有の処理は `tools/ir/excel.ts`。見本は `samples/ir/UiPath.Excel.Activities/` の `ExcelApplicationCard`・`ReadRangeX`・`WriteRangeX`・`WriteCellX`・`ReadCellValueX`・`ExcelApplicationScope`・`ExcelReadCell`（どれも XAML と C# の build は通っている。run はまだ）。迷ったらまずこれを真似る。

#### 8-E-1. イシューのクラス名とカタログのクラス名

イシューのタイトルのクラス名がカタログと違うものがある。カタログの名前で書く（`node tools/ir/coverage.ts --activity <名前>` で確かめる）。

| イシュー | カタログ | 備考 |
| --- | --- | --- |
| ReadCellX（AUT-712） | `ReadCellValueX` | |
| ChangePivotDataSourceX（AUT-988） | `ChangePivotTableDataSourceX` | |
| クラス名不明 / Auto Fill（AUT-986） | `AutoFillX` | |
| ExcelForEachRow（AUT-1058） | `ExcelForEachRowX` | `ExcelForEachRow` は非推奨（Obsolete）。新しい方で書き、古い方は触れるだけ |
| CreatePivotTableX（AUT-991） | `CreatePivotTableXv2` | `CreatePivotTableX` は非推奨 |
| CsvFile / Write CSV（AUT-850） | `AppendWriteCsvFile` | `CsvAction`（Write / Append）を持つモダンの Write CSV。get-default-xaml で表示名を確かめる |
| GetCellColorX、ExcelProcessScopeX など | 同じ | `ExcelProcessScopeX` はイシューではクラシックに入っているが、中身はモダン（Use Excel File を入れる外側のスコープ） |

完全名（get-default-xaml の `--activity-class-name`）は、モダンが `UiPath.Excel.Activities.Business.<名前>`（`GetSelectedRangeX` / `SelectRangeX` は `UiPath.Excel.Activities.Windows.Business.`、`GetCellColorX` は `UiPath.Excel.Activities.`）、クラシックが `UiPath.Excel.Activities.<名前>`、CSV が `UiPath.CSV.Activities.<名前>`。迷ったらカタログの `clrType` を見る。

#### 8-E-2. モダン（Use Excel File の中で使うもの）

Use Excel File（`ExcelApplicationCard`）は、ブックの参照（`IWorkbookQuickHandle`）を delegate の引数として中に渡す。中のアクティビティは、その参照から作った式（`IReadRangeRef` / `IReadWriteRangeRef` / `IReadCellRef` / `ISheetRef` など）をプロパティに受け取る。

```json
{ "act": "ExcelApplicationCard", "item": "Excel",
  "props": { "WorkbookPath": { "lit": "data\\excel\\Sample.xlsx" }, "ReadOnly": true },
  "body": [
    { "act": "ReadRangeX", "props": { "Range": "Excel.Sheet(\"Sheet1\").Range(\"A1:B4\")", "SaveTo": "dt" } },
    { "act": "WriteCellX", "props": { "Cell": "Excel.Sheet(\"Sheet1\").Cell(\"D1\")", "Value": { "lit": "済" } } }
  ] }
```

- **`"item": "Excel"` を必ず書く**（Studio の既定の名前。書かないと引数名が `item` になり、`Excel` が宣言されていないと検証で `EXCEL_REF` になる）
- body に2つ以上書くと生成器が Sequence で包む
- 参照は VB の式で書く。XAML ではそのまま `Range="[Excel.Sheet(&quot;Sheet1&quot;).Range(&quot;A1:B4&quot;)]"` になり、C# では生成器が `Excel.Sheet["Sheet1"].Range["A1:B4"]`（インデクサー）に直す

| プロパティの型 | 書き方の例 |
| --- | --- |
| `IReadRangeRef` / `IReadWriteRangeRef` / `IWellDefined*RangeRef`（範囲） | `Excel.Sheet("Sheet1").Range("A1:B4")`、シート全体は `Excel.Sheet("Sheet1")`、テーブルは `Excel.Table("Table1")` |
| `IReadCellRef` / `IReadWriteCellRef`（セル） | `Excel.Sheet("Sheet1").Cell("A1")` |
| `ISheetRef`（シート） | `Excel.Sheet("Sheet1")` |
| `IPivotTableRef` | `Excel.Sheet("Sheet1").PivotTable("PivotTable1")` |
| `IChartRef` | `Excel.Sheet("Sheet1").Chart("Chart 1")` |
| `IWorkbookQuickHandle`（`Workbook` などブックそのもの） | `Excel` |
| For Each Excel Row の中の行 | `CurrentRow("Name")`（`ExcelForEachRowX` の `item` は `["CurrentRow", "CurrentIndex"]`） |

使えるメンバーはカタログの `handles`（`IWorkbookQuickHandle` → `Sheet` / `Table`、`WorksheetQuickHandle` → `Range` / `Cell` / `PivotTable` / `Chart` など）。検証（`tools/ir/excel.ts` の `checkExcel`）は、式の先頭が宣言済みか、`.名前` がカタログにあるか（`Rangee` のような打ち間違い）を build の前に見る。

ほかの delegate の引数名（get-default-xaml の `DelegateInArgument Name` と同じにする）：

| アクティビティ | item |
| --- | --- |
| `ExcelProcessScopeX` | `"ExcelProcessScopeTag"` |
| `ExcelForEachRowX` | `["CurrentRow", "CurrentIndex"]` |
| `ForEachSheetX` | `["CurrentSheet", "CurrentIndex"]` |

`SortX` / `InvokeVBAX` / `ExecuteMacroX` / `CreatePivotTableXv2` / `UpdateChartX` は、body に「子の設定用アクティビティ」（`SortColumnX`、`InvokeVBAArgumentX`、`ExecuteMacroArgumentX`、`PivotTableFieldX`、`*Modification`）を並べる。get-default-xaml は body に空の Sequence を置くので、IR では body に子の設定を並べる（2つ以上なら Sequence に包まれる。Studio と同じ）。

#### 8-E-3. クラシック（Excel Application Scope の中で使うもの）

```json
{ "act": "ExcelApplicationScope", "item": "ExcelWorkbookScope",
  "props": { "WorkbookPath": { "lit": "data\\excel\\Sample.xlsx" }, "ReadOnly": true },
  "body": [ { "act": "ExcelReadCell", "props": { "SheetName": { "lit": "Sheet1" }, "Cell": { "lit": "A2" }, "Result": "v" } } ] }
```

- 中のアクティビティ（`ExcelReadRange`、`ExcelWriteCell` など。基底が `ExcelInteropActivity`）は、スコープの変数を参照しない（実行時に親を探す）。スコープの外に置くと検証で `EXCEL_SCOPE`
- `item` は Studio の既定の `"ExcelWorkbookScope"` にする（中から参照しないが、Coded の using の変数名になる）
- `WorkbookPath`（新しく開く）と `ExistingWorkbook`（開いているブックを使う）は OverloadGroup。後者の例は `ExcelApplicationScope.existing.json`
- `Range` など String の入力は、既定 XAML が `""` を入れるものがある（`ExcelReadRange.Range`）。空でよいなら `{ "lit": "" }` を書く

#### 8-E-4. テスト用のブック（samples/data）

- 読むブックは `samples/data/excel/Sample.xlsx`。中身は `samples/data/excel/make-sample.mjs` の先頭のコメント（Sheet1：Name / Age / Double の表と式、A1 が赤。Sheet2：A1 に「シート2」）
- `verify.mjs` が `samples/data/` を作業用プロジェクトの `data/` に写すので、IR では **`"data\\excel\\Sample.xlsx"`**（相対パス）で開く。読むだけのときは `"ReadOnly": true`
- 書き出すときは **`"output\\<workflow>.xlsx"`** に書く（`verify.mjs` が毎回空の `output/` を作る。`CreateNewFile` の既定 true で新しく作られる）。Sample.xlsx は書き換えない
- XAML と C# は同じ `output/` に続けて書くので、**何度流しても同じ結果になる書き方**にする（追記ではなく上書き。書いたら読み戻してログに出す）。例は `WriteRangeX.min.json`
- 別のブックが要る（シートを増やす、表やピボットを入れるなど）ときは、`make-sample.mjs` を直して作り直すか、同じ形のスクリプトで別のファイルを作る（バイナリを手で作って置かない。中身はスクリプトに書く）。パスワード付きのブックなどスクリプトで作れないものは、サンプルを build だけにして `*.verify.json` の `noRun` に理由を書く（例 `ExcelApplicationCard.secure.json`）

#### 8-E-5. Coded（対応表）

Coded の Excel は `excel` サービス（`IExcelService`）でブックを開き、返ってきた参照に対して **拡張メソッド**（`UiPath.Excel.Activities.API.ExcelOperations`）を呼ぶ形。API はカタログで探す：

```bash
# サービスのメソッド（UseExcelFile / UseWorkBook / ExcelProcessScope）
node -e "const c=require('./catalog/UiPath.Excel.Activities/3.6.1.json');for(const m of c.services[0].methods)console.log(m.name,m.params.map(p=>p.type+' '+p.name).join(', '))"
# 拡張メソッド（ReadRange、WriteCell、SaveExcelFile …）。最初の引数が this（どの参照に対して呼べるか）
node -e "const c=require('./catalog/UiPath.Excel.Activities/3.6.1.json');for(const m of c.extensions[0].methods.filter(m=>/Sort/.test(m.name)))console.log(m.returns,m.name,m.params.map(p=>p.type+' '+p.name+(p.optional?'='+p.default:'')).join(', '))"
```

`handles`（参照の型のプロパティ・インデクサー）、`enums`（`UiPath.Excel.ExcelSaveAsType` などのメンバー名）、オプションのクラス（`UseOptions`、`FilterOptions`、`TextToColumnsOptions` など。`handles` にプロパティがある）も同じファイルにある。

対応表の書き方（`tools/ir/mapping.ts` の先頭のコメントも見る）：

| やりたいこと | 書き方 | 例 |
| --- | --- | --- |
| スコープを using にする | `"scope": "using"`。変数名は IR の `item` | `ExcelApplicationCard.json` → `using (var Excel = excel.UseExcelFile(options: new UseOptions { ... })) { ... }` |
| オプションのクラスを渡す | `"init": { "param": "options", "type": "UseOptions", "props": { "Path": "{WorkbookPath}", ... } }`。IR に無いプロパティの行は省かれる。値を配列にすると使える最初のもの | `ExcelApplicationCard.json` の `Password` |
| 参照に対して拡張メソッドを呼ぶ | `"call": "{Range}.ReadRange"`（call にもテンプレートが使える） | `ReadRangeX.json`、`WriteRangeX.json`、`WriteCellX.json` |
| API に既定値が無い引数 | `"defaults": { "HasHeaders": true }`（アクティビティの既定値。IR に無いときに使う） | `ReadRangeX.json` |
| enum | `"UiPath.Excel.ReadFormattingOptions.{ReadFormatting}"`（完全名 + メンバー名） | `ReadRangeX.json` |
| object を返す API の結果を変数に入れる | `"code": "{SaveTo} = ({SaveTo|type})Convert.ChangeType(..., typeof({SaveTo|type}));"` | `ReadCellValueX.json` |
| クラシック：スコープの変数を使う | `{@IWorkHandle}`（外側の `scopeType` の末尾の名前） | `ExcelReadCell.json` → `ExcelWorkbookScope.ReadCell(sheetName: ..., ...)` |
| ある形だけ Coded API が無い | `{ "when": ["ExistingWorkbook"], "reason": "..." }`（NO_CODED_API になり C# を作らない） | `ExcelApplicationScope.json` |
| static のメソッド（CSV） | `"call": "ExcelOperations.WriteCsvFile"`（`AppendCsvFile` / `ReadCsvFile` / `WriteCsvFile` は拡張メソッドではない） | （未作成） |

- `usings` に、拡張メソッドを使うなら `UiPath.Excel.Activities.API`、オプションのクラスなら `UiPath.Excel.Activities.API.Models`、`UiPath.Excel` の型を使うなら `UiPath.Excel` を書く（スコープの対応表には全部入れてある）
- モダンのスコープ（`UseExcelFile`）は Excel を起動する。クラシックの `UseWorkBook` は Excel を起動せずにブックを読み書きする（Visible / MacroSetting など Excel の起動に関するプロパティは Coded では捨てている）
- IR の変数の型で、C# の既定の using に無いもの（`SecureString` など）は完全名で書く（`"type": "System.Security.SecureString"`）。`types-xaml.ts` に無い Excel の型は `tools/ir/excel.ts` の `excelXamlTypes` に足す
- 繰り返し（`ExcelForEachRowX` / `ForEachSheetX`）は、API が `ForEachRow(range, Action<CurrentRowQuickHandle>)` のようにラムダを取る。生成器はまだラムダのスコープ（`"scope": "lambda"` のような形）を持たない。そのバッチで生成器を足すか、足すまでは対応表を `"coded": null` と理由にする
- 子の設定用アクティビティを持つもの（`SortX` など）は、API が記述子（`SortXDescriptor`、`PivotTableDescriptor` など）を取る。body の子から記述子を作る仕組みは生成器にまだ無い。同じく、そのバッチで生成器を足すか、`"coded": null` と理由にする

#### 8-E-6. build / run と Linear

```bash
node tools/ir/gen.ts samples/ir/UiPath.Excel.Activities/ReadRangeX.*.json --check
node tools/ir/gen-coded.ts samples/ir/UiPath.Excel.Activities/ReadRangeX.*.json --check --print
node tools/verify/verify.mjs --name <作業名> --build-only samples/ir/UiPath.Excel.Activities/ReadRangeX.min.json samples/ir/UiPath.Excel.Activities/ReadRangeX.full.json
node tools/compare-default-xaml.mjs --generated samples/generated/UiPath.Excel.Activities --activity ReadRangeX
```

- build の警告「Use Excel File を Excel Process Scope の中で使うことを勧める」は無視してよい
- run には Excel（デスクトップ版）が要る。この PC には入っているが、管理者権限のシェルから起動した Excel はファイルを開けない（「ファイルにアクセスできません」）。run はマネージャーがまとめて流すので、期待ログ（`*.expected.log`）を必ず書き、build まで通ったら Linear を **In Progress** にして「run 待ち」とコメントする
- run できないもの（パスワード付きのブック、秘密度ラベル、マクロ付きのブック、クリップボード、PDF の出力先の確認など）は `noRun` に理由を書く。その上で build と全テストが通れば Done

## 9. XAML → IR の取り込みに向けて気づいた点

今回は作らないが、既存の XAML を読んで IR にする（そこから C# を作る）ときに困らないよう、IR を変えるときは次に気をつける。

- **式の言語**：IR の文字列の式は VB 前提。取り込む XAML が C# のプロジェクト（`expressionLanguage: CSharp`）だと式も C# になる。IR に式の言語（ワークフロー単位の `language` か、値ごとの `{ cs }`）を持たせる余地を残しておく。`{ vb, cs }` の形はその足がかり
- **属性のリテラルと式の区別**：XAML では `Message="abc"`（リテラル）と `Message="[abc]"`（式）が別。IR では `{ lit }` と文字列で分けているので、取り込み時もこの区別を保つ
- **既定値**：生成器は `get-default-xaml` の既定値（`Version="V5"` など）を自動で足す。取り込み時は、既定値と同じ属性を IR から落とさないと、往復で差分が出る（落とすかどうかを決めておく）
- **表示用の情報**：`sap2010:WorkflowViewState.IdRef`、`sap:VirtualizedContainerService.HintSize`、注釈（`sap2010:Annotation.AnnotationText`）は IR に無い。往復で消えてよいか、IR に `annotation` などを足すかを決める
- **IR が持たないもの**：Flowchart / StateMachine、`InvokeWorkflowFile` の `ArgumentsVariable`、`ActivityFunc`（`RetryScope.Condition` など）、要素構文のコレクションやオブジェクト（coverage の「書けない」）。取り込み時は「未対応のノード」として XAML の断片をそのまま持つ逃げ道（例 `{ "act": "RawXaml", "xaml": "..." }`）があると、全部を落とさずに済む
- **名前空間と型**：IR の型名は短い名前（`String`、`DataTable`）で、`types-xaml.ts` の表にあるものだけ。取り込み時は XAML の `x:TypeArguments="scg:List(x:String)"` を IR の型名に戻す逆引きが要る。表を増やすときは両方向で使える形にしておく
- **delegate の引数名**：ForEach の `item` などは IR では `item` で持つ。XAML の `DelegateInArgument Name` をそのまま入れれば往復できる
- **Coded への変換で落ちる意味**：Switch は if / else if に、RetryScope は for + try / catch に、ContinueOnError は try / catch に直している。XAML → IR → C# の置き換えでは、これらの差（RetryScope の回数の数え方、ログの出方）が期待ログで分かるよう、`*.expected.log` を必ず置く
