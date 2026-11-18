# Coded（C#）の出力を読みやすくする

`gen-coded.ts --project <P>` で作る C# を、短く・読みやすくする仕組み。moneyforward_cs の Login__Coded で確かめた（2026-11-18、UiPath.UIAutomation.Activities 26.10.6）。

## セレクターはオブジェクトリポジトリ（Descriptors）で書く

- `<P>/.local/.codedworkflows/ObjectRepository.cs`（Studio のビルド・`uip rpa validate` / `run` で `.objects` から作られる）を読み、IR のターゲットの `Reference` がリポジトリにあれば、`new TargetAnchorableModel { ... }` ではなく `Descriptors.<アプリ>.<画面>.<要素>` で渡す（`tools/ir/coded-descriptors.ts`）
  - `uiAutomation.Open(Descriptors.<アプリ>.<画面>, targetAppOptions: ...)`、`app.Click(Descriptors.….<要素>, clickOptions: ...)`
  - 引数名はメソッドで違う（`target` / `elementDescriptor` / `screenDescriptor`）ので、名前なしで先頭に置く
  - 実行時の中身はリポジトリのもの（IR の値ではない）。IR とリポジトリが食い違っていないか確かめてから切り替える（`uip rpa uia object-repository get-element-definition` で書き出して比べた）
  - `--no-descriptors` でこれまでどおり（中身をその場に書く）
- **要素は、開いた画面の下のものしか使えない**。別の画面の要素を渡すと実行時に「Target name '…' is not part of the current screen.」。生成のときに `CODED_SCREEN_MISMATCH` の注意を出す。その画面の下に同じ要素を作り（写す）、IR の `Reference` をそちらにする
- リポジトリに無いターゲットは、UiPath 標準の CLI で足す：
  ```bash
  uip rpa uia object-repository get-element-definition --reference-id <ライブラリ Id>/<Id> --definition-file-path a.xaml   # ひな形（.xaml と .xaml.metadata）
  uip rpa uia object-repository create-elements --screen-reference-id <画面の Reference> --definition-file-paths a.xaml,b.xaml
  ```
  `.xaml.metadata` の `Name` が要素の名前（C# の名前になる）。写すときは `Guid` を変える。足したら `uip rpa validate` で `ObjectRepository.cs` を作り直してから生成する
- 入れ子の要素（要素の下の要素。Top > Consent など）も `Descriptors.….Top.Consent` で書ける。ただし CLI の `get-element-definition` では引けず（「一致する要素が見つかりません」）、`objrepo.ts import` も入れ子を扱えない（取り込むと、`build` が入れ子の要素を消そうとする。使わない）

## 既定値と同じオプションは書かない

- Coded のオプションのクラス（`ClickOptions` など）を new したときの値と同じ代入は書かない（`tools/ir/coded-option-defaults.json`）。値は、使い捨ての Coded ワークフローで new して Log に出して確かめた
- 版を上げたら確かめ直す（違う値になっていたら、書かないと意味が変わる）
- 中身がすべて既定値になったオプションは、引数ごと省く（Login は 13KB → 9KB）
- メソッドの引数も、既定値と同じものは書かない（表の「<メソッド名>()」のキー）。`Log` の `level` は省略可で既定は Info（カタログの既定値は数値 8。LogLevel の数値を Log に出して Fatal=1、Error=2、Warn=4、Info=8、Trace=16 を確かめた）。`Log(message: "…")` だけになる

## オプションは1行に1つ、行末に Studio の日本語の名前

```cs
app1.TypeInto(Descriptors.….メールアドレス, typeIntoOptions: new TypeIntoOptions
{
    Text = UserName, // テキスト
    InteractionMode = UiPath.UIAutomationNext.Enums.NChildInteractionMode.DebuggerApi, // 入力モード
});
```

