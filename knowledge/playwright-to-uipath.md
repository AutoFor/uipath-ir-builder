# Playwright（TypeScript）と UiPath（XAML・Coded）を IR を通して行き来する（AUT-1219）

- **Playwright → UiPath**：Playwright（TypeScript）で画面を操作しながら、操作した要素の属性を記録する。記録から IR とオブジェクトリポジトリ（`<P>/ir/repository.json`）を作り、いつもの生成器（`gen.ts`・`gen-coded.ts`）で XAML と Coded を作る
- **UiPath → Playwright**：IR（と `repository.json`）から Playwright（TypeScript）のスクリプトを作る。XAML は `import-xaml.ts` で IR にしてから渡す。XAML や Coded から直接は変換しない
- C# 版 Playwright（Microsoft.Playwright）は使わない（`prototypes/playwright-serverless/` は記録として残す）
- `playwright-core` は `tools/pw` にだけ入れる（`cd tools/pw && npm install`）。ブラウザーはロボットと同じ Chrome（`channel: "chrome"`）で、Playwright 用のものは落とさない

## Playwright → UiPath

1. 要素を、先に objects に定義する（下の「Playwright の objects」）。見本は `samples/pw/form/objects.ts`・`samples/pw/signin/objects.ts`
2. 台本で `tools/pw/recorder.ts` の `launch` と `UiRecorder` を import し、要素を名前で指して操作する（`O.アプリ.画面.要素`）。使うメソッドは次のとおり
   - `rec.goto(O.アプリ.画面, { urlArg })` / `click(要素)` / `fill(要素, 値, { valueArg })` / `text(要素, "out_…")` / `waitVisible(要素)`
   - `clickIfVisible(要素, ミリ秒)`：出たときだけ押す（Cookie のバナーなど）
   - `unsupported`：Playwright にしか無い操作を残す
   - じかに書く形（`rec.click("画面", "名前", page.locator(…))`）も使えるが、record-to-ir.ts が警告を出す

   見本は `samples/pw/form/form.ts`（手元で配る小さなフォーム）と `samples/pw/signin/signin.ts`（UiPath のサインイン画面。パスワードは入れず、送信もしない）。
3. 日本語と英語で 1 回ずつ流す（`launch` のロケール）
   ```bash
   node tools/pw/serve.mjs samples/pw        # form のときだけ。http://127.0.0.1:8765/form/form.html
   node samples/pw/form/form.ts ja-JP && node samples/pw/form/form.ts en-US
   ```
4. IR とリポジトリにする。アプリ・画面・要素の名前は、objects の名前のまま入る（変換できなかったものは `<P>/ir/<名前>.conversion.md` に出る）
   ```bash
   node tools/pw/record-to-ir.ts --project <P> --workflow Main --browser Chrome samples/pw/form/rec/form.ja.json samples/pw/form/rec/form.en.json
   node tools/ir/objrepo.ts build --project <P>        # UiPath の .objects
   node tools/pw/pw-objects.ts build --project <P>     # Playwright の <P>/pw/objects（同じ repository.json から）
   node tools/ir/gen.ts <P>/ir/Main.json --project <P> --out <P>
   ```
5. Coded は別のプロジェクト（`main` が `Main.cs`）で作る。同じプロジェクトに `Main.xaml` と `Main.cs` を置くと、名前がぶつかる。Descriptors で書く手順は次のとおり
   1. `uip rpa validate` で `.local/.codedworkflows/ObjectRepository.cs` を作る
   2. もう一度 `gen-coded.ts` を流す
6. 動かすのは DESKTOP の Unattended のロボット（`queue-run.mjs`）。サーバーレスでは動かさない（下の「サーバーレス」）

### 操作と UiPath のアクティビティ

| 記録 | IR |
| --- | --- |
| `goto` | `NApplicationCard`（開く）＋ `NGoToUrl` |
| `click` | `NClick` |
| `fill` | `NTypeInto` |
| `text` | `NGetAttributeGeneric<String>`（Attribute `innertext`）＋ `LogMessage`。Get Text（`NGetText`）は使わない（下の「読み取りの文字」） |
| `waitVisible` | `NCheckState`（WaitAppear）＋ `If Not` → `Throw` |
| `clickIfVisible` | `NCheckState`（WaitAppear、出なくても止めない）＋ `If` → `NClick` |

画面（記録の screen）が変わると、`NApplicationCard`（つなぐ）を入れ子にする。

