# 人のタスクの割り当て

イシュー：AUT-1090。2026-11-02 時点。`UiPath.Persistence.Activities` 1.13.0、`@uipath/maestro-builder-sdk` 6.66.5、`uip` 1.204.0。

**Maestro 3形式（Flow、BPMN、Case）は 2026-11-02 に個人ワークスペースで `debug` して実測した（下の「テナントでの実測」）。XAML はパッケージを個人ワークスペースに上げたが、ロボットが繋がらずジョブが動かず、未確認。** 「読んだ」はテナントの読み取りか DLL・SDK・文書の読み取り。確かめる手順は最後の節。

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

## テナントでの実測（2026-11-02）

個人ワークスペース（`cb95b4b9-...`）、`uip` 1.204.0。`flow debug` / `bpmn debug` / `case debug`。担当者欄は `uip tasks get` の値。ユーザーはログイン中の本人（メールは書かない）。グループは**既存の組み込みグループ `Automation Developers`**（メンバーは本人と UnAttended のロボットアカウントだけ）を読み取りで選んだ。グループは作っていない。

| 形式 | 指定 | タスク | 状態 | `TaskAssignmentCriteria` | 担当者 | インスタンス／ジョブ |
| --- | --- | --- | --- | --- | --- | --- |
| Flow（QuickForm） | `user` | 100235303 | Pending | SingleUser | 本人 | `598616e8-5501-4d11-a47b-f2b5d0684c19` |
| BPMN（QuickForm） | `task-assign.mjs` user | 100235312 | Pending | SingleUser | 本人 | `25d54538-a180-4837-bc85-95e0d859ae94` |
| Case（Action App） | `recipient: "<メール>"`（SDK の `"user"`） | 100235318 | Pending | SingleUser | 本人 | `3f115e9d-3ad1-49bc-b559-184a287baafa` |
| Flow（Action App） | `staticGroupName` | 100235316 | **Unassigned** | SingleUser | なし | `800b267f-ad74-4b97-ae0a-e0198f64a32c` |
| Flow（Action App） | `group`（名前） | 100235317 | **Unassigned** | SingleUser | なし | `2ba9ccda-1083-4e77-bfa9-a3d8e776018f` |
| Flow（Action App） | `workload` | 100235324 | Pending | **Workload** | 本人（`TaskAssignees` に DirectoryUser） | `5a3adb05-3f2e-44db-94b9-64bcea116459` |
| BPMN（QuickForm） | group（AllUsers） | 100235329 | **Unassigned** | SingleUser | なし | `33e02493-408e-427e-9f25-72d1c8bc5bab` |
| BPMN（QuickForm） | workload | 100235333 | Pending | Workload | 本人 | `fb0d3d85-8a71-4186-8218-28a8b250a6f5` |
| Case（Action App） | (a) SDK のまま `"user"` + Type 1 | 100235340 | **Unassigned** | SingleUser | なし | `f296318d-5e89-40a6-91cc-0c75b6a79a40` |
| Case | (b) `AllUsers`（`task-assign.mjs`） | 100235341 | **Unassigned** | SingleUser | なし | `4fe3c52c-deaa-4080-b5a4-497714aa4c02` |
| Case | (c) `assignmentCriteria` を消す | 100235346 | **Unassigned** | SingleUser | なし | `6552f5b6-8d66-4f65-8994-8edda6acc8d6` |
| Case | `Workload`（`task-assign.mjs`） | 100235343 | Pending | Workload | 本人 | `adffbd87-bc21-4f2c-910d-32b1e710530d` |

Case の (a)(b)(c) は重なって起動し、もう1組もできた（タスク 100235335〜100235337、ジョブ `325711a0-...`、`8c94c048-...`、`5c8066ff-...`）。どれが a か b か c かは確証が無いが、**6件とも未割り当て**で結果は同じ。BPMN の workload の重複（`34a34877-e3a5-4abc-85f5-dead107e8f6a`）は Faulted で、タスクはできていない。

分かったこと：