- 日本語の名前は、パッケージの日本語リソース（`ja\*.resources.dll`）から取った表 `catalog/<パッケージ>/<版>.ja.json`（カタログの `displayName` のキー → 日本語）。作り方：`pwsh tools/catalog-extractor/extract-ja.ps1 <パッケージ> <版>`
- 表のある版だけ。無ければ、これまでどおり1行にまとめる。`--compact` でも1行にまとめる
- メソッドの名前付きの引数も、2つ以上あれば1行に1つずつ書く（`Log(`、`system.GetCredential(` など。対応表の `call` でも `code` のひな形でも）：
  ```cs
  (UserName, sc_Passwrod) = system.GetCredential(
      assetName: "credMoneyforwardShao",
      folderPath: "Common",
      timeoutMS: 30000, // タイムアウト (ミリ秒)
      cacheStrategy: UiPath.Core.Activities.CacheStrategyEnum.None // キャッシュ ストラテジ
  );
  ```
- ただし `Log(...)` は1行のまま書き、`// 名前` も付けない（短く読めるため。`generate-coded.ts` の `ONE_LINE_CALLS`）。`// …` を行の途中に書くと、その後ろの `);` までコメントになるので、1行の呼び出しには名前を付けない
- 引数が2つ以上の呼び出しは、オプション（複数行）を含んでいても引数を1行に1つずつ書き、閉じかっこは行頭に置く（`uiAutomation.Open(` の画面と `targetAppOptions:` が横に並ばないように）
- 1つの操作（クリック・入力・待機・状態の確認・ワークフローの呼び出しなど）の直前に `Log(message: "<手順名>", level: LogLevel.Trace);` を入れ、その手順の `// 手順名` は書かない（落ちたとき、最後に何をしようとしたかがログに残る）。名前の無い手順はアクティビティの種類名（`Delay` など）。まとまり・分岐・繰り返し・ログ・代入には入れない（`NOT_TRACED_ACTIVITIES`）。`--no-trace-log` で入れない
  - Trace のログは、ロボットのログのレベルが Trace（Verbose）のときだけ残る。Orchestrator で見るには、プロセス（またはジョブ）のログのレベルを Trace にする
- ログ（`Log(...)`）の手順は `// 手順名` を書かない（メッセージが説明になる）
- 手順と手順のあいだに空行を入れる（`// 手順名` ＋ 処理を1つのまとまりに見せる）。ブロックの先頭（`{` の直後）と、まとまり（Sequence など）の見出しのすぐ下には入れない
- using がある名前空間の前置きは省く（`UiPath.UIAutomationNext.Enums.NAppCloseMode.Never` → `NAppCloseMode.Never`、`UiPath.CodedWorkflows.LogLevel.Error` → `LogLevel.Error`）。名前がぶつからないと分かっている名前空間だけ（`generate-coded.ts` の `SHORTEN_NAMESPACES`）。文字列の中は変えない
- 名前が付かない引数がある：カタログの props に `displayName` が無いもの（GetRobotCredential の `AssetName`・`FolderPath` など、親クラスで定義された props。カタログの取り出しで表示名を拾えていない）。推測では付けない

## IR からも既定値を落とす（slim.ts）

```bash
node tools/ir/slim.ts --project <P> <ir.json>...                  # 落とせるものを出す
node tools/ir/slim.ts --project <P> --coded --write <ir.json>...  # Coded にしか使わない IR を書き換える
```

- 既定：既定 XAML の値・アクティビティの `DefaultValue` と同じ props（XAML でも Coded でも同じ意味）。XAML からの取り込み（import-xaml.ts）は前から既定 XAML の値を落としているので、手で書いた IR に効く
- `--coded`：1つずつ消してみて、生成する C# がまったく変わらないものも落とす。カタログで既定値が分からない enum（`InteractionMode=SameAsCard`、`ClipboardMode=Never`）は、これで確かめる。XAML にすると意味が変わることがあるので、XAML も作る IR には使わない
- 必須（required）の props は落とさない