`urlArg` / `valueArg` で引数にした値は、最初の記録の値を引数の既定値（`arguments[].default`）にする。XAML ではルートの `this:Main.in_Url="..."`、Coded では `Execute(String in_Url = "...")` になり、Studio で引数を渡さずにそのままデバッグできる。ir-to-pw.ts のスクリプトも、渡されなかった引数は既定値を使う

### セレクターの選び方（`chooseSelector`）

上から順に、全部の言語の記録で同じ値になり、ページの中で 1 つに決まるものを使う。

1. テスト用の属性：`data-testid`・`data-cy`・`data-e2e`・`data-test`・`data-qa` → `<webctrl tag='T' data-cy='v' />`
2. `id`、`name`。ただし作られた id（`mat-input-3`・`:r1:`・数字の長いもの）は使わない
3. `aria-label` → 属性 `aria-label`。言語で違えば `aria-label='^(日本語|English)$' matching:aria-label='regex'`（`aaname` ではない。下の表）
4. 表示の文字 → `innertext`。言語で違えば 3 と同じ正規表現
5. タグだけで 1 つに決まるならタグ
6. 親から絞り込む（複数行）：言語によらない属性（data-testid など・id）で 1 つに決まる祖先と、その中で 1 つに決まるタグか表示文字 → `<webctrl tag='DIV' data-testid='card-b' /><webctrl tag='BUTTON' />`
7. 近くのラベル（アンカー）：前の兄弟（親の 2 つ上まで）の短い文字で、ページで 1 つに決まるもの。本体はタグ（とクラス）→ 下の「アンカー・複数行のセレクター・iframe」
8. どれもだめなら `css-selector`。壊れやすいので、変換できないものの一覧にも出す

- iframe の中の要素は、先頭に iframe の行（`<webctrl tag='IFRAME' id='inner' />`）を足す。id・name・title・data-testid・src の順に、1 つに決まるもの

