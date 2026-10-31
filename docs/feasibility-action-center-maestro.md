# Action Center と Maestro の生成器を作れるか

調査のイシュー：AUT-1071。環境：`uip` 1.204.0、Studio 26.10、`UiPath.Persistence.Activities` 1.13.0、`@uipath/maestro-builder-sdk` 6.66.5。

## 結論

**どれも生成はできる。ただし、確かめたのはローカルの検証までで、実際に動かしたものは1つもない。**

| 対象 | 作れるか | 確かめた範囲 | 作り方 |
| --- | --- | --- | --- |
| Action Center（XAML） | 作れる。今の仕組みにほぼそのまま載る | `uip rpa build` | カタログと型を足す。C# は作れない（Coded API なし） |
| BPMN | 作れる | `check`、`compile`、`format`、`validate`、`pack` | XAML の IR は使わない。公式 SDK を使う |
| Flow | 作れる | `check`、`compile`、`validate`、`pack` | 同上 |
| Case | 骨組みは作れる。人のタスクは中身が未解決 | `check`、`compile`、`validate --strict` | 同上。工程の並びでないので、形が別 |

**いちばん大きな発見は、Maestro には公式の生成の道具（`@uipath/maestro-builder-sdk`）がすでにあること**。TypeScript で書いて `compile` すると `.flow` / `.bpmn` / `caseplan.json` ができる。独自の出力器を作る理由は薄い。

おすすめは、Action Center を先に進め、Maestro は SDK の上に検証の窓口だけを作ること（最後の節）。

**その後**：検証の窓口は `tools/maestro/verify.mjs`（[docs/maestro-verify.md](maestro-verify.md)）。独自の IR は作らないと決めた（[docs/maestro-ir-vs-sdk.md](maestro-ir-vs-sdk.md)）。テナントの資源は [docs/maestro-tenant-resources.md](maestro-tenant-resources.md)。

## 1. Action Center

### パッケージ

- パッケージは `UiPath.Persistence.Activities`。この PC の NuGet キャッシュには無く、UiPath の公開フィード（`UiPath-Official`）にある（最新 1.13.0）。`uip rpa packages install` で作業用プロジェクトに入った
- README の他のパッケージと違い、`*.runtime` のパッケージは無い。DLL は本体の `lib/net6.0-windows7.0/`
- `net6.0-windows7.0` の `UiPath.Persistence.Activities.dll` を `tools/catalog-extractor` で読んで、**修正なしで 20 アクティビティ、239 プロパティ、警告 0 件**のカタログになった（`catalog/UiPath.Persistence.Activities/1.13.0.json`）
- **Coded API は無い**：抽出器で services 0 件。`--follow-returns` でも handles と extensions は 0 件。対応表は `"coded": null` にした

### IR に載るか

変えたのは、生成器が読むカタログの一覧に1行（`gen.ts`、`gen-coded.ts`、`samples.test.ts`、`coverage.ts`）と、`types-xaml.ts` の型2つ（`FormTaskData`、`ExternalTaskData`）だけ。既存のテストは全部通る（587件）。既存のスナップショットは変わらない。

サンプル（`samples/ir/UiPath.Persistence.Activities/`）の `verify.mjs --build-only` の結果：

| サンプル | 中身 | XAML の build |
| --- | --- | --- |
| `CreateFormTask.min` | フォームタスクを作る | OK |
| `CreateFormTask.layout` | `FormLayout` に JSON を入れる | OK（中身は未検査。下記） |
| `FormTaskApproval.full` | 作成 → 待機 → `TaskAction` で分岐。`FormData` に In と Out | OK |
| `CreateExternalTask.min` | 外部タスクの作成と待機 | OK |
| `ResumeAfterDelay.min` | 時刻まで中断 | OK |

C# は、どれも `NO_CODED_API` で作らない（設計どおり）。

239 プロパティのうち、今の IR で書けないのは 18 件：`AssignmentCriteria`、`ReassignCriteria`（型 `Criteria`）、`FormLayoutGuid`、`BulkFormLayoutGuid`（Guid）、`TimerDays`、`TimerHours`（Byte）、`BindingsKey`、`CreateUserAction` の App タスク用の5件など。担当者は `UserNameOrEmail` と `Group` で書けるので、フォームタスクの基本には困らない。

### 特別なこと（実機で分かったこと）

