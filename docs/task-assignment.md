# 人のタスクの割り当て

イシュー：AUT-1090。2026-11-02 時点。`UiPath.Persistence.Activities` 1.13.0、`@uipath/maestro-builder-sdk` 6.66.5、`uip` 1.204.0。

**テナントへの書き込みはしていない。** 「読んだ」はテナントの読み取りか DLL・SDK・文書の読み取りで、**指定した人に実際に割り当たることは、どの形式でもまだ確かめていない**。確かめる手順は最後の節。

## Action Center の割り当ての仕組み

### 割り当て条件（4種類）

| 条件（`Id`） | 動き（文書） | 相手 | 制限（文書） |
| --- | --- | --- | --- |
| `SingleUser` | 1人に割り当てる | ユーザー名かメール | |
| `AllUsers` | グループの全員に同じタスク。1人が完了すると、ほかの人の保留中から消える | グループ | ローカルと Azure AD。AD の入れ子のメンバーも含む |
| `Workload` | 保留中が最も少ない人に割り当てる。`AllUsers` のタスクは数えない | グループ | ローカルのグループだけ。先頭の 1000 人 |
| `RoundRobin` | 順番に割り当てる。この条件のタスクだけを数える | グループ | ローカルのグループだけ |

グループは、グループか全メンバーに、フォルダの Actions の View と Edit が要る（文書）。

### 割り当ての方法

| 方法 | ユーザー | グループの条件 | 根拠 |
| --- | --- | --- | --- |
| 作るときに指定（`CreateFormTask` などの `UserNameOrEmail`、`Group`、`AssignmentCriteria`） | ○ | ○ | カタログ、既定 XAML。文書の `CreateFormTask` のページには作成時の割り当ての欄の説明が無い |
| 作った後に `AssignTasks` | ○ | ○ | 文書（条件の4種類はこのページにある） |
| タイマーの超過で再割り当て（`ReassignUser`、`ReassignGroup`、`ReassignCriteria`） | ○ | ○ | 文書。再割り当ての後、タイマーは消える |
| 画面：自分に割り当て、管理者の割り当て・再割り当て・解除、転送（Form のみ）、一括 | ○ | × | 文書 |
| `uip tasks assign` / `reassign` / `unassign` | ○（`--user`、`--user-id`） | × | `--help` と Skill |
| Orchestrator API `POST /odata/Tasks/UiPath.Server.Configuration.OData.AssignTasks` | ○（`TaskId` と `UserId`） | 文書に無い | 文書。DLL の API クライアントには `AssignmentCriteria` と `AssigneeNamesOrEmails` の名前があるが、API の形は試していない |

### 無いもの

- **タスクカタログの既定の割り当て先**：文書に無い。`uip tasks catalogs create` の項目も名前、説明、暗号化、保持だけ。カタログは分類と保持の設定で、割り当てには使えない（無いことを確かめたのではなく、見つからなかった）
- **自動割り当てのルール**：文書に単独のルールの説明が無い。自動で振り分けるのは `Workload` と `RoundRobin` だけ

### 読み取りで見た値

`uip tasks list` の 29 件は、種類（Form、AppTask、QuickForm、DocumentValidation）にかかわらず、全部 `TaskAssignmentCriteria: "SingleUser"`。

| タスク | 状態 | `TaskAssignmentCriteria` | `TaskAssignees` |
| --- | --- | --- | --- |
| 100230027（FormTask） | Unassigned | `SingleUser` | `[]` |
| 100234674（AppTask） | Unassigned | `SingleUser` | `[]` |
| 100217692（FormTask） | Pending（API で割り当て済み） | `SingleUser` | `[]` |

**指定が無いと `Unassigned` で作られ、条件はサーバーの既定 `SingleUser` になる。** グループの条件のタスクはテナントに無かったので、`TaskAssignees` に何が入るかは見ていない。

### API クライアントのエラー名（意味は名前からの推定）

DLL の文字列にある：`GroupNotAllowedForSingleUserAssignment`、`WorkloadRoundRobinNotAllowedForAdGroups`、`MultipleUsersOnlySupportedForWorkloadAssignment`、`WorkloadEmailAssignmentTooManyUsers`、`AssignmentCriteriaNotSupported`、`TaskAssigneeNotPermitted`、`GroupAssignmentActionNotPermitted`、`MultipleGroupAssignmentNotEnabled`。

