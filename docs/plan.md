# UiPath 中間表現（IR）生成の方向性

## Context

`uip rpa` + `uipath-rpa` スキルでの XAML / Coded Workflow 作成が遅い。原因は「推測 → 実機に聞く」を毎回 AI がやっていること。

- `SKILL.md` だけで 55KB、`references/` 以下に md が 704 本（4.8MB）。毎回読む
- アクティビティ1個ごとに `activities find` → `<Activity>.md` を読む → `get-default-xaml` → 足りないプロパティを補う（SKILL.md ルール21）。どれも Studio IPC 経由で、初回は約22秒のコールドスタート
- `get-default-xaml` は既定値と同じプロパティを出さない（`NGetText` は出力プロパティが0個）。結果、AI が推測し、`validate` は通るのに `build` で落ちる
- Coded も `packages inspect` を毎回呼んで API を調べている

**AutoFor/PowerPlatformFlowBuilder が同じ問題を解いている**。Power Apps でも AI に pa.yaml を直接書かせず、次の形にしていた。

```
spec JSON（AI が書く・型が決まっている）
  → validate.ts（実測カタログで、貼る前に弾く）
  → generate.ts（決まった形の YAML を機械的に出す。"=" はここで1箇所だけ付ける）
  → paste（実機）→ 失敗したら repair.ts（診断コード別の修復ルール。直さないものも決める）
```

中心になっているのは `knowledge/controls.measured.json`。**実機から測った型情報**で、想像では書かない。計測（measured）、却下された事実（rejected）、人の判断（`catalog.ts` の JUDGEMENTS）を分けて持つ。

これを UiPath に移す。

## 方針：3層に分ける

```
① カタログ（オフラインで1回だけ作る。パッケージのバージョンごと）
② IR / 指示書（AI が書くのはここだけ。小さく、型付き）
③ 生成 → 検証 → build → 修復（すべて機械がやる）
```

### ① アクティビティカタログを抽出する（推測をやめる中心）

**情報源は推測ではなくDLL**。`~/.nuget/packages/uipath.*` にパッケージがすでにローカルにある（`uipath.system.activities` は 26.x までそろっている）。

- **リフレクション抽出器**（C# の `MetadataLoadContext` を使う小さなコンソールアプリ）
  - Activity 派生クラス → ClassName、XAML の xmlns（`XmlnsDefinition` 属性）、アセンブリ名
  - プロパティ → 名前、`InArgument<T>` / `OutArgument<T>` / `InOutArgument<T>` / 素の型、`[RequiredArgument]`、`[DefaultValue]`、enum の値一覧、`[Category]` / `[DisplayName]`
  - 子を持つか（`Body` / `Activities` / `ActivityAction<T>` など）
  - これが `get-default-xaml` で見えない「既定値と同じプロパティ」の穴を埋める
- **実測の追記**：`get-default-xaml` の出力（Variant 相当の必須属性、`HealingAgentBehavior` など）をアクティビティごとに1回だけ採って、キャッシュに足す
- **実例コーパス**：自分のリポジトリ（MonthlyInvoiceProcess、iizuka-kodomo-clinic-reservation など）の .xaml を走査して、「実際に使われた属性の組み合わせ」を集める。パーサは `AutoFor/uipath-xaml-visualizer` の `packages/shared/parser/xaml-parser.ts` を流用する
- 出力：`catalog/<PackageId>/<version>.json`。1アクティビティを数行の JSON にした要約。AI に渡すのは**使うアクティビティのぶんだけ**

Coded 向けも同じ DLL から抽出する。サービス API（`system.*`、`excel.*` など）のメソッドシグネチャの一覧で、`packages inspect` を毎回呼ばずに済む。

### ② IR（指示書）

PA の spec JSON と同じ考え方。**AI に XAML 文字列を書かせない**。

```json
{
  "workflow": "Main",
  "arguments": [{ "name": "in_FilePath", "dir": "In", "type": "String" }],
  "variables": [{ "name": "dt", "type": "DataTable" }],
  "body": [
    { "act": "ReadRangeX", "props": { "Range": "\"A1\"", "SaveTo": "dt" } },
    { "act": "ForEachRow", "in": "dt", "body": [
      { "act": "LogMessage", "props": { "Message": "row(\"Name\").ToString" } }
    ]}
  ]
}
```

- `act` は ClassName（エイリアスはカタログ側で引く）
- 式は VB か C# の文字列。`[...]` の付け方や xmlns、`sap2010:WorkflowViewState.IdRef` などは**生成器が1箇所で付ける**（PA の `=` と同じ扱い）
- 名前空間の import や `.project.json` の依存も、使ったアクティビティから生成器が決める

