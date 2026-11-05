# AI 向けの使い方

このフォルダ（uipath-ir-builder）は、UiPath のワークフローを AI に作らせるための道具。AI は XAML や C# を直接書かず、小さな JSON（IR）だけを書く。XAML と Coded の C# は生成器が作り、カタログ（パッケージの DLL から抜き出した型情報）で検証してから書き出す。

この文書は「この道具を使って業務の自動化を作る AI」向け。道具そのものに対応アクティビティを足す作業（Linear のイシュー）は [docs/worker-guide.md](docs/worker-guide.md) を読む。

## 置き場所

作る UiPath プロジェクトは、このフォルダの**外**に置く。このフォルダの中には作らない（テストが `samples/` をたどる、git の履歴に業務の変更が混ざる、プロジェクトごとに版と言語が違う、のため）。

```
C:\...\uipath-ir-builder\        ← この道具。読むだけ。変えない
C:\...\<どこか>\請求書処理\       ← UiPath のプロジェクト（Studio で開ける形）
    project.json                 ← パッケージの版と式の言語（VB / C#）はここで決まる
    Main.xaml                    ← 生成器が書き出す。手で直さない
    ir\Main.json                 ← AI が書く IR。こちらが正本
```

- AI が書き換えるのは `ir\*.json` だけ。XAML / `.cs` は毎回 IR から作り直す。XAML を直接直すと、次に生成したときに消え、検証も効かない
- プロジェクトのフォルダが無ければ、人に Studio で空のプロジェクトを作ってもらう（`uip` は Studio の裏の Helm を使うので、AI が勝手に作らない）
- 試すだけなら、このフォルダの `out\` の下に作ってよい（git の管理の外）

## 流れ

コマンドはこのフォルダで実行する（Node 24 以上、npm の依存なし）。`<P>` はプロジェクトのフォルダ。

### 1. プロジェクトを確かめる

`<P>\project.json` を読む。

- `expressionLanguage`：`VisualBasic`（書いていなければこれ）か `CSharp`。生成器は `--project` で自動で合わせるので、AI が切り替える必要はない
- `dependencies`：使えるパッケージと版。ここに無いパッケージのアクティビティは使えない。版に合うカタログが無いと生成器がエラーにする（近い版で代用しない。人に知らせる）

### 2. 使うアクティビティを調べる

推測でアクティビティ名やプロパティ名を書かない。必ず調べる。

```bash
node tools/ir/coverage.ts --activity ReadRangeX     # プロパティ、向き（in / out / prop）、必須、IR での書き方、サンプル
```

- 書き方の手本は `samples/ir/<パッケージ>/<クラス名>.min.json`（必須だけ）と `.full.json`（全部入り）。まずこれを写して直す
- アクティビティの一覧はカタログ `catalog/<パッケージ>/<版>.json` の `activities[].className`
- パッケージごとの注意は `knowledge/`（Excel は `excel.md`、Testing は `testing.md`、UI 操作は [docs/worker-guide.md](docs/worker-guide.md) の 8.）
- 書けないものと理由は [knowledge/coverage-gaps.md](knowledge/coverage-gaps.md)

### 3. IR を書く

1ワークフロー1ファイル。例：

```json
{
  "workflow": "Main",
  "variables": [
    { "name": "names", "type": "String[]", "default": "{\"太郎\", \"花子\"}" },
    { "name": "message", "type": "String" }
  ],
  "body": [
    { "act": "ForEach", "typeArg": "String", "item": "name", "props": { "Values": "names" },
      "body": [
        { "act": "InvokeWorkflowFile", "props": { "WorkflowFileName": { "lit": "Greet.xaml" } },
          "args": [
            { "name": "in_Name", "dir": "In", "type": "String", "value": "name" },
            { "name": "out_Message", "dir": "Out", "type": "String", "value": "message" } ] },
        { "act": "LogMessage", "props": { "Level": "Info", "Message": "message" } } ] }
  ]
}
```

- 引数は `"arguments": [{ "name": "in_Name", "dir": "In", "type": "String" }]`
- `props` の文字列は **VB の式**（C# のプロジェクトでも VB で書く。生成器が C# に直す）。文字列リテラルは `{ "lit": "..." }`、enum はメンバー名
- 子は `body`、`then` / `else`、それ以外は `slots`。`Switch` は `cases`、`TryCatch` は `catches`、`MultipleAssign` は `assigns`
- 書き方の詳細は [README.md](README.md) の「IR → XAML 生成器」
- C# のプロジェクトで C# に直せない式（名前付き引数 `f(x:=1)` など）は、`{ "vb": "...", "cs": "..." }` で両方書く。C# の予約語（`out`、`class`、`string` など）を変数名にしない

### 4. 検証して書き出す

```bash
node tools/ir/gen.ts <P>/ir/Main.json <P>/ir/Greet.json --project <P> --check   # 検証だけ
node tools/ir/gen.ts <P>/ir/Main.json <P>/ir/Greet.json --project <P> --out <P>  # <P>/Main.xaml などを書き出す
```

- **`--project <P>` を必ず付ける**。付けないと、既定の版と VB で作ってしまう
- IR は1つずつ並べて渡す（gen.ts はフォルダも `*.json` も受け取らない）
- 「〜のカタログが無い」という注意は、そのパッケージのアクティビティを使わなければ気にしなくてよい
- エラーが出たら、メッセージを読んで IR を直し、通るまで繰り返す。エラーを避けるために XAML を手で書かない
- Coded（C#）のワークフローが欲しいときは `node tools/ir/gen-coded.ts <P>/ir/Main.json --project <P> --out <P>`（同じ IR から作る。対応表の無いアクティビティはエラー）

### 5. 動かして確かめる

プロジェクトそのものは触らず、写した作業用のプロジェクトで build / run する。

```bash
node tools/verify/verify.mjs --name <作業名> --template <P> --use-project --no-coded <P>/ir/Main.json <P>/ir/Greet.json
node tools/verify/verify.mjs --name <作業名> --template <P> --use-project --no-coded --build-only <P>/ir   # build だけ
```

- 結果は `out/verify/<作業名>/report.md`。ログも見られる
- 期待するログを `<P>/ir/Main.expected.log` に1行1件で書いておくと、出たログと突き合わせる（`[Information] こんにちは` のようにレベルから書くとレベルも比べる）
- 入力引数は `<P>/ir/Main.verify.json` に `{ "args": { "in_Name": "太郎" } }`
- **このマシン（DESKTOP）では、`uip` も verify.mjs も SSH から直接動かさない**。`verify.mjs` を `tools/verify/queue-run.mjs` に置き換えて、引数はそのまま渡す（run の窓口が画面のセッションで動かす）
- UI を操作するもの、Orchestrator が要るもの、本物のメールを送るものは、run する前に人に確かめる。build だけで止めてよい

### 6. 人に渡す

- 書き出した XAML と `ir\` をプロジェクトに残す。Studio で開けば、そのまま見られる
- 何を作ったか、verify の結果（通った / build だけ / 落ちた理由）、確かめていないものを伝える

## してはいけないこと

- XAML / `.cs` を手で書く・直す（IR を直して生成し直す）
- カタログに無いアクティビティ、プロパティ、版を推測で使う
- このフォルダ（道具）のファイルを、業務のために書き換える。生成器の不具合や足りないアクティビティを見つけたら、人に知らせる
- `--project` を付けずに、実際のプロジェクトに書き出す

## プロジェクト側に置く AGENTS.md

業務のプロジェクトのフォルダには、次の内容の `AGENTS.md`（Claude Code なら `CLAUDE.md` にも `@AGENTS.md` の1行）を置く。道具の場所は環境に合わせて直す。

```markdown
# このプロジェクトの作り方

このプロジェクトのワークフローは uipath-ir-builder で作る。
道具: C:\Users\seiya\ghq\github.com\AutoFor\uipath-ir-builder
最初に、その AGENTS.md を読んで、その手順に従う。

- AI が書くのは ir\*.json だけ。*.xaml と *.cs は生成したもので、手で直さない
- 生成: node tools/ir/gen.ts <このフォルダ>\ir\Main.json <このフォルダ>\ir\<ほかの IR>.json --project <このフォルダ> --out <このフォルダ>（道具のフォルダで実行。IR は1つずつ並べる。*.json は展開されない）
```