1. **Wait 系と `ResumeAfterDelay` のファイルは、エントリポイントでないと build が落ちる**（`ST-DBP-024`）。`*.verify.json` の `"entryPoint": true` で通った
2. **`WaitForFormTaskAndResume` / `WaitForExternalTaskAndResume` が別々のファイルにあると、build が落ちる**（AUT-1074）。`Internal constraint exception ... An item with the same key has already been added. Key: System.Activities.Statements.Sequence`

   | 組み合わせ | 結果 |
   | --- | --- |
   | 別ファイルに Form と External | 失敗（8回とも） |
   | 別ファイルに Form と Form | 失敗（2回とも） |
   | 1ファイルに Form と Form、Form と External | 通る（2回ずつ） |
   | Wait 1つのファイルと、`ResumeAfterDelay` のファイルと、作成だけのファイル | 通る（3回とも） |
   | 別ファイルに Form と External を 1.12.0 で | 失敗（1回。エラー文までは確認していない） |
   | 別ファイルに Form と External を `--skip-analyze` で | 通る（1回） |

   実際の案件でも起きうるので、先に切り分ける。原因は分かっていない。**今は Wait を含むサンプルを、1つずつ `verify.mjs` に渡す必要がある**
3. **`project.json` の `supportsPersistence`**：作業用プロジェクト `C:\Users\Public\uipath-ir-probe-feas-ac` で `true` にした。uipath-rpa スキルの文書によると build には影響せず、実行時の中断に要る（未確認）
4. **フォームのスキーマ**：`GenerateInputFields`（既定 `True`）なら `FormData` からフォームが作られる（文書による。画面は未確認）。`FormLayout` は文字列の JSON で、**build は中身を見ない**。サンプルの form.io 形式の JSON は推測で書いたもので、画面に出るかは分からない。信頼できるスキーマは見つけていない

### 試していないもの

run（Orchestrator と Action Center が要る）、実際の中断と再開、フォームの表示、シリアライズできない変数の扱い、20 アクティビティのうちサンプルを書いていない 15 件、`compare-default-xaml` との突き合わせ（既定 XAML は5件を見ただけで、保存していない）。

## 2. Maestro

### 今の IR は流用できない

XAML の IR は Sequence の木で、式は VB、部品は DLL の型。Maestro は別物なので、出力先を足す形にはならない。

| | XAML の IR | BPMN / Flow | Case |
| --- | --- | --- | --- |
| 構造 | 入れ子の木 | ノードと線のグラフ | ステージと、開始・終了の条件 |
| 式 | VB | JavaScript（`=js:$vars.x` / `=vars.x`） | JavaScript（`=vars.x`） |
| 部品の情報源 | DLL のカタログ | `uip maestro ... registry`（テナントの資源も入る） | 同左 |
| 図 | 無くてよい | BPMN は必須（`format` が作る） | レイアウトは任意 |

流用できるのは「AI は小さな入力だけを書き、機械が生成して検証する」という考え方。

### 検証の材料

実際に動いたもの（ローカル。`registry pull` はテナントを読むだけ）：

- **`validate`**：3形式とも使える。わざと壊した例を弾いた（線の先が無い、ラベルが空、終了イベントが無い、変数名の間違い、ステージが無い）
- **`check`（SDK）**：`validate` より手前で、意味の間違いを弾く。`$vars.review.status` は `flow validate` を通るが、`flow check` は `HITL_READ_STATUS` で止めた。**`validate` だけでは足りない**
- **レジストリ**：BPMN は拡張の型 35、Flow はノード 4136（テナントのコネクタを含む）。`registry get` でスキーマや XML の雛形が取れる
- **`pack`**：Flow と BPMN は `.nupkg` までできた（Case は未実施）
- **`decompile`**：既存のファイルを SDK のソースに戻せる（`init` の雛形で確認）

### 試作

`tools/maestro/gen.ts` は、1つの JSON（`samples/maestro/*.json`）から Flow と BPMN の SDK のソースを作る。`tools/maestro/check.mjs` が通しで検証する。全ステップ OK。

| 生成物 | 通した検証 | 中身 |
| --- | --- | --- |
| `Minimal.flow`、`ExpenseApproval.flow` | `check`、`compile`、`validate` | 人の承認（QuickForm）→ 分岐 → script |
| `Minimal.bpmn`、`ExpenseApproval.bpmn` | `check`、`compile`、`format`、`validate` | 同上 |
| `Minimal.direct.bpmn` | `format`、`validate` | **SDK なしで XML を直接書いたもの**（script だけ） |
| `ExpenseCase.json` | `check`、`compile`、`validate --strict` | 1ステージ、人のタスク1つ。ソースは手書き（`samples/maestro/ExpenseCase.case.ts`） |