- 値の `&` `'` は XML 用に、正規表現の記号は `\` で逃がす
- 画面のセレクターは、転送のあとのページの `url='<オリジン>/*'` にする。開く URL（`Url`）は、スクリプトが開いた URL にする（転送のあとの URL には、毎回変わる値が入る）
- 要素のターゲットには、画面のセレクターを `ScopeSelectorArgument` でも持たせる（samples の IR と同じ形。無くて困ると確かめたわけではない）

#### UiPath のセレクターが読める属性

2026-11-19 に、DESKTOP の Unattended のロボット（Chrome 157、UIAutomation 26.10）で確かめた。試しのページは `samples/pw/form/attr.html`、IR は `C:\Users\Public\uipath-cloud-ui\AttrCases\AttrTest.json`。Check State（3 秒）で、出たかどうかを見た。

| セレクター | 結果 |
| --- | --- |
| `<webctrl data-testid='run-btn' />`、`tag='BUTTON' data-cy='run'`、`tag='SPAN' data-e2e='…'`、`tag='INPUT' data-testid='…'` | ○ |
| `css-selector='[data-testid=run-btn]'`、`parentid='box'`、`class='mat-btn primary'` | ○ |
| `aria-label='Run app'`、`aria-label='^(アプリを実行\|Run app)$' matching:aria-label='regex'` | ○ |
| `innertext='(Run\|実行)' matching:innertext='regex'` | ○ |
| `aaname='Run'`（ボタンの表示の文字）、`aaname='^(実行\|Run)$' matching:aaname='regex'` | ○ |
| `aaname='Run app'`（aria-label の値）、その正規表現 | × |
| `role='button'`（単独でも、aaname と組み合わせても）、`aria-role='button' aaname='Echo'` | × |
| `data-testid='nope'`（無い値。否定の対照） | ×（正しい） |

分かったことは次のとおり。

- `data-*` は、そのまま使える
- aria-label は `aaname` ではなく、属性 `aria-label` で書く。`aaname` は表示の文字に当たる
- `role` は使わない

## Playwright の objects（`pw/objects`）

UiPath のオブジェクトリポジトリ（`.objects`）と同じく、Playwright でもセレクターをコードの外に置き、コードからは名前で指す（2026-11-19 に利用者が決めた）。構造をそっくりにはせず、この点だけを似せる。

- **正本は `<P>/ir/repository.json`**。ここから UiPath の `.objects`（`objrepo.ts build`）と、Playwright の `<P>/pw/objects/index.ts`（`pw-objects.ts build`）の両方を作る。どちらも手で直さない
- **階層は UiPath と同じ**：アプリ → 画面 → 要素。コードからは `O.アプリ.画面.要素` で指す（それぞれ Playwright の Locator）。名前の空白などは `_` にする（Coded の Descriptors と同じ。`IR Form` → `IR_Form`）。画面は `$url`・`$urlPattern` を持つ
  ```ts
  import objects from "./objects/index.ts";
  const O = objects(page, "ja-JP");
  await page.goto(O.IR_Form.フォーム.$url as string);
  await O.IR_Form.フォーム.名前.fill("太郎");
  ```
- **言語**：要素はロケールごとの locator を持てる（`{ "ja-JP": …, "en-US": …, "*": … }`）。`objects(page, locale)` のロケールで選ぶ（同じロケール → 同じ言語 → `*`）
  - record-to-ir.ts は、言語で値が違う要素に `locales`（ロケールごとのセレクター）を足す。`target` は両方の言語に当たる正規表現のまま（UiPath はこちらを使う）
  - XAML から来た要素（`locales` が無い）は、`*` の 1 つだけになる
- **手で書く台本**（recorder を使うもの）：要素は先に `defineObjects`（`tools/pw/objects.ts`）で定義し、名前で指す。記録すると、その名前のまま repository.json に入る。そのあとは repository.json が正本
- **ぶつかったとき**：セレクターをコードにじかに書いた手順は、record-to-ir.ts が警告を出す。リポジトリに無いターゲット（XAML にじかに書いたセレクター）は、ir-to-pw.ts がじかに書いて一覧に出す（`objrepo.ts register` で登録すると objects から引ける）
- **`pw-objects.ts build` が `<P>/pw/` に作るもの**
  - `objects/index.ts`：要素の定義
  - `objects/index.md`：変換できない要素があるときの一覧
  - `lib/runtime.ts`・`lib/objects.ts`：`tools/pw` の写し
  - `package.json`
  - `node_modules`：`tools/pw/node_modules` へのジャンクション。消すときは、つなぎだけを外す（中を消さない）

  生成したスクリプトの import は `./lib/runtime.ts` と `./objects/index.ts` になる（前は `../../../../seiya/ghq/…` のような長いパスだった）

## UiPath → Playwright

```bash
node tools/ir/import-xaml.ts <P>/Main.xaml --project <P> --out <dir>      # XAML から始めるとき
node tools/pw/ir-to-pw.ts --project <P> <P>/ir/Main.json [--out <dir>]    # 既定は <P>/pw/Main.pw.ts と Main.pw.md。pw/objects と lib も作る
node <P>/pw/Main.pw.ts <引数の JSON> [--locale en-US] [--headed]         # 手元の Chrome で動かす
```

- セレクターは `O.アプリ.画面.要素` で引く。要素は `$ref` と、XAML から取り込んだ IR の `Reference`（リポジトリの要素の Id）で引き当てる
- できたスクリプトは、`export async function <ワークフロー>(page, args, locale?)` と、そのまま動かすための入口を持つ。`lib/runtime.ts` の小道具を使う
  - `getText`：入力欄なら値、それ以外は表示の文字
  - `waitState`：時間切れなら false を返し、例外にしない
  - `log`
- Coded は IR から作ったものなので、その IR を渡す。手で書いた Coded を IR にする道具は無い
- `--project` を付けると、その `ir/repository.json` で `$ref` を引く。リポジトリを使わない XAML（`import-xaml.ts` の IR はターゲットをそのまま持つ）も変換できる

### アクティビティ

| IR | Playwright |
| --- | --- |
| `NApplicationCard` | OpenMode Always：`page.goto(Url)`。IfNotOpen：空のときだけ `goto`。どちらも、画面のセレクターの `url` を `page.waitForURL`（`*` → `**`）で待つ |
| `NGoToUrl` | `page.goto` |
| `NClick` | `click`（右・中ボタン、ダブルクリック） |
| `NTypeInto` | `fill`。EmptyFieldMode None は `pressSequentially` |
| `NGetText` | `getText`（入力欄は値、それ以外は `innerText`。UiPath の Get Text とは違うことがある。下の「読み取りの文字」） |
| `NGetAttribute`・`NGetAttributeGeneric` | `getAttribute(要素, 属性)`。`innertext`・`visibleinnertext` は `innerText`、`value` は入力欄の値、それ以外は DOM の属性 |
| `NCheckState` | `waitState` |
| `LogMessage`・`If`・`Throw`・`Assign`・`Delay`・`Sequence` | そのまま |

### セレクター → locator（`tools/pw/selector.ts`）

| UiPath | Playwright |
| --- | --- |
| `tag` | CSS のタグ（小文字） |
| `id`・`name`・`class`・`type`・`href` など、`data-*`、`aria-*`（`aria-role` は `role`） | CSS の `[属性="値"]` |
| `aaname` | `.filter({ hasText: /^値$/ })`（UiPath の aaname は表示の文字に当たる） |
| `aria-label` の正規表現 | `.and(page.getByLabel(new RegExp(...)))` |
| `innertext` | `.filter({ hasText: /^値$/ })` |
| `css-selector` | `:is(...)` |
| `parentid` | 祖先の `[id=...]` |
| `idx` | `.nth()` |
| webctrl が 2 つ以上 | `.locator()` をつなぐ |
| `tag='IFRAME'`（`FRAME`）の行 | `.frameLocator(css)` |
| アンカー（FuzzySelector で探すとき） | 最後の行に `:near(アンカーの CSS)`。表示文字は `:text-matches("…")` |
| アンカー（Selector で探すとき） | 使わない（UiPath も使わないので、同じ意味） |

- 当たった要素の先頭を使う（UiPath と同じ。Playwright の strict にしない）ため、`.first()` を付ける
- ワイルドカード `*` は、前・後ろ・両方なら `^=` `$=` `*=` にする。`aaname`・`innertext` は正規表現にする

### 式（`tools/pw/expr.ts`）

VB の式・`{ lit }`・`{ cs }` を TypeScript にする。

- 演算子：`&` → `+`、`=` → `===`、`Not` → `!`（比較より弱いので括弧で包む）、`AndAlso` → `&&` など
- メソッド：`Trim`・`ToUpper`・`ToLower`・`ToString`・`Contains`・`StartsWith`・`EndsWith`・`Replace`・`Length`
- `New Exception(...)` → `new Error(...)`
- 名前は、変数と引数だけ。VB は大文字小文字を区別しないので、宣言の綴りにそろえる

## 変換できないもの（黙って捨てない）

### Playwright → UiPath

`conversion.md` の一覧に出し、ワークフローには Warn のログを残す。

- Playwright にしか無い操作（`page.route`、`page.evaluate` など）。スクリプトで `rec.unsupported(...)` を呼んで残す
- 別のオリジンの iframe の中の要素（iframe の属性を読めない）、iframe を 1 つに決める属性が無いもの
- Shadow DOM の中の要素。UiPath の webctrl のセレクターでは見つからなかった（2026-11-19、Agents のテンプレートの一覧の表 `grid-container`）。shadow DOM の外の要素で確かめる
- CSS のパスにしか決まらない要素
- `clickIfVisible` で、どの言語でも出なかった要素（属性が分からない）。片方の言語でしか出なければ、その記録だけでセレクターを決める（警告）

### UiPath → Playwright

`<名前>.pw.md` の一覧に出し、スクリプトには `// 変換できない:` を残す。

