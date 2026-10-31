# Maestro の検証の窓口

イシュー：AUT-1077。環境：`uip` 1.204.0、`@uipath/maestro-builder-sdk` 6.66.5。

`tools/maestro/verify.mjs` は、公式 SDK のソースを1回で全部の検査に流し、結果を1つにまとめる。**ローカルの検証だけで、動くことは確かめない**（Studio Web と実行は AUT-1080）。

```bash
cd tools/maestro && npm install --ignore-scripts && cd ../..
node tools/maestro/verify.mjs samples/maestro/ExpenseCase.case.ts      # 表が出る。out/maestro-verify/report.json にも書く
node tools/maestro/verify.mjs --json --pack <ファイル>...               # 結果を JSON で。.nupkg も作る
node tools/maestro/verify.mjs --tenant --workspace <dir> <ファイル>...  # 資源の照合。docs/maestro-tenant-resources.md
node --test "tools/maestro/*.test.mjs"                                  # テスト。テナントの照合は MAESTRO_TENANT=1 のときだけ
```

終了コード：0 = OK、1 = NG がある、2 = 使い方か環境の問題。`--strict` で warning も NG にする。

## 流す工程

| 種類 | 工程 |
| --- | --- |
| Flow | `types` → `check --source` → `compile --no-check` → `validate --strict-expressions` |
| BPMN | `types` → `check --source` → `compile` → `format` → `validate` |
| Case | `types` → `check --source` → `compile` → `bindings sync` → `validate --strict` |
| できあがったファイル | `validate` だけ（BPMN は `format` も）。元のファイルは変えず、コピーを検証する |

`check` が NG でも後ろへ進む。**止める工程がそれぞれ違うので、1回で全部見せるため**。前の成果物が無いときだけ skip になる。`--pack` は例外で、前の工程が NG なら流さない。

## どの間違いをどの工程が止めるか

`tools/maestro/fixtures/broken/` の例を実際に流した結果。`verify.test.mjs` が同じことを確かめている。

| 間違い | types | check | compile | validate |
| --- | --- | --- | --- | --- |
| Flow：`$vars.review.status` を読む | 通る | **止まる** `HITL_READ_STATUS` | 通る | 通る |
| Flow：script の文法の間違い | 通る | 通る | 通る | **止まる**（`--strict-expressions` のときだけ） |
| Flow：数値に `toUpperCase` | 通る | 通る | 通る | **止まる**（同上） |
| Flow：無い変数を読む | 通る | **止まる** `UNKNOWN_REF` | 通る | **止まる** |
| Flow：`script({ cod: ... })` の綴り | **止まる**（`code` では？） | 内部エラーで止まる（綴りの話は出ない） | 通る | warning |
| BPMN：線の先が無い | 通る | **止まる** `DANGLING_FLOW` | 止まる | － |
| BPMN：無い変数を読む | 通る | **止まる** `EXPR_UNDECLARED_REF` | 止まる | － |
| BPMN：終了イベントが無い | 通る | warning `DEAD_END` | warning | 通る |
| Case：ステージが無い | 通る | **止まる** `NO_STAGES` | 止まる | － |
| Case：無いタスクを指す規則 | 通る | **止まる** `UNKNOWN_TASK_REF` | 止まる | － |

分かったこと：

- **`validate` だけでも `check` だけでも足りない**。`$vars.review.status` は `check` でしか止まらず、script の文法の間違いは `validate --strict-expressions` でしか止まらない
- **`flow validate` は既定だと、script の文法の間違いを warning にして `Valid` を返す**。窓口では `--strict-expressions` を必ず付ける
- **`compile` は、`check` で NG のものでも `.flow` を書く**。ファイルができたことは合格の意味にならない
- **`pack` も、script の文法の間違いを通す**（`.nupkg` ができた）
- `uip` の `check` と `compile` は TypeScript の型を見ない。`types` は `tsc --strict` で、SDK に同梱の TypeScript を使う
- 失敗の中身の置き場所がそろっていない（`Data.Diagnostics`、`Instructions`、`Data.Warnings` の文字列、`Data.Issues`）。窓口が同じ形にそろえる。`compile` が繰り返す診断は消す

## 窓口でも止まらないもの

- **Flow の空の分岐**：どの工程でも止まらない（`EmptyArm.flow.ts`）。SDK の README は `check` が止めると書いているが、`(e) => {}` では止まらなかった。害があるかは分からない
- **テナントに無い資源**：`--tenant` を付けないと通る（AUT-1079）
- **実行時の間違い**：RPA の引数名など。SDK の文書も、ローカルでは分からないと書いている

## 残る warning

- `unknown attribute <type>`：SDK が compile した BPMN には、script だけの例でも必ず出る。自分では直せないので `note` にして数えない。**害が無いと確かめたわけではない**
- `VARIABLE_NOT_SET`（`ExpenseApproval.bpmn` の `amount`）：SDK の `.input()` で宣言した変数でも出る。原因は未確認。warning のままなので、`--strict` だとこの例は NG になる
- `STRICT_BINDINGS_ABSENT`（アプリを指定しない Case の `action`）：warning のまま。`--strict` で止まる
- `Script references "iterator"`（BPMN のループの中の script）：`inputs: { "iterator[0]": "=iterator[0]" }` を付けても消えない。動くかは未確認
