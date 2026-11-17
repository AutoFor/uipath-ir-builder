# Data Fabric（Data Service）を RPA から使う

UiPath.DataService.Activities 26.10.1 の 11 のアクティビティを IR で書いて、テナントで動かしたときに分かったこと（2026-11-14）。
App から使う形（表の部品、ボタンの手順）は [apps.md](apps.md) の「Data Fabric の表」、Flow から使う形は [maestro.md](maestro.md)。

## 確かめたこと

見本は `samples/ir-unbuildable/UiPath.DataService.Activities/RecordAndFileActivities.full.json`。

- 使った表：試しの表 `IrProbeItem`
  - Title：文字、必須
  - Amount：小数 0 桁
  - Note：文字
  - Attachment：ファイル
- 動かし方：トライアルのテナントで、DESKTOP のロボットから run の窓口を通して動かした。
- 11 のアクティビティすべてが動いた。最後に全部消したので、表は 0 件で終わった。

| アクティビティ | 結果のログ |
| --- | --- |
| CreateEntityRecord | `CREATE id=… title=one` |
| GetEntityRecordById | `GET title=one amount=100` |
| UpdateEntityRecord | `UPDATE title=one-updated note=updated` |
| CreateMultipleEntityRecords | `CREATE MANY count=2` |
| UpdateMultipleEntityRecords | `UPDATE MANY titles=two-updated,three-updated` |
| QueryEntityRecords | `QUERY count=3` |
| UploadFileToRecordField | `UPLOAD done` |
| DownloadFileFromRecordField | `DOWNLOAD …\irprobe-dl = hello data fabric` |
| DeleteFileFromRecordField | `DELETE FILE done` |
| DeleteMultipleEntityRecords | `DELETE MANY failed=0` |
| DeleteEntityRecord | `DELETE done` |

## 書き方

- どれも型引数に表の型を書く：`"typeArg": "DataService.Entities.<表>"`
  - XAML では `de:<表>` になる。生成器が `DataService.DataService.Entities` の参照と、`DataService.Entities` の import を足す。
- 表の指定は `EntityId`（`New Guid("<表の id>")`）。
  - 表の id は `uip df entities list` の `Id`。テナントごとに違う。
- **Create と Update は、列の値を 2 か所に書く。**
  - **`State`（`objs`）**：使う列の一覧。
    - 形は `RecordState`（`RequiredFieldCount` と `SelectedFields`）。
    - `SelectedFields` の各要素は `DynamicEntityField` で、`Id`（列の id）、`Name`、`IsRequired`、`ArgumentValue` を持つ。
    - `ArgumentValue` は型の決まっていない引数なので、`{ "type": "<型>", "value": <式> }` で書く。生成器が `<InArgument x:TypeArguments="…">` にする。
  - **`InputEntityInFieldView`**：同じ値を `new DataService.Entities.<表>() With { .Title = "one", … }` で書いたもの。
  - 片方が無いと、run の前の検証で落ちる。
    - Create：「1 つ以上の必須フィールドが設定されていません」
    - Update：「更新するには少なくとも 1 つのフィールドを設定する必要があります」
  - `InputEntity` だけ書いても、`IsInRecordView="True"` を足しても通らない。
  - `RequiredFieldCount` は表の必須の列の数。列の id は表の定義の `fields[].id`。
- 出力：
  - 1 件のもの（Create、Get、Update）は `OutputEntity`（表の型）。
  - 一括のもの（CreateMultiple、UpdateMultiple、Query）は `OutputRecords`（`IList<表>`）。
- 一括の入力：
  - Create と Update の `InputRecords` は `ICollection<表>`（`New List(Of …) From {…}`、`recs.Select(…).ToList()`）。
  - DeleteMultiple の `InputRecords` は `ICollection<Guid>`（`recs.Select(Function(r) r.Id).ToList()`）。
- ファイル：
  - `Field` は列の名前（`{ "lit": "Attachment" }`）、`RecordId` はレコードの id。
  - Upload は `FilePath`（ローカルのパス）か `FileResource`。
  - Download は `FilePath`（保存先）で、`DownloadedFileResource`（`ILocalResource`）が出る。
