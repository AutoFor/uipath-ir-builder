# Playwright（TypeScript）と UiPath（XAML・Coded）を IR を通して行き来する（AUT-1219）

- **Playwright → UiPath**：Playwright（TypeScript）で画面を操作しながら、操作した要素の属性を記録する。記録から IR とオブジェクトリポジトリ（`<P>/ir/repository.json`）を作り、いつもの生成器（`gen.ts`・`gen-coded.ts`）で XAML と Coded を作る
- **UiPath → Playwright**：IR（と `repository.json`）から Playwright（TypeScript）のスクリプトを作る。XAML は `import-xaml.ts` で IR にしてから渡す。XAML や Coded から直接は変換しない
- C# 版 Playwright（Microsoft.Playwright）は使わない（`prototypes/playwright-serverless/` は記録として残す）
- `playwright-core` は `tools/pw` にだけ入れる（`cd tools/pw && npm install`）。ブラウザーはロボットと同じ Chrome（`channel: "chrome"`）で、Playwright 用のものは落とさない

## Playwright → UiPath

1. スクリプトで `tools/pw/recorder.ts` の `launch` と `UiRecorder` を import し、操作を次のメソッドで書く
   - `rec.goto` / `click` / `fill` / `text` / `waitVisible`
   - `clickIfVisible`：出たときだけ押す（Cookie のバナーなど）
   - `unsupported`：Playwright にしか無い操作を残す

   見本は `samples/pw/signin/signin.ts`（UiPath のサインイン画面）。パスワードは入れず、送信もしない。
2. 日本語と英語で 1 回ずつ流す（`launch` のロケール）
   ```bash
   node samples/pw/signin/signin.ts ja-JP && node samples/pw/signin/signin.ts en-US
   ```
3. IR とリポジトリにする（変換できなかったものは `<P>/ir/<名前>.conversion.md` に出る）
   ```bash
   node tools/pw/record-to-ir.ts --project <P> --workflow Main --app "UiPath サインイン" --browser Chrome samples/pw/signin/rec/signin.ja.json samples/pw/signin/rec/signin.en.json
   node tools/ir/objrepo.ts build --project <P>
   node tools/ir/gen.ts <P>/ir/Main.json --project <P> --out <P>
   ```
4. Coded は別のプロジェクト（`main` が `Main.cs`）で作る。同じプロジェクトに `Main.xaml` と `Main.cs` を置くと、名前がぶつかる。Descriptors で書く手順は次のとおり
   1. `uip rpa validate` で `.local/.codedworkflows/ObjectRepository.cs` を作る
   2. もう一度 `gen-coded.ts` を流す
5. 動かすのは DESKTOP の Unattended のロボット（`queue-run.mjs`）。サーバーレスでは動かさない（下の「サーバーレス」）

### 操作と UiPath のアクティビティ

| 記録 | IR |
| --- | --- |
| `goto` | `NApplicationCard`（開く）＋ `NGoToUrl` |
| `click` | `NClick` |
| `fill` | `NTypeInto` |
| `text` | `NGetText` ＋ `LogMessage` |
| `waitVisible` | `NCheckState`（WaitAppear）＋ `If Not` → `Throw` |
| `clickIfVisible` | `NCheckState`（WaitAppear、出なくても止めない）＋ `If` → `NClick` |

画面（記録の screen）が変わると、`NApplicationCard`（つなぐ）を入れ子にする。

`urlArg` / `valueArg` で引数にした値は、最初の記録の値を引数の既定値（`arguments[].default`）にする。XAML ではルートの `this:Main.in_Url="..."`、Coded では `Execute(String in_Url = "...")` になり、Studio で引数を渡さずにそのままデバッグできる。ir-to-pw.ts のスクリプトも、渡されなかった引数は既定値を使う

### セレクターの選び方（`chooseSelector`）

上から順に、全部の言語の記録で同じ値になり、ページの中で 1 つに決まるものを使う。

1. テスト用の属性：`data-testid`・`data-cy`・`data-e2e`・`data-test`・`data-qa` → `<webctrl tag='T' data-cy='v' />`
2. `id`、`name`。ただし作られた id（`mat-input-3`・`:r1:`・数字の長いもの）は使わない
3. `aria-label` → `aaname`。言語で違えば `aaname='^(日本語|English)$' matching:aaname='regex'`
4. 表示の文字 → `innertext`。言語で違えば 3 と同じ正規表現
5. タグだけで 1 つに決まるならタグ
6. どれもだめなら `css-selector`。壊れやすいので、変換できないものの一覧にも出す

