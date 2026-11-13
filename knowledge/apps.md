# UiPath Apps

UiPath の Apps には 2 つある。

| | Coded Apps | ローコードの Apps |
| --- | --- | --- |
| 作り方 | React + TypeScript を書く | Studio Web の画面で部品を並べる |
| 道具 | `uip codedapp`（pack / publish / deploy） | `uip` に無い。Studio Web で作り、ソリューションで出し入れする |
| この道具 | `tools/apps/coded-action.ts`（Action App） | `tools/apps/rpa-app.ts`（RPA アプリ） |

## Coded Action App

Action Center の人のタスクの画面。オートメーション（Maestro のユーザータスク、エージェントのエスカレーション、`CreateAppTask` など）が渡したデータを見せ、人が書いて、結果のボタン（承認・差し戻しなど）で返す。

```bash
node tools/apps/coded-action.ts samples/apps/expense-review.json --out <dir>    # 作る（--check で検証だけ）
cd <dir> && npm install --prefer-offline && npm run build                       # tsc（strict）と vite build
uip codedapp pack dist -n <app> -v 1.0.0                                        # .uipath/<app>.<版>.nupkg
uip codedapp publish -t Action   /   uip codedapp deploy -n <app> --folder-key <GUID>   # 出すのは人に確かめてから
```

### パーツ

| パーツ | ファイル | 中身 |
| --- | --- | --- |
| データの約束 | `action-schema.json` | `inputs`（読むだけ）、`outputs`（人が書く）、`inOuts`（入っていて直せる）、`outcomes`（結果のボタン）。4 つとも必ずある（空なら `"properties": {}`）。pack でパッケージに入る |
| 画面 | `src/components/Form.tsx` | `FormData`（全フィールド）と既定値、タスクの読み込み、書いた値の保存、必須の判定、結果のボタン |
| 部品の見た目 | `src/components/Form.css`、`src/index.css`、`src/App.css` | UiPath のスキルのテンプレートのまま（`templates/coded-action-app/` に写した）。色は `index.css` のトークンで変える |
| 足した部品の見た目 | `src/components/Parts.css` | 選択・ラジオ・チェック・一覧・JSON（テンプレートに無いもの） |
| 骨組み | `src/App.tsx`、`src/main.tsx`、`src/uipath.ts`、`vite.config.ts`、`index.html`、`tsconfig.json`、`package.json` | テーマ（Action Center の明暗に合わせ、ボタンで切り替え）。`vite.config.ts` の `base: './'` は必ず要る |

動き（`@uipath/coded-action-app` の `CodedActionAppService`）：

- `getTask()`：タスクのデータ。`data` には `inputs` と `inOuts` しか無い（`outputs` は最初は無い）ので、既定値の上に重ねる。`isReadOnly`、`theme` も来る
- `setTaskData(data)`：書くたびに呼ぶ（途中まで書いたものを Action Center が残す）
- `completeTask(<outcome>, data)`：結果のボタン
- Action Center の iframe の中で動く。`sdk.initialize()`（OAuth のリダイレクト）は呼ばない

### IR（`samples/apps/expense-review.json`）

```json
{ "app": "expense-review", "title": "経費の申請を確かめる", "subtitle": "…",
  "fields": [
    { "name": "amount", "dir": "in", "type": "number", "required": true, "label": "金額", "currency": "JPY", "section": "申請" },
    { "name": "category", "dir": "inout", "type": "string", "control": "select", "options": ["交通費", "交際費"], "required": true },
    { "name": "comment", "dir": "out", "type": "string", "control": "textarea", "required": true, "description": "…" },
    { "name": "requestId", "dir": "in", "type": "string", "format": "uuid", "hidden": true } ],
  "outcomes": [ { "name": "Reject", "label": "差し戻す", "validate": false }, { "name": "Approve", "label": "承認する", "primary": true } ] }
```

- `dir`：`in` → `inputs`、`out` → `outputs`、`inout` → `inOuts`（RPA の引数の向きと同じ書き方）
- `type`：`string` / `number` / `integer` / `boolean` / `array`（`items`）/ `object`（`properties`）/ `file`。`format` は `string` にだけ `date` か `uuid`。uip codedapp の検証器（`JsonActionSchemaValidator`）と同じ規則で調べる
- `label`、`section`、`hidden`、`control`、`options`、`placeholder`、`min` / `max`、`currency` は画面だけのもの（`action-schema.json` には入らない。`description` は入る）
- `outcomes`：`validate: false` は必須が空でも押せる（差し戻しなど）。`primary` が右端の目立つボタン（無ければ最後のもの）

