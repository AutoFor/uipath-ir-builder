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

Excel の部分は別のワーカーが書く。ここは UIAutomation（`UiPath.UIAutomation.Activities`、イシューは Linear の親 AUT-615 の子）。

### 8-1. UIAutomation の考え方

- UI の画面要素（ターゲット）は、XAML では**要素で書くオブジェクト**（`<uix:NClick.Target><uix:TargetAnchorable ... /></uix:NClick.Target>`）。IR ではノードの `objs` に書く。処理は `tools/ir/uia.ts` にまとめてある
- `objs` のキーは**アクティビティのプロパティ名**（`Target`、`TargetApp`、`VerifyOptions`、`CursorPosition`、`DialogHandling` など）、中身のキーは**そのオブジェクトの型のプロパティ名**（XAML の属性名と同じ。別名は付けていない）
- 書ける型とプロパティは `catalog/UiPath.UIAutomation.Activities/26.10.6.objects.json`。`coverage.ts --activity` で「objs」と出るものが `objs` に書くプロパティ
- 値の書き方は `props` と同じ（`{ "lit": "..." }` は文字列リテラル、文字列は VB の式、enum はメンバー名、フラグの enum は `"Selector, FuzzySelector"`）。入れ子のオブジェクト（`TargetAnchorable.PointOffset` など）はそのまま JSON のオブジェクト、アンカー（`Anchors`）は配列
- 生成器が足すもの：`TargetAnchorable` の `Guid` と `Version="V6"`、`TargetApp` の `Version="V3"`、Classic の `Target` の `Id`、`NApplicationCard` の `ScopeGuid` と、その中のアクティビティの `ScopeIdentifier`（Studio と同じ）

| 系統 | ターゲットの型（objs のキー） | 置き場所 | Coded |
| --- | --- | --- | --- |
| Modern（`N*`） | `TargetAnchorable`（`Target`） | `NApplicationCard` の `body` の中（または `props.InUiElement`） | `uiAutomation.Open(...)` の戻り値 `app` のメソッド |
| Classic（`Click`、`TypeInto` など） | `UiPath.Core.Activities.Target`（`Target`） | Classic のスコープ（`OpenBrowser` / `OpenApplication` / `WindowScope` / `BrowserScope`）の中で部分セレクタ | なし（`"coded": null`） |
| SAP / CV / Semantic | 上と同じ形（Modern の SAP は `TargetAnchorable`） | 同上 | Modern の SAP と Semantic の一部は `app` のメソッド（`SAPCallTransaction`、`FillForm`、`SetValue` など）。Classic と CV はなし |

### 8-2. Modern の書き方（例：Use Application/Browser の中で Click）

```json
{ "act": "NApplicationCard", "name": "UIA Test Form を開く", "item": "WSSessionData",
  "objs": { "TargetApp": { "Url": "New Uri(htmlPath).AbsoluteUri", "BrowserType": "Edge",
                           "Selector": { "lit": "<html app='msedge.exe' title='UIA Test Form' />" } } },
  "props": { "OpenMode": "Always", "CloseMode": "Always" },
  "body": [
    { "act": "NClick", "name": "Greet を押す",
      "objs": { "Target": {
        "FullSelectorArgument": { "lit": "<webctrl id='greet' tag='BUTTON' />" },
        "ScopeSelectorArgument": { "lit": "<html app='msedge.exe' title='UIA Test Form' />" },
        "SearchSteps": "Selector",
        "PointOffset": { "Position": "Center", "X": 0, "Y": 0 } } },
      "props": { "ClickType": "Single", "MouseButton": "Left" } }
  ] }
```

