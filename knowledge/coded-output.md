# Coded（C#）の出力を読みやすくする

`gen-coded.ts --project <P>` で作る C# を、短く・読みやすくする仕組み。moneyforward_cs の Login__Coded で確かめた（2026-11-18、UiPath.UIAutomation.Activities 26.10.6）。

## セレクターはオブジェクトリポジトリ（Descriptors）で書く

- `<P>/.local/.codedworkflows/ObjectRepository.cs`（Studio のビルド・`uip rpa validate` / `run` で `.objects` から作られる）を読み、IR のターゲットの `Reference` がリポジトリにあれば、`new TargetAnchorableModel { ... }` ではなく `Descriptors.<アプリ>.<画面>.<要素>` で渡す（`tools/ir/coded-descriptors.ts`）
  - `uiAutomation.Open(Descriptors.<アプリ>.<画面>, targetAppOptions: ...)`、`app.Click(Descriptors.….<要素>, clickOptions: ...)`
  - **例外：セレクターが C# の式の要素**（リポジトリの変数を差し込むもの。例 `string.Format("…<webctrl tag='OPTION' aaname='{0}*' />", 支出元)`）は、`Descriptors` にせず `new TargetAnchorableModel { SearchSteps = Selector, PartialSelector = <式> }` で渡す（`Reference` は付けない）。Coded の `Descriptors` はリポジトリの変数を受け取れず、変数の名前がそのまま入る（moneyforward_cs の MF入力で `aaname='支出元*'` を探して見つからず、本番の月1繰越が段階3で止まった。2026-11-20）
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
- ログは **Steps**（`tools/ir/templates/Steps.cs`。gen-coded.ts が出力先に `Steps.cs` として置く）を通して出し、生成したコードも手で書いたコードも同じ形にする（下の「ログの書き方」）。その手順の `// 手順名` は書かない（`--no-trace-log` で入れない）
  - Execute の先頭に `using var __wf = Steps.Workflow((m, l) => Log(m, l), "<ワークフロー名>");`、最後（と return の前）に `__wf.Ok();`（`Log` は CodedWorkflow の protected なので、ワークフローから渡す）
  - 1つの操作の前に `var __stepN = Steps.Op("<ワークフローの中の場所>", "<手順名>");`、後に `__stepN.Ok();`。ワークフローの呼び出しは `Steps.Call`。画面を開く（`using (var appN = uiAutomation.Open(...))`）と状態の確認（`WaitState` → `if`）は、本体の前で Ok（本体の時間を含めない）
  - 手順名：Studio の既定の英語の名前は日本語にそろえる（`stepName`。`Check App State` → 状態を確認、`Click` → クリック、`Type Into` → 文字を入力、`Delay` → 待機 …）。画面を開くは「画面に付く／画面を開く '名前'」（OpenMode が Never なら付く）、ワークフローの呼び出しは「ワークフローを呼ぶ '<実際の呼び先>'」（古い .xaml の名前は出さない）
  - ワークフローの中の場所は、囲んでいる名前のある手順（まとまり・分岐・スコープ）。Studio が付ける決まった名前（`実行`・`Target appears` など。`GENERIC_CRUMBS`）は入れず、同じ場所に同じ名前が並ぶときは `（2回目）`
  - LogMessage は `Steps.Log("<場所>", <本文>, <レベル>)`（場所が付く）
  - Trace のログは、ロボットのログのレベルが Trace のときだけ残る。サーバーレスでは、ジョブを動かすロボット アカウント（フォルダーの Automation User）の「アクセス ルールを編集 → ロボットの詳細オプション → ログ レベル」を Trace にする（CLI の `uip or users update` には無い）。`uip or users get <key> --all-fields` の `ExecutionSettings.TracingLevel` で確かめられる

### ログの書き方（Steps）

2026-11-19 に moneyforward_cs の月1繰越のログ（242 行）を見て決めた。生成したコード（`[場所] 手順 …始め`）と手で書いたコード（`=== … ===`・`--- … ---`・`★`・`→`）で書き方も細かさも違い、英語と日本語・古い .xaml の名前・同じ値の繰り返しが混ざっていたため。