型と部品：

| 型 | 読むだけ（in） | 書ける（out / inout） |
| --- | --- | --- |
| `string` | 文字 | 文字 / `textarea` / `select` / `radio`。`format: date` は日付 |
| `number` / `integer` | 文字（`currency` で通貨の書式） | 数（`integer` は小数を切る。`min` / `max`） |
| `boolean` | チェック（押せない） | チェック |
| `array` | 一覧 | まだ無い（`APP_UNSUPPORTED`） |
| `object` | JSON | まだ無い |
| `file` | 添付の Id（`{ ID }`） | まだ無い |

必須（`required`）は、書けるフィールドの `string`（空白だけは空）と `number` / `integer` で、`validate` の結果のボタンを押せなくする。

### 確かめたこと

- 見本（14 フィールド、全部の型と部品）を作り、`npm install --offline`（このマシンの npm のキャッシュだけ）→ `tsc`（strict、`noUnusedLocals`）→ `vite build` が通った。版は react 19.3.1、vite 8.3.5、`@uipath/coded-action-app` 1.0.0
- `uip codedapp pack` で `.nupkg` ができ、`content/action-schema.json` が入った。スキーマはスキルの `validate-action-schema.js` も通る
- まだ：Action Center で開くこと（publish / deploy は人に確かめてから）、SDK のサービス（Data Fabric、添付の表示など）、Coded Web App

## ローコードの Apps

Studio Web の「RPA アプリ」（新規作成 ▾ → アプリ）。見本は Studio Web で作った Solution 7（2 ページ、部品 9 種、App の変数、ボタンのイベント）を `uip solution download <solutionId> -d <dir>` で書き出したもの（`C:\Users\seiya\Documents\UiPath\apps-sample\`）。ブラウザーの「ソリューションをダウンロード」はブラウザーのあるマシンに落ちるので、`uip` で取るほうが確か。

### 生成器（`tools/apps/rpa-app.ts`）

```bash
node tools/apps/rpa-app.ts samples/apps/rpa-app-request.json --uis out/RequestApp.uis   # --out <dir> でフォルダ、--check で検証だけ
uip solution upload out/RequestApp.uis                                                  # 新しいソリューションとして入る（フォルダを渡すと .local が落ちる）
```

```json
{ "app": "RequestApp", "solution": "RequestAppSolution", "kind": "rpa-app",
  "variables": [ { "name": "ApplicantName", "type": "string" } ],
  "pages": [
    { "name": "MainPage", "controls": [
        { "type": "textbox", "name": "Applicant", "label": "申請者", "placeholder": "山田 太郎", "required": true },
        { "type": "button", "name": "GoConfirm", "text": "確認へ", "onClick": [
            { "set": "ApplicantName", "value": "Controls.MainPage.Applicant.Value" },
            { "open": "Confirm" } ] } ] },
    { "name": "Confirm", "controls": [ { "type": "label", "name": "Who", "text": { "var": "ApplicantName" } } ] } ] }
