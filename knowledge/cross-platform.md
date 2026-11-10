# Windows とクロスプラットフォーム

UiPath のプロジェクトには、Windows（`project.json` の `targetFramework` が `Windows`）と、クロスプラットフォーム（`Portable`）がある。どちらもこの道具で作れて、行き来もできる（`tools/ir/migrate-platform.ts`）。

Studio 26.10 で両方の空のプロセスを作って比べ、パッケージのクロスプラットフォーム用の DLL を Windows 用と同じ抽出器で読んで確かめた。

## 移す

```bash
node tools/ir/migrate-platform.ts --project <P> --to Portable [--dry-run]   # Windows → クロスプラットフォーム
node tools/ir/migrate-platform.ts --project <P> --to Windows  [--dry-run]   # クロスプラットフォーム → Windows
```

1. 移る先の版のカタログを選ぶ。クロスプラットフォームは `catalog/<パッケージ>/<版>.portable.json`。無ければ作り方を出して止める（下の「カタログ」）
2. `<P>/ir/*.json` を移る先のカタログで検証する。移る先に無いアクティビティ・プロパティがあれば、場所を挙げて止める（何も書かない）
   ```
   移せない ir\Main.json body[1]: MultipleAssign（UiPath.System.Activities）はクロスプラットフォームに無い
   ```
   IR を直して（別のアクティビティにする）、もう一度流す
3. IR の無い XAML（Studio で作ったもの）は、移る前のカタログで `<P>/ir/<workflow>.json` に取り込む。取り込めなければ止める（C# の式の XAML、サブフォルダの XAML はまだ取り込めない）
4. `project.json` の `targetFramework` を書き換え、XAML を IR から作り直す

- `--dry-run` で、何も書かずに移せるかだけ調べられる。移す前に、プロジェクトを git に入れるか写しておく
- Coded の `.cs` は作り直さない（`gen-coded.ts` で作り直す）
- `runtimeOptions.requiresUserInteraction` は変えない（Studio の空のプロジェクトでは Windows が `true`、クロスプラットフォームが `false`。UI を操作するかで決める）
- 移したあとの `gen.ts` / `gen-coded.ts` は、`--project` の `targetFramework` を見て、そのカタログとルートの参照で作る

## Studio の空のプロジェクトの違い（26.10、VB）

| | Windows | クロスプラットフォーム |
| --- | --- | --- |
| `project.json` の `targetFramework` | `Windows` | `Portable` |
| `runtimeOptions.requiresUserInteraction` | `true` | `false` |
| Main.xaml の AssemblyReference | `PresentationFramework`、`WindowsBase`、`PresentationCore` がある | その 3 つが無い。`System.Data.Common` が `System.Data` の後ろ |
| 依存の実体 | `UiPath.System.Activities.Runtime.Windows` | `UiPath.System.Activities.Runtime.Portable` |

ほかは同じ（`expressionLanguage` は VB も C# も選べる、`dotNetVersion` は `net10.0`、namespaces も同じ）。

## カタログ

クロスプラットフォームで使えるアクティビティは、パッケージの `lib/net6.0` の DLL（Windows は `lib/net6.0-windows7.0`）にあるもの。Windows のカタログと同じ抽出器・同じ引数で作る：

```bash
bash tools/catalog-extractor/extract-portable.sh <パッケージ> <版>    # 1 つ
bash tools/catalog-extractor/extract-portable.sh --all                 # catalog/ にある版のうち、DLL が手元にあるもの全部
node tools/catalog-diff.ts catalog/<パッケージ>/<版>.json catalog/<パッケージ>/<版>.portable.json   # Windows との違い
```

- DLL は `<pkg>.runtime.portable` → `<pkg>.runtime` → `<pkg>` の順に探す。手元に無ければ、その版を依存に入れたクロスプラットフォームのプロジェクトを Studio で開くか build すると、NuGet のキャッシュに入る
- `.objects.json`（UI のターゲットなどの型）は Windows のものを使う
- .NET の `System.Activities` と Coded の基底クラス（`UiPath.CodedWorkflows`）は、どちらでも同じカタログ

### 今あるもの（Windows → クロスプラットフォームのアクティビティ数）