- **ユーザーの割り当ては3形式とも効いた**。Case は SDK が書く `assignmentCriteria: "user"` のままで効く
- **グループの全員（`AllUsers` 相当）は、3形式とも未割り当てのまま**。タスクの条件も `SingleUser` のままで、`TaskAssignees` は空。エンジンはグループ名を受け取っている（`uip traces spans get` の `hitlTaskConfiguredAssignee` が `Automation Developers`）のに、タスクに反映されない。同じグループで `Workload` は割り当たるので、グループの権限の問題ではないように見える（推定）。原因は未確認。画面は見ていないので、`AllUsers` の意味の未割り当てが API では `SingleUser` と見えるだけ、という可能性は残る
- **`Workload` は Flow、BPMN、Case で割り当たった**（担当は本人。グループの人間のメンバーが本人だけのため）。`RoundRobin` は流していない
- `fixtures/assign/AssignGroup.*.ts` のグループ指定（Flow の `group`、Case の `type: 1`）は `AllUsers` なので、未割り当てになる。人に割り当てたいときは `workload` を使う
- 窓口 `verify.mjs` に warning `TASK_GROUP_ALL_USERS` を足した（Flow の `group`/`staticGroupName`、BPMN と Case の `AllUsers`）

### XAML の実測（2026-11-02〜03、個人ワークスペース）

- 経緯：窓口の runner でのローカル実行は `An organization unit is required for this action. Error code: 1101`（フォルダの文脈が無い）。そこで `uip or packages upload --feed-id <個人ワークスペースのフィード>` で `uipath-ir-test-assign` 1.0.2 を上げ、個人ワークスペースのプロセス（`-formtask`、`-user`、`-group`、`-distribute`、`-nocrit-user`、`-nocrit-group`、`-useraction`、`-timer`、`-external`、`-assigntasks-full`、`-assigntasks-group`）を `--runtime-type Development` で流した。`--feed-id` と `--folder-key` は併用できず、既定の宛先はテナントのフィード。2026-11-02 はロボットが繋がらず Pending のままだった（`UiRobotSvc` のサービスモード）。11-03 06:26 に Development が繋がって流れた
- ジョブが Suspended になる形（`FormTaskAssign.full`）は枠を占めず、あとのジョブは続けて流れた

| 形 | プロセス | ジョブ | 結果 | タスク | Status / 条件 / 担当者 |
| --- | --- | --- | --- | --- | --- |
| `FormTaskAssign.full`（`in_Assignee` に本人） | formtask | `39406135-5c6a-4a07-8f6f-b470c7e6070e` | Suspended（タスク待ち） | 100241773 | Pending / SingleUser / 本人 |
| `CreateFormTask.assign-user` | user | `42eee8da-bf95-4704-a1ed-46bd97c389b3` | Successful | 100241791 | Pending / SingleUser / 本人 |
| `CreateFormTask.nocrit-user`（`AssignmentCriteria` なし、`UserNameOrEmail` のみ） | nocrit-user | `81e85d64-16f5-4dc1-951b-339da04e3cd7` | Successful | 100241798 | Pending / SingleUser / 本人 |
| `CreateFormTask.nocrit-group`（`Group` のみ） | nocrit-group | `5ca8525a-eab2-41af-bac8-44a475979b29` | Successful | 100241800 | **Unassigned** / SingleUser / なし |
| 同上（`AssignTasks.full` 用に 2 つ目） | nocrit-group | `b5a4ad51-92d3-47d5-9164-8681b6cf9339` | Successful | 100241805 | **Unassigned** / SingleUser / なし |
| `CreateFormTask.assign-group`（`AllUsers` + `Group`） | group | `d8c9df1a-a3ee-4768-9dd6-5e3b8c65f206` | **Faulted** | なし | `Action cannot be assigned to this user due to insufficient permissions Error code: 2414` |
| `CreateFormTask.assign-distribute` | distribute | `d826a363-dc09-47b8-b19f-068f85035c2d` | **Faulted** | なし | `You do not have the required permissions to change the assignee of the action Error code: 2415` |
| `CreateUserAction.assign` | useraction | `504f8689-30c0-4d45-bab2-bc53820ba6bc` | **Faulted** | なし | `Object reference not set to an instance of an object.`（`PersistenceActivityException`、`CreateUserAction` 内） |
| `CreateFormTask.timer`（`SingleUser` + `Group` + `UserNameOrEmail`、Reassign も同形） | timer | `fc27ef75-7399-4b1a-bf5e-f4dde389aacc` | Successful | 100241803 | Pending / SingleUser / 本人 |
| `AssignTasks.group`（`in_TaskId`=100241800） | assigntasks-group | `735109f8-4fca-4097-9b4c-bd791f981a40` | Successful | 100241800 | **Unassigned のまま** / SingleUser / なし |
| `AssignTasks.full`（`Reassign`、`Group` + `UserNameOrEmail`、`in_TaskId`=100241805） | assigntasks-full | `cc8b13b8-ee6d-4e8c-8711-646092a33fdc` | Successful | 100241805 | **Unassigned のまま** / SingleUser / なし |
| `CreateExternalTask.full`（`TaskCatalog="External"`） | external | `44503a3e-f095-46b1-852b-765b9129fd1d` | **Faulted** | なし | `No task catalog exists with name External Error code: 2451` |