- **UiPath にしか無いもの**
  - デスクトップのアプリ（`wnd`・`ctrl`・`uia`）
  - 画像・CV・意味で探すターゲット
  - あいまい一致の属性（`matching:x='fuzzy'`）。FuzzySelector で探すターゲットでも、属性にあいまい一致が無ければ、そのまま厳密な一致で書ける
  - アンカーのうち、`:near()` に書けないもの：アンカーが複数行・本体と別の iframe・`aria-label` の正規表現・`idx` を持つもの、アンカーが 2 つ以上（1 つ目だけ使い、一覧に出す）
  - アンカーの位置（`DesignTimeRectangle`、PositioningType Default）は、近さ（`:near`）で近づける。意味が変わりうるので一覧に出す
- **セレクター**
  - 式で組み立てるセレクター
  - `aaname`・`innertext`・`aria-label` 以外の正規表現
  - CSS で書けないワイルドカード
  - 表に無い属性（`tablerow`・`isleaf`・`parentclass` など）
- **アクティビティ**
  - 上の表に無いもの（`NHover`・`NSelectItem`・`NCheckBox` など、まだ足していない）
  - 扱っていないプロパティ（例：`NClick` の `KeyModifiers`）
- **式**
  - 上に無いメソッド・型（`String.Format`、`DateTime.Now` など）
  - ラムダ、`If(...)`
  - C# の `$"..."`・`@"..."`
