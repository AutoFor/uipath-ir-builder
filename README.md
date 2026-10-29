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
| UiPath.UIAutomation.Activities | 25.10.33 | 202 |

## わかっている穴

- 既定値は `[DefaultValue]` 属性からしか取れない。コンストラクタで入れる既定値は見えない
- 新しめのアクティビティは「必須」を ViewModel 側で持っていそうで、属性だけでは漏れる
- xmlns 定義が見つからないアクティビティは `clr-namespace:` 形式の代わりの値になる（System 44個、UIAutomation 11個）
- `uip rpa activities get-default-xaml` との突き合わせはまだ（UiPath へのサインイン待ち）