どのタスクも `TaskAssignees` は空だった（`uip tasks get`）。実メールアドレスはここに書かない。

分かったこと（実測）：

- **ユーザー指定（`UserNameOrEmail`）は XAML でも効く**。`AssignmentCriteria` を外しても効く（`CreateFormTask.nocrit-user`）。Maestro の「ユーザーだけ書いて条件を省いたときに効くか」はこれで確認できた（XAML では効く）
- **`Group` だけ（条件なし）は未割り当て**（Maestro の「グループの全員は未割り当て」と同じ）。`AssignTasks` の `AllUsers` + `Group` もタスクを割り当てなかった（ジョブは成功扱い。失敗した割り当ては `FailedTaskAssignments` に入るが、中身は取っていない）
- `CreateFormTask` の `AssignmentCriteria=AllUsers` + `Group`（`assign-group`）と `assign-distribute` は、この個人ワークスペースでは**権限エラー（2414、2415）で落ちた**。原因は未確認（推定：`Automation Developers` に個人ワークスペースのフォルダでの割り当て権限が無い、または実行ユーザーに割り当ての権限が足りない。フォルダやロールの変更は許可外なので試していない）
- **`SingleUser` + `Group` は XAML の実行時には弾かれなかった**。`CreateFormTask.timer`（`SingleUser`、`Group`、`UserNameOrEmail`）は成功し、`UserNameOrEmail` の本人に割り当たった。`GroupNotAllowedForSingleUserAssignment` は出なかったので、生成器と検証には止める修正を入れていない。`AssignTasks.full` も同形で成功したが、タスクは割り当たらなかった（`Group` が優先されたのか、`Reassign` が未割り当てのタスクに効かないのかは切り分けていない）。`CreateExternalTask.full` はカタログ不在で落ちたので、この形は未確認
- `CreateUserAction.assign` は `NullReferenceException` 相当で落ちた。1 つの XAML に user 用と group 用の 2 つの `CreateUserAction` があり、どちらで落ちたかは切り分けていない。アプリ（`AppId` 等）を指定していない形なので、アプリの指定が要る可能性があるが推定

起動の手順：

```bash
F=cb95b4b9-2397-47d8-bd95-185ad630dd91
uip or processes list --folder-key $F --limit 100 --output-filter "[?contains(Name,'uipath-ir-test-assign')].{n:Name,k:Key}"
uip or jobs start <キー> --folder-key $F --runtime-type Development --input-arguments '{"in_Assignee":"<メール>"}'   # formtask だけ。assigntasks-* は {"in_TaskId":<番号>}
```

### 2026-11-03 追加（AUT-1104、読み取りとジョブのログだけ）

run の窓口（runner.mjs）が止まっていた（`runner.alive` の最終更新が 2026-11-02 16:13）ので、1 呼び出しずつに分けた版の pack ができず、新しいジョブは流していない。既存のジョブのログと、グループとロールの読み取りで分かったこと。

