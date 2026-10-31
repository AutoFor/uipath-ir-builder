# Maestro：独自の IR か、SDK の直書きか

イシュー：AUT-1078。環境：`uip` 1.204.0、`@uipath/maestro-builder-sdk` 6.66.5。

## 結論

**独自の IR は作らない。AI は SDK のソース（`*.flow.ts` / `*.bpmn.ts` / `*.case.ts`）を直接書き、`tools/maestro/verify.mjs` で検証する。**

IR が勝つのは「同じ処理を Flow と BPMN の両方に出す」ときの入力の短さだけで、その場合でも式は両方書く。代わりに、SDK が持っている型の検査と、既存ファイルからの逆変換を失い、ノードが増えるたびに生成器を直すことになる。

`tools/maestro/gen.ts` は比較の記録として残し、これ以上育てない。

見直す条件：Flow と BPMN の両方に同じものを出す案件が実際に続くこと、または SDK が使えなくなること（直接生成ができることは確かめてある：`Minimal.direct.bpmn`）。

**どちらも実行はしていない。** 比べたのは書きやすさとローカルの検証までで、実行時の違いは分からない。

## 比べた例

| 例 | 中身 | 直書き | IR |
| --- | --- | --- | --- |
| Approval | 人の承認 → 分岐 → script | `tools/maestro/fixtures/ok/Approval.{flow,bpmn}.ts` | `samples/maestro/ExpenseApproval.json` |
| Batch | ループ、失敗時に人へ回す | `tools/maestro/compare/Batch.{flow,bpmn}.ts` | `tools/maestro/compare/Batch.ir.json` |

Batch は、IR にまだ無かった `loop` と `onError` を含むものとして新しく書いた。両方とも `verify.mjs` を通した。Flow は、直書きと IR で、id の行と名前を除いて同じ `.flow` になった（`diff` で確認）。

## 結果

| 観点 | 直書き | IR | 実際に見たもの |
| --- | --- | --- | --- |
| 入力の量（Flow だけ） | Approval 724、Batch 715 バイト | 805、681 バイト | ほぼ同じ |
| 入力の量（Flow と BPMN） | 1819、1597 バイト | 805、681 バイト | **IR が半分以下** |
| 式 | 種類ごとに書く | **結局両方書く**（`flow` と `bpmn`） | ループの現在の値は Flow が `$vars.each.currentItem`、BPMN が `iterator[0]` |
| 構造の差 | 種類ごとに書く | 生成器が吸収する | 吸収しきれない。BPMN のループは1つのタスクの繰り返しで、複数の工程には別の形（`subProcess`）が要る。今の `gen.ts` は script 1つに限った |
| 綴りの間違い | `tsc` が `'cod' ... Did you mean to write 'code'?` と行番号つきで言う | `{ "idd": "a" }` は `.step(undefined, ...)` を生成し、`check` は `Cannot read properties of undefined (reading 'replace')`。`{ "kind": "scrpt" }` は `steps is not iterable` | 直書きが明らかによい。IR に検査を足せば縮むが、その分は自前の仕事になる |
| 診断の読み先 | 自分の書いたファイルの行 | 生成物の行。JSON に戻って読み替える | 直書きがよい |
| ノードが増えるとき | 何もしなくてよい。SDK の公開関数は 82 個（`api-index.md`） | `loop` と `onError` だけで `gen.ts` が 28 行増えた（Flow と BPMN の両方） | 直書きがよい |
| テナントの資源 | `rpaWorkflow`、`connector`、`lookup` などがそのまま使える | すべて IR に写す必要がある（今の `gen.ts` は未対応） | 直書きがよい |
| 既存のファイル | `flow decompile` で SDK のソースに戻る（戻して compile はできた。元とバイト単位では同じにならなかった） | 戻す道が無い | 直書きがよい |
| Case | 書ける | 工程の並びでないので載らない | 直書きしかない |
| SDK の版が変わるとき | ソースを直す | 生成器を直す。SDK が守る API に依存する点は同じ | 差は小さい。**IR は SDK の変更から守ってくれない** |

## XAML の IR と違う理由

XAML では、IR は必要だった。XAML は人にも AI にも書きにくく、DLL のカタログから型を作り、VB と C# に出し分ける必要があった。Maestro は公式の SDK がその役割を持っていて、ソースが小さく、型もある。

共通して残すのは「AI は小さな入力を書き、機械が生成して検証する」という考え方で、**「小さな入力」が JSON である必要はない**。

## 分かっていないこと

- AI が実際にどちらを間違えにくいかは測っていない。上の表は例を数個書いた結果で、統計ではない
- `decompile` で戻したソースには、レイアウトと版が全部書かれるので長くなる。編集しやすいかは試していない