試して分かったこと：

- **Flow と BPMN は1つの JSON から作れるが、式は共通にならない**。script の本文は両方書く形にした。人の判断の読み方も違う（Flow は `$vars.review.output.Action`、BPMN は `=Action` を変数に写す）
- `compile` した BPMN には図が無く、そのままだと `validate` が `No diagrams found` で落ちる。`format` が要る
- 直接書く場合は、Flow の `definitions` と `variables.nodes` の再生成がいる。SDK なら勝手に入る（`ExpenseApproval.flow` は 25KB、元のソースは 717 バイト）
- **BPMN の warning が2つ残る**：`VARIABLE_NOT_SET`（`amount`）、`unknown attribute <type>`。害があるかは分からない
- **Case の `action` は、アプリもフォームも無いまま `validate --strict` を通る**（warning `STRICT_BINDINGS_ABSENT`）。動くとは言えない。SDK の `action()` にはフォームの指定が無く、QuickForm の書き方は未解決（AUT-1079）

### 注意

- SDK の README は「CLI のプレリリースが要る」と書いている。`uip` 1.204.0 では動いたが、変わる可能性がある。バージョンは固定した（`tools/maestro/package.json`、`npm install --ignore-scripts`）
- SDK の文書によると、BPMN の QuickForm はテナントの `ShouldUseHitlQuickFormSchema` が有効なときだけ動く（未確認）
- SDK の文書にあるオフライン実行（`flow-debug --mock --hitl-response`）のコマンドは、このパッケージに入っていなかった。試せていない

### 試していないもの

Studio Web で開くこと、`debug` と実行、コネクタ・RPA・エージェント・Action App など**テナントの資源を指すノード**（ここが実務の中心）、ループや並列、イベント、エラー処理、Case の SLA と複数ステージ。

## 3. 必要な作業量

実測ではなく見込み。ワーカー1人が1バッチでこなす量で数えた。

| イシュー | 内容 | 見込み |
| --- | --- | --- |
| AUT-1074 | Wait が複数ファイルで落ちる問題 | 小（原因次第で伸びる） |
| AUT-1072 | Persistence の残りのサンプルと対応表 | 小 |
| AUT-1073 | 書けないプロパティ | 小〜中 |
| AUT-1075 | 永続化のルールを IR の検証で弾く | 小 |
| AUT-1076 | テナントでの run | 中（了承が要る） |
| AUT-1077 | Maestro の検証の窓口 | 小 |
| AUT-1078 | 独自 IR か SDK の直書きか | 小（判断） |
| AUT-1079 | テナントの資源を指すノード | 中〜大 |
| AUT-1080 | Studio Web と debug | 中（了承が要る） |

## 4. おすすめの進め方

1. **Action Center を先に**。今の仕組みに載るので、AUT-1074 → AUT-1072 → AUT-1075 → AUT-1073 の順。AUT-1076 で一度実機に当て、フォームの形を確かめる
2. **Maestro は独自の出力器を作らない**。SDK の上に AUT-1077 を作る。SDK が使えなくなったときの逃げ道として、直接生成も可能なことは確かめた
3. **Maestro の独自 IR は、まだ作らない**。AUT-1078 で比べて決める。SDK のソースがすでに小さく型付きで、JSON を挟む利点は今のところ見えていない。試作の `gen.ts` は調査用で、そのまま育てる前提にしない
4. **テナントの資源（AUT-1079）と実機（AUT-1080）は早めに一度当てる**。ローカルの検証が通っても動くとは限らないので、Flow の小さな例で先に確かめるのがよい

## 再現のしかた

```bash
# Action Center。作業用プロジェクトに依存を足してから（テンプレートには入れていない）
uip rpa packages install --packages '[{"id":"UiPath.Persistence.Activities","version":"1.13.0"}]' --project-dir 'C:\Users\Public\uipath-ir-probe-feas-ac' --output json
node tools/verify/verify.mjs --name feas-ac --build-only samples/ir/UiPath.Persistence.Activities/FormTaskApproval.full.json

# Maestro
cd tools/maestro && npm install --ignore-scripts && cd ../..
node tools/maestro/check.mjs
```
