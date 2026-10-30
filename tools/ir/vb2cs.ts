// IR の VB の式を C# の式に直す。よく使う形だけを機械的に直し、直せない形はエラーにする（推測で書かない）。
// 直せないときは、IR の値を { "vb": "...", "cs": "..." } にして両方を書く。
//
// 直すもの:
//   "a""b" → "a\"b"、& → +、= → ==、<> → !=、And/AndAlso → &&、Or/OrElse → ||、Not → !、Mod → %、Xor → ^
//   Nothing → null、True/False → true/false、Me → this、Is Nothing → == null、IsNot Nothing → != null
//   New X → new X()、New X(Of T) → new X<T>()、New T() {…} → new T[] {…}、New X(...) From {…} → new X(...) {…}
//   (Of T) → <T>、Integer/Long/Date → int/long/DateTime（型の位置）
//   CInt/CLng/CDbl/CDec/CBool/CStr/CDate(x) → Convert.ToXxx(x)、CType/DirectCast(x, T) → ((T)(x))、TryCast(x, T) → (x as T)
//   変数(0) → 変数[0]（宣言済みの変数のときだけ）、.Item(k) / .Rows(0) / .Columns(0) / .Chars(0) → [k]
//   .ToString など引数なしで呼べるメソッドに () を付ける
//   宣言済みの名前は大文字小文字を宣言に合わせる（VB は区別しないが C# は区別する）
// 直さないもの（エラー）: If(...)、Function/Sub のラムダ、AddressOf、TypeOf、Like、\（整数の割り算）、^（べき乗）、{…} の配列リテラル

export type Converted = { cs: string } | { error: string };

type Tok = { k: "str" | "num" | "id" | "op" | "ws" | "date"; v: string };

const parameterless = new Set([
  "ToString", "Trim", "TrimStart", "TrimEnd", "ToUpper", "ToLower", "ToUpperInvariant", "ToLowerInvariant", "ToArray",
  "ToList", "ToCharArray", "Clone", "GetType", "Distinct", "Reverse", "First", "Last", "FirstOrDefault", "LastOrDefault",
  "Any", "Copy", "AsEnumerable", "CopyToDataTable", "Dispose",
]);
const indexers = new Set(["Item", "Rows", "Columns", "Chars", "Cells"]);
const typeAlias: Record<string, string> = { integer: "int", long: "long", short: "short", date: "DateTime", single: "float", char: "char" };
const conv: Record<string, string> = {
  cint: "Convert.ToInt32", clng: "Convert.ToInt64", cdbl: "Convert.ToDouble", cdec: "Convert.ToDecimal",
  cbool: "Convert.ToBoolean", cstr: "Convert.ToString", cdate: "Convert.ToDateTime", csng: "Convert.ToSingle", cshort: "Convert.ToInt16",
};
const unsupported = new Set(["if", "function", "sub", "addressof", "typeof", "like", "iif", "gettype", "nameof", "with", "aggregate", "from", "select", "where"]);

function lex(s: string): Tok[] | { error: string } {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      let j = i + 1, v = "";
      for (;;) {
        if (j >= s.length) return { error: "文字列が閉じていない" };
        if (s[j] === '"') { if (s[j + 1] === '"') { v += '"'; j += 2; continue; } break; }
        v += s[j++];
      }
      if (/^[cC]\b/.test(s.slice(j + 1, j + 2) + " ")) return { error: "文字リテラル \"x\"c は未対応" };
      out.push({ k: "str", v }); i = j + 1; continue;
    }
    if (c === "#") return { error: "日付リテラル #...# は未対応" };
    if (/\s/.test(c)) { let j = i; while (j < s.length && /\s/.test(s[j])) j++; out.push({ k: "ws", v: s.slice(i, j) }); i = j; continue; }
    if (/\d/.test(c) || (c === "." && /\d/.test(s[i + 1] ?? ""))) {
      const m = /^(\d*\.?\d+(?:[eE][+-]?\d+)?)([DdFfRr@!#]|UI|UL|US|[SILU])?/.exec(s.slice(i))!;
      const suf = (m[2] ?? "").toUpperCase();
      const map: Record<string, string> = { "": "", D: "m", "@": "m", F: "f", "!": "f", R: "d", "#": "d", S: "", I: "", L: "L", UI: "u", UL: "UL", US: "" };
      out.push({ k: "num", v: m[1] + (map[suf] ?? "") }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_]\w*/.exec(s.slice(i))!; out.push({ k: "id", v: m[0] }); i += m[0].length; continue; }
    if (c === "[") return { error: "[名前] のエスケープは未対応" };
    const two = s.slice(i, i + 2);
    if (["<>", "<=", ">=", "&=", "+=", "-="].includes(two)) { out.push({ k: "op", v: two }); i += 2; continue; }
    out.push({ k: "op", v: c }); i++;
  }
  return out;
}