- **TargetApp**（`NApplicationCard` に必須）：`Selector`（ウィンドウのセレクタ）、`FilePath`（アプリ）か `Url` ＋ `BrowserType`（ブラウザ）、`Arguments`、`WorkingDirectory`、`IsExactTitleEnabled`
- **Target**（`TargetAnchorable`）：
  - `FullSelectorArgument`（Studio の「厳密なセレクター」。アプリのウィンドウから見た部分セレクタ）、`FuzzySelectorArgument`（あいまいセレクター）、`ScopeSelectorArgument`（ウィンドウのセレクタ。Studio は毎回書く）
  - `SearchSteps`（**必須**。ターゲットの検索方法：`Selector` / `FuzzySelector` / `Image` / `TextNative` / `CV` / `SemanticSelector` などをフラグで並べる）
  - `WaitForReadyArgument`（`None` / `Interactive` / `Complete`）、`ElementVisibilityArgument`、`ElementType`
  - 画像・テキストで探すとき：`ImageBase64` ＋ `ImageAccuracyArgument`、`NativeTextArgument` ＋ `NativeTextOccurrenceArgument`、`CvTextArgument` など
  - クリック位置（ClickOffset）：`PointOffset: { Position, X, Y }`（アクティビティの `ClickOffset` は非推奨。使わない）
  - アンカー：`Anchors: [ { "FullSelectorArgument": {...}, "SearchSteps": "Selector" } ]`（XAML は build で確かめた。Coded のモデルに無いので、使うと C# は作れない → `samples/ir-invalid-coded/UiaAnchors.json`）
- `VerifyOptions`（実行の検証）：`{ "Mode": "Appears", "Target": { ...TargetAnchorable... }, "Retry": false, "Timeout": 5 }`
- `NApplicationCard` の `body` は ActivityAction。`"item": "WSSessionData"`（Studio の名前）にしておく

### 8-3. Classic の書き方（例：OpenBrowser の中で TypeInto）

```json
{ "act": "OpenBrowser", "item": "ContextTarget", "props": { "Url": "New Uri(htmlPath).AbsoluteUri", "BrowserType": "Edge" },
  "body": [
    { "act": "TypeInto", "objs": { "Target": { "Selector": { "lit": "<webctrl id='name' tag='INPUT' />" }, "TimeoutMS": 10000, "WaitForReady": "COMPLETE" } },
      "props": { "Text": { "lit": "Hanako" }, "SimulateType": true } },
    { "act": "CloseTab" }
  ] }
```

- `Target` は `Selector`（または `Element`）が要る。`TimeoutMS`、`WaitForReady`（`NONE` / `INTERACTIVE` / `COMPLETE`）
- クリック位置は `objs.CursorPosition: { "Position": "Center", "OffsetX": 0, "OffsetY": 0 }`
- **Classic のスコープの外でフルセレクタ（`<html ...>` や `<wnd ...>` から始まるもの）を使うと、build の分析で `UI-DBP-006` のエラーになる**（Modern の `NApplicationCard` の中でも同じ）。Classic は Classic のスコープの中で部分セレクタを使う
- Classic は Coded の API が無い。対応表は `"coded": null, "reason": "Coded API なし（Classic の UI 操作。…）"`（例 `mappings/UiPath.UIAutomation.Activities/Click.json`）

### 8-4. Coded（C#）の対応表

`uiAutomation`（`IUiAutomationAppService`）の `Open` が返す `UiTargetApp` に、`Click` / `TypeInto` / `GetText` / `WaitState` などがある（引数はターゲットの `TargetAnchorableModel` とオプション）。API の一覧は `catalog/UiPath.UIAutomation.Activities/26.10.6.json` の `services`（`UiTargetApp` のメソッドはカタログに無いので、下の表と既存の対応表を見本にする）。

