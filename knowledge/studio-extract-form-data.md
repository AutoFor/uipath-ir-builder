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

## 「画面から項目を検出」が何も起こさない件（AUT-1088 追加調査、2026-11-03）

Studio 26.0.204、UIAutomation 26.10.6。ローカルの DLL（`UiPath.UIAutomationNext.Activities.Design.dll` と、Semantic 部分が ILMerge された `UiPath.UIAutomationNext.Activities.dll`）を ilspycmd で読み、ログと突き合わせた。ネットワーク呼び出し、Studio、ロボットには触っていない。DLL の中身はリポジトリに入れない。

### 呼び出しの流れ（コードの読み取り）

1. `ExtractFormDataViewModel.DiscoverAsync`：`IsDiscovering` 中なら何もしない → `IsCustomTypeGenerationSupported`（Studio の機能 `JitCustomTypeServiceV4`）が偽なら Error `Morph is not supported by Studio` で戻る → `IsLoggedInAsync` が偽なら Error `User is not logged in.` と画面のダイアログ → `DiscoverFieldsAsync`。
2. `DiscoverFieldsAsync`：対象アプリが null なら**ログなしで null**。ブラウザーが対象外なら Error と ダイアログ。それ以外は `DiscoverFieldsService.DiscoverAsync`。例外は `UiAutomationException` なら Error ログとダイアログ、その他も Error ログとダイアログ。どちらも null を返す。
3. 呼び出し元は null か空なら Error `[EFD]: No fields discovered.` を書いて戻る。つまりこのメッセージは「結果が空」ではなく「直前に例外があった、または対象アプリが取れなかった」ときに出る。
4. `DiscoverInternalAsync`：ブラウザー種別（`SemanticRuntimeBrowserTypes`）を確認 → アプリを前面化 → 500ms 待つ → デバッガー接続（`BrowserDebuggerScope.AttachAsync`）→ `GetSemanticCacheOptionsAsync`（**スクリーンショットを撮る**。失敗すると例外 `Failed to capture screenshot.`）→ 進捗スケルトン表示（ログの showLoadingSkeleton）→ `SemanticRuntimeService.GetSemanticCacheAsync`（例外は中で握って `SemanticCache(ex)` にする。Error ログは出る）→ キャッシュが無効、スキーマが空、表示名が全部空のどれかなら `DiscoverFormFieldsException`（ダイアログ）。成功なら表示名の配列を返す。スケルトンの hide は `DisposeAsync` なので、成功でも失敗でも出る。
5. 成功後：`GetFieldMappings`（表示名 → プロパティ名）→ 現在の値と同じなら Debug `Nothing to do` → 違えば `FieldMappings.Value = …` → `UpdateTypeAsync` → `MorphAsync` → `IDesignerCustomTypesService.UseCustomTypeAsync("FormData", …)`（`.local/.jit` に型の DLL を作る）。

### 検出が依存するもの（コードの読み取り）

- **ログイン**：`IAccessProviderService.IsLoggedInAsync` だけがゲート。未ログインなら Error とダイアログで止まる。
- **クラウド**：検出の本体はブラウザー拡張経由の DOM 抽出（`DOMExtractorService`）で、ローカルで動く。クラウドを呼ぶ箇所は、(a) `ServerConfigurationService.GetAsync<DOMExtractorConfig>`（Semantic プロキシの ConfigurationV2。失敗時は埋め込みリソースに落ちる。結果はメモリに1時間）、(b) `DOMRelationsService`（入力欄に強いアンカーが無いときだけ、DOM の関係を Semantic プロキシに問い合わせる。タイムアウト3秒、失敗は握りつぶして空）。どちらも失敗しても検出は止まらない。スキーマ照合（`SchemaMatching`）や LLM Gateway（ScreenPlay）はフォーム項目の検出では使わない（実行時の検索や AI エージェント用）。
- **ライセンス、AI Trust Layer、Autopilot ポリシー、機能フラグ**：検出の経路（上の 1〜5）には、これらを判定する分岐は**見つからなかった**。ログイン以外でゲートになるのは Studio の `JitCustomTypeServiceV4` だけ。
- **キャッシュ**：`ISemanticCache` はメモリ上のオブジェクトで、ファイルには残らない。ディスクのキャッシュは無い。0.2 秒の理由は、拡張の JS が注入済みで DOM 抽出と安定判定が速く済むため、と**推定**（初回 2.8 秒はスクリプト注入と設定取得を含む）。
- **RDP、Remote UIA**：`RemoteUiaProcessService` は UIAutomation の別プロセスとの接続の仕組みで、検出の分岐には使われていない。ただしスクリーンショットは `DriverAsyncService.GetBrowserViewportAsync` など拡張との通信に依存する。

