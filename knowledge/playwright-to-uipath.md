# Playwright の操作を UiPath の XAML と Coded にする（AUT-1219）

Playwright（TypeScript）で画面を操作しながら、操作した要素の属性を記録する。記録から IR とオブジェクトリポジトリ（`<P>/ir/repository.json`）を作り、あとはいつもの生成器（`gen.ts`・`gen-coded.ts`）で XAML と Coded を作る。逆向き（UiPath → Playwright）はこのあと作る。C# 版 Playwright（Microsoft.Playwright）は使わない（`prototypes/playwright-serverless/` は記録として残す）。

## 流れ

1. スクリプトで `tools/pw/recorder.ts` の `launch` と `UiRecorder` を import し、操作を `rec.goto` / `click` / `fill` / `text` / `waitVisible` で書く（Playwright にしか無い操作は `rec.unsupported`）。見本は `samples/pw/signin/signin.ts`（UiPath のサインイン画面。パスワードは入れず、送らない）
   - `playwright-core` は `tools/pw` にだけ入れる（`cd tools/pw && npm install`）。ブラウザーはロボットと同じ Chrome（`channel: "chrome"`）で、Playwright 用のものは落とさない
2. 日本語と英語で 1 回ずつ流す（`BrowserNewContextOptions.Locale`）
   ```bash
   node samples/pw/signin/signin.ts ja-JP && node samples/pw/signin/signin.ts en-US
   ```
3. IR とリポジトリにする（変換できなかったものは `<P>/ir/<名前>.conversion.md` に出る）
   ```bash
   node tools/pw/record-to-ir.ts --project <P> --workflow Main --app "UiPath サインイン" --browser Chrome samples/pw/signin/rec/signin.ja.json samples/pw/signin/rec/signin.en.json
   node tools/ir/objrepo.ts build --project <P>
   node tools/ir/gen.ts <P>/ir/Main.json --project <P> --out <P>
   ```
4. Coded は別のプロジェクト（`main` が `Main.cs`）で作る。同じプロジェクトに `Main.xaml` と `Main.cs` を置くと名前がぶつかる。Descriptors で書くには、先に `uip rpa validate` で `.local/.codedworkflows/ObjectRepository.cs` を作り、もう一度 `gen-coded.ts` を流す
5. 動かすのは DESKTOP の Unattended のロボット（`queue-run.mjs`）。サーバーレスでは動かさない（下の「サーバーレス」）

## セレクターの選び方（`chooseSelector`）

上から順に、全部の言語の記録で同じ値になり、ページの中で 1 つに決まるものを使う。

1. テスト用の属性：`data-testid`・`data-cy`・`data-e2e`・`data-test`・`data-qa` → `<webctrl tag='T' data-cy='v' />`
2. `id`（作られた id は除く：`mat-input-3`・`:r1:`・数字の長いもの）、`name`
3. `aria-label` → `aaname`。言語で違えば `aaname='^(日本語|English)$' matching:aaname='regex'`
4. 表示の文字 → `innertext`。言語で違えば 3 と同じ正規表現
5. タグだけで 1 つに決まるならタグ
6. どれもだめなら `css-selector`（壊れやすいので、変換できないものの一覧にも出す）

- 値の `&` `'` は XML 用に、正規表現の記号は `\` で逃がす
- 画面のセレクターは転送のあとのページの `url='<オリジン>/*'`。開く URL（`Url`）は、スクリプトが開いた URL（転送のあとの URL には毎回変わる値が入る）
- UiPath のセレクターが `data-*` などの属性をそのまま読めるかは、DESKTOP の試し（`C:\Users\Public\uipath-cloud-ui\AttrCases`）で確かめる。まだ結果が無い（2026-11-19 時点。窓口が止まっていた）

## 変換できないもの（黙って捨てない）

`conversion.md` の一覧に出し、ワークフローには Warn のログを残す。

- Playwright にしか無い操作（`page.Route`、`page.EvaluateAsync` など）。スクリプトで `rec.Unsupported(...)` を呼んで残す
- 出るかどうかが状態で変わるもの（Cookie のバナーなど）。UiPath では、出たときだけ閉じる手順を人が足す
- iframe の中の要素（フレームのセレクターをまだ作っていない）
- Shadow DOM の中の要素は警告だけ（UiPath で探せるかは確かめていない）
- CSS のパスにしか決まらない要素

## サーバーレス

- Linux のサーバーレス（Default Serverless、`requiresUserInteraction: false`）では、UI Automation は使えない。`NApplicationCard` は通るが、要素はどれも `NodeNotFoundException`（`<webctrl tag='BODY' />` でも）。Playwright も動かない（`prototypes/playwright-serverless/README.md`）
- Windows のサーバーレスは、資格情報のあるロボットのアカウントが要る。AUT-1219 ではやめた（DESKTOP の Unattended のロボットで確かめる）

## 生成器の直し（このとき）

- Coded の `TargetAnchorableModel` / `TargetAppModel` で、リポジトリから足した `Reference` が引用符なしの式になっていた。属性に書く文字列は C# の文字列にした。`Guid` は Studio の `ObjectRepository.cs` も書かないので、Coded では書かない（`tools/ir/uia.ts`）
- 記録の道具を C# から TypeScript に書き直した（2026-11-19）。同じ画面の記録から、C# 版と同じ IR・`repository.json`・変換の一覧になることを確かめた。`tools/pw/recorder.test.ts` は手元の Chrome で小さなページを 2 言語で記録する（Chrome が無ければ飛ばす）