| IR | C# |
| --- | --- |
| `NApplicationCard`（`"special": "scope"`） | `using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { ... }, targetAppOptions: new TargetAppOptions { ... })) { body }` |
| `objs.Target`（TargetAnchorable） | `new TargetAnchorableModel { PartialSelector = FullSelectorArgument, ScopeSelector = ScopeSelectorArgument, FuzzyPartialSelector = FuzzySelectorArgument, SearchSteps = ..., WaitForReady = ..., PointOffset = new PointOffsetModel { ... } }` |
| `objs.TargetApp` | `new TargetAppModel { Selector, FilePath, Url, BrowserType, Arguments }` |
| `objs.VerifyOptions` | `new VerifyOptions { Mode, Target, Retry, Timeout, ExpectedText }` |
| `NClick` | `app1.Click(target: ..., clickOptions: new ClickOptions { ClickType = ..., ... })` |
| `NTypeInto` | `app1.TypeInto(target: ..., typeIntoOptions: new TypeIntoOptions { Text = ..., ... })` |
| `NGetText` | `result = app1.GetText(target: ..., getTextOptions: new GetTextOptions { ... })` |
| `NCheckState`（`"branches"`） | `var s = app1.WaitState(target: ..., checkStateOptions: new CheckStateOptions { ... }); if (s) { IfExists } else { IfNotExists }` |
| `props.InUiElement` があるとき | `uiAutomation.Click(uiElement: ..., clickOptions: ...)`（`"when": ["InUiElement"]` の形。まだ run していない） |

対応表の書き方（`tools/ir/mapping.ts` の先頭にも説明）。例は `mappings/UiPath.UIAutomation.Activities/NClick.json`：

```json
{ "activity": "NClick", "package": "UiPath.UIAutomation.Activities",
  "coded": [
    { "call": "{app}.Click", "usings": ["UiPath.UIAutomationNext.API.Models", "UiPath.UIAutomationNext.Enums"],
      "args": { "target": "{Target}",
                "clickOptions": { "new": "ClickOptions", "set": { "ClickType": "{ClickType|enum}", "Timeout": "{Timeout}", "VerifyOptions": "{VerifyOptions}" } } } } ],
  "ignore": ["ScopeIdentifier", "Version"] }
```

- `{app}`：いちばん内側の `NApplicationCard` のアプリの変数。`{Target}` など `objs` のプロパティは、モデルの式（`new TargetAnchorableModel { ... }`）になる
- `{Prop|enum}`：enum の完全名（`UiPath.UIAutomationNext.Enums.NClickType.Single`。フラグは `A | B`）。enum は必ずこれで書く
- `args` の値を `{ "new": "型", "set": { ... } }` にすると、IR にある props の分だけ入ったオプションのオブジェクトになる。1つも無ければ引数ごと省く。オプションが必須のオーバーロードしか無いときは `"always": true`
- `objs` の型 → Coded のモデルの対応（プロパティ名の読み替え）は `tools/ir/uia.ts` の `codedModels`。新しい型を Coded で使うときはそこに足す（共有ファイルなので小さく）
- オプションに無いプロパティ（例 `NCheckState.CheckWindowActive`）は対応表に書かない（使うと `MAPPING_UNUSED_PROP`）。full のサンプルからは外し、対応表の `notes` に「Coded 未対応」と書く
- `UiTargetApp` のメソッドはチェッカー（`tools/coded/check.ts`）が見ない。引数名の間違いは build で分かるので、必ず `verify.mjs` で C# も build する

### 8-5. run の方針

- **run の対象は、ワークフローが自分で書き出すローカルの HTML を Edge で開くもの**に統一する（Edge と Chrome には UiPath の拡張機能が入っている）。1つのサンプルで「HTML を書く → 開く → 操作 → 結果を読む → ログ → 閉じる」まで完結させる。見本は `samples/ir/UiPath.UIAutomation.Activities/NTypeInto.min.json`
  - HTML は `WriteTextFile` で `System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-test-form.html")` に書き、`New Uri(htmlPath).AbsoluteUri` を開く。ページのタイトルは `UIA Test Form`、要素は `#name`（入力）、`#greet`（ボタン。押すと `#result` が `Hello, [名前]` になる）、`#agree`（チェックボックス）、`#result`（結果）
  - 要素が足りないとき（ドロップダウン、表など）は HTML に足してよい。ほかのサンプルと同じ HTML でなくてもよいが、タイトルと既存の id は変えない
  - 結果は `NGetText`（Classic なら `GetValue`）で読んで `LogMessage` で出し、`*.expected.log` と突き合わせる
  - 横に `*.verify.json` を置き、`{ "requires": "Microsoft Edge と UiPath の Web 拡張機能..." }` と書く（verify.mjs は読まない。人とマネージャー向けのメモ）
