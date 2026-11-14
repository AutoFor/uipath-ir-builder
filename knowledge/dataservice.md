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
