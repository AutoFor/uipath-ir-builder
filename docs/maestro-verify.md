# Maestro の検証の窓口

イシュー：AUT-1077。環境：`uip` 1.204.0、`@uipath/maestro-builder-sdk` 6.66.5。

`tools/maestro/verify.mjs` は、公式 SDK のソースを1回で全部の検査に流し、結果を1つにまとめる。**ローカルの検証だけで、動くことは確かめない**（Studio Web と実行の結果は末尾の節。AUT-1080）。

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

- `unknown attribute <type>`：SDK が compile した BPMN には、script だけの例でも必ず出る。自分では直せないので `note` にして数えない。テナントで動いた（末尾の節）
- `VARIABLE_NOT_SET`（`ExpenseApproval.bpmn` の `amount`）：SDK の `.input()` で宣言した変数でも出る。キャンバスでも同じ警告が出る。入力を渡せば値は届く（末尾の節）。warning のままなので、`--strict` だとこの例は NG になる
- `STRICT_BINDINGS_ABSENT`（アプリを指定しない Case の `action`）：warning のまま。`--strict` で止まる
- `Script references "iterator"`（BPMN のループの中の script）：`inputs: { "iterator[0]": "=iterator[0]" }` を付けても消えない。動くかは未確認

## テナントで動かした結果（AUT-1080）

2026-11-01、`uip` 1.204.0、`flow debug` / `bpmn debug` / `case debug`。debug は個人用ワークスペースで動く。人のタスクは `uip tasks complete` で完了した（`--type QuickFormTask`、割り当ては要らなかった）。キャンバスはブラウザで開いて目で見た。

| 生成物 | キャンバス | debug | ジョブ |
| --- | --- | --- | --- |
| `Minimal.flow` | 見ていない | Completed | `632cfef2-ca2b-46b8-b6c4-f10ecdbb0607` |
| `ExpenseApproval.flow` | 開く。ノードと Approve / Reject が見える | Completed。Approve → `pay`、`comment` が戻る | `801a4865-2c4c-4e1f-ac1c-8d155223777c` |
| `Minimal.bpmn` | 見ていない | Completed | `a711dd23-5e54-4151-967b-2ae2f7aa70bb` |
| `Minimal.direct.bpmn` | 見ていない | Completed（`entryPointId` を足した後） | `4b51ab4d-0cc4-4715-ab1c-bccb7dac87ea` |
| `ExpenseApproval.bpmn` | 開く。図は出るがノードに名前が出ない。`amount` の警告が1件 | Completed。タスクの `Data` に `Amount: 1234`。Reject → `notify` | `ca52d0b5-95fa-4313-863b-4e088d431964` |
| `ExpenseCase.json` | 開く（ステージとタスクが見える） | **Faulted**。`170004 Invalid input for the HITL task`。アプリの無い `action` は動かない | `b2f56bfa-7dfe-4808-90a9-0d67ec223f0d` |
| `samples/maestro/TimerCase.case.ts` | 見ていない | Completed | `df4726b0-72cf-48df-a3f2-deba726477eb` |

分かったこと：

- **BPMN の warning の2つに、この例では実害が見つからなかった**。`unknown attribute <type>` が出た BPMN は全部動いた。`VARIABLE_NOT_SET` は入力を渡した実行で、値がタスクまで届いた
- **QuickForm は Flow でも BPMN でも動く**
- **`validate` が通った Case でも落ちる**。`STRICT_BINDINGS_ABSENT` の warning は実害がある。`--strict` で止めるのが正しい
- **直接書く BPMN には `uipath:entryPointId` が要る**。無いと `bpmn refresh` が止まる（`gen.ts` を直した）
- **`.bpmn` を差し替えたら `uip maestro bpmn refresh <プロジェクトのフォルダ>` を流す**。`entry-points.json` が古いと、debug は `Running` のまま終わらない（`ea53f87c-b1e0-4416-afcf-3d1d5f68503e`、`ee23f87f-3891-4442-9875-bc8c794798d4` は280秒で打ち切って cancel した）。`validate` はこれを止めない。古いファイルがあると refresh も落ちるので、`entry-points.json` を消してから流す
- `.flow` の `id` が UUID でなくても（`Minimal`）動いた
- `flow debug` には `--timeout` があるが、`bpmn debug` と `case debug` には無い。人のタスクの前で止まる debug は、裏で流して別のコマンドでタスクを完了する

試していないもの：テナントの資源を指すノード（`Rpa.flow.ts` など）の実行、`solution publish`、入力なしの `VARIABLE_NOT_SET`、ループ、並列、Case の複数ステージ。
