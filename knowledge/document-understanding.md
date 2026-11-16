# Document Understanding（Extract Document Data）

UiPath.DocumentUnderstanding.Activities の「Extract Document Data」を IR で書いて動かしたときに分かったこと（2026-11-14、3.3.0、トライアルのテナント）。

## 確かめたこと

- 見本は `samples/ir/UiPath.DocumentUnderstanding.Activities/ExtractDocumentDataWithDocumentData.min.json`。
  - 使ったモデル：Document Understanding の既定のモデル（Predefined の Invoices）。
  - 確かめ方：Studio Web のクロスプラットフォームのプロジェクトに入れ、クラウドのロボットで Debug した。
  - 結果：架空の請求書から、`Invoice Number=INV-1001`、`Document Date=2026-10-05`、`Total Amount=8100`、`currency=JPY`、`Vendor Name=Acme Trading Ltd.` が取れた。
- Flow の「Extract document（Preview）」は、実行時に INVALID_DOCUMENT で落ちる（knowledge/maestro.md の 10 節）。同じ請求書でも、この形なら動く。

## 書き方

- クラス名は `ExtractDocumentDataWithDocumentData`。型引数が要る。
  - `ExtractDocumentData` は browsable が false の古いもの。使わない。
- **型引数は `UiPath.IntelligentOCR.StudioWeb.Activities.DataExtraction.DictionaryData`**。プロパティは `GenerateData` を `False` にする。
  - Studio Web の既定は「Generate data type」がオン。このとき型引数は Studio が作るクラス（例 `...SWEntities.ExtendedExtractionResultsForDocumentData.Invoices.Bundle.Invoices`）になる。
  - そのクラスは、プロジェクトの `.entities/EntitiesBundle.*.zip` と `.project/JitCustomTypes*.json` にある。生成器では作れない。
- 出力は `ExtractionResults`。変数の型は `UiPath.IntelligentOCR.StudioWeb.Activities.DataExtraction.IDocumentData(Of ...DictionaryData)`。
- 入力 `FileInput` は `IResource`。Studio Web のファイルの引数（Entrypoint arguments で付ける）をそのまま渡せる。
- モデルの指定は文字列のプロパティでする。Predefined の Invoices の値：

  | プロパティ | 値 |
  | --- | --- |
  | `ProjectId` | `00000000-0000-0000-0000-000000000000` |
  | `ProjectName` | `Predefined` |
  | `ProjectTag` / `ProjectVersionName` | `Production` |
  | `ProjectVersionNumber` | `0` |
  | `DocType` / `ModernDocumentTypeId` | `invoices` |
  | `ModernDocumentTypeName` / `ExtractorName` | `Invoices` |
  | `ActivityMajorVersion` | `2` |

  ほかのモデルの値は、Studio Web で選んで `uip solution download --extract` で読む。
  - プロジェクトの一覧には、IXP のプロジェクト（`ixp_trial_invoices`）も出る。Flow の Extract ノードで作ったモデル（`Extract document (Preview)`、`InvoiceExtract`）も出る。
- 結果の読み方は `docData.Data` の `DictionaryData` のメソッドで読む。
  - メソッド：`GetFields()`（`ResultsDataPoint[]`。`FieldName` と `Values(0).Value`）、`GetFieldValue("Total Amount").Value`、`GetTables()`。
  - `JsonConvert.SerializeObject(docData.Data)` は `{"Handler":{}}` になり、中身が出ない。
- ルートの imports は、Studio Web が作った XAML から取る（`--imports-from`）。
  - BlankTemplate の並びだと `UiPath.Platform.ResourceHandling` が無く、Studio Web が「Type 'IResource' is missing」と言う。
  - `uip rpa build` は通ってしまうので、build だけでは分からない。

## 生成器に足したもの

- カタログ：`catalog/UiPath.DocumentUnderstanding.Activities/3.3.0.json` と `.portable.json`。
  - DLL は `lib/net6.0/UiPath.IntelligentOCR.StudioWeb.Activities.dll` と `UiPath.IntelligentOCR.dll`。
  - NuGet のキャッシュに入れるには、依存に足した作業用プロジェクトを build する。
- 型（`types-xaml.ts`）：`DictionaryData`、`IDocumentData`。
- 式で使えるようにする設定：`EXPRESSION_IMPORTS` に入れた xmlns の型を変数・引数に使うと、ルートの imports と AssemblyReference に名前空間とアセンブリを足す。
  - 足さないと build が `BC30002: Type 'IDocumentData' is not defined` で落ちる。
  - どの型にも足す形にすると、既存のスナップショットが変わる。なので表にした。

