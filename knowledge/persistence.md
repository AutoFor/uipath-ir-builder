# 永続化（UiPath.Persistence.Activities 1.13.0）で分かったこと

環境：Studio 26.10、`uip rpa build`。テナントで動かした結果は次の節（AUT-1076）。それ以外の節は build までの話。

## テナントで動かして分かったこと（AUT-1076）

2026-11-01、`autofor/DefaultTenant`、個人用ワークスペース、`--runtime-type Development`（この PC のロボット）。タスクはどれも API（`uip tasks assign` → `uip tasks complete`）で完了した。**人が画面で完了したものは無い。**

| 確かめたこと | 結果 | 根拠のジョブ |
| --- | --- | --- |
| `GenerateInputFields: true` だけ（`FormLayout` なし） | **実行時に落ちる**。「引数 'フォーム レイアウト' の値が設定されていないか無効です」。build は通る。文書の「FormData からフォームが作られる」は実行時には成り立たない（Studio の画面が設計時に作るものと推定） | `f175cbf7-071b-4d9a-b18c-62ab597e7e81` |
| `FormLayout` を入れたときのタスク作成 | 作れる。`FormLayoutId` が付き、`Data` に In と InOut の値が入る | `3c5201f0-04e2-4988-8485-9d3a8cfa2168` |
| 中断と再開 | 動く。Suspended → タスク完了 → 再開 → Successful | 同上、`2eabc575-f600-4ea3-973a-ec476fdade82` |
| `FormData` の Out、InOut の戻り | 変数に戻る（`comment=API 完了`、`note=note-changed`） | `3c5201f0` |
| `TaskAction` の値 | **ボタンの `key`**（`label` ではない）。`key: "approve"` なら `approve`。`Approve` で完了しようとすると「Provided form action does not match any button」 | `3c5201f0`、`2eabc575`（reject） |
| `action: "event"` のボタンでの完了 | `key` で完了できる（`event` の値は試していない） | `9cd06a40-427d-4062-8761-14d865168817` |
| 再開後の変数 | wait の前に入れた変数、In 引数とも残る。`task` は `Status=Completed` と `Action` と `Data` が入って戻る | `3c5201f0` |
| `FormTaskApproval.full`（直したもの）で分岐 | `承認: ok` が出た | `67cd1cbf-bd40-4cd1-b92c-0828bad4978e` |
| 無いタスクカタログ（`TaskCatalog`） | **落ちる**。「No task catalog exists with name ... Error code: 2451」。build は通る | `8a88e19c-94b8-49b7-971d-9c842d52eaf0` |
| **`FormLayout` の画面** | **形で決まる**。文字列が配列なら出る。オブジェクトなら本文が空になる（次の節） | タスク 100227750（出る）、100227641、100227660、100227691（空） |

### FormLayout は配列で書く。オブジェクトだと画面が空になる

**文字列を JSON の配列（`[{...},{...}]`）にする。** `{"components":[...]}` や `{"display":"form","components":[...]}` は、タスクは作れて API でも完了できるが、画面の本文が空になる。

サーバーは渡した JSON を `components` に丸ごと入れて保存する（`uip tasks get` の表示。キーの先頭を大文字にして出す）。

| 渡した文字列 | 保存された形 | 画面 | 根拠（タスク） |
| --- | --- | --- | --- |
| `[...]` | `{Components:[...],Version:1}` | 出る。値も入る | 100227750（部品の入ったコンテナ `columns` でも出る：別のフォルダの 100221082） |
| `{"components":[...]}` | `{Components:{Components:[...]},Version:1}` | 空。下のエラー | 100227660、100227691 |
| `{"display":"form","components":[...]}` | `{Components:{Display:"form",Components:[...]},Version:1}` | 空。同じエラー | 100217692（削除済みのタスク。`display` では直らない） |

エラー `(this.hook(...) || []).forEach is not a function` は form.io のもの。`NestedComponent.addComponents` が `this.hook('addComponents', this.componentComponents, this) || []` に `forEach` する（公開パッケージ `formiojs` 4.14.13 のソースで確認。Action Center に入っている版は未確認）。`componentComponents` は `component.components` で、ここが配列でなくオブジェクトだと落ちる。スタックは `setForm` → `createRenderer` → `new Webform` → `set form`。

