# UI 操作が「要素が見つからない」で落ちたときの直し案（ui-repair）

`uip rpa run` で UI 操作（NClick、NTypeInto など）が `NodeNotFoundException` などで落ちたとき、今の画面を調べて、IR のセレクターの直し案を出す道具。`tools/repair/`。

**直し案を出すところまでが自動**。IR を直すのも、もう一度動かすのも、人が直し案を確かめてからにする（データを変えるワークフローを、勝手にやり直さないため）。

## 流れ

```
uip rpa run が UI 操作で落ちる
  → 止める（ui-repair.ts がログから、落ちたファイルと行・アクティビティを読む）
  → IR の中で、そのアクティビティのターゲット（objs.Target）を探す（Coded は行の Reference、XAML は DisplayName）
  → browser-use（observe.py）で今の画面を読む：どんな画面か、要素はあるか、その HTML の属性、ありそうな原因
  → uip rpa uia で今のタブの要素ツリーを取り、候補に点数を付け、interact get-all で属性を確かめる
  → いちばん合う候補から target-anchorable resolve-defaults でセレクターを作り直す（セレクターは UiPath が作る。手で組み立てない）
  → out/repair/<作業名>/proposal.md と proposal.json
人が確かめる → ui-repair.ts apply → gen.ts / gen-coded.ts で作り直す → もう一度 run
```

## 使い方

```bash
# 動かして、UI 操作で落ちたら直し案を作る
node tools/repair/ui-repair.ts --project <P> --run coded/Login__Coded.cs --name login
# すでにある run のログ（uip rpa run --output json の出力）から作る
node tools/repair/ui-repair.ts --project <P> --log <run.log> --name login
# browser-use を使わない（API キーが無いとき、画面を AI に見せたくないとき）
node tools/repair/ui-repair.ts --project <P> --log <run.log> --name login --no-observe
# 直し案を IR に当てる（人が proposal.md を確かめてから）
node tools/repair/ui-repair.ts apply out/repair/login/proposal.json
```

- `<P>/ir/` に IR が要る（`import-xaml.ts --project <P> --out <P>/ir`）。IR が無い・古いと、落ちたターゲットを見つけられない
- 終了コード：0 = 直し案を作った（か、落ちていない）、1 = 作れなかった（候補と notes を見る）、2 = 使い方の誤り
- `apply` が変えるのは `objs.Target` の `FullSelectorArgument`・`FuzzySelectorArgument`・`ScopeSelectorArgument`・`SearchSteps` だけ。直し案を作ったときから IR が変わっていたら当てない

## 直し案の決め方

- **タブ**：IR のアプリのセレクター（`TargetApp.Selector` の `title` / `url`）に合うタブを、`snapshot capture` の一覧から探す。合うタブが無ければ、同じホストのタブで調べ、「ページやログイン状態が違うかもしれない」と notes に書く。ホストのタブも無ければ「アプリが開いていない」で止める（直し案は出さない）
- **候補の点数**（`repair.ts` の `rankCandidates` と `scoreLive`）
  - 役割が ElementType に合う（InputBox、Button など。合わないものは外す）。見えない（`[invisible]` など）ものは外す
  - DisplayName の `'…'`、セレクターの `aaname`、browser-use が見た表示名と、名前がちょうど同じ（+7）か、含む（+4）
  - 元のセレクターの属性（`tag`、`type`、`id` など）が今の属性に合う（+3）、合わない（-1）
- 1 位と 2 位の差が 3 点未満、または 1 位が 4 点未満なら、直し案は出さず、候補を並べて人に決めてもらう（`uip rpa uia interact highlight <ref>` で場所を確かめられる）
- スコープ（`ScopeSelectorArgument`）は、今のものが今のタブの題名・URL に合わないときだけ変える

## browser-use（observe.py）

- browser-use 1.0.0。`tools/repair/.venv` に入れる（git に入れない）：

  ```bash
  python -m venv tools/repair/.venv
  tools/repair/.venv/Scripts/python -m pip install -r tools/repair/requirements.txt
  ```

- AI は Anthropic（`ChatAnthropic`）。環境変数 `ANTHROPIC_API_KEY` が要る。無ければ browser-use を飛ばして、uip rpa uia だけで調べる。モデルは `UI_REPAIR_MODEL`（既定 `claude-sonnet-5-5`）、手順の上限は `UI_REPAIR_MAX_STEPS`（既定 8）
- 普段の Chrome（ログイン済み）に `Browser('chrome')` でつなぐ。Chrome の DevToolsActivePort が要るので、Chrome でリモート デバッグを許可しておく（`chrome://inspect/#remote-debugging`）
- **読むだけ**：クリック・入力・送信・ページ移動・タブの開け閉めをしないよう指示し、扱うドメインを対象のホストに絞る（`allowed_domains`）。結果に残す属性は `tag`・`id`・`name`・`type`・`aria-label`・`placeholder`・`class` だけ
- **UiPath と同時に動かさない**。UiPath の入力方式 `DebuggerApi`（Chromium API）も Chrome のデバッガーの仕組みを使うので、つながりがぶつかると「Chromium API プロトコルへのアタッチに失敗しました」になる（Claude in Chrome でも同じことが起きた）

## 気をつけること

- `interact get-all` の出力には Cookie や HTML の中身が入る。`repair.ts` の `LIVE_KEEP` にある属性だけを残し、直し案やログに書かない
- アプリカードの `CloseMode` が `IfOpenedByAppBrowser` / `Always` だと、ロボットが開いたタブは落ちたときに閉じられ、あとから調べられない。調べるときは、先に対象のページを Chrome で開いておき、ロボットがそのタブにつなぐようにする
- 「要素が見つからない」の原因がセレクターでないこともある（前の手順で別の画面に進んでいない、ログイン状態が違う、読み込みが遅い）。そのときは直し案ではなく notes と browser-use の `cause` を見て、ワークフローか画面の準備を直す
- 確かめたこと（2026-11-17）：moneyforward_cs の Login__Coded の失敗ログで、落ちた行 → IR のターゲットまでを特定し、MoneyForward のタブが無いことを notes に出した。GitHub のタブで、古いセレクターから候補を選び、resolve-defaults で作り直したセレクターを直し案にし、apply で IR に当てた。browser-use は API キーが無く、まだ動かしていない