- デスクトップのアプリが要るもの（ウィンドウ操作など）は、メモ帳（`notepad.exe`）を使ってよい。Windows 11 のメモ帳はタブ付きの新しいアプリなので、セレクタは実際の UI を見て決める（決められなければ build までにして、理由を書く）
- **run できないもの**（`*.verify.json` に `noRun` を書き、build までで完了）：SAP（SAP GUI が無い）、Computer Vision（CV サーバーが要る）、Semantic（AI の UI 理解のサービスが要る）、トリガー（人の操作を待つ）、OCR のクラウドサービス
- 今はこのシェルから run できない（BATCH-BRIEF.md）。run するものは build まで通したら Linear を In Progress にして「run 待ち」とコメントする

### 8-6. 1イシューの進め方（UIAutomation）

1. `node tools/ir/coverage.ts --activity <ClassName>` で、`objs` に書くプロパティ（「objs」）と、必須・Coded の対応表の有無を見る
2. 既定 XAML を取る（1-2 と同じ。クラス名は `UiPath.UIAutomationNext.Activities.NHover` / `UiPath.Core.Activities.Hover` など）
3. 見本（`samples/ir/UiPath.UIAutomation.Activities/` の同じ系統のもの）を写して min / full を書く。min はそのアクティビティの必須だけ（HTML を開くなどの前後の手順は入れてよい）
4. `node tools/ir/gen.ts <ir> --check` → `node tools/ir/gen-coded.ts <ir> --check --print` → `node --test "tools/ir/*.test.ts"`
5. `node tools/verify/verify.mjs --name <作業名> --build-only <ir...>`（XAML と C# の両方）
6. 対応表：Modern は 8-4、Classic・CV・Classic の SAP は `"coded": null`
7. Linear：run するものは In Progress ＋「run 待ち」、`noRun` のものは Done

### 8-7. まだ書けないもの・気をつけること

- `objects.json` に無い型（`UiPath.CV.*` の記述子、`SearchedElement` 以外の Activities.Models など）は「UI のターゲット」として書けない。足すときは抽出器の `--types` で `objects.json` を作り直す（正規表現に型を足す）：
  ```bash
  L=~/.nuget/packages/uipath.uiautomation.activities.runtime/26.10.6/lib/net6.0-windows7.0
  tools/catalog-extractor/bin/Release/net9.0/CatalogExtractor.exe --package UiPath.UIAutomation.Activities --version 26.10.6 \
    --types '^UiPath\.(UIAutomationNext\.(TargetAnchorable|Target|TargetApp|ClickOffset|PointOffset|RegionOffset|DialogHandling|Activities\.(VerifyExecutionOptions|VerifyExecutionTypeIntoOptions|SearchedElement))|Core\.(Activities\.(Target|ImageTarget|CursorPosition)|Region))$' \
    --dll $L/UiPath.UIAutomationNext.Activities.dll --dll $L/UiPath.UIAutomationNext.dll --dll $L/UiPath.UiAutomation.Activities.dll --dll $L/UiPath.UIAutomationCore.dll \
    --out catalog/UiPath.UIAutomation.Activities/26.10.6.objects.json
  ```
- `UiElement` / `Browser` / `Window` 型の変数は `types-xaml.ts` にまだ無い（`InUiElement` / `OutUiElement` を使うサンプルは、型を足してから）
- `System.Drawing.Rectangle`（`Region` の中身、CV の `InRegion`）、`List<String>`（SAP の `Items`）、`SecureString` はまだ書けない
- 検証のエラー：`UIA_NO_SCOPE`（Modern のターゲットが `NApplicationCard` の外）、`UIA_TARGET_MISSING`（`Target` / `TargetApp` が無い）、`UIA_SEARCH_STEPS`（`SearchSteps` が無い）、`UIA_TARGET_EMPTY`（セレクタなど探す手がかりが無い）、`BAD_OBJ`（オブジェクトの形が違う）。例は `samples/ir-invalid/Uia.json`

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