## Flow から呼ぶ

- `samples/maestro/deploy/DuViaRpa.flow.ts`：Flow のファイルの入力を `rpaWorkflow` の `inputs` で RPA の `IResource` の引数（`in_Invoice`）にそのまま渡す。RPA の出力の引数（`out_InvoiceNumber`、`out_Total`）は `$vars.<id>.output` に入る。
- 2026-11-14 に `debug.mjs --automate --profile trial` で、`{"out_InvoiceNumber":"INV-1001","out_Total":"8100"}` が返り、全部 Completed。
- RPA は Studio Web の Deploy で Shared/Solution 1 に出した（クラウドのロボットで動く）。key は `uip or processes list --all-folders --process-type Process` の Key。`registry search "rpa-workflow"` は 0 件だった。

## Flow の Extract ノードで作ったモデル（Preview）を、このアクティビティで呼ぶ

- Studio Web のプロジェクトの一覧で「Extract document (Preview)」を選ぶと、次の値になる。
  - `ProjectId`：モデルのプロジェクトの ID
  - `ProjectName`：`Extract document (Preview)`
  - `ProjectTag` / `ProjectVersionName`：`live`
  - `ProjectVersionNumber`：`1`
  - `DocType`：`default_extractor`
  - `ModernDocumentTypeId`：`00000000-0000-0000-0000-000000000000`
  - `ModernDocumentTypeName`：`Default`
  - `ExtractorName`：`IXP Default Extractor`
- 項目はフィールド グループの下（`Default.SalesOrder` など）。
- 2026-11-14 に 3.3.0 で run すると、抽出が `Internal Server Error ... [UnexpectedInternalServerError]` で落ちた。
- 公式の文書は 3.6.0-preview 以降を求める。Studio Web で依存を 3.6.0-preview にすると、「Installing dependencies」から 5 分以上進まず、試せなかった。
- Flow のノードで実行したときの INVALID_DOCUMENT と合わせると、Preview のモデルは実行時に呼ぶ経路がまだ通らない。

### 文書で分かったこと（2026-11-17、AUT-1197）

- **Extract ノードのモデルは DU API v2（`api-version=2`）で呼ぶ**（文書）。呼び方は、タグで呼ぶ（`documentTypeId` は `00000000-…`）か、extractorId（`gpt_ixp_<版>`）で呼ぶかの 2 つ。上の 500 は v1 の形（`DocType` が `default_extractor`）で呼んだときのもので、これだけでは「サーバーの抽出が落ちている」とは決められない。
- **RPA から呼ぶには、DU.Activities 3.6.0-preview 以上と、ソリューションの中のモデルと、「Use Solution Resources」が要る**（文書）。上の 3.3.0 の試しは条件を満たしていない。
- **Flow で作ったモデルは、テナントの DU API v2 のプロジェクトの一覧（`GET /du_/api/framework/projects?api-version=2`）に出ない**（2026-11-17、Sorahane Trial。出たのは Predefined の 3 つと IXP の `ixp_trial_invoices` だけ）。ソリューションの資源として扱われ、外からは呼べないとみられる。
- INVALID_DOCUMENT の中身は、Orchestrator の IXP models → Runs → trace の Files で、入力・プロンプト・出力が見られる（文書）。AI Trust Layer の Audit には IXP の名前で記録される（無ければ異常）。
- **DU API v2 は 2026-06-26 に GA**。v1 から変わって壊れる点：キーが PascalCase（上の一覧も `Projects`・`Id`）、タグの経路が `/projects/{id}/tags/{tag}/…`、Discovery が `taxonomy` を返す、IXP の結果が `FieldGroup` になった。

## 文書で分かったこと（2026-11-15 の突き合わせ、AUT-1203）

公式の文書（ixp・document-understanding）で分かり、まだテナントで試していないもの。番号は AUT-1203 の表の番号。1・2・9 は上の節。

### Flow の Extract ノードのモデル

