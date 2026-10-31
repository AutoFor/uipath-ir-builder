# 新しい版に上げるときの手順

UiPath のアクティビティパッケージ（System、UIAutomation、Excel など）や Studio の版が上がったときに、カタログ・対応表・既定 XAML・サンプルを追従させる手順。AUT-612。

考え方：**推測で近い版を使わない**。新しい版の DLL からカタログを作り直し、前の版との差分を見て、影響のあるものだけ直し、最後は `uip rpa build` / run で確かめる。

## 版に依存するもの（どこを見直すか）

| もの | 場所 | 見直し方 |
| --- | --- | --- |
| カタログ（プロパティ・必須・enum・Coded API） | `catalog/<PackageId>/<version>.json`（と `.objects.json`） | 手順 1〜2 で作り直す。**手で書き換えない** |
| カタログを読む場所 | `tools/ir/samples.test.ts` の `loadCatalog([...])`、`tools/ir/gen.ts` などの読み込み一覧 | 新しい版のファイル名に差し替える（古い版を残してよい） |
| 既定 XAML（`Version=V5`、`HealingAgentBehavior=SameAsCard` など） | `knowledge/default-xaml/` | 取り直して `compare-default-xaml` で比べる（手順 5）。取った版は記録されないので、コミットメッセージかこの手順の記録に書く |
| ルートの imports / AssemblyReference | `tools/ir/generate.ts` の BlankTemplate の並び | Studio の版が変わったら、新しいテンプレートの XAML と見比べる |
| 対応表（XAML → C#） | `mappings/<pkg>/*.json` | Coded API が変わったとき（手順 4） |
| 作業用プロジェクト | `C:\Users\Public\uipath-ir-probe`（`project.json` の `dependencies`、`dotNetVersion`） | 新しい版を入れ直す。直接いじらず、版を上げた複製で試す |
| `uip` / Helm | CLI の版、.NET ランタイム | `uip` の版が上がると必要な .NET が変わることがある（1.204.2 は .NET 10.0.0 が必要だった） |

## 1. DLL を探す

アクティビティの DLL は、デザイン用パッケージではなく**ランタイム用パッケージ**（`*.runtime.windows` / `*.runtime`）の `lib/` にある。NuGet のキャッシュ（`~/.nuget/packages`）に、`uip rpa build` などで依存が復元された版が入る。

```bash
N=~/.nuget/packages
ls $N/uipath.system.activities.runtime.windows/        # 版の一覧
ls $N/uipath.system.activities.runtime.windows/<新版>/lib/net6.0-windows7.0/
```

新しい版が手元に無いときは、作業用プロジェクトの `project.json` の `dependencies` を新しい版にして build し、復元させる（窓口を通す：`node tools/verify/queue-run.mjs --name <作業名> --build-only --timeout 300 <ファイル>`。SSH 側で `uip` を直接呼ばない）。

## 2. 抽出器を回す

README の「カタログ抽出器」と同じ。パッケージごとに、アクティビティの DLL と API の DLL を渡す。

```bash
dotnet build -c Release tools/catalog-extractor
tools/catalog-extractor/bin/Release/net9.0/CatalogExtractor.exe \
  --package UiPath.System.Activities --version <新版> \
  --dll $N/uipath.system.activities.runtime.windows/<新版>/lib/net6.0-windows7.0/UiPath.System.Activities.dll \
  --dll $N/uipath.system.activities.runtime.windows/<新版>/lib/net6.0-windows7.0/UiPath.System.Activities.Api.dll \
  --out catalog/UiPath.System.Activities/<新版>.json
```

- UI の対象オブジェクト（`.objects.json`）は `--types` で別に作る（既存の `*.objects.json` と同じ手順）
- Excel など `--follow-returns` が要るパッケージは README の例どおり
- **前の版も同じ抽出器で作り直せるなら作り直す**（古い DLL が NuGet キャッシュに残っていることがある）。作り直せない古いカタログは `readOnly`、`services`、out の `Result` などの項目が欠けていて、差分に「抽出の差」が混ざる（手順 3 で分けて出る）。作り直せるなら、先に前の版を作り直してから差分を取ると、本当の差分だけが残る

## 3. 差分を見る

```bash
node tools/catalog-diff.ts UiPath.System.Activities <旧版> <新版>
node tools/catalog-diff.ts UiPath.UIAutomation.Activities <旧版> <新版> --impact --out out/diff.md
# ファイルを直接渡してもよい
node tools/catalog-diff.ts catalog/X/a.json catalog/X/b.json
```

出るもの：増えた / 消えたアクティビティ、増えた / 消えたプロパティ、型（`type`）の変更、種類（in / out / prop）の変更、必須の変更、enum の値の増減、obsolete / browsable の変更、overloadGroups と default の変更、Coded API（サービスのメソッド）の増減・引数の変更。