const csString = (v: string) => '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';

// scope は宣言済みの名前 → 型（IR の型名）
export function vbToCs(expr: string, scope: Map<string, string>): Converted {
  const lx = lex(expr);
  if ("error" in lx) return lx;
  const t = lx.filter((x) => x.k !== "ws");
  const names = new Map([...scope.keys()].map((n) => [n.toLowerCase(), n]));
  let i = 0;
  const out: string[] = [];
  const peek = (o = 0) => t[i + o];
  const isOp = (x: Tok | undefined, v: string) => x?.k === "op" && x.v === v;
  const isId = (x: Tok | undefined, v: string) => x?.k === "id" && x.v.toLowerCase() === v;

  try {
    expression(() => i >= t.length);
  } catch (e) {
    return { error: (e as Error).message };
  }
  return { cs: out.join("").trim() };

  // stop が真になるまで読む。かっこの中は再帰で読む
  function expression(stop: () => boolean) {
    while (!stop()) {
      const x = t[i];
      if (x.k === "str") { out.push(csString(x.v)); i++; continue; }
      if (x.k === "num") { out.push(x.v); i++; continue; }
      if (x.k === "op") { op(x.v); continue; }
      ident();
    }
  }

  function op(v: string) {
    i++;
    switch (v) {
      case "&": out.push(" + "); return;
      case "=": out.push(" == "); return;
      case "<>": out.push(" != "); return;
      case "\\": throw new Error("\\（整数の割り算）は未対応");
      case "^": throw new Error("^（べき乗）は未対応。Math.Pow を使う");
      case "{": throw new Error("{…} の配列リテラルは未対応（変数の既定値なら型が配列のときだけ直せる）");
      case "(": group("(", ")"); return;
      case ",": out.push(", "); return;
      case "+": case "-": {
        const before = t[i - 2];
        if (!before || (before.k === "op" && before.v !== ")") || (before.k === "id" && /^(and|andalso|or|orelse|not|mod|xor|is|isnot|return)$/i.test(before.v))) { out.push(v); return; }
        out.push(` ${v} `); return;
      }
      case "<": case ">": case "<=": case ">=": case "*": case "/": out.push(` ${v} `); return;
      default: out.push(v);
    }
  }

  // 開きかっこの直後から、対応する閉じかっこまでを open/close で包んで出す
  function group(open: string, close: string) {
    out.push(open);
    let depth = 0;
    expression(() => {
      if (i >= t.length) throw new Error("かっこが閉じていない");
      const x = t[i];
      if (isOp(x, "(") && depth >= 0) { /* 中のかっこは op() が再帰で読む */ }
      if (isOp(x, ")")) { i++; return true; }
      return false;
    });
    void depth;
    out.push(close);
  }

  function typeName(): string {
    // 型の位置: 名前（.名前）*、(Of …)、()（配列）
    let s = "";
    const id = t[i];
    if (id?.k !== "id") throw new Error("型名が無い");
    s += typeAlias[id.v.toLowerCase()] ?? id.v; i++;
    while (isOp(peek(), ".") && peek(1)?.k === "id") { s += "." + peek(1)!.v; i += 2; }
    if (isOp(peek(), "(") && isId(peek(1), "of")) {
      i += 2;
      const args: string[] = [typeName()];
      while (isOp(peek(), ",")) { i++; args.push(typeName()); }
      if (!isOp(peek(), ")")) throw new Error("(Of …) が閉じていない");
      i++;
      s += `<${args.join(", ")}>`;
    }
    return s;
  }

  function ident() {
    const x = t[i];
    const lc = x.v.toLowerCase();
    const prev = t[i - 1];
    const afterDot = isOp(prev, ".");
    if (!afterDot) {
      if (unsupported.has(lc)) throw new Error(`${x.v} は C# に直せない。{ "vb": ..., "cs": ... } で書く`);
      switch (lc) {
        case "and": case "andalso": i++; out.push(" && "); return;
        case "or": case "orelse": i++; out.push(" || "); return;
        case "not": i++; out.push("!"); return;
        case "mod": i++; out.push(" % "); return;
        case "xor": i++; out.push(" ^ "); return;
        case "nothing": i++; out.push("null"); return;
        case "true": i++; out.push("true"); return;
        case "false": i++; out.push("false"); return;
        case "me": i++; out.push("this"); return;
        case "is": i++; out.push(" == "); return;
        case "isnot": i++; out.push(" != "); return;
        case "new": return newExpr();
      }
      if (conv[lc] && isOp(peek(1), "(")) { i++; out.push(conv[lc]); return; }
      if ((lc === "ctype" || lc === "directcast" || lc === "trycast") && isOp(peek(1), "(")) return cast(lc);
    }
    i++;
    // 宣言済みの名前（メンバーアクセスの先頭だけ）
    const declared = !afterDot ? names.get(lc) : undefined;
    const name = declared ?? (afterDot ? x.v : x.v);
    if (afterDot && indexers.has(x.v) && isOp(peek(), "(")) {
      if (x.v === "Item") out.pop(); // .Item(k) → [k]
      else out.push(name);
      i++; group("[", "]"); return;
    }
    out.push(name);
    if (declared && isOp(peek(), "(")) { i++; group("[", "]"); return; } // 変数(0) → 変数[0]
    if (afterDot && parameterless.has(x.v) && !isOp(peek(), "(")) out.push("()");
    if (isOp(peek(), "(") && isId(peek(1), "of")) { // メソッドの型引数 Foo(Of T)(...)
      i += 2;
      const args = [typeName()];
      while (isOp(peek(), ",")) { i++; args.push(typeName()); }
      i++;
      out.push(`<${args.join(", ")}>`);
    }
  }

  function newExpr() {
    i++; // New
    const ty = typeName();
    let s = `new ${ty}`;
    if (isOp(peek(), "(")) {
      // New T() {…} は配列
      if (isOp(peek(1), ")") && isOp(peek(2), "{")) { i += 2; out.push(`new ${ty}[] `); return initializer(); }
      out.push(s); i++; group("(", ")");
    } else out.push(s + "()");
    if (isId(peek(), "from")) { i++; out.push(" "); initializer(); }
  }

  function initializer() {
    if (!isOp(peek(), "{")) throw new Error("{ が無い");
    i++;
    out.push("{ ");
    expression(() => {
      for (;;) {
        if (i >= t.length) throw new Error("{ が閉じていない");
        if (isOp(t[i], "}")) { i++; return true; }
        if (isOp(t[i], "{")) { initializer(); continue; } // 入れ子の初期化子（Dictionary の {k, v}）
        return false;
      }
    });
    out.push(" }");
  }

  function cast(kind: string) {
    i += 2; // CType (
    const save = out.length;
    expression(() => {
      if (i >= t.length) throw new Error(`${kind} が閉じていない`);
      return isOp(t[i], ",") && depthZero();
    });
    const value = out.splice(save).join("").trim();
    i++; // ,
    const ty = typeName();
    if (!isOp(peek(), ")")) throw new Error(`${kind} が閉じていない`);
    i++;
    out.push(kind === "trycast" ? `(${value} as ${ty})` : `((${ty})(${value}))`);
  }

  // expression() はかっこを再帰で読むので、ここに来る "," は常にトップレベル
  function depthZero() { return true; }
}

// 変数の既定値。VB の配列リテラル {a, b} は、型が配列のときだけ new T[] { a, b } に直す
export function vbDefaultToCs(expr: string, type: string, scope: Map<string, string>): Converted {
  const s = expr.trim();
  if (s.startsWith("{") && s.endsWith("}") && type.trim().endsWith("[]")) {
    const inner = vbToCs(s.slice(1, -1), scope);
    if ("error" in inner) return inner;
    return { cs: `new ${csType(type)} { ${inner.cs} }` };
  }
  return vbToCs(s, scope);
}

// IR の型名を C# の型名にする（List(Of String) → List<String>、Integer → int）
export function csType(t: string): string {
  return t.trim()
    .replace(/\(Of\s+/g, "<").replace(/\)/g, ">")
    .replace(/\b(Integer|Long|Short|Date|Single|Char)\b/g, (m) => typeAlias[m.toLowerCase()]);
}
