// 入れる文字のあとに押すキー（Tab・Enter など）の、Playwright と UiPath の Type Into の書き方の対応（AUT-1214）
// UiPath の Type Into は、文字の中の [k(tab)] などをキーとして押す。Playwright は fill のあとに keyboard.press で押す。
// 使いどころ：shadow DOM の中のボタンなど、UiPath のセレクターで指せない要素を、入力欄からのキー操作で押す
//   （Agents のメモリ空間の削除の確かめ：名前を打って Tab・Tab で「削除」に移り、Enter。キーの間を空けないと押せない）

// Space は UiPath の特殊キーに無い（[k(space)] は「特殊キーの構文エラー」。2026-11-20、DESKTOP）。空白の文字そのものを打つ。
// ただし Chrome の既定の入力方式では文字は流し込み（キーを押さない）になり、ボタンは押せない。ボタンは Enter で押す
const PW_TO_UIPATH: Record<string, string> = {
  Tab: "[k(tab)]", Enter: "[k(enter)]", Space: " ", Escape: "[k(esc)]", Backspace: "[k(back)]", Delete: "[k(del)]",
  ArrowUp: "[k(up)]", ArrowDown: "[k(down)]", ArrowLeft: "[k(left)]", ArrowRight: "[k(right)]",
  Home: "[k(home)]", End: "[k(end)]", PageUp: "[k(pgup)]", PageDown: "[k(pgdn)]",
};
const UIPATH_TO_PW = Object.fromEntries(Object.entries(PW_TO_UIPATH).map(([k, v]) => [v, k]));

// 入れたあとのキーの間に置く時間（ミリ秒）。名前を打った直後に Tab・Tab・Enter を続けて押すと、
// 「削除」のボタンが押せる状態になる前にキーが届き、押せなかった（2026-11-20、Agents のメモリ空間）。
// UiPath では Type Into の DelayBetweenKeys（文字ごとの間）にする
export const KEY_DELAY_MS = 300;

// Playwright のキーの名前 → UiPath の書き方（[k(…)] か空白）を並べた文字。知らないキーはエラー
export function keysToUiPath(keys: string[]): string {
  return keys.map((k) => {
    const u = PW_TO_UIPATH[k];
    if (!u) throw new Error(`キー「${k}」は UiPath の書き方に直せない（使えるのは ${Object.keys(PW_TO_UIPATH).join("・")}）`);
    return u;
  }).join("");
}

// 末尾の [k(…)] の並び（あいだと後ろの空白は Space）を、Playwright のキーの名前に戻す。
// [k(…)] が 1 つも無ければ分けない（ふつうの文字の後ろの空白はキーにしない）。知らないキーがあっても分けない
export function splitTrailingKeys(s: string): { text: string; keys: string[] } {
  const m = /((?:\[k\(\w+\)\])(?:\[k\(\w+\)\]| )*)$/.exec(s);
  if (!m) return { text: s, keys: [] };
  const keys = [...m[1].matchAll(/\[k\((\w+)\)\]| /g)].map((x) => UIPATH_TO_PW[x[0] === " " ? " " : `[k(${x[1].toLowerCase()})]`]);
  if (keys.some((k) => !k)) return { text: s, keys: [] };
  return { text: s.slice(0, m.index), keys };
}