### ログから絞ったこと（実測）

`2026-11-03_UIAutomation.log` と `_UiPath.Studio.Project.log`：

| 時刻 | 起きたこと | 読み |
| --- | --- | --- |
| 07:29、07:30 | スケルトン表示から非表示まで 3.0 秒、3.3 秒。**エラーなし** | 例外なしで `DiscoverInternalAsync` を通った |
| 08:02〜08:04 | 6 回、`AttachDebugger` が `0x800402E1`、`get_viewportRegion` が `0x80040233`、`Failed to capture screenshot.` → ダイアログ → `No fields discovered.` | file:/// でスクリーンショット失敗。例外から「No fields」までの隙間は、ダイアログを閉じるまでの時間（最後の 08:04:12 → 08:13:18 は 9 分） |
| 08:13:18 | `No fields discovered.` | 08:04:12 の例外のダイアログを閉じた直後。http にした後の失敗ではない |
| 08:14:19 以降 | スケルトン 2.8 秒、1.5 秒、0.2 秒、0.15 秒、0.1 秒。**例外も `No fields discovered.` も `User is not logged in.` も無い** | スクリーンショットは成功し、`DiscoverFieldsAsync` は空でも null でもない配列を返した（上の 2〜4 の Error 経路はすべてログが出る作りなので、出ていないことで除外できる） |

つまり、**08:14 以降は「検出できなかった」のではなく、検出は成功した可能性が高い**。ユーザーの見立て（「No fields discovered」が続く）は、08:13 の1行を http の結果と取り違えている（**実測**）。成功後に残る経路は 5 の後半で、Debug ログ（`Discovered N fields`、`Generated N properties`、`Nothing to do`、`Field mappings updated`、`Morphing to type`）はこの環境のログに**1行も出ていない**（Debug が出力されない設定）ため、どこで止まったかは見えない。

別件（実測）：`.screenshots/` に 08:14:15 の画像があり、テスト用フォーム（申請者名、メールアドレス、電話番号、申請日、部署、金額、区分…）が写っている。`.objects` にも画面の記述子が増えている。スクリーンショットはフォームを正しく捉えている。Main.xaml は `FieldMappings="{x:Null}"`、`NApplicationCard` は `InteractionMode="DebuggerApi"`、`NExtractFormDataGeneric` は `Version="V5"`、`.local/.jit/cache` は 06:43 の `GlobalVariables.*.dll` だけ。

### 原因（実測と推定を分ける）

- **実測**：file:/// のときの失敗は、拡張がページに接続できないこと（`AttachDebugger` `0x800402E1`、`get_viewportRegion` `0x80040233`）で起きたスクリーンショット失敗。Chrome の拡張に「ファイルの URL へのアクセスを許可する」が無い、または `file://` で拡張が動かないための失敗、と**推定**。http にしたら解消し、以降はスクリーンショット例外が出ていない（**実測**）。
- **実測**：08:14 以降はエラー経路を通っていない。クラウド、ライセンス、ポリシーが原因とする証拠は無い。
- **推定（未確認）**：検出は成功したが、`FieldMappings.Value` の代入後の `UseCustomTypeAsync`（JIT の型づくり）で、Studio 側が何もせず戻っている。根拠は、検出が成功なら残る分岐がここだけであること、`.local/.jit` に新しい DLL が出ていないこと、06:43 に `JitAssemblyProjectEndpoint.UpdateDesigners` の NullReferenceException が出ていること、それと「モデル」の選択肢が空で Path Mini のままのこと（これは別機能の可能性もある）。別の可能性として、保存したときの Main.xaml がデザイナーの値を反映していない（保存のタイミング）ことも**否定できない**。
- 「No license exist」「対話型接続は利用できません」（Studio.log）は、検出のログインゲート（`IsLoggedInAsync`）を通ったことと矛盾して見える。`IsLoggedInAsync` の実装（定義は Design の外の共有アセンブリ）は**読めていない**。ログインしていないのにゲートを通る可能性は否定できない。