- 一括の作成・更新は、行の id を引き継ぐときに `.Id = r.Id` を入れる。
- **範囲（Tenant / Folder。26.10.0 で GA、AUT-1194）**：どのアクティビティも `BaseEntityActivity` の `ScopeValue`・`SolutionEntityKey`・`SolutionEntityName` を持つ（カタログ 26.10.1）。
  - テナントの表（今までの書き方）：`ScopeValue` を書かないか `"Tenant"`。`SolutionEntityKey`・`SolutionEntityName` は書かない。
  - フォルダの表：`"ScopeValue": "\"Folder\""`、`"SolutionEntityKey": "\"<ソリューションの表の資源の key>\""`、`"SolutionEntityName": "\"<表の名前>\""`。実行時はアクティビティが `X-UiPath-FolderPath` を付けて、ソリューションのフォルダの表に当たる。見本は `samples/ir-unbuildable/UiPath.DataService.Activities/DeleteEntityRecord.folder.json`。
  - 生成器の検査 `DS_SCOPE`：Folder なのに key か名前が無い、Tenant なのに key か名前がある、を止める。
  - 出典：スキル uipath-rpa の `activity-docs/UiPath.DataService.Activities/overview.md` の「Solution Context」。DLL の表示名は Tenant / Folder（日本語の画面では テナント / フォルダー。Studio Web の RPA アプリは `ScopeValue="テナント"` と書いた）。
  - フォルダの表はソリューションの中でだけ動く（手元のワークスペース・単体のプロジェクトでは Tenant だけ）。RPA アプリ（`rpa-app.ts`）はフォルダの表を使えないので Tenant のまま。
  - まだ：フォルダの表を Studio で選んだときの XAML の実物（`SolutionEntityKey` に入る値の形、`bindings_v2.json` の `BoundEntityFolderPath`）と、ソリューションでの実行。

## 表の定義（.entities/EntitiesStore.json）

- 型は、プロジェクトの `.entities/EntitiesStore.json` から build のときに作られる。
- Studio Web の書き出しには、**その App を保存したときの表しか入らない**。あとで作った表は入らない。
- `tools/apps/df-entities-store.ts` で、`uip df entities list` の出力から表を足せる。
  - WorkCalendar の書き出しと比べて、キーの順まで同じになることをテストで見ている。
  - 型の名前は対応表で付け替える（STRING → NVARCHAR、BOOLEAN → BIT など）。
  - ファイルの列は書き出しの例が無く、UNIQUEIDENTIFIER とみなした（これで build と run は通った）。

```bash
uip df entities list --output json > df.json
node tools/apps/df-entities-store.ts df.json <元の EntitiesStore.json> <表> --out <プロジェクト>/.entities/EntitiesStore.json
# 別のテナントの表を使うとき：組み込みの SystemUser と選択肢セットの id も付け替える
uip df choice-sets list --output json > cs.json
node tools/apps/df-entities-store.ts df.json <元の EntitiesStore.json> <表> --rebase cs.json --out …
```

- 見本の表の定義は `samples/dataservice/irprobe.entities.json`。トライアルのテナントの id なので、テナントが変われば作り直す。

## 落とし穴

- **ロボットがつながるテナントを確かめる。**
  - 「`Entity '<表>' not found at tenant level`」や「`Entity <表> does not exist`」は、ロボットが別の組織・テナントにつながっているときに出る。
  - DESKTOP のロボットは、設定では会社の組織（`UiPathServerUrl`）だった。それでも、Assistant がトライアルの組織にサインインしていたため、トライアルのテナントを見ていた（2026-11-14）。
  - 表は、ロボットが見ているテナントに作る。
  - 組織のサインインの状態は `%APPDATA%\UiPath\store.json` に出る。
- 数値の列を作るときは `DECIMAL`（`decimalPrecision: 0`）を使う。`INTEGER` は Data Fabric の画面で扱えないと `uip df` が断る。
- `samples/ir` には置けない。表の型が無いと build できないため、`samples/ir-unbuildable` に置いて、検証と生成だけテストする。

## 文書で分かったこと（2026-11-15 の突き合わせ、AUT-1206）

番号は AUT-1206 の表の番号。まだテナントで試していない。2 は AUT-1194。

### ソリューションとフォルダの表

- **ソリューションに入るのはフォルダの表だけ**（1）：テナントの表はデプロイ先にもとから無いと動かない（この道具の RPA と App の見本はテナントの表を使っている）。フォルダの表は使うと自動でリソースになり、関係先・選択肢セットも入る。デプロイでは表の形だけが作られ、データは写らない。版を上げると形が直され、データは残る。型を変えると衝突になる。アンインストールでは、データのある表は残る。
- **フォルダの表を使えない場所**（4）：単体の VB Apps、RPA（UB）Apps、Unified Projects、手元のワークスペース。エージェントの道具（Data Fabric の活動、プレビュー）もテナントの表だけ（コンテキストはどちらも使える。25）。同じ名前の表を 2 つ、1 つのワークフローに入れられない。テナントとフォルダをまたぐ関係は作れない。
- **フォルダの表の権限**（15）：Orchestrator のロールの Entity Records・Entity Schema・Entity Roles。その上に Data Fabric の画面（Manage Access → Folder entities role）で表ごとの RBAC。反映は 2 分のキャッシュで遅れる。関係のある表は両方のフォルダに権限が要る。
- **表の差し替え**（16）：デバッグは Debug configuration で（今の表・別のフォルダの同じ形の表・外して新しく作る）。実行は Orchestrator の Package Requirements。デプロイのときには差し替えられない。テナントをまたぐ差し替えはできない。
- **形を変えたあとの更新**（22）：Studio Web は表の欄の横の Refresh。コネクタの活動はソリューションのリソースで Update Configuration → 活動で Refresh Schema。

