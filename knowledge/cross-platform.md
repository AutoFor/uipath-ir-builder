# Windows とクロスプラットフォーム

UiPath のプロジェクトには、Windows（`project.json` の `targetFramework` が `Windows`）と、クロスプラットフォーム（`Portable`）がある。どちらもこの道具で作れて、行き来もできる（`tools/ir/migrate-platform.ts`）。

Studio 26.10 で両方の空のプロセスを作って比べ、パッケージのクロスプラットフォーム用の DLL を Windows 用と同じ抽出器で読んで確かめた。

## 移す

```bash
node tools/ir/migrate-platform.ts --project <P> --to Portable [--dry-run]   # Windows → クロスプラットフォーム
node tools/ir/migrate-platform.ts --project <P> --to Windows  [--dry-run]   # クロスプラットフォーム → Windows
```

1. 移る先の版のカタログを選ぶ。クロスプラットフォームは `catalog/<パッケージ>/<版>.portable.json`。無ければ作り方を出して止める（下の「カタログ」）
2. `<P>/ir/**/*.json`（サブフォルダも）を移る先のカタログで検証する。移る先に無いアクティビティ・プロパティがあれば、場所を挙げて止める（何も書かない）
   ```
   移せない ir\Main.json body[1]: MultipleAssign（UiPath.System.Activities）はクロスプラットフォームに無い
   ```
   IR を直して（別のアクティビティにする）、もう一度流す
3. IR の無い XAML（Studio で作ったもの）は、移る前のカタログで IR に取り込む
   - IR は XAML と同じフォルダの形に置く（`Main.xaml` → `ir/Main.json`、`Sub/Greet.xaml` → `ir/Sub/Greet.json`）。サブフォルダの XAML（と、`x:Class` とファイル名が違う XAML）は IR に `"file": "Sub/Greet.xaml"` が付き、同じ場所に作り直す
   - **取り込めない XAML（C# の式、Flowchart など）は、XAML をそのまま移す**。Windows とクロスプラットフォームの XAML の違いはルートの AssemblyReference（WPF の 3 つ）だけなので、そこだけを書き換え、ほかは 1 文字も変えない。その前に、XAML の要素とプロパティを移る前・移る先のカタログと突き合わせ、移る先に無いものがあれば場所（要素の道筋と表示名）を挙げて止める
     ```
     移せない Main.xaml Activity/Sequence/MultipleAssign「まとめて代入」: MultipleAssign（UiPath.System.Activities）はクロスプラットフォームに無い
     ```
4. `project.json` の `targetFramework` を書き換え、XAML を IR から作り直す（式の言語は `expressionLanguage` のまま。C# のプロジェクトは C# の XAML になる）

- `--dry-run` で、何も書かずに移せるかだけ調べられる。移す前に、プロジェクトを git に入れるか写しておく
- Invoke Workflow File のパス（プロジェクトからの相対パス。`Sub\Greet.xaml`）は変えない。呼び先が移したあとのプロジェクトに無ければ注意を出す（止めない）
- Coded の `.cs` は作り直さない（`gen-coded.ts` で作り直す）。Coded の API はどちらも同じ（`UiPath.CodedWorkflows` 24.10.3 は `lib/net6.0` だけで、System の Windows 版も Portable 版も同じ版に依存する）
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

まだ無いもの（手元にクロスプラットフォームの DLL が無い）：UiPath.UIAutomation.Activities 25.10.33 / 26.10.3、UiPath.System.Activities 24.10.7 / 26.2.6。