**`SingleUser` と `Group` を一緒に書くと、実行時に落ちる疑いがある**（`GroupNotAllowedForSingleUserAssignment` からの推定）。既存のサンプル `CreateFormTask.timer`、`CreateExternalTask.full`、`AssignTasks.full` はこの形で、build 用の置き物。真似しない。

## 生成器との対応

| 機能 | XAML | Coded | Flow | BPMN | Case |
| --- | --- | --- | --- | --- | --- |
| ユーザー | ○ | × | ○ | ○（後処理） | ○ |
| グループの全員 | ○ | × | ○ | ○（後処理） | ○（後処理） |
| Workload / RoundRobin | ○ | × | ○ | ○（後処理） | ○（後処理） |
| 実行時に決める | 式で書く | × | `custom` | × | `{ type: 3 }`（Skill。未検証） |
| 作った後の割り当て | `AssignTasks` | × | × | × | × |
| タイマーで再割り当て | `Reassign*` | × | × | × | × |

### XAML（IR）

```json
{ "act": "CreateFormTask",
  "props": { "UserNameOrEmail": { "lit": "user@example.com" }, "...": "..." },
  "objs": { "AssignmentCriteria": { "Id": { "lit": "SingleUser" }, "Name": { "lit": "Activity_AssignTasks_AssignmentCriteria_SingleUserName" }, "Description": { "lit": "SingleUserDescription" } } } }
```

グループは `UserNameOrEmail` の代わりに `"Group": { "lit": "Reviewers" }`。`Id`、`Name`、`Description` は次の組で、`<Id>` を入れ替えるだけ。`Id` だけでも build は通るが、Studio の表示のため3つとも書く。

`"Id": "<Id>"`、`"Name": "Activity_AssignTasks_AssignmentCriteria_<Id>Name"`、`"Description": "<Id>Description"`（DLL のユーザー文字列で4種類とも確かめた）。`Id` は `SingleUser` / `AllUsers` / `RoundRobin` / `Workload`。

- 対象は `CreateFormTask`、`CreateUserAction`、`CreateExternalTask`、`AssignTasks`。サンプルは `CreateFormTask.assign-user`、`.assign-group`、`.assign-distribute`、`CreateUserAction.assign`、`AssignTasks.group`、`FormTaskAssign.full`（引数 `in_Assignee`）
- **build は組み合わせを見ない**：`RoundRobin` でグループなし、`SingleUser` で誰もなし、無い `Id`、`AllUsers` でユーザーだけ、`AssignmentCriteria` なしのユーザーやグループ、どれも build は通った。検証は、リテラルの `Id` が4種類のどれかだけを見る（`ASSIGNMENT_CRITERIA_ID`）。組み合わせは、実行で確かめるまで弾かない
- `AssignmentCriteria` を書かずに `UserNameOrEmail` だけを書いて実行時に効くかは未確認。書いておく

### Coded

**書けない（`coded: null`）。** 1.13.0 の DLL に Coded のサービスが無く（抽出器で services 0 件）、`UiPath.System.Activities` のサービスにもタスクと割り当てのメソッドが無い。対応表はそのまま。

代わり：XAML の `CreateFormTask` を `RunWorkflow` で呼ぶ（中断のアクティビティはエントリポイントにしか置けないので、待つところは別に考える）、または Orchestrator API を HTTP で呼ぶ。どちらも試していない。

### Flow

`hitl({ recipient: { channels: ["ActionCenter"], assignee: { type, value } } })`。Action App と QuickForm で同じ。`type` は `user`、`group`、`staticEmail`、`staticGroupName`、`workload`、`roundRobin`、`custom`（`value` が式）。

SDK の文書：`value` が無いと種類にかかわらず未割り当て。`user` と `staticEmail` で `value` が無いと `HITL_RECIPIENT_NO_USER`。

### BPMN

**SDK の `humanTask` に `recipient` が無い**（`HumanTaskCommonOpts` など）。compile と format の後に足す。

```bash
# Action App は先に bpmn-app-task.mjs で v2 にする
node tools/maestro/task-assign.mjs <ファイル.bpmn> <要素の id> user user@example.com
```

