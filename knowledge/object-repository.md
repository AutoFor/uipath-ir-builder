# オブジェクトリポジトリ（.objects）

UI 操作のターゲット（画面と要素）を、プロジェクトの `.objects/` にまとめておく仕組み。Studio の「オブジェクトリポジトリ」パネルがこれを読み書きする。この道具では `tools/ir/objrepo.ts` が受け持つ（AUT-1172）。

Studio 26.10（UiPath.UIAutomation.Activities 26.10.6）で、実際に Studio に操作してもらい、ファイルの変わり方を見て確かめた。

## 使い方

正本は `<P>/ir/repository.json`（AI が書く）。`.objects/` はそこから作る。ワークフローの IR は `$ref` でリポジトリを指す。

```bash
node tools/ir/objrepo.ts import   --project <P>                     # .objects → ir/repository.json（Studio で直したあとも、これで取り込み直す）
node tools/ir/objrepo.ts build    --project <P> [--dry-run]         # ir/repository.json → .objects
node tools/ir/objrepo.ts list     --project <P>                     # アプリ / 画面 / 要素の木
node tools/ir/objrepo.ts register --project <P> <ir.json>... [--no-reuse]   # その場のターゲットを登録して $ref にする
node tools/ir/objrepo.ts rename   --project <P> <アプリ/画面[/要素]> <新しい名前>
node tools/ir/objrepo.ts move     --project <P> <アプリ/画面/要素> <アプリ/画面>
```

- `register` / `rename` / `move` は、`repository.json` と `<P>/ir/*.json` の `$ref` を書き換えてから `build` までする（`--no-build` で止める）
- セレクターなど中身の編集は、`repository.json` の `target` を直して `build` する。そのあと `gen.ts` で生成し直すと、その要素を使うアクティビティにも新しい中身が入る（Studio の「参照しているアクティビティも更新」と同じ）
- `repository.json` を直して `build` していないと、`gen.ts` は `REPO_STALE` で止まる（古い `.objects` から作らないため）
- `repository.json` に `id` の無い画面・要素は、`build` が Id を付けて書き戻す。Id は変えない（XAML の `Reference` が Id を指す）

### repository.json

```json
{
  "libraryId": "eRrDs_Jr9UuH8YiG90Uadg",
  "apps": [
    { "name": "Chrome テスト用申請フォーム", "id": "Cv9UiYHU3069gunXIjPWMA", "version": "1.0.0", "versionId": "Y-JziXTGBEicBHZh6kqJEQ",
      "screens": [
        { "name": "申請フォーム1", "id": "T1SvUsNiY0mZEkdcaCcnQw", "interactionMode": "DebuggerApi",
          "target": { "BrowserType": "Chrome", "Selector": { "lit": "<html app='chrome.exe' title='テスト用申請フォーム' />" }, "Url": { "lit": "file:///C:/form/index.html" } },
          "elements": [
            { "name": "電話番号", "id": "5xuiQeEQVU6K1TO8qim-Pg", "taxonomy": "Input", "activityType": "Click",
              "target": { "FuzzySelectorArgument": { "lit": "<webctrl id='phone' tag='INPUT' />" }, "SearchSteps": "FuzzySelector", "ElementType": "InputBox" } } ] } ] } ]
}
```

- `target` は IR の `objs.TargetApp`（画面）/ `objs.Target`（要素）と同じ書き方。ただし**リテラルだけ**（式は `REPO_EXPR`）。`Reference` / `ContentHash` は書かない（リポジトリが付ける）
- 同じ親の下で名前が重なるとエラー（`REPO_NAME`）。Studio と同じく `名前(1)` にする
- `InformativeScreenshot` は `<P>/.screenshots/<名前>` の画像。リポジトリにはその写しが入る
  - 無い画面・要素は、Studio のプレビューに「プレビューを利用できません」と出る（動きには関わらない）。`build` は `REPO_NO_SCREENSHOT` の注意を出し、`list` は「（画像なし）」を付ける。手で書いたターゲットには画像が無いので、画像が要るなら Studio でその要素を指定し直す（撮った画像が `.screenshots` に入る）

### ワークフローの IR から使う

```json
{ "act": "NApplicationCard", "objs": { "TargetApp": { "$ref": "Chrome テスト用申請フォーム/申請フォーム1" } },
  "body": [ { "act": "NClick", "objs": { "Target": { "$ref": "申請フォーム1/電話番号" } } } ] }
```

- 名前は「アプリ/画面/要素」。後ろから合わせるので、1 つに決まるなら「画面/要素」や「要素」だけでもよい（決まらなければ `REPO_REF`）。名前に `/` があるなら配列で書く
- `$ref` と一緒にほかのプロパティは書けない。中身はリポジトリで直す
- `gen.ts` / `gen-coded.ts` は `--project` の `.objects` から中身を写し、`Reference="<ライブラリ Id>/<Id>"` と `ContentHash` を足す。Studio がリポジトリの要素をアクティビティに結びつけたときと同じ XAML になる（Studio の XAML と比べて、属性は全部同じだった）

### register（その場のターゲットを登録する）

