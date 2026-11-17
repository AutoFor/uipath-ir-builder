# Studio のフォーム（UiPath.Form.Activities）

Studio のフォーム デザイナーで作るフォーム（`.uiform`）と、カスタムの HTML のフォームを、ロボットのマシンの画面に窓で出すパッケージ。AUT-1209 で、カタログ・既定 XAML・見本・検査の道具をそろえ、build と run（Attended、DESKTOP の RDP の画面）で確かめた。

Action Center のフォームのタスク（`CreateFormTask` など）は別のパッケージ（`UiPath.Persistence.Activities`）で、[persistence.md](persistence.md) を読む。どちらも form.io だが、ファイルの形も動く場所も違う。

## 1. パッケージとカタログ

| 項目 | 値 |
| --- | --- |
| パッケージ | `UiPath.Form.Activities` 26.4.0（2026-05-28。公式フィードの最新） |
| カタログ | `catalog/UiPath.Form.Activities/26.4.0.json`（9 アクティビティ） |
| 実行環境 | **Windows だけ**。パッケージは `lib/net6.0-windows7.0` だけで、クロスプラットフォーム（Portable）のカタログは無い（作れない） |
| Coded API | 無い（`services` も対応表も無い）。Coded（C#）では XAML 経由（`RunWorkflow`）で呼ぶ（[coded-via-xaml.md](coded-via-xaml.md)） |
| 既定 XAML | `knowledge/default-xaml/UiPath.Form.Activities/26.4.0/`（9 個。`compare-default-xaml` で食い違いなし） |
| 依存 | `UiPath.Studio.Forms.Runtime` 26.4.0（WebView2 で form.io を描く。窓の型 `WindowState` と結果の型はここ） |
| project.json | 依存に `"UiPath.Form.Activities": "[26.4.0]"`。画面に出すので Attended で動かす（`runtimeOptions.isAttended` / `requiresUserInteraction` を true にした作業用プロジェクト `C:\Users\Public\uipath-ir-probe-forms` で確かめた） |

| アクティビティ（ClassName） | Studio の表示名 | 主なプロパティ |
| --- | --- | --- |
| `ShowFormActivity` | Show Form | `FormId`、`InstanceName`、`IsAsync`（既定 True）、`Arguments`（In / Out / InOut の辞書）、`Title`、`Width` / `Height` / `Left` / `Top`、`ShowMargin`、`ShowInTaskbar`、`TopMost`、`WindowState`、`Result`（Boolean?） |
| `CloseFormActivity` | Close Form | `FormId`、`InstanceName` |
| `HideFormActivity` | Hide Form | `FormId`、`InstanceName`、`Result`（`HideFormResult[]`） |
| `BringFormToFrontActivity` | Bring Form to Foreground | 同上 |
| `ChangeFormPropertiesActivity` | Change Form Properties | 窓の性質（Show Form と同じもの。`ShowInTaskbar` は無い）、`Result`（`UpdateFormResult[]`） |
| `ExecuteScriptActivity` | Run Form Script | `Source`（JavaScript）、`Result`（`ExecuteScriptResult[]`。`(0).Value` が式の値） |
| `GetFormFieldsActivity` | Get Form Values | `Arguments`（**Out だけ**の辞書。キーは部品の key）、`Result`（`GetFormValuesResult`） |
| `SetFormFieldsActivity` | Set Form Values | `Arguments`（**In だけ**の辞書）、`Result`（`SetFormValuesResult[]`） |
| `FormTriggerActivity`（型引数 1 つ） | Form Event Trigger | `FormId`、`Event`、`Tag`（＝インスタンス名の絞り込み）、`MessageId`（HTML のメッセージだけ）、`Enabled`。型引数は下の 5. |