`Actions.HITL` v2 の `uipath:context` に、`assignmentCriteria` と `recipient`（`{"Value":...,"Type":...}`）を足す。形は、製品の Flow → BPMN の変換（`uip` の maestro-tool の `applyHitlExtension`）と同じ：

| Flow の `type` | `assignmentCriteria` | `recipient.Type` |
| --- | --- | --- |
| `user`、`staticEmail` | `SingleUser` | 2 |
| `group`、`staticGroupName` | `AllUsers` | 1 |
| `workload` | `Workload` | 1 |
| `roundRobin` | `RoundRobin` | 1 |

`validate` と `format` は通すことを確かめた（テスト）。実行は未確認。

### Case

`.action({ recipient: "user@example.com" })` は `{ Type: 2, Value }` になる。グループの `{ type: 1, value }` も書けるが、**SDK は Type が何でも `assignmentCriteria` を `"user"` にする**（`serialize.js`）。SDK の型のコメントは `0/1/3` を予約と言い、Skill は「グループでは `assignmentCriteria` を省く」と言い、Flow の変換は `AllUsers` と書く。3つが違うので、どれが動くかは実行で確かめる。

```bash
node tools/maestro/task-assign.mjs <caseplan.json> <タスクの displayName> group Reviewers
```

今は Flow の変換に合わせて `AllUsers` に書き換える（**推定**）。ユーザーは SDK の `"user"` のまま。

## 指定が無いときの扱い

**止めない。未割り当てのまま作る。**

| 場所 | 扱い | 理由 |
| --- | --- | --- |
| IR の検証（`tools/ir/validate.ts`） | 何も出さず、この文書に書く | 検証に warning の仕組みが無い（全部 error）。`FormTaskTenantCheck` など既存の IR を壊さない |
| Maestro の窓口（`tools/maestro/verify.mjs`） | warning `TASK_UNASSIGNED`（工程 `assign`） | warning の仕組みがある。通常は OK のまま。`--strict` では NG になる |

未割り当ては動く（`Unassigned` で作られ、人が拾うか割り当てるのを待つ）。ただし API で完了するには先に割り当てが要る（`FormTask`。knowledge/persistence.md）。

## テナントで確かめる手順

今回は流していない。書き込みの許可をもらってから。割り当て先は実在の人とグループに替える（**見本の `user@example.com` と `Reviewers` はテナントに無い**）。確かめることは、どれも `uip tasks get <id>` の `Status`、`AssignedToUser`、`TaskAssignmentCriteria`、`TaskAssignees`。

1. **XAML**：`FormTaskAssign.full` を pack して個人用ワークスペースにアップロードし、`--input-arguments '{"in_Assignee":"<メール>"}'` で起動する（手順は knowledge/persistence.md）。`Pending` で割り当たっていれば成功。次に `AssignmentCriteria` を外した形も試す
2. **XAML のグループ**：`CreateFormTask.assign-group` と `.assign-distribute` を実在のローカルグループで試す。`TaskAssignees` の中身を見る。`SingleUser` と `Group` を一緒に書いたときに落ちるかも見る
3. **Flow**：`fixtures/assign/AssignUser.flow.ts` と `AssignGroup.flow.ts` の値を替えて `flow debug`
4. **BPMN**：`AssignForm.bpmn.ts` を compile、format、`task-assign.mjs`、`entry-points.json` を消して `bpmn refresh`、`bpmn debug`。Action App は `tenant/App.bpmn.ts` に `bpmn-app-task.mjs` の後で流す
5. **Case**：`AssignUser.case.ts` を `case debug`。グループは `AssignGroup.case.ts` を、(a) SDK のまま `"user"`、(b) `task-assign.mjs` の `AllUsers`、(c) `assignmentCriteria` を消す、の3通りで試し、効くものに `task-assign.mjs` を合わせる
6. 終わったら、作ったタスクを片付ける

## 文書

- [Assign Tasks](https://docs.uipath.com/action-center/automation-cloud/latest/user-guide/assign-tasks)
- [Managing actions](https://docs.uipath.com/action-center/automation-cloud/latest/user-guide/managing-actions)
- [Create Form Task](https://docs.uipath.com/action-center/automation-cloud/latest/user-guide/create-form-task)
- [Tasks requests（Orchestrator API）](https://docs.uipath.com/orchestrator/automation-cloud/latest/api-Guide/tasks-requests)