| パッケージ | 版 | Windows | クロスプラットフォーム |
| --- | --- | --- | --- |
| UiPath.System.Activities | 26.10.0 | 186 | 150 |
| UiPath.Excel.Activities | 3.6.1 | 128 | 22（ブックのファイルを直接読み書きするものと CSV だけ。Excel を開く `ExcelApplicationCard` などは無い） |
| UiPath.MicrosoftOffice365.Activities | 2.2.7 | 135 | 56（Integration Service の `*Connections` 版） |
| UiPath.MicrosoftOffice365.Activities | 3.12.11 | 185 | 108 |
| UiPath.UIAutomation.Activities | 26.10.6 | 211 | 66（モダンの `N〜` だけ。下の「UI 操作」） |
| UiPath.Mail.Activities | 2.12.10 | 49 | 27（Outlook デスクトップ、Lotus Notes、Exchange の旧版、`CreateDraft` などが無い。IMAP / POP3 / SMTP、`〜X` の版、Gmail・Exchange のカードはある） |
| UiPath.Persistence.Activities | 1.13.0 | 20 | 20 |
| UiPath.Testing.Activities | 23.4.1 / 25.10.1 | 22 / 25 | 同じ |
| UiPath.WebAPI.Activities | 1.20.1 | 8 | 8 |
| UiPath.DataService.Activities | 26.10.1 | 12 | 12 |

まだ無いもの（手元にクロスプラットフォームの DLL が無い）：UiPath.UIAutomation.Activities 25.10.33 / 26.10.3、UiPath.Mail.Activities 1.21.1、UiPath.SAP.BAPI.Activities 3.0.1、UiPath.System.Activities 24.10.7 / 26.2.6。これらの版を使うプロジェクトは、クロスプラットフォームに移そうとすると「カタログが無い」で止まる。UiPath.IntegrationService.Activities は Windows のカタログも無い。

- パッケージのクロスプラットフォーム版に、Windows のカタログの DLL の一部が無いことがある。そのアセンブリのアクティビティはクロスプラットフォームに無い（`extract-portable.sh` が「〜はクロスプラットフォームに無い」と出す）

### UI 操作（26.10.6）

クロスプラットフォーム版（`uipath.uiautomation.activities.runtime.portable`）には `UiPath.UIAutomationNext.Activities.dll` と API の DLL しか無い。

- クラシックのアクティビティ（`UiPath.UiAutomation.Activities.dll`：`Click`、`TypeInto`、`OpenBrowser` など 125）と CV（`UiPath.CV.Activities.dll`：18）は全部無い
- モダンのうち無いのは `NSAPLogon` と `NSetBrowserData` だけ。`NApplicationCard` の `OCREngine` も無い
- オブジェクトリポジトリ（`.objects`）と `$ref` はそのまま使える（`.objects` はどちらでも同じ形）

### System 26.10.0 でクロスプラットフォームに無いもの（36）

`AskWhenRun`、`AssignOperation`、`Beep`、`BuildDataTable`、`CreateList`、`CustomInput`、`DeleteFileX`、`DeleteFolderX`、`ExecutePowerShell`、`FileChangeTrigger`（V2・V3 も）、`FileExistsX`、`FolderExistsX`、`ForEachFileX`、`ForEachFolderX`、`FormatValue`、`GetFileInfoX`、`GetFolderInfoX`、`GetTransactionItem`、`GetUsernamePasswordX`、`IfElseIf`（`IfElseIfV2` はある）、`InputDialog`、`InvokeComMethod`、`InvokePowerShell`、`InvokeVBScript`、`InvokeWorkflowInteractive`、`MoveFolderX`、`MultipleAssign`、`ProcessEndTrigger`（V2 も）、`ProcessStartTrigger`（V2 も）、`RenameFolderX`、`SelectFile`、`SelectFolder`

- DLL の型の定義を直接見て、無いことを確かめた（名前の文字列は DLL にあっても、型は無い）
- 置き換えの例：`MultipleAssign` → `Assign` を並べる、`IfElseIf` → `IfElseIfV2`、`BuildDataTable` → `Assign` で `New DataTable` を作って列を足す
- プロパティの違い：`OrchestratorHttpRequest.RelativeEndpoint` がクロスプラットフォームでは必須、`FilterDataTable` に `OutputFirstRow` がある

## 確かめたこと

- `LogMessage` と `Assign` だけのワークフローを Windows → クロスプラットフォーム → Windows と移し、どちらも run の窓口で build が通った。戻した XAML は元と文字まで同じ
- オブジェクトリポジトリを使う UI 操作のプロジェクト（`NApplicationCard`、`NClick`、`NTypeInto` と `$ref`）をクロスプラットフォームに移し、Main と Sub の build が通った
- まだ見ていないもの：クロスプラットフォームでの run、C# のプロジェクトの移行
