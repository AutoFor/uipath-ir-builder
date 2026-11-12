# UiPath Apps

UiPath の Apps には 2 つある。

| | Coded Apps | ローコードの Apps |
| --- | --- | --- |
| 作り方 | React + TypeScript を書く | Studio Web の画面で部品を並べる |
| 道具 | `uip codedapp`（pack / publish / deploy） | `uip` に無い。Studio Web で作り、ソリューションで出し入れする |
| この道具 | `tools/apps/coded-action.ts`（Action App） | まだ（本物を書き出して読み解くところから） |

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

まだ。Studio Web で部品を並べた App を作り、ソリューションを書き出してもらって、部品ごとに読み解く（AUT-1177）。