- **調べる手段**（3・4）：Orchestrator のフォルダの IXP models タブ（絞り込みを IXP）→ モデルの Runs → trace の Files で、入力・プロンプト・スキーマ・出力が見られる（見られるのは予測を出した本人だけ）。AI Trust Layer の Audit には、設計時も実行時も IXP の名前で 1 job 1 件・60 日残る。Sorahane Trial で記録が無かったのは、それ自体が異常の手がかり。
- **実行に要る権限**（5）：抽出の run を始める `IXPModels.View`・`Jobs.Create`、結果と trace を見る `IXPModels.View`・`Logs.View`、止める `Jobs.Edit`、デプロイ `SolutionDeployments.Create`、設計時 `Jobs.View`。
- **使い道は 4 つ**（10）：同じソリューションのほかの Flow（In this solution）、ほかのソリューション（デプロイしてから Published）、RPA、DU API v2。
- **Validate extraction ノード**（8）は、同じ Flow の中で Extract document から作った Extract にしか使えない。Published のモデル（`ixpExtract`）で人に確かめさせるなら、RPA の Create Validation Task か、エージェントの Document Validation Task（[agents.md](agents.md)）。
- **出力の形**（7）：Studio Web の Extract document は `version`・`type`・`result`・`taxonomy`・`metadata`。Published の `ixpExtract` は `ExtractionResult`（[maestro.md](maestro.md) の 9 節。AUT-1188 で確かめた）。
- **設定で知識に無いもの**（17）：Page range、Extraction strategy（Standard / Advanced。Advanced で Attribution が消える）、Layout parsing（None / Full）、Attribution（Rules-based / Model-based）、Overrides（JSON）、エラーの道、出力の Static mock / Generated。
- **ソリューションの中のモデル**（39）：Explorer の IXP models から Remove from solution。Deploy の横の矢印で Publish だけ。デプロイ後の Change version でモデルの版も一緒に変わる。
- **出た日**（40）：IXP のリリースノートでは 2026-10-23 に Preview（Maestro のリリースノートは 10-30）。

### IXP のプロジェクト（UCD）

- **デプロイは 2 種類**（11）：To project（タグ live / staging。Studio のアクティビティ・API・エージェントの道具が使う。`uip ixp projects publish --tag`）と To folder（preview。Orchestrator の IXP models に出て、Flow の Published が使う。`uip ixp deployments create`）。
- **Community の `deployments create` の 403**（6）：To folder には、デプロイ先のフォルダの Orchestrator の権限「IXP Models - Create」と、IXP の「IXP Package Reader」の役割が要る（文書）。
- **Runtime permission checks**（19）：プロジェクトごとの切り替え。オンにすると Project Execute を持つ役割（IXP Developer・IXP Automation User・IXP Project Admin）の利用者・ロボットしか見つけられない。エージェントの実行時は IXP Automation User が要る。
- **役割の変更**（34、2026-08-11）：IXP Project Creator が増えた（作った人がそのプロジェクトの admin）。タクソノミーの取り込み・書き出しは Dataset - Review、モデルの設定は Dataset - Write に変わった。
- **キャッシュ**（12）：モデルの設定とタクソノミーを変えずに同じ文書を処理し直すと、キャッシュした予測を返す。同じ PDF で試し直しても、確かめたことにならない。
- **データ型は 15 種類**（15）：Exact text、Inferred text、Choice（表示の値と Alternate values）、Number、Monetary quantity、Date、Date and time、Time、Duration、Email、Hostname、IPv4、IPv6、UUID、Boolean。
- **タクソノミーの取り込み・書き出し**（16）：Extract ノードは Open full view → Taxonomy → Import/Export（JSON。同じ名前は上書きか複製。型が違うものは複製）。UCD は Manage taxonomy → Import。UCD から書き出したものは Extract ノードに取り込める。
- **Autopilot のタクソノミー**（27）：上げた文書は合計 100 ページまで使う。作られたものは直接は直せない（作り直すか、作ってから Manage Taxonomy）。
- **評価**（36）：タグで文書を絞れる。Batch size 1〜50（既定 10）、Timeout 5〜500 分（既定 20）。注釈を付けても、Action Center で確かめても、モデルは学ばない。
- **CLI `re`**（26、github.com/reinfer/cli）：`re -c <設定> package download --file x.zip` / `package upload x.zip --name …` で、プロジェクトをテナントの間で移せる。
- **信頼度**（28）：log probability を返さないモデル（Gemini 3.1 Pro Preview・3.1 Flash Lite・3.5 Flash・3.5 Flash Lite、gpt-5.4）は、信頼度がいつも 1.0（抜けなかった項目は 0）。
- **モデルの入れ替わり**（29）：2026-10 に gpt-5.1 / 5.4・Gemini 3.5 Flash Lite が GA、Claude Sonnet 4.6 / 5 が preview、Gemini 3.6 / 3.7 Flash は非推奨（3.8 Flash へ）。`dynamicExtract` の `config.model` の値は古くなる。
- **BYOS**（30、preview）：自分の Gemini / GPT の契約で動かす。Integration Service の接続 → AI Trust Layer → ポリシー → テナントに割り当て。