### 表と列

- **型**（12・13）：Studio での型は Number → Decimal、Auto-number → Integer（開始値は Int64）、Date-Time → DateTimeOffset、Date → DateTime、選択肢セット → Enum、複数選択 → `HashSet<Enum>`。ファイルの列はレコードの中で `UiPath.DataService.Definition.EntityAttachment`（Name・Path・Size・Type、無ければ null。1 ファイル 10 MB まで）。`tools/apps/df-entities-store.ts` の `SQL_TYPE` に自動採番と複数選択はまだ無い（書き出しの `sqlType` の名前を、その列のある表で確かめてから足す）。
- **名前と列の決まり**（23）：表と列の Name は英数字 3〜30 文字で英字で始まる。作ったあとは名前も型も変えられない。一意（Unique）は文字と数値だけ（大文字小文字を区別しない。一度外すと付け直せない）。文字の長さは既定 200（1〜4,000）、複数行は 1〜10,000。数値は小数 0〜10 桁（既定 2）。
- **関係と選択肢セット**（24）：テナントの表はテナントの表とだけ、フォルダの表は権限のあるフォルダの表とだけ関係を持てる。選択肢セットにも範囲があり、変えられない。値は 250 個まで。使われている選択肢セットは消せない。
- **System User の表**（29）：Created By と Updated By は System User への関係の列。User Type の選択肢セット（User / Group / Robot）がある。消すことも変えることもできない。
- **Native と Federated**（19・20、2026-09-22 に GA）：作ったあとは変えられない。Federated は読むだけ（書くとエラー）で、行の RBAC と Insights は無い。Federated の照会は絞り込みが要る（Data タブと 200 件以下で offset の無い読み出しは除く）。データウェアハウスは 1 頁しか返さない。1 回 50 MB 以下が目安。

### 上限・API

- **件数と量**（14）：Query Entity Records の Top は 1 回 1000 件まで（Skip で頁を送る）。一括の活動も 1 回 1000 件で、1 回が API 1 回に数えられる。1 日の API 呼び出しは Community 1,000 回、Enterprise（トライアルを含む）は DFU 1 つごとに 10,000 回。容量はデータ 100 MB / 1 GB、添付 500 MB / 5 GB。
- **複数の表を結合して読む**（18、2026-09-22 に GA）：Query Multiple Entity Records。Inner / Left、結合は 3 つまで。システムの列・暗号化した列・選択肢セット・ファイルは結合のキーにできない。集計は関数 5 つと groupBy 5 つまで（行の権限は集計に効かない）。IR にはまだ無い。
- **REST API**（27）：入口は `…/datafabric_/api`（Public Sector と Dedicated は `dataservice_`）。名前が違うと `Accept: application/json` を付けないかぎり 200 と HTML が返る。`expansionLevel` は 1〜3（既定 2）。呼ぶなら `node tools/platform/cloud-api.mjs ... --service datafabric_`（[cloud-ops.md](cloud-ops.md)）。
- **CSV の取り込み**（28）：画面は 10 MB・30,000 件まで（Firefox 不可。関係・選択肢セット・自動採番の列は取り込めない。最初の 100 件のうち 80 件が失敗すると全体が失敗）。API は `POST …/EntityService/<表>/bulk-upload`。
- **表の形の書き出し・取り込み**（11）：画面の Import/Export で JSON（取り込みは 30 MB 未満、テナントにもフォルダにも入れられる。同じ表があると無い列だけ足すか取り込まないか）。テナントの表をフォルダに写す公式の手段。

### イベントとコネクタ

- **イベントは、トリガーの接続の利用者に表を読む権限が要る**（3、2026-02-19 から）。無いとイベントが届かず起動しない。列の権限が無いと、その列を抜いて届く。
- **Connected と Disconnected**（10）：Studio や Flow のトリガーの活動（Connected）はレコードそのものが `output` に入る。Orchestrator のイベントのトリガー（Disconnected）はイベントの情報（`UiPathEventObjectId` など）だけで、Get Entity Record by Id で取りに行く（[api-workflow.md](api-workflow.md) の観察と同じ）。Data Fabric のイベントは webhook で届く。
- **コネクタの名前**（21、2026-05-27 に GA）：「UiPath Data Fabric connector」（key は `uipath-uipath-dataservice` のまま）。2026-02-24 から Query Entity Records に絞り込みの組み立て画面。IS の活動は、従来の活動が使えない Maestro・API ワークフロー・エージェントでだけ出る。
- **VS Code の Data Fabric のプロジェクト**（17、プレビュー）：`.entity` ファイル（JSON）で表を作る。Flow の組み込みの 4 つのノードは IS の接続なしで使える（フォルダのネイティブの表だけ）。表のプロジェクトだけのソリューションはデプロイできない。