```

- 部品（`type`）：`textbox`、`number`、`textarea`、`checkbox`、`dropdown`、`date`、`button`、`label`、`table`。ページの根のパネルに上から並ぶ（入れ子のパネルはまだ）
- 項目：`label`、`text`、`placeholder`、`required`、`checked`、`hidden`、`disabled`、`min` / `max`（number）、`rows`（textarea）。部品に無い項目は `APP_PROP`。雛形の部品にあるほかの式の項目は `props: { "tooltip": "…" }`
- 値：文字（VB の文字列にする）・真偽・数、`{ "var": "<App の変数>" }`（tokens と bindingReferences でつなぐ）、`{ "vb": "<式>" }`（そのまま）
- 変数：`type` は `string` と `list`（`{ "type": "list", "of": "<Data Fabric の表>" }`。表の一覧を持つ）。ほかの型はまだ（`APP_UNSUPPORTED`）
- `onClick`（button）：`{ "set": "<変数>", "value": "<VB の式>" }` は代入、`{ "open": "<ページ>" }` はアプリのページを開く。式の `Controls.<ページ>.<部品>` は名前があるかを調べる
- `table`：`source: { "var": "<list の変数>" }` と `columns: [{ "heading": "日付", "value": "<表の列の名前>" }]`
- Data Fabric の表を使う手順は下の「Data Fabric の表」
- 部品の JSON は雛形（`templates/rpa-app/controls.json`。Studio Web の書き出しから `node tools/apps/rpa-app-templates.ts <書き出したフォルダ>` で作る）を写し、id を振り直して式だけ書き換える。ドロップダウンの選択肢、画像はまだ
- **`open` があると注意 `APP_OPEN_PAGE`**：取り込んだあと、開く先のページの部品の式を Studio Web で 1 回直して保存する（そのページの DLL ができるまで「Selected page is not accessible」）

確かめたこと：見本を `--uis` で作って `upload` し、Studio Web で 2 ページ・変数・部品の文字（日本語、プレースホルダー）が出た。ボタンの XAML の代入は通った。Confirm の式を 1 回直すと Confirm の DLL ができ、XAML に Studio Web が `Apps.*` の参照を足した。そのあと Debug で動かし、申請者を入れて「確認へ」を押すと、Confirm ページに切り替わり、入れた名前が変数を通ってラベルに出た（ワークフローの 3 つの手順がすべて成功）。問題パネルに「Workflow has validation errors」が残っていても、そのワークフローを開くと「No issues found」に変わった（前の検査の結果が残っていただけ）

### Data Fabric の表（見本：`samples/apps/work-calendar.json`、稼働日カレンダー）

App は表を直接は持たない。ボタンのワークフローの中で Data Service の手順を使って読み書きし、一覧は `list` の App の変数に入れて表の部品に出す。

```bash
uip df entities create WorkCalendar --body '{"fields":[{"name":"WorkDate","type":"DATE","isRequired":true},{"name":"IsHoliday","type":"BOOLEAN"},…]}'
# 表の定義：表を 1 回でも使った App を書き出し（uip solution download）、使う表だけに絞る
node tools/apps/rpa-app-entities.ts <書き出し>/<App>/.entities/EntitiesStore.json WorkCalendar --out samples/apps/work-calendar.entities.json
node tools/apps/rpa-app.ts samples/apps/work-calendar.json --uis out/WorkCalendar.uis
uip solution upload out/WorkCalendar.uis
```

- IR の `"entities": "work-calendar.entities.json"`（IR からの相対パス）で表の定義を渡す。表の id、列の id と型をここから読む
- 書き出しの `EntitiesStore.json` には**テナントの表がすべて**入る（ほかの業務の表の名前・説明も）。`rpa-app-entities.ts` で使う表と参照先（`SystemUser`）だけにし、作った人の id は 0 にする
- 手順（`onClick`）：
  - `{ "create": "<表>", "fields": { "<列>": "<VB>" } }` → `uda:CreateEntityRecord`。必須の列が無いと `APP_REF`。`Id`・`CreateTime` などは書けない
  - `{ "update": "<表>", "id": "<Guid の VB>", "fields": {…} }` → `uda:UpdateEntityRecord`（`RecordId`）
  - `{ "delete": "<表>", "id": "<Guid の VB>" }` → `uda:DeleteEntityRecord`
  - `{ "query": "<表>", "into": "<list の変数>", "top": 1000 }` → `uda:QueryEntityRecords`（`OutputRecords` をワークフローの変数 `rowsN` に）と、`AppVariable.<変数> = rowsN.ToListSource()`
  - `{ "if": "<VB>", "then": [...], "else": [...] }` → `If`
- XAML：表を使うワークフローは見出しを `templates/rpa-app/event-entities.xaml`（`uda` / `udam` / `de` / `ac` の名前空間、`DataService.DataService.Entities` などの参照）にする。`ScopeValue="テナント"` は日本語の画面の Studio Web が書いた値のまま
- `project.json` の `entitiesStores: [{ serviceDocument: ".entities/EntitiesStore.json", namespace: "DataService.Entities" }]` と `.entities/EntitiesStore.json` だけ置く。型の DLL（`EntitiesBundle.<hash>.zip`）と `.project/JitCustomTypes*.json` は入れなくても、取り込んだあと Studio Web が作った
- list の変数：`appVariableDefinition: { baseType: "generic", dataType: "Apps.Controls.ListSource", options: [{ baseType: "class", dataType: "[5ba47f0c-5858-4f65-9378-b4be1cff98f2]::DataService.Entities.WorkCalendar" }] }`（`type: "object"`）。XAML の型は `ac:ListSource(de:WorkCalendar)`（`Apps.Controls.ListSource(Of T)`、`UiPath.Apps.Expressions.Integrations`）。`New ListSource(Of T)(data, totalRecords)` か拡張の `.ToListSource()`。中身は `.data`
- 表の部品：`config.sourceBinding.expressionId` の式に変数（token 付き）、`config.columns[]` の `headingExpression`（文字）と `valueExpression`（列の名前。式は `$.controls.<id>.config.columns[?(@.id=="ID…")].valueExpression`）
- 日付の部品の値は `DateOnly?`。日付の列（DateTime）へは `Controls.P.D.Value.Value.ToDateTime(TimeOnly.MinValue)`。チェックボックスの値は `Boolean`
- 表の日付の列は `2026-11-23T00:00:00.0000000Z` と出る（書式はまだ）

確かめたこと（2026-11-13）：見本を `--uis` で作って `upload` し、3 つのワークフローを開いて問題なし。デバッグで、日付を入れて「保存」→ 表に 1 行出た、チェックを変えて「保存」→ 同じ行が直った（行は増えない）、「この日の設定を消す」→ 行が消えた。DESKTOP の Chrome でやった（Studio Web は UiPath Assistant とのつなぎを求める）

### ソリューション（.uis = zip）

| ファイル | 中身 |
| --- | --- |
| `<名前>.uipx` | `SolutionId`、`Projects: [{ Type: "WebApp", ProjectRelativePath: "App/project.uiproj", Id }]` |
| `SolutionStorage.json` | Studio Web の SolutionId と ProjectId |
| `resources/solution_folder/{app,appVersion,package,process/webApp}/App.json` | 配置の設定（app → appVersion と codeBehindProcess の process → package） |
| `App/project.uiproj` | `ProjectType: "WebApp"`、`WebAppSettings.AppId`（App の systemName） |
| `App/project.json` | ふつうの RPA の project.json。`targetFramework: "Portable"`、VB、依存に `UiPath.WorkflowEvents.Activities`（App Events）、DataService、IntegrationService、WebAPI、System |
| `App/Main.xaml` | 裏で動くプロセス。`InitializeHubConnection(sessionId)` → `StartTriggers(.local/generated/Triggers.Generated.xaml)`。引数は `sessionId` |
| `App/<ページ>_<部品>_<イベント>.xaml` | イベントのワークフロー（下） |
| `App/.app/models/models-<App の systemName>.json` | App 本体（`type: "app"`）。`appFields` が App の変数 |
| `App/.app/models/models-<ページの systemName>.json` | ページ（`type: "form"`）。1 ページで約 110KB |
| `App/.app/AppsRequestTrigger.xaml`、`.local/generated/Triggers.Generated.xaml` | 決まった形のトリガー |
| `App/.entities/EntitiesBundle.<hash>.zip`、`.project/JitCustomTypes*.json` | Studio Web がページから作る DLL（`Apps.app.<hash>`、`Apps.form.<ページ>.<hash>`、`…Expressions.<hash>`）。ワークフローの式の `Controls.<ページ>.<部品>`、`AppVariable.<名前>` はここの型 |
| `App/.local/ProjectSettings.json` | `ProjectAppMetadata`：イベントの XAML → ページの `formId`（取り込むと消える。下） |

### ページ（models-<systemName>.json）

- `title`（ページの名前）、`formId`、`rootPanelId: "ID1"`、`controls`、`expressions`、`workflowBindings`、`bindingReferences`
- `controls`：部品の id → 部品。`component`、`name`、`config.childIds`（パネルの子の順）、`_logicalParent`、`properties`、`events`
- `properties` は 1 部品で 60〜90 個あり、ほとんどスタイルの既定値。値は `valueType` ごと（`string`、`boolean`、`size`、`box`、`vb-expression` …）。内部の `id`（`ID1234`）は 1 ページの中で重ならない通し番号（`idCounter` が次の番号）
- 文字や真偽などの式（`vb-expression`）は `properties.<名>.value.expressionId` だけを持ち、中身は `expressions[<部品 id>].expressions[<expressionId>]` にある：`{ expression: "\"Approve\"", isLiteral, contextSourceId: "$.controls.<部品 id>.properties.<名>.value", tokens }`
- App の変数を使う式は `tokens: [{ token: "ApplicantName", tokenId: <appFields の id>, tokenType: "app-variable", type: "AppVariables.AppVariable", startIndex, endIndex }]` を持ち、`bindingReferences[<appFields の id>]` にその式の id が入る

部品（`component`）と、式で持つ主な項目：

| 部品 | component | 式の項目 | イベント |
| --- | --- | --- | --- |
| パネル | `form-vb-panel` | — | click / load（根） |
| テキストボックス | `form-text-vb` | `label`、`placeholder`、`required`、`text` | change |
| 数 | `form-text-number-vb` | `label`、`required`、`inputControlMinValue` / `MaxValue` | change |
| テキスト領域 | `form-text-area-vb` | `label`、`required` | change |
| チェックボックス | `form-check-box` | `text`、`resolvableChecked`、`required` | change |
| ドロップダウン | `form-dropdown-vb` | `label`、`required`（選択肢は別の項目） | change |
| 日付 | `form-mobile-date-picker-vb` | `label`、`required` | change |
| ボタン | `form-button` | `text` | click |
| ラベル | `form-label` | `text` | click |
| 表 | `form-simple-table-vb` | — | change |
| 画像 | `form-image-vb` | `url`（`new AppsFile("data:…")`） | click |

全部の部品に `resolvableHidden`、`resolvableDisabled` がある。

### App の変数（App 本体の `appFields`）

```json
{ "id": "hs3218…", "name": "ApplicantName", "type": "string",
  "appVariableDefinition": { "name": "ApplicantName", "baseType": "primitive", "dataType": "System.String", "defaultValue": null } }