**パッケージにクロスプラットフォームの DLL がそもそも無いもの**（2026-11-17、NuGet のキャッシュの `lib` で確かめた。クロスプラットフォームでは使えない）：UiPath.Mail.Activities 1.21.1（`net461`・`net6.0-windows7.0` だけ。2.12.10 には `net6.0` があり、カタログもある）、UiPath.SAP.BAPI.Activities 3.0.1（`net8.0-windows7.0` だけ）。これらの版を使うプロジェクトは、クロスプラットフォームに移そうとすると「カタログが無い」で止まる。UiPath.IntegrationService.Activities は Windows のカタログも無い。

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
- **クロスプラットフォームでの run も通った**（2026-11-17）。
  - 手元：`uip rpa init --target-framework Portable` で作った作業用プロジェクト `C:\Users\Public\uipath-ir-probe-portable`（依存は System・Testing・UIAutomation。WebAPI 2.5.2 はカタログが無いので外した）を `--template` にして、AddDataRow・WriteTextFile・ReadTextFile・CompareText の XAML が run の窓口で OK。
  - クラウド：Portable のテスト用プロジェクトを、Sorahane Trial の `Default Serverless` で Test Manager のテストとして流して OK（[testing.md](testing.md)）。Windows のプロジェクトは、このクラウドのロボットでは流れない。
- **Coded（C#）もクロスプラットフォームで build・run が通った**（2026-11-17）。前に「'CodedWorkflow' が見つかりません」で落ちたのは、Coded の土台が無いからではなく、**名前空間の食い違い**だった
  - Studio は build のときに Coded の土台（`.codedworkflows/`、`.local/.codedworkflows/CodedWorkflow.cs`）を自分で作る。名前空間はプロジェクトの名前から作る（作業用プロジェクト `uipath-ir-probe-portable` → `uipathirprobeportable`）
  - verify.mjs は `--use-project` が無いと、gen-coded.ts の既定の名前空間（`CatalogProbeNet8`。既定のテンプレートの名前）で C# を書いていた。今は作業用プロジェクトの名前空間を渡す（`--use-project` があれば gen-coded.ts がプロジェクトから取る）
  - `--template C:\Users\Public\uipath-ir-probe-portable --use-project` で、System の AddDataRow・LogMessage・ReadTextFile と Main / Greet（InvokeWorkflowFile）の XAML と C# が、build も run も OK（`out/verify/pcoded-run`、`pcoded2-run`）。クロスプラットフォームのテンプレートで `--use-project` を付け忘れると、verify は注意を出す（Windows のカタログで作ってしまうため）
- **名前空間の名前は `project.uiproj` の `Name`**：`project.json` の `name` だけを変えたプロジェクトでは、Studio は `project.uiproj` の `Name`（`uipath-ir-probe-cs` → `uipathirprobecs`）で `CodedWorkflow` を作り、そのうえ Coded のファイルのコンパイルが `CodedActivityBuilderUtils.CreateActivity` の「Sequence contains no matching element」で落ちた。2 つの名前はそろえておく。チェッカーと verify は `project.uiproj` の `Name` を先に見る
- **C# のプロジェクトの移行**（2026-11-17）：C# の Windows のプロジェクト（`Main.xaml` は IR から作った C# の XAML、`Sub/Greet.xaml` は IR の無い C# の XAML で、Main が `Sub\Greet.xaml` を Invoke Workflow File で呼ぶ）をクロスプラットフォームに移し、Main と Sub/Greet の run、IR から作った Coded（`RunWorkflow("Sub\\Greet.xaml")` で呼ぶ）の run が OK。期待するログも合った。Windows に戻すと、XAML は元と 1 文字も違わず、build・run も OK（`out/verify/migcs-port-run`、`migcs-coded2-run`、`migcs-win-run`）
- **サブフォルダの XAML の取り込み**（2026-11-17）：VB の Windows のプロジェクトの `Sub/Greet.xaml`（IR なし）を移すと `ir/Sub/Greet.json`（`"file": "Sub/Greet.xaml"`）に取り込まれ、クロスプラットフォームで IR から XAML と C# を作って build・run が OK（`out/verify/migvb-run`）。Windows に戻すと元の XAML と同じ
- verify.mjs で手書きの XAML をサブフォルダごと試すときは `--base <フォルダ>`（そこからの相対パスのまま写す）。IR に `file` があれば、そのサブフォルダに書く
- まだ見ていないもの：Flowchart など VB でも取り込めない XAML を「そのまま移す」ときの build（仕組みは C# の XAML と同じ）、Studio が自分で作ったサブフォルダの XAML（ここでは生成器で作った XAML を Studio の形とみなして試した。Studio の `x:Class` の付け方には寄らない：`x:Class` はそのまま `workflow` に、場所は `file` に持つ）
