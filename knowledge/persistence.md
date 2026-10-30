# 永続化（UiPath.Persistence.Activities 1.13.0）で分かったこと

環境：Studio 26.10、`uip rpa build`。**確かめたのは build まで。run（テナント）は AUT-1076 で了承待ちなので、実際の中断と再開は1つも確かめていない。**

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

どちらも build では分からず、run も無いので、弾くと正しいものまで止める恐れがある。AUT-1076 で確かめてから足す。

- **シリアライズできない変数**：`UiElement`、`SecureString`、`Browser` を Wait のスコープに置いても build は通る。文書の [ST-DBP-025](https://docs.uipath.com/studio/standalone/2024.10/user-guide/st-dbp-025) は検査すると書くが、build のログには出ない。ページに型の一覧も無い
- **`ForEach` の中の中断**：文書には本体に置かないとあるが（[Orchestration Process](https://docs.uipath.com/studio/standalone/2023.4/user-guide/orchestration-process)）、build は通る

## フォーム

`FormLayout` は文字列で、build は中身を見ない。**形を確かめる手段が無いので、JSON を推測で足さない**。`CreateFormTask.layout` の JSON は調査のときの推測のまま（`verify.json` に明記）。

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
