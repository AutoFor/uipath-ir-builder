// C# のソースを、解析しやすい形にする小さな字句処理。完全な構文解析はしない。
//
// mask(): コメントと文字列・文字リテラルの中身を空白に置き換える（引用符と位置・改行は残す）。
//   補間文字列 $"...{式}..." の {式} はコードとして残す。これで正規表現が文字列の中身に引っかからない。
// splitArgs(): "(" の位置から対応する ")" までを、トップレベルの "," で引数に分ける。

export function mask(src: string): string {
  const out = src.split("");
  const n = src.length;
  const blank = (a: number, b: number) => { for (let k = a; k < b && k < n; k++) if (out[k] !== "\n" && out[k] !== "\r") out[k] = " "; };

  // コードを読む。stopAtBrace のときは、対応する "}" の位置で止まって返す（補間の穴の中）
  function code(i: number, stopAtBrace: boolean): number {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === "/" && src[i + 1] === "/") { let j = src.indexOf("\n", i); if (j < 0) j = n; blank(i, j); i = j; continue; }
      if (c === "/" && src[i + 1] === "*") { let j = src.indexOf("*/", i + 2); j = j < 0 ? n : j + 2; blank(i, j); i = j; continue; }
      if (c === "'") {
        let j = i + 1 + (src[i + 1] === "\\" ? 2 : 1);
        j = src.indexOf("'", j);
        if (j < 0 || j - i > 12) { i++; continue; } // 文字リテラルに見えない
        blank(i + 1, j); i = j + 1; continue;
      }
      const m = /^(\$+@?|@\$+|@)?("""+|")/.exec(src.slice(i, i + 12));
      if (m && !(m[1] === undefined && /[\w]/.test(src[i - 1] ?? ""))) { i = str(i, m[1] ?? "", m[2].length); continue; }
      if (stopAtBrace) {
        if (c === "{" || c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        else if (c === "}") { if (depth === 0) return i; depth--; }
        else if (c === ":" && depth === 0 && src[i + 1] !== ":") { // 書式指定 {x:N2}
          let j = i; while (j < n && src[j] !== "}") j++;
          blank(i, j); i = j; continue;
        }
      }
      i++;
    }
    return n;
  }

  // 文字列リテラル。start は接頭辞（$ / @）の位置
  function str(start: number, prefix: string, quotes: number): number {
    const dollars = (prefix.match(/\$/g) ?? []).length;
    const verbatim = prefix.includes("@");
    let i = start + prefix.length + quotes;
    const raw = quotes >= 3;
    const close = '"'.repeat(quotes);
    while (i < n) {
      const c = src[i];
      if (raw && src.startsWith(close, i)) return i + quotes;
      if (!raw && !verbatim && c === "\\") { blank(i, i + 2); i += 2; continue; }
      if (!raw && verbatim && c === '"' && src[i + 1] === '"') { blank(i, i + 2); i += 2; continue; }
      if (!raw && c === '"') return i + 1;
      if (!raw && !verbatim && c === "\n") return i; // 閉じていない
      if (dollars > 0 && c === "{") {
        const open = "{".repeat(dollars);
        if (!raw && dollars === 1 && src[i + 1] === "{") { blank(i, i + 2); i += 2; continue; }
        if (src.startsWith(open, i)) {
          const end = code(i + dollars, true);
          i = end + dollars;
          continue;
        }
      }
      blank(i, i + 1);
      i++;
    }
    return n;
  }

  code(0, false);
  return out.join("");
}

// s[i] が "<" のとき、ジェネリックの型引数リストに見えれば対応する ">" の次の位置を返す。見えなければ -1
export function genericEnd(s: string, i: number): number {
  if (!/[\w]/.test(s[i - 1] ?? "")) return -1;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "<") depth++;
    else if (c === ">") {
      depth--;
      if (depth === 0) {
        const next = s.slice(j + 1).match(/^\s*(.)/)?.[1] ?? "";
        return "()[]{},;.?>=".includes(next) || next === "" ? j + 1 : -1;
      }
    } else if (!/[\w\s.,?\[\]:]/.test(c)) return -1;
  }
  return -1;
}

export type Arg = { text: string; start: number; name?: string; modifier?: "out" | "ref" | "in"; value: string; valueStart: number };

// open は "(" の位置。返り値の end は対応する ")" の位置（見つからなければ -1）
export function splitArgs(s: string, open: number): { args: Arg[]; end: number } {
  const args: Arg[] = [];
  const stack: string[] = [];
  let argStart = open + 1;
  const push = (end: number) => {
    const raw = s.slice(argStart, end);
    if (!raw.trim()) return;
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    const start = argStart + lead;
    let rest = text, off = 0, name: string | undefined, modifier: Arg["modifier"];
    const nm = /^([A-Za-z_]\w*)\s*:(?!:)\s*/.exec(rest);
    if (nm) { name = nm[1]; off += nm[0].length; rest = rest.slice(nm[0].length); }
    const md = /^(out|ref|in)\s+/.exec(rest);
    if (md) { modifier = md[1] as Arg["modifier"]; off += md[0].length; rest = rest.slice(md[0].length); }
    args.push({ text, start, name, modifier, value: rest, valueStart: start + off });
  };
  for (let i = open + 1; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{") stack.push(c);
    else if (c === "<") { const e = genericEnd(s, i); if (e > 0) i = e - 1; }
    else if (c === ")" || c === "]" || c === "}") {
      if (!stack.length) { if (c === ")") { push(i); return { args, end: i }; } return { args, end: -1 }; }
      stack.pop();
    } else if (c === "," && !stack.length) { push(i); argStart = i + 1; }
  }
  return { args, end: -1 };
}
