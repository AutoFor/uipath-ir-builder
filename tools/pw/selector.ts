// UiPath の Web のセレクター（<webctrl ... />）を Playwright の locator の式にする（AUT-1219。ir-to-pw.ts から使う）。
//
// 直せるもの（webctrl の属性）：
//   tag → CSS のタグ / id・name・class・type・href・src・title・role・data-*・aria-*（aria-role は role）→ CSS の [属性="値"]
//   aaname → filter({ hasText: /^値$/ })（UiPath の aaname は表示の文字に当たる。aria-label の値では見つからなかった。2026-11-19、DESKTOP で確かめた）
//   aria-label → CSS の [aria-label="値"]。正規表現（matching:aria-label='regex'）なら getByLabel(new RegExp(...))
//   innertext → filter({ hasText: /^値$/ })
//   css-selector → そのまま CSS / parentid → 祖先の [id="値"] / idx → nth
//   値の * と ? は UiPath のワイルドカード。CSS の属性では ^= $= *= で書ける形だけ。matching:<属性>='regex' は aaname・innertext・aria-label だけ
//   webctrl が 2 つ以上なら、locator をつなぐ（2 つめ以降は 1 つめの中を探す）
// 直せないもの：webctrl 以外（wnd・ctrl・uia など、デスクトップのアプリ）、上に無い属性（isleaf・tablerow・parentclass など）、
//   あいまい一致（matching:<属性>='fuzzy'）
export type LocatorResult = { ts: string; notes: string[] } | { why: string };

type SelNode = { tag: string; attrs: [string, string][] };

const unxml = (s: string) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function parseSelector(sel: string): SelNode[] | string {
  const nodes: SelNode[] = [];
  const re = /<\s*([\w-]+)((?:\s+[\w:.-]+\s*=\s*(?:'[^']*'|"[^"]*"))*)\s*\/>/gy;
  const rest = sel.trim();
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  let pos = 0;
  while (pos < rest.length) {
    while (/\s/.test(rest[pos] ?? "")) pos++;
    if (pos >= rest.length) break;
    re.lastIndex = pos;
    m = re.exec(rest);
    if (!m) return `セレクターを読めない: ${rest.slice(pos, pos + 60)}`;
    const attrs: [string, string][] = [];
    for (const a of m[2].matchAll(/([\w:.-]+)\s*=\s*(?:'([^']*)'|"([^"]*)")/g)) attrs.push([a[1], unxml(a[2] ?? a[3])]);
    nodes.push({ tag: m[1], attrs });
    pos = re.lastIndex;
  }
  return nodes;
}

const CSS_ATTRS = new Set(["id", "name", "class", "type", "href", "src", "title", "role", "value", "placeholder", "for", "alt"]);
const cssStr = (s: string) => JSON.stringify(s); // CSS の文字列も " と \ の逃がし方は同じ
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const wildRe = (v: string) => "^" + v.split("").map((c) => (c === "*" ? ".*" : c === "?" ? "." : reEsc(c))).join("") + "$";

// CSS の [k=v]。UiPath のワイルドカードは、前・後ろ・両方の * だけ CSS で書ける
function cssAttr(k: string, v: string): string | undefined {
  if (!/[*?]/.test(v)) return `[${k}=${cssStr(v)}]`;
  if (v.includes("?")) return undefined;
  const inner = v.replace(/^\*+|\*+$/g, "");
  if (inner.includes("*")) return undefined;
  if (!inner) return `[${k}]`;
  const s = v.startsWith("*"), e = v.endsWith("*");
  return `[${k}${s && e ? "*=" : e ? "^=" : "$="}${cssStr(inner)}]`;
}

export function selectorToLocator(sel: string, root = "page"): LocatorResult {
  const nodes = parseSelector(sel);
  if (typeof nodes === "string") return { why: nodes };
  const notes: string[] = [];
  const parts: string[] = [];
  let first = true;
  for (const n of nodes) {
    if (n.tag === "html") {
      if (first && parts.length === 0) continue; // 画面（ブラウザー）のセレクターがフルセレクターの先頭にあるとき
      return { why: "<html> がセレクターの途中にある" };
    }
    if (n.tag !== "webctrl") return { why: `<${n.tag}> は Web の要素ではない（デスクトップのアプリの操作は Playwright に無い）` };
    const matching = new Map(n.attrs.filter(([k]) => k.startsWith("matching:")).map(([k, v]) => [k.slice(9), v]));
    for (const [k, how] of matching) if (how === "fuzzy") return { why: `${k} のあいまい一致（matching:${k}='fuzzy'）は Playwright に無い` };
    let css = "";
    let tag = "";
    let cssSel = "";
    let ancestor = "";
    const tail: string[] = [];
    for (const [k, v] of n.attrs) {
      if (k.startsWith("matching:") || k.startsWith("fuzzylevel:")) continue;
      const regex = matching.get(k) === "regex";
      if (regex && k === "aria-label") { tail.push(`.and(${root}.getByLabel(new RegExp(${JSON.stringify(v)})))`); continue; }
      if (regex && k !== "aaname" && k !== "innertext") return { why: `${k} の正規表現（matching:${k}='regex'）は CSS で書けない` };
      if (k === "tag") { tag = v.toLowerCase(); continue; }
      if (k === "css-selector") { cssSel = v; continue; }
      if (k === "parentid") { const a = cssAttr("id", v); if (!a) return { why: `parentid='${v}' のワイルドカードは CSS で書けない` }; ancestor = `${a} `; continue; }
      if (k === "idx") { const i = Number(v); if (!Number.isInteger(i) || i < 1) return { why: `idx='${v}' は直せない` }; tail.push(`.nth(${i - 1})`); continue; }
      if (k === "aaname" || k === "innertext") {
        const re = regex ? v : wildRe(v);
        tail.push(`.filter({ hasText: new RegExp(${JSON.stringify(re)}) })`);
        continue;
      }
      const name = k === "aria-role" ? "role" : k;
      if (CSS_ATTRS.has(name) || name.startsWith("data-") || name.startsWith("aria-")) {
        const a = cssAttr(name, v);
        if (!a) return { why: `${k}='${v}' のワイルドカードは CSS で書けない` };
        css += a;
        continue;
      }
      return { why: `webctrl の属性 ${k} は直せない` };
    }
    const full = ancestor + (cssSel ? `:is(${cssSel})${css}` : (tag || (css ? "" : "*")) + css);
    parts.push(`.locator(${JSON.stringify(full)})${tail.join("")}`);
    first = false;
  }
  if (!parts.length) return { why: "webctrl が無い" };
  // UiPath は当たった要素の先頭を使う。Playwright の strict（2 つ以上でエラー）にしないように first にする
  return { ts: `${root}${parts.join("")}.first()`, notes };
}