- **1行の形は `[場所] 本文`**。場所は、ワークフローをまたいだ道すじ（`Steps.Workflow` / `Steps.Section` が積む。RunWorkflow で呼んだ先にも続く）＋ ワークフローの中の場所。内側の 3 つまで（`PlaceDepth`、それより外は `…`）。一番外の行（場所が無い）は `[]` を付けない
- **始めと終わり**：まとまりごとに `<名前> …始め` と `<名前> …終わり（n.n秒）：<結果の要約>`。Ok を呼ばずに抜けたら `…中断（n.n秒）`（Warn）。見出しの記号（`===`・`---`）は使わない
- **レベル**
  - Info：ワークフロー・まとまり（Section）の始めと終わり、業務のデータ（取得した件数・差分・計算の内訳）、dry-run で止めた書き込み
  - Trace：1つ1つの操作（Op）・呼び出し（Call）の始めと終わり、細かい途中の値（列の一覧など）
  - Warn：中身を持たない操作（Op）が 10 秒（`SlowSeconds`）以上かかった、途中で止まった、続けられるが気になること。呼び出し・まとまりは中の合計なので、遅くても Warn にしない
  - Error：失敗（実行状況を Failed にした、など）
- **同じことを 2 回出さない**：Coded（.cs）の呼び出しは、呼んだ先の `Steps.Workflow` が始め・終わりを出すので、`Steps.Call` は何も出さない（XAML の呼び出しは出す）。次の操作と同じことを言うだけの LogMessage（`MF Login...` など）は IR から消す。同じ値（基準日など）は、それを決めた所で 1 回だけ
- **dry-run**：止めた書き込みは `Steps.DryRun("<書き込み>")` → `（dry-run）書き込まない：<書き込み>`（Info）
- **値の書き方**：金額 `Steps.Yen`（`248,413円`）、日付 `Steps.Date`（`2026/11/15`）、件数 `Steps.Count`（`20件`）
- **例外**：各層で `catch { Log("エラー発生"); Log(スタックトレース); throw; }` はしない（同じエラーが層の数だけ出ていた）。どこで止まったかは、終わりの無い「…始め」と「…中断」で分かる。実行状況を Failed にするなど、そこでしかできないことがあるときだけ catch して Error を出す
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
- `--coded`：1つずつ消してみて、生成する C# がまったく変わらないものも落とす（生成の前の検証と、XAML 経由の小さな XAML の中身も比べる）。操作の対象（`objs.Target` / `objs.TargetApp`）の中の値も同じように確かめるので、Descriptors で書く対象はセレクターや設計時の値（`DesignTimeRectangle`、`IconBase64` など）が落ち、`Reference` だけになる（その IR からは XAML を作り直せない。Coded だけのプロジェクトで使う。moneyforward_cs の `ir/` は Login 38KB → 23KB など）。カタログで既定値が分からない enum（`InteractionMode=SameAsCard`、`ClipboardMode=Never`）は、これで確かめる。XAML にすると意味が変わることがあるので、XAML も作る IR には使わない
- 必須（required）の props は落とさない

## 取り込みで足したもの（2026-11-18）

- `Tuple<…>`（Data Fabric の失敗の一覧など）、Guid のリテラル（`EntityId="…"` → `Guid.Parse("…")` の式）
- Studio が「表データを抽出」の列から作る型付きの表（`System.Data.DataTable<番号>`、アセンブリ `Studio.Generated.TypedDataTable<番号>`）は `DataTable` として読む
- 対応表：`NExtractDataGeneric`（`{app}.ExtractData(target, ExtractDataOptions)`。UiPath.UIAutomationNext.API.dll のメタデータで確かめた）、`WriteLine`（`Console.WriteLine`）
- メール（Gmail・Outlook の「最新のメールを取得」）は、デザイナーの内部の値（Backup、`x:Reference`）が多く取り込めない。Coded の API はある：`google.Gmail(new GmailConnection("<接続 ID>", serviceContainer)).GetNewestEmail(<ラベル>)`、`office365.Mail(new MailConnection("<接続 ID>", serviceContainer)).GetNewestEmail(<フォルダー>)`。ラベル・フォルダーは `GetMailLabels()` / `GetMailFolders()` から ID で探す。moneyforward_cs の `MoneyForwardクラウド認証` は、この式で IR を手で書いた