### 直すなら（ユーザー、テナント管理者）

- file:/// ではなく http://127.0.0.1:8765/ を使う（済み）。Chrome の拡張の詳細で「ファイルの URL へのアクセスを許可する」をオンにすれば file:/// も試せる。
- Studio 側で、UIAutomation のログレベルを Debug にして（Studio の設定のログ、または UIAutomation の詳細ログ）もう一度検出する。`[EFD]: Discovered N fields.` と `[BESDVM]: Morphing to type.` が出れば、どこで止まったか分かる。`UpdateTypeAsync` の後に `[BESDVM]` が無ければ、型づくりの手前。
- 検出後に、プロジェクトをいったん保存して Main.xaml を開き直し、`FieldMappings` と `.local/.jit` に新しい DLL が出たかを見る。
- Studio にサインイン（Orchestrator に接続）してから試す（`対話型接続は利用できません` の状態を解く）。
- テナント管理者に頼むことは、今回の調査からは**無い**（ライセンスやポリシーが原因という証拠が無いため）。

### まだ分からないこと

- 検出が返した項目の数と名前。Debug ログが無く、型が作られた形跡も無い。
- `IsLoggedInAsync` の実装と、この Studio の状態での値。
- `JitCustomTypeServiceV4` が Studio 26.0.204 の GUI で有効か（無ければ警告が出て「項目の検出」ボタン自体が隠れるはずで、押せているので有効と**推定**）。
- 「モデル」プロパティが空の理由。今回読んだ経路には出てこない（別のクラスの可能性）。

### 生成器への影響

- 生成器は `FieldMappings` を **dicts** で直接書く（項目の検出を使わない）ので、検出が動かなくても出力の形には影響しない。検出が返す表示名からプロパティ名への変換は `GetFieldMappings`（`ToPropertyName`。型名 `FormData` と同じ名前は先頭に `_`、重複は `_1`、`_2`）で、**生成器が写すならこの規則**。
- 項目ありの `FieldMappings` の実物は、まだ Studio から取れていない。上の「直すなら」で検出が通り、型が作られれば確かめられる。
- 型の DLL（`.local/.jit`）は生成器では作れない（従来どおり）。Helm の `JitCustomTypeServiceV4` が無い件（AUT-706）も変わらない。
- `NApplicationCard` に `InteractionMode="DebuggerApi"` が付くことを今回の実物で確認した。生成器は付けていないが、検出が `DebuggerScope` を使う経路なので、Extract の実行時の挙動には関係する可能性がある（未確認）。

## Studio.CommandLine の analyze / analyze-file で検証できるか（AUT-1088、2026-11-03）

`C:\Program Files\UiPathPlatform\Studio\26.0.204-cloud.25540\UiPath.Studio.CommandLine.exe`。すべて scratchpad にコピーしたプロジェクトに対して流した（元のフォルダ、Studio の設定、テナントには触っていない。git clone / commit / publish / options / manage は実行していない）。

### 使い方（実測）

- `analyze -p <project.json のパス> [-c <規則の設定ファイル>]`、`analyze-file -p <ワークフローの.xaml> [-c …]`。**注意**：ヘルプには `analyze-file` が `--workflow-file-path` と出るが、`-p` で動いた。`-p` にプロジェクトのフォルダではなく `project.json` を渡した。
- 出力は標準出力に `#json{ … }`。キーは `<GUID>-FilePath` / `-ErrorCode` / `-ErrorSeverity` / `-Description` / `-Recommendation`（項目によって `-Item`）の平坦な辞書。Description は Studio の言語（日本語）。
- 終了コード：**Error の指摘があれば 1、無ければ 0**（Warning と Info だけなら 0）。
- SSH（High、セッション 0）から**そのまま動いた**。ログインも Studio の画面操作も要らない。プロジェクト全体で数秒〜十数秒。Studio が起動中でも動く（落とさなかった）。
- 窓口（`runner.mjs`）は `verify.mjs` だけを流す作りで任意のコマンドは流せない。ただし analyze は SSH で動くので、窓口は不要。

