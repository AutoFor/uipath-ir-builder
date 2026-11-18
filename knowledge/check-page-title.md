# ページの題名で分岐する（メンテナンス画面など）

## やってはいけない形

`Use Application/Browser`（Coded では `uiAutomation.Open(...)` の `app`）の中の `Check App State`（`NCheckState` → `app.WaitState`）で、
対象の `ScopeSelector` に題名を書いて絞るつもりの形：

```
PartialSelector = "<webctrl tag='BODY' />"
ScopeSelector   = "<html app='chrome.exe' title='*メンテナンス*' />"
```

- アプリの中の子のアクティビティでは、対象を探す範囲はつかんだアプリ（タブ）で決まり、この `ScopeSelector` の題名では絞られない
- BODY はどのページにもあるので、**題名に関係なくいつも「ある」になる**
- moneyforward_cs（2026-11-18）：題名「マネーフォワード ID」の普通のログイン画面で True になり、メンテナンス中と誤判定して止まった
  （使い捨ての Coded ワークフローで確認：旧の形 True、下の TITLE の形は題名に合わせて True / False）

## よい形

HEAD の中の `TITLE` 要素を `innertext` で探す（見えない要素でも、セレクターでは見つかる）：

```json
"objs": { "Target": {
  "FullSelectorArgument": { "lit": "<webctrl tag='TITLE' innertext='*メンテナンス*' />" },
  "SearchSteps": "Selector", "WaitForReadyArgument": "None" } }
```

- `Timeout` は短く（3 秒など）。ふつうは「無い」側に進むので、その分だけ待つことになる
- メンテナンスで止めるときは `BusinessRuleException` を投げる（[business-rule-exception.md](business-rule-exception.md)）