- `FormId` は素のプロパティ（属性）。式は書けない。IR には GUID の文字列をそのまま書く
- `WindowState` は `Normal` / `Minimized` / `Maximized`（`UiPath.Studio.Forms.Runtime.WindowState`。IR にはメンバー名を書く）
- 窓の大きさと位置は DPI で拡大される（150% の画面で `Width` 480 → 約 700 px）
- 公式の文書：[Form activities](https://docs.uipath.com/activities/other/latest/workflow/form-activities)、[Show Form](https://docs.uipath.com/activities/other/latest/workflow/show-form-activity)、[Form Event Trigger](https://docs.uipath.com/activities/other/latest/workflow/form-trigger-activity)、[Forms（Studio）](https://docs.uipath.com/studio/standalone/latest/user-guide/form-type-of-workflow)、[カスタム HTML](https://docs.uipath.com/activities/other/latest/workflow/design-forms-using-custom-html)

## 2. フォームの中身をどう持つか（決めたこと）

**フォームのファイルは生成しない。AI が `.uiform`（または `.html`）を直接書き、`tools/ir/forms.ts` で検査する。** `.uiform` は Studio のフォーム デザイナーが読み書きするのと同じ JSON で、XAML と違って生成器が組み立てる余地が無い（form.io の部品をそのまま並べるだけ）。IR の別の形を作ると、Studio で開いて直したときに戻せなくなる。

- 置き場所：プロジェクトの中ならどこでもよい（build が全部探す）。`<P>/Forms/<名前>.uiform` にそろえる。業務のフォームを道具のフォルダに置かない
- ワークフローの IR からは **FormId（ファイルの `Metadata.Id` の GUID）** で指す。ファイル名やパスでは指さない
- ファイルを写して新しいフォームを作ったら、`Metadata.Id` を新しい GUID にする（同じ Id が 2 つあると、どちらが出るか決まらない。検査が `FORM_DUP_ID` で弾く）

### `.uiform` の形

`UiPath.Studio.Forms.Runtime` の `FormFileSchema`（`Metadata` / `DesignProperties` / `Data`）。ファイル全体が 1 つの JSON。

```json
{
  "Metadata": { "Id": "6f0c2a3e-9b1d-4c58-a7e2-1f3b5d7c9a01", "Kind": "FormIo" },
  "DesignProperties": { "Title": "あいさつ", "Width": 480, "Height": 560 },
  "Data": {
    "display": "form",
    "components": [
      { "type": "textfield", "key": "name", "label": "名前", "input": true, "tableView": true },
      { "type": "number", "key": "age", "label": "年齢", "input": true, "tableView": true },
      { "type": "checkbox", "key": "agree", "label": "同意する", "input": true, "tableView": false },
      { "type": "button", "key": "greet", "label": "あいさつする", "action": "event", "event": "greet", "input": true, "tableView": false },
      { "type": "button", "key": "submit", "label": "送信", "action": "submit", "input": true, "tableView": false }
    ]
  }
}
```

- `Metadata.Kind` は `"FormIo"`。`Id` は GUID
- `DesignProperties`：`Title`、`Width`、`Height`、`Padding`、`Theme`、`ShowInTaskbar`、`ShowMargin`、`CustomStyle`。Show Form の同名のプロパティを書かなければ、これが使われる。**窓が小さいと下の部品がはみ出してスクロールが出る**（420×320 では送信ボタンが隠れた。スクショで確かめる）
- `Data`：form.io のフォーム。`components` の部品の `key` が、Get / Set Form Values と Show Form の `Arguments` のキーになる
- 部品の種類は Studio の `FormIoComponentTypes` にあるもの：button、checkbox、number、password、radio、select、label、textarea、textfield、datagrid、datatable、day、time、datetime、selectboxes、survey、datamap、currency、url、email、phoneNumber、htmlelement、content、columns、panel、table、tabs、hidden、container、editgrid、filePath
- ボタン：`"action": "submit"` はフォームを送信して**窓を閉じる**（同期の Show Form が戻る）。`"action": "event"` は閉じずに `click.<key>` のイベントを出す（5.）
- 一覧の部品（select など）の選択肢は、`Arguments` のキーに `.Items` を付けて渡せる（25.2.1 から。公式のリリースノート）。run では確かめていない

### HTML のフォーム

先頭のコメントに Metadata を書く（公式の見本 HTML_forms_Sample と同じ形）。値の読み書きは、ページが用意する `uiPathApi.getValue(id)` / `setValue(id, value)` を通る。`uiPathApi.sendMessage(id, value)` は実行時にエンジンが差し替え、`form.message` のイベントになる。

```html
<!-- form
{
  "Metadata": { "Id": "6f0c2a3e-9b1d-4c58-a7e2-1f3b5d7c9a02", "DisplayName": "Hello.html", "Kind": "Html" }
}
-->
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script>
  var uiPathApi = {
    getValue: function (id) { var el = document.getElementById(id); return el.value === undefined ? el.innerHTML : el.value; },
    setValue: function (id, v) { var el = document.getElementById(id); if (el.value === undefined) el.innerHTML = v; else el.value = v; },
    sendMessage: function (id, value) { }
  };
</script></head>
<body><input id="name"><button onclick="uiPathApi.sendMessage('ok', document.getElementById('name').value)">OK</button></body></html>
```

- HTML の `<title>` は窓の題にならない。Show Form の `Title` を書く

### build が作る対応表

`uip rpa build`（Studio の build）がプロジェクトの中の `.uiform` / `.html` の Metadata を読み、`.local/content/FormsRuntime.json` を作る。実行時はこれで FormId からファイルを探す。

```json
{ "IdMap": { "6f0c2a3e-...-9a01": "data/forms/Hello.uiform", "6f0c2a3e-...-9a02": "data/forms/Hello.html" } }
```

- **build を飛ばして run すると、フォームが見つからない**（`フォーム <Id> が見つかりませんでした。 (NoMapEntry)`）。verify の `--build-once`（`uip rpa run --skip-build`）では全部これで落ちた。フォームを使うワークフローは毎回 build して run する
- パッケージにすると `content/FormsRuntime.json` として入る（実行時の探し先は `content`、`../../content`）

## 3. 検査の道具（`tools/ir/forms.ts`）

```bash
node tools/ir/forms.ts list --project <P>                          # FormId、種類、パス、部品の key、使えるイベント名
node tools/ir/forms.ts check --project <P> <P>/ir/Main.json ...    # フォームのファイルと、IR の FormId・Arguments の key・Event を突き合わせる
```

| コード | 意味 |
| --- | --- |
| `FORM_BAD_JSON` / `FORM_NO_METADATA` / `FORM_BAD_ID` / `FORM_BAD_KIND` | ファイルの形が違う（build が FormId を拾えない） |
| `FORM_NO_COMPONENTS` | `Data.components` が無い（窓が空になる） |
| `FORM_NO_KEY` / `FORM_DUP_KEY` | 部品の key が無い・重なっている |
| `FORM_UNKNOWN_TYPE` | Studio のフォームに無い部品の種類 |
| `FORM_BUTTON_ACTION` | ボタンの action が submit / event / reset 以外 |
| `FORM_HTML_NO_API` | HTML に uiPathApi が無い |
| 注意（warn。check は落とさない）：`FORM_COLUMNS_STACK` / `FORM_TOO_TALL` / `FORM_THEME` / `FORM_CURRENCY_DECIMAL` / `FORM_PHONE_MASK` | 見た目の問題（7.）。スクショで見つけたもの |
| `FORM_DUP_ID` | 同じ Metadata.Id のファイルが 2 つある |
| `FORM_ID_MISSING` / `FORM_ID_NOT_FOUND` | IR の FormId が無い・プロジェクトに無い（実行時に NoMapEntry） |
| `FORM_KEY_NOT_FOUND` | Arguments のキーが `.uiform` の部品の key に無い（`.Items` は外して比べる） |
| `FORM_EVENT_NOT_FOUND` | Form Trigger の Event がそのフォームに無い |

gen.ts は FormId の先のファイルを見ない（プロジェクトを知らないため）。IR を書いたら `forms.ts check` も流す。

## 4. 書き方（IR）

見本は `samples/ir/UiPath.Form.Activities/*.min.json` / `*.full.json`、フォームは `samples/data/forms/`（verify が作業用プロジェクトの `data/forms/` に写す）。

```json
{ "act": "ShowFormActivity", "props": { "FormId": "6f0c2a3e-9b1d-4c58-a7e2-1f3b5d7c9a01", "InstanceName": { "lit": "読む" } },
  "dicts": { "Arguments": [ { "name": "name", "dir": "In", "type": "String", "value": { "lit": "四郎" } } ] } },
{ "act": "GetFormFieldsActivity", "props": { "FormId": "6f0c2a3e-9b1d-4c58-a7e2-1f3b5d7c9a01", "InstanceName": { "lit": "読む" }, "Result": "res" },
  "dicts": { "Arguments": [ { "name": "name", "dir": "Out", "type": "String", "value": "name" } ] } }
```

- `Arguments` は `dicts.Arguments`。Show Form は In / Out / InOut、Get は Out だけ、Set は In だけ（違うと検証が `BAD_DICT` で弾く）。値の型は変数の型に変換される（number → `Double`、checkbox → `Boolean`）
- 同じフォームを 2 つ出すときは `InstanceName` を変える。後のアクティビティも同じ `InstanceName` を書く（書かないと全部のインスタンスが対象になる。Get は「複数が当てはまる」で落ちる）
- 結果の型は IR に `HideFormResult[]`、`UpdateFormResult[]`、`ExecuteScriptResult[]`、`GetFormValuesResult`、`SetFormValuesResult[]` と書く（`tools/ir/types-xaml.ts`）。どれも `.OK`（Boolean）を持つ
- 生成器に足したもの（AUT-1209）：`Dictionary<String, OutArgument>`（Get Form Values）を `dicts` で書けるようにした。Form の型（トリガーの型引数と結果の型）と、接頭辞 `ufa`（Studio と同じ）。抽出器は Nullable の enum（`WindowState?`）の値も取るようにした

## 5. Form Trigger（イベント）

Studio では「トリガーのワークフロー」（最初のアクティビティが Form Trigger のファイル。Main から **Run Local Triggers** で動かす。Studio が `.local\generated\Triggers.Generated.xaml` を作る）で使う。生成器では、パッケージの説明（triggers.md）にあるもう一つの形、**Trigger Scope の Triggers に置く**形で書く。**Run Local Triggers は要らない**（Trigger Scope の中で、メッセージ・窓・部品のイベントがどれも発火した。AUT-1210）。Action の `args`（`TriggerArgs`）を `CType(args, UiPath.Forms.Activities.<型>)` で読む。

| Event | 型引数 | 中身 | run |
| --- | --- | --- | --- |
| `form.message`（HTML の `uiPathApi.sendMessage`） | `MessageTriggerEventArgs` | `Id`、`Data`。`MessageId` で絞る | 発火を確かめた（FormTriggerActivity.min） |
| `window.state_changed` | `WindowStateTriggerEventArgs` | `State` | 発火を確かめた（FormTriggerActivity.full。Change Form Properties で最小化） |
| `window.closed` / `window.got_focus` / `window.lost_focus` | `FormInfoTriggerEventArgs` | 共通の `FormSourceId`、`InstanceName`、`Index` | 確かめていない |
| **`click.<key>`**（`action: "event"` のボタン） | `FormInfoTriggerEventArgs` | 共通 | 発火を確かめた（`FormTriggerActivity.component.json`） |
| **`changed.<key>`**（値の部品） | 部品の型に合わせる：number・currency → `NumberTriggerEventArgs`（`Value`）、checkbox → `BooleanTriggerEventArgs`、text → `TextTriggerEventArgs`（`Text`）、password → `PasswordTriggerEventArgs`、datagrid・datatable・editgrid → `DataTableTriggerEventArgs`、datamap → `DictionaryTriggerEventArgs` | `Value` など | textfield（`changed.name`、「abc」も「十郎」も）・number（`changed.age`）・checkbox（`changed.agree`）の発火を確かめた。**同じ瞬間に変えた部品は最後の 1 つしか出ない**（下） |
| 入れ物の中（datagrid の列など） | `changed.<親の key>.<key>`（デザイナーの `CreateEventDefinition`） | | 確かめていない |

- **イベント名は「種類.key」の順**（`click.greet`、`changed.age`）。Studio の表示は「greet clicked」だが、XAML の `Event` はこの形。DLL の IL で確かめた：`Constants.FormatEventName(a, b)` は `a + "." + b` で、窓は `("window", "state_changed")`、部品は `FormIoRendered.HandleEventTriggered` が `("click", eventId)`、`BrowserController.NotifyValueChanged` が `("changed", key)`、デザイナーの `FormIoElementsEnumerator.CreateEventDefinition` も `("changed", <key のパス>)` で作る。トリガー（`FormTriggerActivity.HandleEventTriggered`）は `Event` と完全一致で比べる
- AUT-1209 で「部品のイベントが発火しない」と書いたのは、名前を `greet.click` と逆に書いていたため（AUT-1210 で分かった）。`tools/ir/forms.ts check` は逆の順を `FORM_EVENT_NOT_FOUND` で弾き、正しい書き方を出す
- `Tag` は文書の「Instance Name」で、インスタンスの絞り込み。トリガーごとの名札ではない（名札のつもりで別の値を入れると、どのイベントも合わずに発火しない）
- **同じ瞬間に 2 つ以上の部品を変えると、`changed` は最後に変えた部品の分しか出ない**（AUT-1213）。form.io は短い間の変更をまとめて `change` を 1 回出し、ページ（`FormIoHost.js` の `form.on('change')`）はその `args.changed`（最後の 1 つ）だけを `ValueChanged` で送る。名前を変えた直後（同じ JS の中）に年齢を変えると、送られたのは年齢だけで、名前は消えた。1 秒あけると両方送られ、両方発火した。人が打つ場合は部品ごとに時間があくので起きない。run で人の操作の代わりに値を入れるときは、部品ごとに `setTimeout` をずらす
  - AUT-1210 で「textfield の changed は発火しない」と書いたのはこのため（名前のすぐ後に別の部品を変えていた）。ランタイムの不具合ではない。C# 側は textfield を String として `NotifyValueChanged<String>` → `FormTriggerArgs<String>` → `TextTriggerEventArgs`（`Text`）に渡す（IL で確かめた）
- run での押し方：ExecuteScript で `setTimeout` を仕掛けてから Trigger Scope に入る（見本）。ボタンは `document.querySelector('button[name="data[<key>]"]').click()`、数値は `focus` → `value` → `input` のイベント → `blur`。ワークフローからの Set Form Values では `changed.<key>` は出ない（値の変化はページの操作だけ）
- ロボットの UI 操作（クラシックの Click / Type Into、`<wnd title='…' /><ctrl name='…' role='push button' />`）は、WebView2 の中の部品に届かなかった（値が変わらない）。押すのは ExecuteScript を使う

## 6. 動かして確かめたこと（2026-11-17、DESKTOP の RDP の画面、`queue-run.mjs`）

- 見本 18 本（9 アクティビティ × min / full）を XAML と Coded（XAML 経由）の両方で run し、期待ログと一致した（36 本）。非同期（`IsAsync=True`）で出し、値を書き・読み・閉じるので、人の入力は要らない
- 画面はスクショで確かめた（`samples/forms/FormScreenshots.json`：InvokeCode で画面を撮って `output/*.png` に保存する。`node tools/verify/queue-run.mjs --name <名前> --template C:\Users\Public\uipath-ir-probe-forms --use-project --no-coded samples/forms/FormScreenshots.json` → `C:\Users\Public\uipath-ir-probe-forms-<名前>-run\output\`）。初期値の表示、題と大きさの変更、Hide で消えて Bring to Front で戻る、HTML のフォームへの Set、を目で確かめた
  - **画面全体を撮る**ので、その時のデスクトップ（ほかの窓、ブラウザーの中身）も写る。撮った PNG は確かめたら消し、イシューやチャットに貼らない（2026-11-17 に、API キーの画面の一部が写っていた）
- **人の入力が要るもの**（run は build だけ。`*.verify.json` の `noRun`）：
  - 同期の Show Form（`IsAsync=False`。`ShowFormActivity.sync.json`）：人が送信するか閉じるまで止まる。Parallel のもう一方の枝から ExecuteScript で送信ボタンを押すと戻り（`Result=True`）、数値の Out は戻った。JS で入れた文字とチェックは、戻ったり戻らなかったりした（人の入力と違う入れ方のため。人が打った場合は未確認）
- 無人（Unattended）では動かさない。窓を出す画面が要る

## 7. デザイン（見た目を整える）

見本 `samples/data/forms/ExpenseRequest.uiform`（経費の申請）。入れ物・表・タブ・テーマを使い、窓だけを撮って直しながら作った（`samples/forms/ExpenseRequestScreenshots.json`）。IR の見本は `ShowFormActivity.design.json`（DataTable と DateTime の受け渡しも run で確かめた）。

### 入れ物（コンテナー）

Studio のランタイムにある入れ物は 5 つ。入れ物は値を持たず、中の部品の key がそのままフォームの key になる。

| type | 使いどころ | 書き方 |
| --- | --- | --- |
| `panel` | 見出し付きの枠（「申請者」など） | `title`、`theme`（`primary` など。Flatly では濃い紺の帯）、`collapsible`、`components` |
| `columns` | 横に並べる | `columns: [{ "width": 6, "size": "sm", "components": [...] }, ...]`（width は 12 分割）。**`size` は「この幅以上で横に並ぶ」区切り**：`sm` 576px、`md` 768px（既定）、`lg` 992px。窓の幅（DesignProperties.Width、CSS の px）より大きい区切りだと縦に積まれる。720 の窓では `md` が積まれた。窓が 1000 未満なら `sm` にする |
| `tabs` | 長いフォームを分ける | `components: [{ "key": "tab1", "label": "内容", "components": [...] }, ...]`（タブ自体には type を書かない） |
| `table` | 格子に置く | `numRows`、`numCols`、`rows: [[{ "components": [...] }, ...], ...]` |
| `container` | 中の値を 1 つのオブジェクトにまとめる | 中の key は外から読み書きしない（`container` の key で丸ごと） |

一覧で入力するもの（`datagrid`・`editgrid`・`datatable`・`datamap`）も中に部品を持つが、中の key は「行の中の列」。外からは表の key で、**DataTable** を Show Form の In・Get Form Values の Out に渡す（列名＝中の部品の key）。`datagrid` は `addAnother` で「行を足す」ボタンの文字を変える（既定は英語の Add Another）。

form.io にある `fieldset` と `well` は Studio の部品の一覧に無い（検査が `FORM_UNKNOWN_TYPE` で弾く）。

### テーマと CSS

- `DesignProperties.Theme`：`Default` / `Cosmo` / `Cyborg`（暗い色）/ `Flatly` / `Sandstone`（Bootswatch の Bootstrap。`FormIoThemes.js`）。ほかの値は Default
- `DesignProperties.CustomStyle`：CSS をそのまま `<style>` で差し込む。部品は `.formio-component-<key>` で指せる（例 `.formio-component-header h3 { margin: 0 }`）
- `DesignProperties.Padding`：窓の内側の余白
- 見出しや説明文は `content`（`html` に `<h3>`、`<p class="text-muted">`）。Bootstrap のクラスが使える
- ボタンは `theme`（`primary` / `secondary` / `success` / `danger`）と `block: true`（列の幅いっぱい）。送信とやめるを columns で横に並べる

### 日本向けに直すところ（スクショで見つけた）

| 部品 | 既定のままだと | 直し方 |
| --- | --- | --- |
| `phoneNumber` | 入力マスクが米国の形 `(___) ___-____` | `"inputMask": "999-9999-9999"` |
| `currency` | 「¥12,800.00」。`decimalLimit: 0` にすると「¥12,800.」と点が残る | `number` に `"prefix": "¥"`, `"delimiter": true`, `"decimalLimit": 0`（「¥ 12,800」） |
| `datagrid` | 行を足すボタンが「Add Another」 | `"addAnother": "行を足す"` |
| `datetime` | 書式が米国の形 | `"format": "yyyy-MM-dd"`、`"enableTime": false`。Show Form の In に DateTime を渡すと入る |
| `select` | 選択肢は `data.values` の `{label, value}`。値は value（In に `"dev"` を渡すと「開発」が選ばれる） | `"widget": "choicesjs"`, `"dataSrc": "values"` |

### 窓の大きさ

- RDP の画面（1280×800 相当、150%）では、`Height` 760 の窓は下が画面の外に出て、送信ボタンが見えなかった。**`Height` は 720 以下**にし、長いものは `tabs` で分ける（それでも溢れる分はスクロールになる）
- Show Form の `Left` / `Top` で置き場所を決められる（`Top` 16 など）

### 窓だけを撮って確かめる

画面全体を撮ると、デスクトップのほかの窓まで写る（6.）。`ExpenseRequestScreenshots.json` は、ExecuteScript で `JSON.stringify([window.screenX, window.screenY, window.outerWidth, window.outerHeight, window.devicePixelRatio])` を取り、InvokeCode で**その範囲だけ**（CSS の px に devicePixelRatio を掛け、題の帯の 32px を足す）を `output/*.png` に切り出す。タブを切り替えて撮る（`.nav-link` を click）、下までスクロールして撮る（`window.scrollTo`）もできる。撮った PNG は確かめたら消す。

## 8. 落とし穴

- build を飛ばす run（`--build-once`）では NoMapEntry で落ちる（2.）
- `FormId` を式で書けない（素のプロパティ）。変数で切り替えたいときは、フォームごとに Show Form を分ける
- `.uiform` を写したら `Metadata.Id` を変える
- 窓の大きさは DPI で拡大される。`DesignProperties` の `Width` / `Height` を小さくしすぎると部品がはみ出す。スクショで確かめる
- HTML のフォームの題は `<title>` ではなく Show Form の `Title`