### 結果（実測）

| 対象 | コマンド | 終了コード | 主な出力 |
| --- | --- | --- | --- |
| 1. `空のプロセス1` のコピー（Extract あり） | analyze / analyze-file | 0 / 0 | ST-USG-020 Warning（ログ未使用）、ST-MRD-002 Warning（フォーム データを抽出が既定の名前）、ST-USG-034、UI-ANA-016 Info（ブラウザーの URL）、ST-ANA-009 Info（アクティビティ数）ほか。**「23.10」「JIT」の文言は出ない** |
| 2. `NExtractFormDataGeneric.min` から生成した XAML（Main.xaml として） | analyze / analyze-file | 0 / 0 | ST-USG-020 Warning、ST-ANA-009 Info（アクティビティ: 3 = 型が解決されて数えられた）。**23.10 の指摘なし** |
| 3a. 対照：build が通る `Greet` | analyze / analyze-file | 0 / 0 | ST-USG-020 / ST-USG-010 Warning など |
| 3b. わざと壊す：式の変数名違い（`in_Name`→`in_Nme`） | analyze / analyze-file | **0 / 0** | 3a と同じ指摘だけ。**検出されない** |
| 3c. わざと壊す：閉じタグ不一致（XML 不正） | analyze-file | **1** | Error「ファイル … を解析できませんでした。理由: …」 |
| 3d. わざと壊す：存在しない要素 `NoSuchActivity` | analyze-file | **1** | Error「ファイル … を読み込めませんでした。理由: 不明な型 '{…}NoSuchActivity'」 |

### 何を見ていて、何を見ていないか

- **見ている（実測）**：XAML の読み込み（XML として正しいか、要素の型が名前空間から解決できるか）と、ワークフロー アナライザーの規則（ST-*、UI-ANA-* など）。2 の XAML は読み込めて、`NExtractFormDataGeneric` を含むアクティビティ数が数えられた。
- **見ていない（実測）**：式のコンパイル（未定義の変数が通る）。**`StudioCompatibilityValidator` の「requires UiPath Studio 23.10 or newer」も出ない**＝`uip rpa build` を落としているコンパイル前の検証には当たらない。空のプロジェクト 1 と、build が落ちる 2 の両方で同じく出ないので、**analyze が通っても build が通る保証にはならない**。
- **推定（未確認）**：Studio 本体（Helm ではなく Studio の `WorkflowDesignApi`）に `JitCustomTypeServiceV4` があるかは、この出力からは分からない。analyze は検証の経路にその判定を持たないため、機能フラグの差は見えない。「画面から項目を検出」の失敗原因の調査にも使えない。

### 結論

人の画面操作なしで動き、**構造の壊れ（XML 不正、未知の型）と規則違反の検出には使える**。しかし AUT-1088 の本題である、Studio の検証パネルが出す JIT / 23.10 系のエラーと、式の型の誤りは取れない。**画面の検証の代わりにはならない**（補助にはなる）。

### tools/verify への組み込み案（組み込みはマネジャーの判断後）

- `verify.mjs` の build の前に、`analyze-file` を Error 判定だけに使う任意の段階（`--analyze`）として足す。終了コード 1 を失敗とし、Warning と Info は出力しない（`ST-USG-*` はほぼ必ず出るため）。
- 作業用プロジェクトに XAML を書いた直後に流すので、窓口は不要。パスは固定せず、環境変数か `UiPath.Studio.CommandLine.exe` の探索で見つける。Studio の更新で版のフォルダ名が変わる点に注意。
- 価値があるのは、build が `uip rpa` の Helm で落ちる（AUT-706 のような）ものを除いても、XML と型の壊れを build より前に早く、短く返せること。式の誤りは従来どおり build で見る。

標準入力を閉じずに流すと、120 秒で終わらなかった（1 回。出力 0 バイト）。`</dev/null` を付けると同じ対象が 3〜4 秒で終わる。標準入力が理由というのは、この比較からの推定。
