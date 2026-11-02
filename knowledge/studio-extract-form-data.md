# Studio が保存した「フォーム データを抽出」との比較（AUT-1088）

2026-11-03、Studio 26.0.204.0（`26.0.204-cloud.25540`）で、空のプロジェクト（`空のプロセス`）にもう一つ新規プロジェクト（`空のプロセス1`）を作り、「アプリケーション/ブラウザーを使用」の中に「フォーム データを抽出」（`NExtractFormDataGeneric`）を置いて保存したものを、読み取りだけで調べた。Main.xaml はそのまま `samples/xaml-import/StudioExtractFormData.xaml` に置いてある（画面のタイトル、セレクター、画像、PC 名、ユーザー名は元から無い）。テストは `tools/ir/import-xaml.test.ts`。

**実測**（ファイルの中身）と**推定**を分ける。

## 何を置いた状態か（実測）

「アプリケーション/ブラウザーを使用」（`NApplicationCard`、`TargetApp Area="0, 0, 0, 0"`、URL もセレクターも無い）の中に、設定を何もしていない「フォーム データを抽出」が1つ。「画面から項目を検出」はしていない。このため `FieldMappings` の実物（項目が入った形）はまだ見えていない。

## Main.xaml（実測）

| 項目 | Studio が保存したもの | 生成器の出力（`samples/ir-unbuildable` の min） | 判断 |
| --- | --- | --- | --- |
| 要素 | `<uix:NExtractFormDataGeneric x:TypeArguments="x:Object" …>` | 同じ（`typeArg: "Object"`） | 一致 |
| `FieldMappings` | `FieldMappings="{x:Null}"`（属性） | `<uix:NExtractFormDataGeneric.FieldMappings><scg:Dictionary x:TypeArguments="x:String, x:String">…`（要素） | 項目が空のときだけ分かった。項目ありの実物は**未確認**。型は `IDictionary<String,String>` なので `Dictionary<x:String, x:String>` は**推定** |
| `Version` | 書かない | `Version="V5"`（Helm の既定 XAML に合わせている） | **差あり**。Studio 26.0.204 が選んだ UIAutomation は 25.2.1-preview。この版の既定が V5 かは不明。直さない（根拠が無い） |
| `HealingAgentBehavior` | `SameAsCard` | 同じ | 一致 |
| `ScopeIdentifier` | 外側 `NApplicationCard.ScopeGuid` と同じ GUID | 同じ（生成器も揃える） | 一致 |
| `Target` | 無い | 必須（検証 `UIA_TARGET_MISSING`） | Studio は Target 無しで保存できる。生成器は build できる形に限るので求める |
| `sap2010:WorkflowViewState.IdRef` | `NExtractFormDataGeneric\`1_1`（ジェネリックは型名の `` `1`` が付く） | `NExtractFormDataGeneric_1` | 差あり。ただし他のジェネリック（`ForEach` など）も生成器は付けず、build は通っている。IdRef は識別用なので放置 |
| `HintSize`、`ViewState` | あり | なし | 表示用。捨ててよい |
| `NApplicationCard` | `Version="V2"`、`TargetApp Version="V2"` | `Version="V2"`、`TargetApp Version="V3"` | UIAutomation の版の違い（25.2.1-preview と 26.10.6）。**推定** |
| ルートの宣言 | `VisualBasic.Settings="{x:Null}"`（接頭辞なし）、`sco`/`scg` とも `assembly=System.Private.CoreLib` | `mva:VisualBasic.Settings`、`sco` は `assembly=mscorlib` | 空のプロジェクト（Extract なし）も同じ書き方。Extract とは関係ない。他の build 済みサンプルがこの形で通っているので放置 |
| import / 参照の一覧 | Blank に加え、`GlobalVariablesNamespace`、`GlobalConstantsNamespace`、`System.Runtime.Serialization`、`UiPath.UIAutomationNext.*`、`UiPath.Shared.Activities`、`UiPath.Platform.*`、`UiPath.Semantic.Activities(.Models)` と参照 `UiPath.UIAutomationNext(.Activities)`、`UiPath.UIAutomationCore`、`UiPath.OCR.Activities`、`UiPath.Platform` など | `rootImports` で対象プロジェクトの XAML から引き継ぐ | Studio が自分で足す。`import-xaml` は `EXTRA_IMPORT` / `EXTRA_REFERENCE` の警告にする。式で使わなければ不要 |

## project.json（実測）

空のプロジェクトとの差は次のとおり。ほかは `name`、`projectId`、`entryPoints[].uniqueId` だけ。

- `dependencies` に `"UiPath.UIAutomation.Activities": "[25.2.1-preview]"` が増えた（`UiPath.System.Activities` は `[26.10.0]` のまま）。
- `studioVersion` は `26.0.204.0`、`targetFramework` は `Windows`、`dotNetVersion` は `net10.0`、`expressionLanguage` は `VisualBasic`、`schemaVersion` は `4.1`。どれも空のプロジェクトと同じ。
- Studio が入れたのは**プレビュー版**の 25.2.1-preview。生成器の対象は 26.10.6 なので、同じ Studio で 26.10.6 に上げて試すときは `AgentType` などが 26.10.6 だけにある点に注意。

## 増えたファイル（実測）

空のプロジェクト（Studio で作っただけ。`uip rpa run` 済みの `.local/install` などは別）との差:

| ファイル | 内容 | ソース管理 |
| --- | --- | --- |
| `.objects/.type`（`Library`）、`.objects/.metadata` | Object Repository の入れ物。`.metadata` は `CreatedBy: UiPath.Platform, Version=26.9.0.0`、ID と日時のみ。画面の記述子（`.objects/<アプリ>/…`）は**まだ無い** | 対象（推定。Object Repository は Studio のプロジェクトに含まれる） |
| `.local/` の `AllDependencies.json`、`PackageCache.json`、`nuget.cache`、`<名前>.nuget.props` | 依存の解決結果（UIAutomation の増分を含む） | 対象外（推定。Studio の既定の除外） |
| `.local/.jit/cache/GlobalVariables.<hash>.dll` | JIT の型（グローバル変数）。**空のプロジェクトにもある**ので Extract とは関係ない | 対象外 |
| `.local/db/references-*.db` | 参照のデータベース | 対象外 |

`.project/PackageBindingsMetadata.json` は空のプロジェクトと**バイト単位で同じ**。`.settings/`、`.entities/`、`.templates/`、`.tmh/` も変化なし。`.entities` は空のまま。つまり、**フォーム データを抽出で増えた生成物は、プロジェクトのファイルには無い**。

JIT の型（`JitCustomTypes`、`FieldMappings` から作る型）の DLL は `.local/.jit/` に出ていない（空のプロジェクトにある GlobalVariables の DLL だけ）。「画面から項目を検出」をしていないためと**推定**。項目を検出すると何かが出るはずだが、**未確認**。出ても `.local` 配下なら生成器では作れない（Studio の実行時に作られる）。

## Object Repository を参照しているか（実測）

していない。`TargetApp` は `Area="0, 0, 0, 0"` だけ、`Target` は無く、`.objects` に記述子も無い。画面の情報（タイトル、セレクター、スクリーンショット）は何も残っていない。

## 検証が通ったか

**未確認**。根拠:

- 空のプロジェクトの `.local/` にある `.build-state`、`WorkflowFileValidator.cache`、`install/` が、このプロジェクトには無い（ビルドも実行もしていない）。
- Studio のログ（`%LOCALAPPDATA%\UiPath\Logs\2026-11-03_UiPath.Studio.log`、`…Studio.Project.log`）にあるのは、起動時の認証エラーと更新サービスの警告、ウィザードの重複名エラー、`JitAssemblyProjectEndpoint.UpdateDesigners` の NullReferenceException（06:43、アクティビティを置く前後）だけで、「フォーム データを抽出」の検証結果は出ていない。Main.xaml の最終更新（07:01）はログの最後（06:53）より後。
- Studio が `FieldMappings="{x:Null}"` のまま保存したので、少なくとも保存はできた。しかし Studio の検証パネルに「Studio 23.10 以降が要る」が出たかは、ファイルからは分からない。

## 生成器で直せたもの、直せないもの

- 直したもの：なし。差のうち根拠があるのは `Version`（V5 か無いか）だけで、どちらが正しいかは UIAutomation の版しだいで分からないため。
- 足したもの：Studio 保存の XAML の取り込みテスト、サンプル置き場、この記録。
- 直せないもの：JIT の型の DLL、`.objects` の記述子（Studio が画面を指して作る）。生成器の範囲外。
- `FieldMappings` の項目ありの形は、「画面から項目を検出」を一度やって保存してもらえれば確かめられる。
