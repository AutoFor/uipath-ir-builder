# パッケージの日本語リソース（ja\*.resources.dll）から「表示名のキー → Studio の日本語の名前」の表を作る。
# カタログの displayName（PropertyInteractionMode など）を引くのに使う。gen-coded.ts がオプションの行末のコメントに書く。
#
#   pwsh tools/catalog-extractor/extract-ja.ps1 UiPath.UIAutomation.Activities 26.10.6
#     → catalog/UiPath.UIAutomation.Activities/26.10.6.ja.json
#
# 探す場所：~/.nuget/packages/<パッケージ>*/<版>/ の下の ja\*.resources.dll（本体と runtime / runtime.portable などの関連パッケージ）。
# 同じキーが何度も出たら、先に見つけたものを使う（runtime.portable を先に見る。Studio の Coded と同じ実行用の文言）。
param(
  [Parameter(Mandatory)] [string]$Package,
  [Parameter(Mandatory)] [string]$Version
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$nuget = Join-Path $env:USERPROFILE '.nuget\packages'
$dirs = Get-ChildItem $nuget -Directory | Where-Object { $_.Name -like "$($Package.ToLower())*" } |
  ForEach-Object { Join-Path $_.FullName $Version } | Where-Object { Test-Path $_ } |
  Sort-Object { if ($_ -match 'runtime\.portable') { 0 } elseif ($_ -match 'runtime') { 1 } else { 2 } }
if (-not $dirs) { throw "~/.nuget/packages に $Package $Version が無い（uip rpa restore などで入れる）" }
$out = [ordered]@{}
foreach ($d in $dirs) {
  foreach ($f in Get-ChildItem $d -Recurse -Filter *.resources.dll | Where-Object { $_.FullName -match '\\ja\\' }) {
    $asm = [System.Reflection.Assembly]::LoadFile($f.FullName)
    foreach ($rn in $asm.GetManifestResourceNames()) {
      $r = New-Object System.Resources.ResourceReader($asm.GetManifestResourceStream($rn))
      foreach ($e in $r) { if ($e.Value -is [string] -and $e.Value -ne '' -and -not $out.Contains($e.Key)) { $out[$e.Key] = $e.Value } }
      $r.Close()
    }
  }
}
$dst = Join-Path $root "catalog\$Package\$Version.ja.json"
# カタログ（catalog/<パッケージ>/<版>*.json）の displayName で使っているキーだけ残す（全部だと 1MB 近くある）
$keys = @{}
foreach ($c in Get-ChildItem (Join-Path $root "catalog\$Package") -Filter "$Version*.json" | Where-Object { $_.Name -notmatch '\.(ja|objects)\.json$' }) {
  foreach ($m in [regex]::Matches((Get-Content $c.FullName -Raw), '"displayName":\s*"([^"]+)"')) { $keys[$m.Groups[1].Value] = $true }
}
if ($keys.Count -eq 0) { throw "catalog\$Package\$Version*.json が無い（先にカタログを作る）" }
$sorted = [ordered]@{}
foreach ($k in ($out.Keys | Sort-Object)) { if ($keys.ContainsKey($k)) { $sorted[$k] = $out[$k] } }
$sorted | ConvertTo-Json -Depth 2 | Set-Content -Path $dst -Encoding utf8NoBOM
"OK $($sorted.Count) 件 -> $dst"