**`FormLayoutGuid` が同じだと、新しい `FormLayout` は使われない。** サーバーは最初に登録したレイアウトを使い続ける。パッケージ 1.0.1 から 1.0.3 は `FormLayoutGuid` が同じ（`1ab6e056-...`）で、1.0.3 の XAML は配列に `action: "event"` のボタンなのに、そのタスク 100227691 の保存された形は 1.0.1 のオブジェクトと `action: "submit"` のまま（どれも `FormLayoutId` 100000211）。生成器の GUID はワークフロー名と通し番号から作るので、**レイアウトを変えて再 publish しても効かない**。形を試すときは、ワークフロー名を変える（見本 `FormTaskLayoutShapes.full`）。以前の「配列でも `action: "event"` でも空」という記録は、これで前の形を見ていただけで、誤り。

- API で完了するには、`FormTask` は先に割り当てが要る（無いと「This action is no longer assigned to you」）。`QuickFormTask` は要らなかった
- 部品は `{type,key,label,input,disabled}`、ボタンは `{type,key,label,action:"event",event,theme,input,tableView}`
- 未確認：**保留中のタスクを人が画面で入力して完了し、ワークフローが再開すること**。画面で見たのは完了済みのタスクだけ
- `Data` のキーは `FormData` の名前のまま（`InvoiceNo`）。Out の値は完了時の `--data` のキーで渡す

足してよさそうな検証（未実装）：`CreateFormTask` に `FormLayout` が無いと実行時に落ちる。`FormLayoutGuid` で渡す場合は試していない。シリアライズできない変数と `ForEach` の中の中断は、今回も試していない。

### 手順

```bash
# 作業用プロジェクトを先に作る。パッケージ名を決めるのは project.uiproj の Name（project.json の name も合わせる）。依存と supportsPersistence もここで
# Helm が名前を覚えるので、名前を変えるときは --name も変える
node tools/verify/queue-run.mjs --name <作業名> --build-only --no-coded --pack out/tenant/nupkg --pack-version 1.0.0 <ir.json>   # Wait は1ファイルずつ
uip or packages upload <nupkg> --folder-key <個人用ワークスペース>
# 個人用ワークスペースでは、アップロードで Main.xaml を指すプロセスが自動でできる。別のエントリポイントはプロセスを別に作る
uip or processes create --name <名前> --package-key <id> --package-version 1.0.0 --entry-point <xaml> --folder-key <個人用ワークスペース>
uip or jobs start <プロセスのキー> --folder-key <個人用ワークスペース> --runtime-type Development --input-arguments '{...}'
```

## Wait が別々のファイルにあると build が落ちる（AUT-1074）

`Internal constraint exception ... against activity of type ...WaitFor...AndResume ... An item with the same key has already been added. Key: ...`

| build の組み合わせ（どれもエントリポイント） | 結果 |
| --- | --- |
| 別ファイルに Form と Form | 失敗（Key: Sequence） |
| 別ファイルに Form と、If の中の Form | 失敗（Key: **DynamicActivity**） |
| 別ファイルに Form と Job、Job と Queue | 失敗 |
| 1ファイルに Wait を2つ（片方は入れ子の Sequence の中） | 通る |
| 1ファイルだけのプロジェクトを、同じ作業用プロジェクトで続けて build（Wait 入りで13回） | 通る |

スタックは `ActivityValidationServices.RunConstraints` → `WorkflowInvoker.Invoke` までで、中の場所は出ない。

**分かっていること**：IR と生成器の問題ではない。Wait に付いた制約（`Constraint<Activity>`）の中の例外で、パッケージか Studio の実装側にある。キーの型は毎回同じではない（Sequence、DynamicActivity）。

**推定（確かめていない）**：DLL に `HasNoPersistenceScopeCache`、`GetParentChain`、`NoPersistenceScopeConstraint` という名前があるので、親の型をキーにしたキャッシュに、ファイルごとの検証が同時に書いてぶつかっている。1ファイルずつの build で落ちないことと合う。逆コンパイルは権限で止められたので、コードは読んでいない。Studio の画面で同じことが起きるかも未確認。

**こちらでは直せない**ので、次のように回避する。