### ③ 生成 → 検証 → build → 修復

| 段 | 中身 | Studio |
| --- | --- | --- |
| validate | カタログで、未知のプロパティ・必須の欠け・In/Out の向き違い・enum 外の値・親子違反を弾く | 不要 |
| generate | IR から XAML（または .cs）。テンプレートで決まった形にする | 不要 |
| `uip rpa build` | 最後の真実。ここだけ Studio を使う | 1回 |
| repair | build / analyze のエラーコード別に修復ルールを持つ。`repairs.jsonl` に記録して、ルールを育てる | — |

**直さないものを決める**（PA の `PA2102` と同じ）。未知のアクティビティ型や構造違反は、再試行せずにエスカレーションする。

### スキルの軽量化

`uipath-rpa` スキルは公式プラグインなので触らない。代わりに**薄い自作スキル**（例：`uipath-ir`）を作り、「IR を書く → `npm run gen` → build」だけを書く。アクティビティの知識はカタログ JSON から、必要なぶんだけ読む。

## 進め方（段階）

1. **PoC：カタログ抽出器**。`UiPath.System.Activities` と `UiPath.UIAutomation.Activities` の2パッケージで、リフレクション結果と `get-default-xaml` の結果を突き合わせる。抜け（例：`NGetText.Text`）を拾えるかを確かめる
2. **IR → XAML 生成器**。Sequence / Assign / If / ForEach / LogMessage / InvokeWorkflowFile / ReadRange 程度から始める
3. **validate と自己テスト**。PA の `test:validate` と同じく、**実際に build で落ちた XAML だけ**をテストケースにする
4. **repair ループと `repairs.jsonl`**
5. Coded の API 索引（同じ抽出器の別出力）
6. 薄いスキル化

## 置き場所（案）

新規リポジトリ `AutoFor/uipath-ir-builder`。PA リポジトリの構成（`knowledge/`、`tools/`、`samples/specs/`）に合わせる。抽出器だけ C#、それ以外は TypeScript（tsx）。

## 流用するもの

- `AutoFor/PowerPlatformFlowBuilder`：`tools/powerApps/{spec,validate,generate,repair,catalog,measured}.ts` の設計（計測と判断を分ける、厳格さを型ごとに上げる、直さないルール）、`wiki/仕組み.md`、`wiki/検証の層.md`
- `AutoFor/uipath-xaml-visualizer`：`packages/shared/parser/xaml-parser.ts`（実例コーパスの読み取り）
- `uip rpa activities get-default-xaml` / `uip rpa build` / `uip rpa packages inspect`（カタログの裏取りと最終確認）

## 参考：Egonex-AI/Understand-Anything

PowerPlatformFlowBuilder の出発点になったリポジトリ（Linear AUT-279「PowerAppsのYamlのビルダーをつくりたい。」に記載）。スター約8.9万、MIT、TypeScript。コードを `.ua/knowledge-graph.json` という中間表現にして、それをダッシュボードやチャットで使う Claude Code プラグイン。

借りる考え方：

| Understand-Anything | このプロジェクトでの置き換え |
| --- | --- |
| Tree-sitter で構造の事実を決定的に取る。LLM は要約や分類など意味の部分だけ | DLL リフレクションと実例 XAML の解析で型の事実を取る（①カタログ）。AI は IR を書くだけ（②） |
| 中間表現は JSON 1つ。表示やチャットはすべてそこから | IR JSON 1つから XAML / .cs を生成する（③） |
| `graph-reviewer` が参照の整合性を機械で確認。LLM レビューは `--review` のときだけ | validate はカタログで機械的に行う。AI に直させるのは build エラーの修復だけ |
| フィンガープリントで変わったファイルだけ再解析 | カタログはパッケージのバージョンごとに1回だけ作る。IR も変わったワークフローだけ再生成 |

取り込みの判断：

- **コードはそのまま取り込まない**。対象がコードの理解（グラフ化）で、こちらは生成なので、重なるのは設計の考え方だけ。XAML 向けの Tree-sitter 文法もない
- 既存の UiPath リポジトリの全体像をつかむ目的なら、プラグインとして別途使える（.cs の Coded Workflow は解析できる見込み、.xaml は未確認）。必要になったら試す

## Verification

- PoC：同じアクティビティで、カタログのプロパティ一覧が `get-default-xaml` の出力と `<Activity>.md` の内容を包含しているか機械で照合する
- E2E：IR を3本（Excel 読み → ループ → ログ、UI 操作1つ、InvokeWorkflow）用意し、`gen` → `uip rpa build` が無修正で通るかを確かめる。1本あたりの所要時間と `uip` の呼び出し回数を、今のスキル経由と比べる