差分は **real（本当の差分）** と **suspect（抽出器の違いかもしれないもの）** に分かれる。suspect の判定ルールは `tools/catalog-diff.ts` の先頭に書いてある（out の `Result`、同名プロパティの一斉追加、default / overloadGroups の有無、prop ⇄ in/out、browsable と declaredOn の同時変更）。`readOnly` は古い版に項目が無いので比べず、件数だけ出る。Coded API は**両方の版に `services` があるときだけ**比べる（無ければ「比較できない」と出る）。

見方：

- **消えたアクティビティ / プロパティ**：IR に書いていれば build が落ちる。サンプルと対応表を直す
- **必須が増えた**：古い IR が build で落ちる（`BC30455` など）。サンプルに足す。`overloadGroups` を持つ必須プロパティは「どれか1つ」でよい
- **enum の値が増えた**：検証（`validate.ts`）が古いカタログで新しい値を弾く。カタログを新しくすれば通る
- **enum の値が消えた**：使っているサンプルを直す
- **種類（in ⇄ prop）が変わった**：XAML の書き方（属性か要素か、`[ ]` の有無）が変わる。生成器が出す XAML と既定 XAML を `compare-default-xaml` で比べる
- **Coded API が変わった**：対応表の `call` と `args` を直す（手順 4）

## 4. 影響を判定する（サンプルと対応表）

`--impact` を付けると、`samples/ir/**/*.json` と `mappings/**/*.json` を差分に当てはめ、直す必要があるものを一覧にする。次の版に上げる判断に使う：error が 0 件なら、そのまま上げてよい。

| 重さ | 意味 | 例 |
| --- | --- | --- |
| error | 直さないと build / 生成が落ちる | 消えたアクティビティ、消えたプロパティ、消えた enum 値を使っている、消えた Coded API を呼ぶ対応表 |
| warn | 確かめる | 型が変わった、新しく必須になったのにサンプルが書いていない、obsolete / browsable=false になった、Coded API の引数が変わった |
| info | 抽出器の違いかもしれない（suspect）に由来するもの | prop → in の変更、継承メンバーの browsable の変更 |

- 使い方：`--fail-on-error` を付けると、error があるとき終了コード 1 になる
- 見ているもの：サンプルは `act` と `props`（`dicts` / `lists` / `objs` のキーも）、対応表は `when` と `{Prop}` の参照と `call`。同じ ClassName が別パッケージにある場合（`ForEach` など）は両方を見るので、余計に出ることがある
- Coded API の消えたメソッド・変わった引数は、両方の版に `services` があるときだけ出る

error / warn のサンプルと対応表を直したら、手順 6 へ。

## 5. 既定 XAML を取り直して比べる

既定値は版で変わる。窓口を通して取る（SSH 側で `uip` を直接呼ばない）：

```bash
node tools/verify/queue-run.mjs --name <作業名> --default-xaml <完全クラス名> --out knowledge/default-xaml/<ClassName>.json samples/ir/Greet.json
node tools/compare-default-xaml.mjs --generated samples/generated/<pkg> --activity <ClassName>
```

- すべては取り直さない。差分で「default が変わった」「種類が変わった」「プロパティが増えた」アクティビティと、サンプルで使っているアクティビティのうち既定値を持つもの（UI の `N*` など）に絞る
- 食い違いは生成器かカタログの判断（`knowledge/default-xaml/` の既定値）で直す

## 6. 全テストと build / run

```bash
node --test "tools/ir/*.test.ts"
```

- 新しい版のカタログに差し替えたあと、既存のスナップショット（`samples/generated/`、`samples/generated-coded/`）が変わらないことを確かめる。変わるなら理由を見て、意図したものだけ `UPDATE_SNAPSHOTS=1` で作り直す（無関係な差分は戻す）
- **build**：影響判定で出たサンプルと、差分に出たアクティビティのサンプルを、窓口で build する：`node tools/verify/queue-run.mjs --name <作業名> --build-only --timeout 300 <ファイル>...`
- **run**：期待ログのあるサンプルのうち、次のものを run する：影響判定で出たもの / 既定値や種類が変わったアクティビティ / Coded API が変わったもの。UI と Excel は `--timeout 120` を付ける。全部は run しない（窓口が詰まる）
- 版の違いで落ちたものは、検証のルール（`tools/ir/validate.ts`）とテストケース（`samples/ir-invalid/`）に足す
- 最後の確認は常に `uip rpa build`（と run）。カタログや差分ツールが「通る」と言っても、build が落ちたら build を信じる

## 7. 記録を残す

- 版どうしの差分を `knowledge/version-diff-<旧>-<新>.md` に置く（例：`knowledge/version-diff-26.2-26.10.md`）。`--out` で出した結果に、読み方の注意（抽出の差、比べられなかった項目）を足す
- README の「カタログ」の表に新しい版を足す
- 古い版のカタログは消さない（検証の比較に使う）