- NApplicationCard の `TargetApp` → 画面、その中のアクティビティの `Target`（TargetAnchorable）→ 要素
- 既定は Studio の「リポジトリを再利用」がオンのときと同じ：探し方（SearchHash とセレクター）が同じ画面・要素があれば、それにつなぐ。`--no-reuse` はオフのときと同じで、名前に `(1)`、`(2)` を付けて別に作る
- 新しいアプリの名前は「ブラウザー（または exe）＋ タイトル」、画面の名前はタイトル、要素の名前は `FriendlyName` → セレクターの `aaname` / `name` / `id` / `innertext` → 表示名の順
- `Reference` のあるターゲット（Studio で結びつけて XAML から取り込んだもの）は、その Id の画面・要素の `$ref` にする
- 式の入ったターゲット（`Url` が `New Uri(...)` など）は登録しないで、その場に残す。そのカードの中の要素も登録しない

## .objects の形

```
.objects/.metadata, .type                      ライブラリ（Type "Library"）
  Cv9U/                                         アプリ（フォルダ名は Id の先頭 4 文字）
    .data/ObjectSelectionName/.content, .hash   "UnifiedTarget"
    Y-Jz/                                       バージョン（Name "1.0.0"。Studio ではアプリ名の横に出るだけ）
      T1Sv/                                     画面
        .data/ObjectRepositoryScreenData/.content, .hash, .attributes/SearchHash, .images/.design/<画像 Id>
        5xui/                                   要素（入れ子は無い。画面の下に並ぶだけ）
          .data/ObjectRepositoryTargetData/.content, .hash, .attributes/SearchHash, .images/.design/<画像 Id>
```

- `.metadata`：BOM 付き、CRLF、2 文字字下げの JSON。`Name`、`Type`、`TaxonomyType`（要素。入力欄は `Input`）、`Id`（22 文字の base64url）、`Reference`（`<ライブラリ Id>/<Id>`）、`ParentRef`（親の Reference。アプリには無い）、`Created` / `Updated`（小数 7 桁の UTC）、`CreatedBy`、変えたあとは `UpdatedBy`
- `.type`：`Library` / `App` / `AppVersion` / `Screen` / `Element`（改行なし）
- `.content`：`encoding="utf-16"` と書いてあるが、中身は **UTF-8（BOM なし、LF、最後の改行なし）**。既定の名前空間が uix の XAML。画面は `<TargetApp x:Key="TargetApp">` と `<NInteractionMode x:Key="InteractionMode">`、要素は `<TargetAnchorable x:Key="TargetAnchorable">` と `<x:String x:Key="ActivityType">Click</x:String>`
  - `InformativeScreenshot` は属性でなく `<imageRef attrName="InformativeScreenshot" originalValue="<名前>.jpg" xmlns="">0<22 文字></imageRef>`。画像の中身は `.images/.design/<その Id>`（`.screenshots/<名前>.jpg` と同じバイト列）
  - アンカーの一覧は `Capacity="4"`（XAML 側は Studio が更新すると `Capacity="1"` などになる。中身を比べるときは見ない）
- `.hash`：`ContentHash`。**中身の要約ではない**（MD5 / SHA-1 / SHA-256 のどれとも合わない）。中身が変わるたびに Studio が新しい Id を振る。この道具は中身の SHA-1 から作る。中身が同じなら前の値を残す
- `SearchHash`：`UiPath.UIAutomationNext.Activities.dll` の `GetObjectLibraryHashCode` と同じ計算（`objrepo.ts` の `elementSearchHash` / `screenSearchHash`）。文字列のハッシュは .NET Framework（x64）の `String.GetHashCode`。Studio の値 9 個と一致した
  - 画面：`Selector`（無ければ `FilePath`）のハッシュ
  - 要素：`(scope, SearchSteps, FullSelector, FuzzySelector)` を混ぜたもの。アンカーがあれば、アンカーの値を並べ替えて 31 倍で畳む
  - 画像・CV・Semantic の探し方の分はまだ分かっていない（`REPO_SEARCH_HASH` の注意。Studio の「再利用」で同じと見なされないことがある）

## Studio で操作したときの変わり方

| 操作 | .objects | XAML |
| --- | --- | --- |
| その場のターゲットを登録（再利用オン） | 同じ要素があれば何も増えない | `Reference` と `ContentHash` が付く |
| 同（再利用オフ） | `名前(1)` の要素が増える。中身は同じで ContentHash と画像 Id は新しい | 同上 |
| 要素・画面の名前の変更 | `.metadata` の `Name`、`Updated`、`UpdatedBy` だけ | 変わらない（XAML は Id でつながる） |
| セレクターの編集 | `.content`、`ContentHash`、画像 Id、`SearchHash`。`.content` の先頭に `Reference` が付く。`.metadata` の `Updated` は変わらない | 参照しているアクティビティに新しい中身と `ContentHash`（**保存するまでファイルには出ない**） |
| 画面の追加 | バージョンの下にフォルダが増える | 変わらない |
| 要素を別の画面へ移す | フォルダごと移る（フォルダ名・Id・`.data` は同じ）。`ParentRef`、`Created`、`Updated` が変わる | 変わらない |

- アプリの下に別の種類の画面（Chrome のアプリの下に Premiere の窓など）も置ける
- 「UI ライブラリ」（パッケージで読み込んだ別のリポジトリ）はこの道具ではまだ扱わない

## まだできないこと

- UI ライブラリ（ライブラリのプロジェクトのリポジトリ、パッケージの依存）
- 1 つのアプリに 2 つ以上のバージョン（`REPO_VERSIONS`）
- Coded の `Descriptors.<アプリ>.<画面>.<要素>`（Coded では `$ref` を中身＋`Reference` に展開した TargetAnchorableModel を書く）
- `TargetApp.SapInfo`（`SAPElementInfo`）は 26.10.6 のカタログにだけある（26.10.3 の DLL にはこの型が無い）