- **`AssignTasks.full` の `FailedTaskAssignments` は 1 件だった**（実測。ジョブ `cc8b13b8-...` のログ「失敗: 1」）。つまりジョブは Successful でも、`Reassign` の割り当ては**試されて失敗した**。「未割り当てのタスクに効かない」より、「割り当てを試みたが拒否された」側。失敗の中身（理由、対象）は XAML が件数しか出していないので未確認（推定：2414 と同じ、グループのメンバーに権限が無い失敗）
- **`assign-distribute` の 2415 は `RoundRobin` の呼び出し**（実測）。XAML は上から順に実行され、`RoundRobin` が先頭で、そこで落ちたので `Workload` の呼び出しには着いていない。`Workload` の XAML 単体は未確認（Maestro では割り当たった）
- **2414 と 2415 の原因の手がかり**（読み取り。`uip admin authorization check-access`）：`Automation Developers` のメンバーは本人と `UnAttended`（ロボットアカウント）の 2 つ。個人ワークスペースのフォルダで役割があるのは本人（Personal Workspace Administrator）だけで、**グループにも `UnAttended` にもフォルダの役割が 0 件**。`AllUsers` と `RoundRobin` はグループのメンバーを割り当て先に選ぶので、フォルダに入っていないメンバーに当たって拒否された、という説明が合う（**推定**）。`Group` だけ（条件なし）は割り当てを試みないので成功する、とも合う。確かめる実験（`SingleUser` の `Group` 無し、`Workload`、存在しないグループ名との比較）は、窓口が戻れば流せる。フォルダへのグループの追加は許可外
- **`CreateUserAction`**：ログのスタックは `BaseOrchestratorClientAsyncActivity.EndExecute` → `ThrowIfNeeded` で、エラーは 1.5 秒で出ている（タスク作成のリクエスト側。実測）。生成した XAML は `AppActionData`、`AppActionPropertiesMetadata`、`State`、`SolutionAppResources` が無く、アプリの指定（`SolutionApp` など）も無い（既定 XAML には空の辞書と `RecordDynamicActionPropertiesState` がある）。どれが null で落ちるかは未確認（推定）。user 用と group 用のどちらが落ちたかも未確認
- 窓口が戻ったら流す形（未実行）：`CreateUserAction` の user のみ、group のみ。`CreateFormTask` の `RoundRobin`、`Workload`、`AllUsers` + `UserNameOrEmail`（`Group` 無し）、`AllUsers` + 存在しないグループ。`AssignTasks` の `FailedTaskAssignments` を `Newtonsoft.Json.JsonConvert.SerializeObject(failed)` でログに出す版（`Assign` と `Reassign`）。パッケージは 1.0.3 以降

- **未確認**：`RoundRobin`、`CreateUserAction` のどちらの呼び出しで落ちるか、`CreateExternalTask` の `SingleUser` + `Group`（`External` カタログが無い。カタログの作成は許可外）、`AssignTasks.full` で未割り当てのままだった理由、`assign-group` と `assign-distribute` の権限エラーの原因、人が画面で見たときの `AllUsers` の扱い

### そのほか未確認

- Flow `custom`、Case の `{ type: 3 }`、`RoundRobin`
- 人が画面で見たときの `AllUsers` のタスクの扱い
- 残したインスタンスは Running のまま（タスクが Pending か Unassigned のため）。上の表のジョブ。人が完了するか、後で止める

## 文書

- [Assign Tasks](https://docs.uipath.com/action-center/automation-cloud/latest/user-guide/assign-tasks)
- [Managing actions](https://docs.uipath.com/action-center/automation-cloud/latest/user-guide/managing-actions)
- [Create Form Task](https://docs.uipath.com/action-center/automation-cloud/latest/user-guide/create-form-task)
- [Tasks requests（Orchestrator API）](https://docs.uipath.com/orchestrator/automation-cloud/latest/api-Guide/tasks-requests)