### 上限

- **設計時**（13）：Flow の Extract は 1 フィールド グループ 32 項目、名前 64 文字、指示 4,096 文字、文書の合計 200 MB。UCD は名前 128 文字、指示 2,048 文字、1 プロジェクト 200 文書。Flow の Extract の上限は、`tools/maestro/verify.mjs` が `EXTRACT_LIMIT`（error）で止める（`extract-limits.mjs`）。
- **実行時**（14）：IXP は GPT-4o で 50 ページ、Gemini で 500 ページまで。値が約 200 を超えると token の上限に当たりやすく、出現と信頼度が 0 で返る（対策は Extraction strategy を Advanced。約 1,200 値まで）。DU API の同期の抽出・分類は 5 ページ、非同期は 500 ページ・150 MB（digitization は 160 MB）。DU のプロジェクトは Helix の実行時 100 ページ、既製のモデルは 20 ページ、並列 10 件。
- **データの残り方**（37）：digitization の結果と文書は 7 日。非同期の抽出・分類の結果は 24 時間、同期は残らない。確かめのデータは Storage Bucket。Delete API（preview）で `documentId` ごとに消せる。

### Document Understanding（RPA と API）

- **DU.Activities と IntelligentOCR**（20）：DU.Activities は Studio Web・StudioX・Desktop で使え、入出力は Document Data 1 つ（分割、Taxonomy Manager のルール、1 つの種類に抽出方法を複数、はまだできない）。IntelligentOCR は Windows だけ（Data Extraction Scope・Taxonomy Manager・DU Process template）。生成器は DU.Activities だけを扱う。
- **人に確かめさせる**（21）：Create Validation Task ＋ Wait for Validation Task and Resume、Create Validation Task and Wait、Present Validation Station（attended）、Create Document Validation Artifacts ＋ Create App Task。生成器の見本にはまだ無い。新しい形（35、preview）は、artifacts の API で材料を Storage Bucket に作り、App Task は呼ぶ側が作る。
- **別の組織・テナントのモデル**（18）：Extract Document Data の Use Solution Resources をオフにし、External connection に Credentials Asset と Tenant URL を入れる。課金はモデルのあるテナントに付く。
- **日本語**（22）：既製のモデルに Invoices Japan（`invoice-no`・`vendor-vat-no` など）。Document Type Classifier はラテン文字以外に対応しない（分類を使わなければ抽出は動く）。Helix Extractor 2.0 は対応する。
- **生成 AI の抽出器**（23）：Generative Predefined のプロジェクトで Prompt の引数を使う（1 件 150 項目、プロンプト 1,000 文字、500 ページ、文書は 10 文字以上）。学習も IXP も無しで項目を指定して抜ける。
- **Quick start in Studio**（24）：文書を 1 つ上げると、Extract Document Data を置いた Studio Web のワークフローを作る（JPG・PDF・PNG、14 MB・20 ページまで。ファイル名に `#` や `&` は不可）。
- **Field Groups と Monetary Quantity が GA**（25、2026-06-26）：新しいパッケージでは、上の `DictionaryData` の `GetTables()` で読む形が FieldGroup で返る形に変わる可能性がある。
- **IntelligentOCR の Project Extractor**（38）：Project Name は作ったときと同じ大文字・小文字で書く。
- **課金**（31、2026-07-08）：digitization は無料、分類と抽出は別々に課金。Flex は 1 ページ 1 AI Unit まで、Unified は 1 ページ 0.2 Platform Units。
- **Helix Extractor 2.0 が GA、1.0 は非推奨**（32、2026-06-30）：デプロイ済みの版は 2026-08 末までに 2.0 へ自動で移った。2.0 は実行時 100 ページまで、文書のタグ（batch）に未対応。
- **学習は手で始める**（33、2026-05-13）：Start Training のボタン。スキーマや基のモデルを変えても自動では始まらない（zip を取り込んだときだけ自動）。