```

型は Text、Whole number、Decimal number、True or false、Date、DateOnly、DataTable、List、Array、AppsFile、Object など。

### イベント（RPA アプリ）

ボタンのクリックなどの中身は RPA のワークフロー（XAML）。部品の `events.click.executors` に `{ executorMethod: "start-automation", config: { automationId: <Studio Web のファイル id>, workflowPath: "MainPage_Button_click.xaml" } }`、ページの `workflowBindings[<automationId>]` に部品の id。

```xml
<ui:ManualTrigger DisplayName="MainPage_Button : クリック時 Event" />
<Assign><Assign.To><OutArgument x:TypeArguments="x:String">[AppVariable.ApplicantName]</OutArgument></Assign.To>
        <Assign.Value><InArgument x:TypeArguments="x:String">[Controls.MainPage.Text.Value]</InArgument></Assign.Value></Assign>
<uwana:OpenAppsPage CurrentFormId="<今のページの formId>" PageFormId="<開くページの formId>" PageName="SimpleApproval" … />
```

App Events（`UiPath.WorkflowEvents.Activities`）のアクティビティ：アプリのページを開く（Open Apps Page）、アプリで URL を開く、アプリの値をリセット、アプリのメッセージを表示、スピナーの表示/非表示、ポップオーバー/ボトムシートを閉じる。値は「代入」（Assign）で `AppVariable.<名>` や `Controls.<ページ>.<部品>.Value` に入れる。

### 取り込み（`uip solution upload`）で確かめたこと

- 書き出しの SolutionId と ProjectId を新しくし、ページの式（ラベルの文字）を書き換えて `upload` すると、新しいソリューションとして入り、Studio Web で書き換えたとおりに出る。`.entities` と `JitCustomTypes*.json` を消しても開ける（Studio Web が DLL を作り直す）
- 取り込んだソリューションへの上書き（`upload` をもう一度）は HTTP 500（`.project/…` が見つからない）で通らなかった

#### イベント（XAML）を生かすには

- **`uip solution upload <フォルダ>` は `.local` を送らない**（solution-tool の `DEFAULT_EXCLUDED_DIR_NAMES` に `.local`、`.git`、`node_modules` など）。`.local/ProjectSettings.json` の `ProjectAppMetadata`（イベントの XAML → ページの `formId`）が消え、Studio Web はその XAML を「Workflow is not codebehind」として扱う。その XAML の `AssemblyReference` も直してくれない
- **自分で zip にした `.uis`（`/` 区切り、`.local` 入り）を `uip solution upload <ファイル>.uis` で送ると `.local` が残る**。これで codebehind として扱われる
- そのうえで、XAML の `Apps.app.*` / `Apps.form.*` の `AssemblyReference` を消し、`.entities` と `JitCustomTypes*.json` も入れずに送ると、Studio Web が DLL を作り直し、XAML の参照も足す。`Controls.MainPage.Text.Value`、`AppVariable.ApplicantName` は通った（ボタンのあるページの DLL は、その XAML を開くと作られる）
- **別のページを開く（Open Apps Page）は、開く先のページの DLL が無いと「Selected page is not accessible」**（ページの選択肢も空になる）。開く先のページを開くだけ、ページのタイトルを変えるだけ、そのページにイベントを足すだけでは作られなかった。そのページの式（ラベルの文字）を Studio Web で直したら DLL ができ、エラーが消えた。`Apps.root.dll` に、DLL のできたページだけが並ぶ
- 部品の `automationId`（Studio Web のファイル id）は取り込みで変わるが、`workflowPath` で開けるので、古いままでもボタンから XAML を開けた