- 値の `&` `'` は XML 用に、正規表現の記号は `\` で逃がす
- 画面のセレクターは、転送のあとのページの `url='<オリジン>/*'` にする。開く URL（`Url`）は、スクリプトが開いた URL にする（転送のあとの URL には、毎回変わる値が入る）
- UiPath のセレクターが `data-*` などの属性をそのまま読めるかは、まだ確かめていない（2026-11-19 時点。窓口が止まっていた）。DESKTOP の試し（`C:\Users\Public\uipath-cloud-ui\AttrCases`）で確かめる

## UiPath → Playwright

```bash
node tools/ir/import-xaml.ts <P>/Main.xaml --project <P> --out <dir>      # XAML から始めるとき
node tools/pw/ir-to-pw.ts --project <P> <P>/ir/Main.json [--out <dir>]    # 既定は <P>/pw/Main.pw.ts と Main.pw.md
node <P>/pw/Main.pw.ts <引数の JSON> [--locale en-US] [--headed]         # 手元の Chrome で動かす
```

- できたスクリプトは、`export async function <ワークフロー>(page, args)` と、そのまま動かすための入口を持つ。`tools/pw/runtime.ts` の小道具を使う
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
| `NGetText` | `getText` |
| `NCheckState` | `waitState` |
| `LogMessage`・`If`・`Throw`・`Assign`・`Delay`・`Sequence` | そのまま |

### セレクター → locator（`tools/pw/selector.ts`）

| UiPath | Playwright |
| --- | --- |
| `tag` | CSS のタグ（小文字） |
| `id`・`name`・`class`・`type`・`href` など、`data-*`、`aria-*`（`aria-role` は `role`） | CSS の `[属性="値"]` |
| `aaname` | `.and(page.getByLabel(...))` |
| `innertext` | `.filter({ hasText: /^値$/ })` |
| `css-selector` | `:is(...)` |
| `parentid` | 祖先の `[id=...]` |
| `idx` | `.nth()` |
| webctrl が 2 つ以上 | `.locator()` をつなぐ |

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
- iframe の中の要素（フレームのセレクターを、まだ作っていない）
- Shadow DOM の中の要素は、警告だけ（UiPath で探せるかは確かめていない）
- CSS のパスにしか決まらない要素
- `clickIfVisible` で、どの言語でも出なかった要素（属性が分からない）。片方の言語でしか出なければ、その記録だけでセレクターを決める（警告）

### UiPath → Playwright

`<名前>.pw.md` の一覧に出し、スクリプトには `// 変換できない:` を残す。

- **UiPath にしか無いもの**
  - デスクトップのアプリ（`wnd`・`ctrl`・`uia`）
  - 画像・CV・意味で探すターゲット
  - あいまい一致（`matching:x='fuzzy'`、FuzzySelector だけのターゲット。後者は厳密な一致にして、一覧に出す）
  - アンカー（捨てて、セレクターだけで探す。一覧に出す）
- **セレクター**
  - 式で組み立てるセレクター
  - `aaname`・`innertext` 以外の正規表現
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
- `aaname` は `getByLabel` で探すので、`aria-label`・`aria-labelledby`・`label` から決まる名前にしか当たらない。表示の文字から決まる名前（ボタンの文字など）には当たらない

## 往復で確かめたこと（テスト）

- `tools/pw/ir-to-pw.test.ts`
  - IR → XAML（`generate`）→ IR（`importXaml`）→ Playwright が、元の IR からの Playwright と同じ文字になる
  - 手元の Chrome で小さなページを 2 言語で記録する → IR → Playwright を作って動かす → 記録と同じ結果になる
- サインイン画面（`samples/pw/signin`）では、次を確かめた
  1. 記録 → IR → XAML・Coded（`uip rpa validate` が Success）
  2. その XAML → `import-xaml.ts` → `ir-to-pw.ts` → 手元の Chrome で、日本語・英語とも元の記録と同じ結果になった
  3. XAML から戻した IR の Playwright は、元の IR の Playwright と同じだった

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
