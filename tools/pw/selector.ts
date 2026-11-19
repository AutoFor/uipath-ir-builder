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

// webctrl の 1 行を読む。css：CSS で書ける部分。text：innertext・aaname の正規表現。label：aria-label の正規表現。nth：idx
type Row = { css: string; text?: string; label?: string; nth?: number; frame: boolean };
function readRow(n: SelNode): Row | { why: string } {
  if (n.tag !== "webctrl") return { why: `<${n.tag}> は Web の要素ではない（デスクトップのアプリの操作は Playwright に無い）` };
  const matching = new Map(n.attrs.filter(([k]) => k.startsWith("matching:")).map(([k, v]) => [k.slice(9), v]));
  for (const [k, how] of matching) if (how === "fuzzy") return { why: `${k} のあいまい一致（matching:${k}='fuzzy'）は Playwright に無い` };
  let css = "", tag = "", cssSel = "", ancestor = "";
  const row: Row = { css: "", frame: false };
  for (const [k, v] of n.attrs) {
    if (k.startsWith("matching:") || k.startsWith("fuzzylevel:") || k.startsWith("check:")) continue;
    const regex = matching.get(k) === "regex";
    if (regex && k === "aria-label") { row.label = v; continue; }
    if (regex && k !== "aaname" && k !== "innertext") return { why: `${k} の正規表現（matching:${k}='regex'）は CSS で書けない` };
    if (k === "tag") { tag = v.toLowerCase(); continue; }
    if (k === "css-selector") { cssSel = v; continue; }
    if (k === "parentid") { const a = cssAttr("id", v); if (!a) return { why: `parentid='${v}' のワイルドカードは CSS で書けない` }; ancestor = `${a} `; continue; }
    if (k === "idx") { const x = Number(v); if (!Number.isInteger(x) || x < 1) return { why: `idx='${v}' は直せない` }; row.nth = x - 1; continue; }
    if (k === "aaname" || k === "innertext") { row.text = regex ? v : wildRe(v); continue; }
    const name = k === "aria-role" ? "role" : k;
    if (CSS_ATTRS.has(name) || name.startsWith("data-") || name.startsWith("aria-")) {
      const a = cssAttr(name, v);
      if (!a) return { why: `${k}='${v}' のワイルドカードは CSS で書けない` };
      css += a;
      continue;
    }
    return { why: `webctrl の属性 ${k} は直せない` };
  }
  row.frame = tag === "iframe" || tag === "frame";
  row.css = ancestor + (cssSel ? `:is(${cssSel})${css}` : (tag || (css ? "" : "*")) + css);
  return row;
}

// 1 行を、CSS だけで書く（:near() の中など）。表示文字は Playwright の :text-matches()。aria-label の正規表現・idx は書けない
function rowCss(r: Row): string | { why: string } {
  if (r.label !== undefined) return { why: "aria-label の正規表現は CSS だけでは書けない" };
  if (r.nth !== undefined) return { why: "idx は CSS だけでは書けない" };
  return r.css + (r.text !== undefined ? `:text-matches(${JSON.stringify(r.text)})` : "");
}

function rowsOf(sel: string): Row[] | { why: string } {
  const nodes = parseSelector(sel);
  if (typeof nodes === "string") return { why: nodes };
  const rows: Row[] = [];
  for (const [i, n] of nodes.entries()) {
    if (n.tag === "html") {
      if (i === 0) continue; // 画面（ブラウザー）のセレクターがフルセレクターの先頭にあるとき
      return { why: "<html> がセレクターの途中にある" };
    }
    const r = readRow(n);
    if ("why" in r) return r;
    rows.push(r);
  }
  if (!rows.length) return { why: "webctrl が無い" };
  if (rows[rows.length - 1].frame) return { why: "最後の行が iframe（iframe の中の要素の行が無い）" };
  return rows;
}