- **サンプル**：`*.verify.json` の `"buildAlone": true` で、`verify.mjs --build-only` がそのファイルだけを置いて別に build する。Wait のサンプルをまとめて渡してよい
- **実案件**：Wait を1つのエントリポイントのファイルにまとめる（ST-DBP-024 があるので、呼び出し先には置けない）。複数のファイルに分ける必要があるなら、`--skip-analyze` で通るという記録はある（調査の文書。1回だけ）が、分析全部が止まるので勧めない

## build で確かめた置き場所のルール

| 置き場所 | 結果 | 検証 |
| --- | --- | --- |
| エントリポイントでないファイル（Wait、`ResumeAfterDelay`） | 失敗 `ST-DBP-024` | IR にはエントリポイントの情報が無い。サンプルは `samples.test.ts` が `entryPoint: true` を求める |
| `NoPersistScope`、`NApplicationCard`、`OpenBrowser`、`WindowScope` の中の Wait（間に Sequence や If があっても） | 失敗 `Cannot place activity under scope` | `PERSIST_IN_NO_PERSIST_SCOPE`（`tools/ir/persistence.ts`） |
| `NoPersistScope` の中の `ResumeAfterDelay` | 通る | 弾かない |
| `TryCatch`、`Parallel`、`ForEach`、`ParallelForEach`、`RetryScope`、`ExcelApplicationCard`、`ExcelApplicationScope`、`ExcelProcessScopeX` の中の Wait | 通る | 弾かない |

UI のほかのスコープ（`BrowserScope`、`OpenApplication`、`ElementScope` など）は試していない。

## 検証に入れていないルール

どちらも build では分からない。AUT-1076 でも試していないので、弾くと正しいものまで止める恐れがある。

- **シリアライズできない変数**：`UiElement`、`SecureString`、`Browser` を Wait のスコープに置いても build は通る。文書の [ST-DBP-025](https://docs.uipath.com/studio/standalone/2024.10/user-guide/st-dbp-025) は検査すると書くが、build のログには出ない。ページに型の一覧も無い
- **`ForEach` の中の中断**：文書には本体に置かないとあるが（[Orchestration Process](https://docs.uipath.com/studio/standalone/2023.4/user-guide/orchestration-process)）、build は通る

## フォーム

`FormLayout` は文字列で、build は中身を見ない。書き方は上の節（配列で書く）。`CreateFormTask.layout` の JSON は調査のときの推測のまま（`verify.json` に明記）。

## 書けないプロパティ（AUT-1073）

足したもの：`System.Byte`、`System.Guid`（属性）、`Criteria`（`objs`。`*.objects.json`）。

`Criteria` は既定 XAML に出た `Id="SingleUser"` の形しかサンプルに書いていない。DLL の文字列に `AllUsers`、`RoundRobin`、`Workload` があるが、`Id` の正しい値か確かめられない。build は値を見ない。

既定 XAML は `AssignmentCriteria="{x:Reference __ReferenceID0}"` を出すが、生成器はこの属性を既定値に使わない（参照先の要素が無いと壊れる）。省いたときに実行時に動くかは未確認。

残り（`CreateUserAction`）：

| プロパティ | 理由 |
| --- | --- |
| `AppActionPropertiesMetadata`、`CurrentAppTaskState`、`State` | 画面に出ない内部の状態（browsable=false）。Studio がアプリのスキーマから作るらしく、既定 XAML は空。中身の形を確かめられない |
| `TaskFieldsForDesktop` | `String[]` の素のプロパティ。既定は `{x:Null}` で形の手がかりが無い。Web 用の `TaskFieldsForWeb` は式で書ける |

## build で分かった制約（サンプルを書くときの注意）

- `ConfigureTaskTimer`：時間は 15〜129600 分（`TimerDays` / `TimerHours` / `TimerMinutes` か `TimerDuration`）。`EndCriteria: TaskAssigned` の `Outcome` は `Reassign` か `AutoComplete` だけ。既定の組み合わせ（`TaskAssigned` と `Notify`）は通らない
- `AssignTasks`：`EnableMultipleAssignments` が false なら `UserId` か `UserNameOrEmail` が要る（`Group` だけでは通らない）
- `BindingsKey`（`AddQueueItemAndGetReference`、`StartJobAndGetReference`）、`AppBindingsKey`、`CatalogBindingsKey`：setter が無く `Cannot set unknown member`。カタログを今の抽出器で作り直して `readOnly` にした
- サンプルの `Id`、タスクのカタログ名、`SolutionApp` などの値は置き物で、テナントに実物は無い