- **型**：String・Boolean・数値以外の変数と引数（型を付けない）

## 往復で確かめたこと（テスト）

- `tools/pw/ir-to-pw.test.ts`
  - IR → XAML（`generate`）→ IR（`importXaml`）→ Playwright が、元の IR からの Playwright と同じ文字になる
  - objects で名前を付けて Chrome で記録 → IR と repository.json → pw/objects と Playwright → 2 言語で動かすと記録と同じ結果。スクリプトに `page.locator` が無いこと
  - 手元の Chrome で小さなページを 2 言語で記録する → IR → Playwright を作って動かす → 記録と同じ結果になる
- サインイン画面（`samples/pw/signin`）では、次を確かめた
  1. 記録 → IR → XAML・Coded（`uip rpa validate` が Success）
  2. その XAML → `import-xaml.ts` → `ir-to-pw.ts` → 手元の Chrome で、日本語・英語とも元の記録と同じ結果になった
  3. XAML から戻した IR の Playwright は、元の IR の Playwright と同じだった
- 小さなフォーム（`samples/pw/form/form.html`）で、両方向を DESKTOP のロボットまで確かめた（2026-11-19）。objects に分けたあと（台本は名前で指す、スクリプトは `O.…` で引く）も、ロボットの XAML・Coded と、XAML から戻した Playwright の結果は変わらなかった。XAML から戻した Playwright は、IR から作ったものと同じ文字になった。ページは `node tools/pw/serve.mjs samples/pw` で、http://127.0.0.1:8765/form/form.html に配る
  1. Playwright で 2 言語を記録し、XAML（`PwForm`）と Coded（`PwFormCoded`、Descriptors）を作った。窓口（queue-run）でロボットが動かし、どちらも「結果: 受け付けました: IR 太郎」「見出し: 申し込み」になった
  2. その XAML → `import-xaml.ts` → `ir-to-pw.ts` → 手元の Chrome で、ja-JP・en-US とも記録と同じ結果になった
  - 使ったセレクター：`data-testid`、`aria-label` の 2 言語の正規表現（送信・閉じる）、`innertext` の 2 言語の正規表現（見出し）。出たときだけ閉じるお知らせ（`clickIfVisible`）も通った
- サインイン画面は、シークレット ウィンドウ（`IsIncognito`）にするとロボットで通った（2026-11-19）
  - `PwSignIn3`（XAML）と `PwSignInCoded3`（Coded、Descriptors）が通った。どちらも「サインアップへのリンク: Sign up」
  - 利用者のプロファイルで開いた `PwSignIn2` は、Go To URL やメール欄で「UI 要素が見つかりません」で落ちた。サインイン済みのプロファイルで、画面が記録と変わったため（シークレットで通ったことからの推定）
- 読み取りの文字（Get Text）の違いを直した。下の「読み取りの文字」

## アンカー・複数行のセレクター・iframe（AUT-1221）

題材は `samples/pw/form/layout.html`（＋ `frame.html`）。ラベルの右の入力欄（属性が同じ入力欄 2 つ）、カードの中のボタン（同じボタン 2 つ）、iframe の中の要素を含む。言語は `navigator.language`、`?lang=en` で上書きできる（ロボットの Chrome は OS の言語のままで、`TargetApp.Arguments` の `--lang` も効かなかった）。台本は `samples/pw/form/layout.ts`、要素は `layout-objects.ts`。

### Studio の形と、ロボットでの動き（2026-11-19、DESKTOP）

- Studio はアンカーを `TargetAnchorable.Anchors`（`List<ITarget>`）の `uix:Target` で書く（アンカー自身のセレクターと `SearchSteps`）。向きのプロパティは無く、本体は `SearchSteps="FuzzySelector"` と `DesignTimeRectangle` を持つ（Studio で作った `オブジェクトリポジトリ確認/Main.xaml`）