// 行をつないで locator の式にする。iframe の行は frameLocator（DESKTOP の UiPath も、この行で iframe の中を探せた）。
// near：最後の行に :near(アンカー) を足す（UiPath の FuzzySelector＋PositioningType=Closest と同じく、アンカーにいちばん近いもの）
function chain(rows: Row[], root: string, near?: string): string {
  const parts = rows.map((r, i) => {
    if (r.frame) return `.frameLocator(${JSON.stringify(r.css)})`;
    const last = i === rows.length - 1;
    let p = `.locator(${JSON.stringify(r.css + (last && near ? `:near(${near})` : ""))})`;
    if (r.text !== undefined) p += `.filter({ hasText: new RegExp(${JSON.stringify(r.text)}) })`;
    if (r.label !== undefined) p += `.and(${root}.getByLabel(new RegExp(${JSON.stringify(r.label)})))`;
    if (r.nth !== undefined) p += `.nth(${r.nth})`;
    return p;
  });
  // UiPath は当たった要素の先頭を使う。Playwright の strict（2 つ以上でエラー）にしないように first にする（:near では、いちばん近いもの）
  return `${root}${parts.join("")}.first()`;
}

export function selectorToLocator(sel: string, root = "page"): LocatorResult {
  const rows = rowsOf(sel);
  if ("why" in rows) return rows;
  return { ts: chain(rows, root), notes: [] };
}

// アンカーの 1 行（iframe の行があれば、本体と同じ iframe のもの）を、:near() の中に書く CSS にする
function anchorCss(sel: string, targetRows: Row[]): string | { why: string } {
  const rows = rowsOf(sel);
  if ("why" in rows) return rows;
  const frames = rows.filter((r) => r.frame), tf = targetRows.filter((r) => r.frame);
  if (frames.length !== tf.length || frames.some((r, i) => r.css !== tf[i].css)) return { why: "アンカーが本体と別の iframe にある" };
  const own = rows.filter((r) => !r.frame);
  if (own.length !== 1) return { why: "アンカーのセレクターが複数行（:near() の中に書けない）" };
  return rowCss(own[0]);
}

// UiPath のターゲット（TargetAnchorable の objs の中身）から locator の式を作る。notes は意味が変わるもの
//   アンカー：UiPath は FuzzySelector で探すときだけアンカーを使う（Selector では使わない）。PositioningType=Closest は :near(アンカー) と同じ意味。
//   DesignTimeRectangle で位置を合わせる形（Default）は、近さで探す :near で近づける（意味が変わりうるので notes に出す）
export function targetToLocator(t: Record<string, unknown>, root = "page"): LocatorResult {
  const litOf = (v: unknown): string | undefined => (typeof v === "object" && v && "lit" in v ? (v as { lit: string }).lit : undefined);
  const steps = String(t.SearchSteps ?? "Selector");
  const notes: string[] = [];
  if (/Image|CV|Semantic/i.test(steps) && !/(^|,s*)Selector/.test(steps)) return { why: `画像・CV・意味で探すターゲット（SearchSteps=${steps}）は Playwright に無い` };
  const strict = /(^|,s*)Selector/.test(steps);
  const fuzzy = !strict && /Fuzzy/.test(steps);
  const selVal = fuzzy ? t.FuzzySelectorArgument : (t.FullSelectorArgument ?? t.PartialSelector);
  const sel = litOf(selVal);
  if (sel === undefined) return { why: "セレクターがリテラルではない（式で組み立てるセレクターは直せない）" };
  const rows = rowsOf(sel);
  if ("why" in rows) return { why: `${rows.why}（${sel}）` };
  const anchors = Array.isArray(t.Anchors) ? (t.Anchors as Record<string, unknown>[]) : [];
  if (!anchors.length || strict) return { ts: chain(rows, root), notes }; // Selector の探し方では、UiPath もアンカーを使わない
  if (anchors.length > 1) return { ts: chain(rows, root), notes: ["アンカーが 2 つ以上ある。Playwright には 1 つ目だけを :near() で書く"] };
  const asel = litOf(anchors[0].FuzzySelectorArgument ?? anchors[0].FullSelectorArgument);
  if (asel === undefined) return { why: "アンカーのセレクターがリテラルではない" };
  const near = anchorCss(asel, rows);
  if (typeof near !== "string") return { why: `アンカー（${asel}）：${near.why}` };
  if (t.PositioningType !== "Closest") notes.push("アンカーの位置（DesignTimeRectangle）ではなく、近さ（:near）で探す");
  return { ts: chain(rows, root, near), notes };
}

// 開くときの URL の UiPath のワイルドカード（*）を、Playwright の URL の glob（**）にする
export const urlGlob = (u: string) => u.replace(/\*+/g, "**");
