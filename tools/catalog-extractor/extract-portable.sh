#!/usr/bin/env bash
# クロスプラットフォーム（project.json の targetFramework が Portable）のカタログ catalog/<pkg>/<版>.portable.json を作る。
#
#   bash tools/catalog-extractor/extract-portable.sh <パッケージ> <版>     1 つだけ
#   bash tools/catalog-extractor/extract-portable.sh --all                  catalog/ にある Windows のカタログ全部（DLL が手元にあるもの）
#
# Windows のカタログ（<版>.json）の assemblies と同じ名前の DLL を、クロスプラットフォーム用の lib/net6.0 から読む。
# 探す順：<pkg>.runtime.portable → <pkg>.runtime → <pkg>（どれも ~/.nuget/packages/<小文字>/<版>/lib/net6.0/）。
# DLL が無ければ作らない（その版の Portable のプロジェクトを Studio で作るか build すると、NuGet のキャッシュに入る）。
# .objects.json は Windows のものを使う（UI のターゲットなどの型。カタログを読むときに <版>.objects.json を探す）。
set -u
root=$(cd "$(dirname "$0")/../.." && pwd)
N=${NUGET_PACKAGES:-$HOME/.nuget/packages}
exe=$root/tools/catalog-extractor/bin/Release/net9.0/CatalogExtractor.exe
# パッケージごとの追加の引数（Windows のカタログを作ったときと同じにする。README の「カタログ抽出器」）
extra() { case $1 in UiPath.Excel.Activities) echo --follow-returns ;; esac; }
# .NET の System.Activities と Coded の基底クラスは、Windows と同じものを使う（versions.ts の IMPLICIT）
skip() { case $1 in System.Activities|UiPath.CodedWorkflows) return 0 ;; esac; return 1; }

one() {
  local pkg=$1 ver=$2 win=$root/catalog/$1/$2.json lp dlls=() a p
  skip "$pkg" && return 0
  [ -f "$win" ] || { echo "NG $pkg $ver: $win が無い"; return 1; }
  lp=$(echo "$pkg" | tr 'A-Z' 'a-z')
  local as=() lib="" absent=()
  as=($(node -e "for (const a of require(process.argv[1]).assemblies ?? []) console.log(a)" "$win"))
  # 1 つ目のアセンブリ（アクティビティの本体）がある lib/net6.0 を、そのパッケージのクロスプラットフォーム版とする
  for d in "$N/$lp.runtime.portable/$ver" "$N/$lp.runtime/$ver" "$N/$lp/$ver"; do
    [ -f "$d/lib/net6.0/${as[0]}" ] && { lib=$d/lib/net6.0; break; }
  done
  [ -n "$lib" ] || { echo "-- $pkg $ver: クロスプラットフォームの ${as[0]} が手元に無い（作らない）"; return 0; }
  # そこに無いほかのアセンブリは、クロスプラットフォームに無い（UIAutomation の旧 UiPath.UiAutomation.Activities.dll、CV など）
  for a in "${as[@]}"; do
    if [ -f "$lib/$a" ]; then dlls+=(--dll "$lib/$a"); else absent+=("$a"); fi
  done
  [ ${#absent[@]} -eq 0 ] || echo "   $pkg $ver: ${absent[*]} はクロスプラットフォームに無い（$lib）"
  "$exe" --package "$pkg" --version "$ver" "${dlls[@]}" $(extra "$pkg") --out "$root/catalog/$pkg/$ver.portable.json" | tail -1
}

if [ "${1:-}" = "--all" ]; then
  for f in "$root"/catalog/*/*.json; do
    case $f in *.objects.json|*.portable.json) continue ;; esac
    one "$(basename "$(dirname "$f")")" "$(basename "$f" .json)"
  done
elif [ $# -eq 2 ]; then
  one "$1" "$2"
else
  echo "使い方: bash tools/catalog-extractor/extract-portable.sh <パッケージ> <版> | --all" >&2; exit 2
fi