| 書き方（`samples/pw/form/layout.html`、IR は `C:\Users\Public\uipath-cloud-ui\LayoutCases\`） | 結果 |
| --- | --- |
| `<webctrl data-testid='card-b' /><webctrl tag='BUTTON' />` | ○ |
| `<webctrl tag='IFRAME' id='inner' /><webctrl data-testid='frame-input' />` | ○（iframe の行が無くても、`tag='IFRAME'` だけでも通った） |
| アンカー＋ `SearchSteps=Selector`（四角あり・なし、`PositioningType=Closest` も） | アンカーは使われない（先頭の入力欄に入った） |
| アンカー＋ `FuzzySelector`＋ `DesignTimeRectangle` | ○ |
| アンカー＋ `FuzzySelector`＋ `PositioningType=Closest`（四角なし） | ○（ラベルにいちばん近い入力欄。アンカー自身は `Selector` でよい） |
| `FuzzySelector`、アンカーなし（2 つに当たる） | エラー「類似の一致が複数見つかりました」 |

### 対応の表

| | Playwright → UiPath（記録から） | UiPath → Playwright | 往復 |
| --- | --- | --- | --- |
| 複数行 | 祖先の言語によらない属性 ＋ その中で 1 つのタグか表示文字 → 2 行 | `.locator(A).locator(B)` | ○ |
| iframe | 先頭に `<webctrl tag='IFRAME' id='…' />` | `.frameLocator(css)` | ○ |
| アンカー | 近くのラベル → 本体は `FuzzySelectorArgument`（タグとクラス）＋ `SearchSteps=FuzzySelector` ＋ `PositioningType=Closest` ＋ `Anchors: [{ FullSelectorArgument: ラベル（2 言語の正規表現）, SearchSteps: Selector }]` | `T:near(A).first()`（`:near` は近い順。`.first()` がいちばん近いもの） | ○ |
| アンカー（Selector で探す・DesignTimeRectangle の位置） | 作らない | Selector：使わない（UiPath も使わない）／位置：`:near` で近づけ、一覧に出す | — |
| 手で書いた `:right-of()`・`.filter({ has })`・`getByLabel`・`frameLocator` | 台本の locator は記録で当たった要素を指すだけ。セレクターは記録した属性から上の形で作る | — | — |

- アンカーと親は `repository.json` に入り、`.objects`（`objrepo.ts build`）と `pw/objects`（`pw-objects.ts build`）の両方に出る。コードにはセレクターを書かない
- Coded は、アンカーを `TargetAnchorableModel` で書けない（`CODED_UNSUPPORTED`）。Descriptors（オブジェクトリポジトリ）で書けば動く。`ObjectRepository.cs` は、仮の `Main.cs`（Log だけ）を窓口で 1 回流して作る

### 確かめたこと

- PwLayout（XAML）と PwLayoutCoded（Coded、Descriptors）がロボットで通った。ja（既定）と en（`?lang=en`）とも、Playwright の記録と同じ結果になった
  - 「氏名=IR 太郎 / メール=ir@example.com」「選択: プランB」「プランA」「受け取り: F1」
  - 英語では「Name=… / Email=…」「Chosen: Plan B」「Plan A」「Got: F1」
- PwLayout の XAML → `import-xaml.ts` → `ir-to-pw.ts` の Playwright も、2 言語で同じ結果。スクリプトに `page.locator` は無い
- UiPath → Playwright → UiPath：XAML から作った objects で記録し直すと、10 要素のターゲットが元の `repository.json` と同じになった（違いは、`objrepo.ts build` が足すアンカーの `Guid` だけ）
- テスト（`tools/pw/ir-to-pw.test.ts`）：アンカー・カード・iframe（`srcdoc`）の小さなページで、記録 → 変換 → 2 言語で実行 → 生成した objects で記録し直して同じターゲット

## 読み取りの文字（Get Text と Get Attribute の innertext）

サインイン画面の「言語の選択」は、UiPath の Get Text では「Englishen」、Playwright の `innerText` では「English」になった。中に MUI の Select の見えない入力欄（`<input aria-hidden="true" value="en">`。opacity 0 で、上に重なる）があり、UiPath の Get Text はその値まで文字に入れる。

DESKTOP のロボットで試した（2026-11-19）。ページは `samples/pw/form/gettext.html`、IR は `C:\Users\Public\uipath-cloud-ui\GetTextCases\GetTextTest.json`。

| 読み方 | MUI の形（中に見えない入力欄） | 中に display:none の入力欄 | 文字だけ |
| --- | --- | --- | --- |
| Get Text：ScrapingMethod Default・TextAttribute・Fulltext、ScrapingOptions IgnoreHiddenText（どの組み合わせも） | Englishen | Japaneseja | Plain text |
| Get Text：ScrapingMethod Native | （空） | （空） | （空） |
| Get Attribute：`innertext`・`innerText`・`visibleinnertext` | **English** | **Japanese** | — |
| Get Attribute：`aaname` | （空） | Japanese | — |
| Get Attribute：`textContent` | （空） | （空） | — |

- Get Text の設定では、Playwright の `innerText` と同じ文字にできなかった。OCR は画面の画像を読むので、試していない
- サインイン画面では、文字を出している内側の要素（`id='languageOptions'`）を Get Text で読んでも「Englishen」だった。入力欄が上に重なっているため、と推定している
- **そこで、記録の `text` は Get Attribute の `innertext` で読む**（record-to-ir.ts）
  - PwSignIn3・PwSignInCoded3 で「English」になり、Playwright と同じになった
  - PwForm・PwFormCoded も、結果は変わらなかった
- 逆向き（ir-to-pw.ts）の Get Text（`NGetText`）は `innerText` で読む。中に入力欄がある要素では、UiPath と違う文字になりうる。UiPath 側を Get Attribute の `innertext` に直すと、そろう

## ロボットで動かすときの注意

- 窓口（runner.mjs）は、利用者の RDP の画面のセッションで動かす
  - SSH 側で `uip rpa` の validate・build・run を動かすと、セッション 0 に Helm・UserHost が残る
  - するとロボットの実行がセッション 0（画面が無い）に回り、ブラウザーが開けない（`0x80040353` 新しいブラウザー ウィンドウが表示されませんでした）
- Chrome の拡張には、ネイティブ メッセージング ホスト（`HKCU\Software\Google\Chrome\NativeMessagingHosts\com.uipath.chromenativemsg_v2`）も要る。Studio で拡張を入れ直しても、ここが書かれないことがあった
- Coded の Descriptors に要る `ObjectRepository.cs` は、SSH で validate せずに作る
  1. 窓口の run が作った作業用プロジェクト（`<テンプレート>-<作業名>\.local\.codedworkflows\`）から写す
  2. `gen-coded.ts` をもう一度流す
- Delay の Duration は式（`TimeSpan.FromSeconds(5)`）で書く。`"00:00:05"` は VB のコンパイルで落ちる
- シークレット ウィンドウ（`NApplicationCard` の `IsIncognito`、Studio では「シークレット/プライベート ウィンドウ」）
  - 記録は、Playwright の新しいコンテキスト（Cookie・サインインが残らない）で取る。そのため record-to-ir.ts は、カードを `IsIncognito: true` にする（`--no-incognito` で付けない）
  - ロボットの Chrome が利用者のプロファイル（サインイン済み）だと、画面が記録と変わるため
  - UiPath の Chrome 拡張に「シークレット モードでの実行を許可する」が要る。無いと「Failed to start browser in incognito mode. The UiPath extension is not allowed to run in incognito/private windows.」で落ちる（2026-11-19、DESKTOP）
  - ir-to-pw.ts の Playwright は、いつも新しいコンテキストなので同じ意味になる。`IsIncognito` が無い XAML（利用者のプロファイルで開く）でも新しいコンテキストで開くので、そこは意味が変わる

## サーバーレス

- Linux のサーバーレス（Default Serverless、`requiresUserInteraction: false`）では、UI Automation は使えない
  - `NApplicationCard` は通るが、要素はどれも `NodeNotFoundException` になる（`<webctrl tag='BODY' />` でも）
  - Playwright も動かない（`prototypes/playwright-serverless/README.md`）
- Windows のサーバーレスには、資格情報のあるロボットのアカウントが要る。AUT-1219 ではやめ、DESKTOP の Unattended のロボットで確かめる

## 気づいたこと・直したこと

- Cookie のバナー（OneTrust）は、出ると「メールで続ける」の上に重なり、クリックが 30 秒で時間切れになった。ja-JP で出やすい。`clickIfVisible` で、出たときだけ ×（同意しない）で閉じる
- Coded の `TargetAnchorableModel` / `TargetAppModel` で、リポジトリから足した `Reference` が引用符なしの式になっていた
  - 属性に書く文字列は、C# の文字列にした
  - `Guid` は Studio の `ObjectRepository.cs` も書かないので、Coded では書かない（`tools/ir/uia.ts`）
- 記録の道具を C# から TypeScript に書き直した（2026-11-19）。同じ画面の記録から、C# 版と同じ IR・`repository.json`・変換の一覧になった
