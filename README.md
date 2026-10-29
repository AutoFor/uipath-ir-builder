# uipath-ir-builder

UiPath の XAML / Coded Workflow を、AI に直接書かせずに作るための道具。AI は小さな型付きの中間表現（IR）だけを書き、XAML は機械的に生成する。方針は [docs/plan.md](docs/plan.md)。

## いまあるもの

### カタログ抽出器（`tools/catalog-extractor`）

アクティビティの DLL から、型情報をリフレクションで抜き出して JSON にする。`MetadataLoadContext` で読むだけなので、Studio も UiPath の実行環境もいらない。

取れるもの：ClassName、xmlns、ジェネリックの数、プロパティごとの In/Out の向き・型・`[RequiredArgument]`・`[DefaultValue]`・enum の値・カテゴリ・表示名・OverloadGroup。

```bash
dotnet build -c Release tools/catalog-extractor

N=~/.nuget/packages
tools/catalog-extractor/bin/Release/net9.0/CatalogExtractor.exe \
  --package UiPath.System.Activities --version 26.2.6 \
  --dll $N/uipath.system.activities.runtime.windows/26.2.6/lib/net6.0-windows7.0/UiPath.System.Activities.dll \
  --out catalog/UiPath.System.Activities/26.2.6.json
```

DLL はデザイン用パッケージ（`uipath.system.activities`）ではなく、ランタイム用パッケージ（`*.runtime.windows` / `*.runtime`）の `lib/` にある。

### カタログ（`catalog/`）

| パッケージ | バージョン | アクティビティ数 |
| --- | --- | --- |
| UiPath.System.Activities | 26.2.6 | 185 |
| UiPath.System.Activities | 26.10.0 | 186 |
| UiPath.UIAutomation.Activities | 25.10.33 | 202 |
| UiPath.UIAutomation.Activities | 26.10.6 | 211 |

### get-default-xaml との突き合わせ（`tools/compare-default-xaml.mjs`）

`uip rpa activities get-default-xaml` の出力を `knowledge/default-xaml/` に保存し、カタログと比べる。結果は [knowledge/default-xaml-compare.md](knowledge/default-xaml-compare.md)。

```bash
node tools/compare-default-xaml.mjs catalog/UiPath.System.Activities/26.10.0.json \
  catalog/UiPath.UIAutomation.Activities/26.10.6.json > knowledge/default-xaml-compare.md
```

12アクティビティで比べた結果：

- default に出た48プロパティは、すべてカタログにあった
- default に出ない out 引数をカタログは持っている（`NGetText` の `Text` / `TextString` / `WordsInfo` など）
- default で空のままの必須プロパティを、カタログは必須として持っている（`ForEach.Values`）

`get-default-xaml` は UiPath プロジェクトの中で、`uip login` 済みの状態でないと動かない。初回は Studio 側（Helm）の起動に約10分かかり、2回目からは1件0.5秒ほど。ジェネリックのアクティビティはクラス名に `` `1 `` を付ける（例 ``UiPath.Core.Activities.ForEach`1``）。

## わかっている穴

- 既定値は `[DefaultValue]` 属性からしか取れない。コンストラクタで入れる既定値は見えない（`get-default-xaml` に出る `Version=V5` や `HealingAgentBehavior=SameAsCard` などは、カタログには既定値として入っていない）
- 新しめのアクティビティは「必須」を ViewModel 側で持っていそうで、属性だけでは漏れる
- xmlns 定義が見つからないアクティビティは `clr-namespace:` 形式の代わりの値になる（System 44個、UIAutomation 11個）
