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
//   vbCr / vbLf / vbCrLf / vbTab / vbNewLine / vbNullString など → 文字列リテラル、Now / Today → DateTime.Now / DateTime.Today
//   Left / Mid / Len / InStr / IsNumeric / DateAdd など VB の組み込み関数、ControlChars / Strings → Microsoft.VisualBasic の完全名（意味を変えないため）
//   If(a, b, c) → (a ? b : c)、If(a, b) → (a ?? b)、IIf(a, b, c) → (a ? b : c)、Function(x) e → x => e、GetType(T) → typeof(T)、TypeOf x Is T → (x is T)
//   "x"c → 'x'、{a, b} → new[] { a, b }、#1/2/2020# → new DateTime(2020, 1, 2)、&H10 → 0x10、a:=1 → a: 1、New X With {.A = 1} → new X() { A = 1 }
//   f(a)(0) → f(a)[0]（) のすぐ後の ( はインデックス）、Date.Now / Integer.Parse → DateTime.Now / int.Parse、.tostring → .ToString
//   Not a = b → !(a == b)（VB の Not は比較より弱い）、整数どうしの a / b → (double)a / b（VB の / は小数を返す）
// 直さないもの（エラー）: Sub のラムダ、AddressOf、Like、\（整数の割り算）、^（べき乗）、クエリ構文（From ... Select）、
//   "a" & x + 1（& と + の優先順位が C# と逆）、数値どうしの &（C# では足し算になる）
//
// tree: true は C# の XAML の式（CSharpValue）。式ツリーにコンパイルされるので、省略可能な引数と名前付き引数を書けない（CS0854 / CS0853）。
//   InStr(s, ",") などの VB の組み込み関数は省いた引数の既定値を書き足し、s.Split(","c) は s.Split(new[] { ',' }) にする。
//   名前付き引数と、既定値を決められない呼び出し、C# の予約語の名前の変数（out など）はエラー

export type Converted = { cs: string } | { error: string };
export type ConvertOptions = { tree?: boolean };

// tree: true で書き足す、VB の組み込み関数の省略可能な引数の既定値（引数の数 → 足すもの）。max は引数の最大数。表に無い数はエラー（InStr の3つは Start ありか Compare ありか決まらない）
const CM = "Microsoft.VisualBasic.CompareMethod.Binary", FDW = "Microsoft.VisualBasic.FirstDayOfWeek.Sunday", FWY = "Microsoft.VisualBasic.FirstWeekOfYear.Jan1";
const optionalArgs: Record<string, { max: number; fill: Record<number, string[]> }> = {
  instr: { max: 4, fill: { 2: [CM] } },
  instrrev: { max: 4, fill: { 2: ["-1", CM], 3: [CM] } },
  replace: { max: 6, fill: { 3: ["1", "-1", CM], 4: ["-1", CM], 5: [CM] } },
  split: { max: 4, fill: { 1: ['" "', "-1", CM], 2: ["-1", CM], 3: [CM] } },
  join: { max: 2, fill: { 1: ['" "'] } },
  format: { max: 2, fill: { 1: ['""'] } },
  datediff: { max: 5, fill: { 3: [FDW, FWY], 4: [FWY] } },
  weekday: { max: 2, fill: { 1: [FDW] } },
};

type Tok = { k: "str" | "chr" | "num" | "id" | "op" | "ws" | "date"; v: string };

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
const unsupported = new Set(["sub", "addressof", "like", "nameof", "with", "aggregate", "from", "select", "where"]);
const constants: Record<string, string> = {
  vbcr: '"\\r"', vblf: '"\\n"', vbcrlf: '"\\r\\n"', vbtab: '"\\t"', vbnewline: "Environment.NewLine", vbnullstring: "null", vbnullchar: '"\\0"',
  vbback: '"\\b"', vbformfeed: '"\\f"', vbverticaltab: '"\\v"', now: "DateTime.Now", today: "DateTime.Today",
};
const moduleCase: Record<string, string> = { controlchars: "ControlChars", strings: "Strings", information: "Information", dateandtime: "DateAndTime", conversion: "Conversion", interaction: "Interaction" };
const vbFunctions: Record<string, string> = {};
for (const [mod, list] of Object.entries({
  Strings: "Left Right Mid Len UCase LCase LTrim RTrim InStr InStrRev Replace Split Join Asc AscW Chr ChrW StrReverse Space Format Trim",
  Information: "IsNothing IsNumeric IsDate IsArray IsDBNull",
  DateAndTime: "DateAdd DateDiff Year Month Day Hour Minute Second Weekday",
  Conversion: "Val Int Fix Hex Oct",
})) for (const n of list.split(" ")) vbFunctions[n.toLowerCase()] = `Microsoft.VisualBasic.${mod}.${n}`;
// VB は大文字小文字を区別しない。よく使うメンバーは C# の綴りに直す
const memberCase = new Map([...parameterless, ...indexers, "Length", "Count", "Contains", "Replace", "Split", "Substring", "StartsWith", "EndsWith", "IndexOf", "Add", "Remove", "Now", "Today", "Join", "Format", "IsNullOrEmpty", "IsNullOrWhiteSpace", "Parse", "Where", "Select", "Value", "Name"].map((n) => [n.toLowerCase(), n]));
// C# の予約語。C# の XAML では変数名に使えない
export const csKeywords = new Set("abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while".split(" "));
const linqChain = new Set(["Where", "Select", "SelectMany", "OrderBy", "OrderByDescending", "ThenBy", "Distinct", "Skip", "Take", "Cast", "OfType", "GroupBy", "AsEnumerable", "Reverse", "Concat", "Union"]);
const linqEnd = new Set(["Count", "Sum", "Max", "Min", "Average", "Single", "SingleOrDefault"]);
const INT_TYPE = /^(System\.)?(Int16|Int32|Int64|Integer|Long|Short|Byte)$/;
const NUM_TYPE = /^(System\.)?(Int16|Int32|Int64|Integer|Long|Short|Byte|Double|Decimal|Single)$/;

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
      if (/^[cC](?!\w)/.test(s.slice(j + 1, j + 3))) { out.push({ k: "chr", v }); i = j + 2; continue; }
      out.push({ k: "str", v }); i = j + 1; continue;
    }
    if (c === "#") {
      const m = /^#(\d{1,2})\/(\d{1,2})\/(\d{4})#/.exec(s.slice(i)), iso = /^#(\d{4})-(\d{1,2})-(\d{1,2})#/.exec(s.slice(i));
      if (!m && !iso) return { error: "時刻つきの日付リテラル #...# は未対応" };
      out.push({ k: "num", v: m ? `new DateTime(${+m[3]}, ${+m[1]}, ${+m[2]})` : `new DateTime(${+iso![1]}, ${+iso![2]}, ${+iso![3]})` });
      i += (m ?? iso)![0].length; continue;
    }
    if (c === "&" && /^&[Hh][0-9A-Fa-f]+/.test(s.slice(i))) { const m = /^&[Hh]([0-9A-Fa-f]+)/.exec(s.slice(i))!; out.push({ k: "num", v: `0x${m[1]}` }); i += m[0].length; continue; }
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
    if (["<>", "<=", ">=", "&=", "+=", "-=", ":="].includes(two)) { out.push({ k: "op", v: two }); i += 2; continue; }
    out.push({ k: "op", v: c }); i++;
  }
  return out;
}

const csChar = (v: string) => "'" + v.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const csString = (v: string) => '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';

// scope は宣言済みの名前 → 型（IR の型名）
export function vbToCs(expr: string, scope: Map<string, string>, opts: ConvertOptions = {}): Converted {
  const lx = lex(expr);
  if ("error" in lx) return lx;
  const t = lx.filter((x) => x.k !== "ws");
  const names = new Map([...scope.keys()].map((n) => [n.toLowerCase(), n]));
  let i = 0;
  let noIndexAt = -1; // ここの ( は添字にしない（ラムダの本体の先頭）
  const out: string[] = [];
  const peek = (o = 0) => t[i + o];
  const isOp = (x: Tok | undefined, v: string) => x?.k === "op" && x.v === v;
  const isId = (x: Tok | undefined, v: string) => x?.k === "id" && x.v.toLowerCase() === v;

  try {
    checkAmpersand();
    expression(() => i >= t.length);
  } catch (e) {
    return { error: (e as Error).message };
  }
  return { cs: out.join("").trim() };

  // & は + より弱い（VB）が、C# の + は同じ強さなので、"a" & x + 1 は結果が変わる。数値どうしの & は C# では足し算になる
  function checkAmpersand() {
    const frames = [{ amp: false, plus: false }];
    t.forEach((x, k) => {
      const top = frames[frames.length - 1];
      if (x.k === "id" && /^(and|andalso|or|orelse|not|xor|is|isnot)$/i.test(x.v) && !isOp(t[k - 1], ".")) { top.amp = top.plus = false; return; }
      if (x.k !== "op") return;
      if (x.v === "(" || x.v === "{") frames.push({ amp: false, plus: false });
      else if ((x.v === ")" || x.v === "}") && frames.length > 1) frames.pop();
      else if (["," , "=", "<>", "<", ">", "<=", ">="].includes(x.v)) top.amp = top.plus = false;
      else if (x.v === "&") {
        top.amp = true;
        if (numericOperand(k - 1, NUM_TYPE) && numericOperand(k + 1, NUM_TYPE)) throw new Error("数値どうしの & は C# では足し算になる。Convert.ToString で文字列にしてつなぐ");
      } else if ((x.v === "+" || x.v === "-") && binaryAt(k)) top.plus = true;
      if (top.amp && top.plus) throw new Error("& と + / - が同じかっこの中にある（VB では + が先、C# では左から）。かっこで包む");
    });
  }
  function binaryAt(k: number) {
    const b = t[k - 1];
    return !(!b || (b.k === "op" && b.v !== ")") || (b.k === "id" && /^(and|andalso|or|orelse|not|mod|xor|is|isnot|return)$/i.test(b.v)));
  }
  // 1語だけの数値（リテラルか、その型で宣言された変数）か
  function numericOperand(k: number, re: RegExp) {
    const x = t[k];
    if (!x || isOp(t[k - 1], ".") || isOp(t[k + 1], ".") || isOp(t[k + 1], "(")) return false;
    if (x.k === "num") return re === INT_TYPE ? /^(0x[0-9A-Fa-f]+|\d+L?)$/.test(x.v) : !x.v.startsWith("new");
    return x.k === "id" && re.test(scope.get(names.get(x.v.toLowerCase()) ?? "") ?? "");
  }

  // stop が真になるまで読んだ分を文字列で返す（出力には残さない）
  function capture(stop: () => boolean): string {
    const save = out.length;
    expression(stop);
    return out.splice(save).join("").trim();
  }
  function argEnd() { return i >= t.length || isOp(t[i], ",") || isOp(t[i], ")") || isOp(t[i], "}"); }

  // stop が真になるまで読む。かっこの中は再帰で読む
  function expression(stop: () => boolean) {
    while (!stop()) {
      const x = t[i];
      if (x.k === "str") { out.push(csString(x.v)); i++; continue; }
      if (x.k === "chr") { out.push(csChar(x.v)); i++; continue; }
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
      case "{":
        if (isOp(t[i], "}")) throw new Error("空の {} は型が決まらない");
        i--; out.push("new[] "); initializer(); return;
      case "(":
        // ) のすぐ後の ( は添字（Split(","c)(0)、Rows(0)("A")）
        if (isOp(t[i - 2], ")") && i - 1 !== noIndexAt) group("[", "]"); else group("(", ")");
        return;
      case ":=":
        if (opts.tree) throw new Error("名前付き引数（a:=1）は C# の XAML の式（式ツリー）に書けない（CS0853）。引数を順番どおりに並べる");
        out.push(": "); return;
      case ",": out.push(", "); return;
      case "+": case "-": {
        const before = t[i - 2];
        if (!before || (before.k === "op" && before.v !== ")") || (before.k === "id" && /^(and|andalso|or|orelse|not|mod|xor|is|isnot|return)$/i.test(before.v))) { out.push(v); return; }
        out.push(` ${v} `); return;
      }
      case "/": // VB の / は整数どうしでも小数を返す
        if (numericOperand(i - 2, INT_TYPE) && numericOperand(i, INT_TYPE)) out[out.length - 1] = `(double)${out[out.length - 1]}`;
        out.push(" / "); return;
      case "<": case ">": case "<=": case ">=": case "*": out.push(` ${v} `); return;
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

  function typeName(inOf = false): string {
    // 型の位置: 名前（.名前）*、(Of …)、()（配列。(Of の中だけ。New T() と紛れるため）
    let s = "";
    const id = t[i];
    if (id?.k !== "id") throw new Error("型名が無い");
    s += typeAlias[id.v.toLowerCase()] ?? id.v; i++;
    while (isOp(peek(), ".") && peek(1)?.k === "id") { s += "." + peek(1)!.v; i += 2; }
    if (isOp(peek(), "(") && isId(peek(1), "of")) {
      i += 2;
      const args: string[] = [typeName(true)];
      while (isOp(peek(), ",")) { i++; args.push(typeName(true)); }
      if (!isOp(peek(), ")")) throw new Error("(Of …) が閉じていない");
      i++;
      s += `<${args.join(", ")}>`;
    }
    if (inOf) while (isOp(peek(), "(") && isOp(peek(1), ")")) { i += 2; s += "[]"; }
    return s;
  }

  function ident() {
    const x = t[i];
    const lc = x.v.toLowerCase();
    const prev = t[i - 1];
    const afterDot = isOp(prev, ".");
    if (!afterDot) {
      if (!names.has(lc)) {
        if (constants[lc] && !isOp(peek(1), "(")) { i++; out.push(constants[lc]); return; }
        if (vbFunctions[lc] && isOp(peek(1), "(")) {
          i++; out.push(vbFunctions[lc]);
          if (opts.tree && optionalArgs[lc]) out.push(withDefaults(x.v, lc));
          return;
        }
        if (moduleCase[lc] && isOp(peek(1), ".")) { i++; out.push(`Microsoft.VisualBasic.${moduleCase[lc]}`); return; }
        if (typeAlias[lc] && isOp(peek(1), ".")) { i++; out.push(typeAlias[lc]); return; }
        if ((lc === "if" || lc === "iif") && isOp(peek(1), "(")) return ternary(lc);
        if (lc === "function" && isOp(peek(1), "(")) return lambda();
        if (lc === "gettype" && isOp(peek(1), "(")) {
          i += 2;
          const ty = typeName(true);
          if (!isOp(peek(), ")")) throw new Error("GetType が閉じていない");
          i++; out.push(`typeof(${ty})`); return;
        }
        if (lc === "typeof") {
          i++;
          const v = capture(() => { if (i >= t.length) throw new Error("TypeOf に Is が無い"); return isId(t[i], "is"); });
          i++;
          out.push(`(${v} is ${typeName(true)})`); return;
        }
        if (lc === "cobj" && isOp(peek(1), "(")) { i++; out.push("(object)"); return; }
      }
      if (unsupported.has(lc)) throw new Error(`${x.v} は C# に直せない。{ "vb": ..., "cs": ... } で書く`);
      switch (lc) {
        case "and": case "andalso": i++; out.push(" && "); return;
        case "or": case "orelse": i++; out.push(" || "); return;
        case "not": {
          i++;
          // VB の Not は比較より弱い。Not a = b は !(a == b)
          let depth = 0, cmp = false;
          for (let j = i; j < t.length; j++) {
            const y = t[j];
            if (isOp(y, "(") || isOp(y, "{")) depth++;
            else if (isOp(y, ")") || isOp(y, "}")) { if (--depth < 0) break; }
            else if (depth === 0 && isOp(y, ",")) break;
            else if (depth === 0 && y.k === "id" && /^(and|andalso|or|orelse|xor)$/i.test(y.v)) break;
            else if (depth === 0 && ((y.k === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(y.v)) || (y.k === "id" && /^(is|isnot)$/i.test(y.v)))) cmp = true;
          }
          if (!cmp) { out.push("!"); return; }
          const v = capture(() => argEnd() || (t[i].k === "id" && !isOp(t[i - 1], ".") && /^(and|andalso|or|orelse|xor)$/i.test(t[i].v)));
          out.push(`!(${v})`);
          return;
        }
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
      if (conv[lc] && !names.has(lc) && isOp(peek(1), "(")) { i++; out.push(conv[lc]); return; }
      if ((lc === "ctype" || lc === "directcast" || lc === "trycast") && isOp(peek(1), "(")) return cast(lc);
    }
    i++;
    // 宣言済みの名前（メンバーアクセスの先頭だけ）
    const declared = !afterDot ? names.get(lc) : undefined;
    const name = declared ?? (afterDot ? memberCase.get(lc) ?? x.v : x.v);
    if (afterDot && indexers.has(name) && isOp(peek(), "(")) {
      if (name === "Item") out.pop(); // .Item(k) → [k]
      else out.push(name);
      i++; group("[", "]"); return;
    }
    // 宣言済みの名前が C# の予約語（out、string など）。C# の XAML では使えない（@out も CS0103 で落ちる。knowledge/csharp-expressions.md）
    if (opts.tree && declared && csKeywords.has(declared)) throw new Error(`変数名 ${declared} は C# の予約語なので、C# の XAML では参照できない（@${declared} も通らない）。名前を変える`);
    out.push(name);
    if (opts.tree && afterDot && isOp(peek(), "(")) {
      // Microsoft.VisualBasic.Strings.InStr(...) など、モジュール名つきの VB の組み込み関数
      if (/^Microsoft\.VisualBasic\.\w+$/.test(out[out.length - 3] ?? "") && optionalArgs[lc]) { out.push(withDefaults(name, lc)); return; }
      // String.Split(char) / Split(string) は .NET の省略可能な引数（options）を使う。params の配列の形にする
      if (lc === "split") { splitOne(); return; }
    }
    if (declared && isOp(peek(), "(")) { i++; group("[", "]"); return; } // 変数(0) → 変数[0]
    if (afterDot && parameterless.has(name) && !isOp(peek(), "(")) out.push("()");
    // .Where(...).Count のように、LINQ の続きの Count は引数なしのメソッド
    if (afterDot && linqEnd.has(name) && !isOp(peek(), "(") && afterLinq(i - 2)) out.push("()");
    if (isOp(peek(), "(") && isId(peek(1), "of")) { // メソッドの型引数 Foo(Of T)(...)
      i += 2;
      const args = [typeName()];
      while (isOp(peek(), ",")) { i++; args.push(typeName()); }
      i++;
      out.push(`<${args.join(", ")}>`);
      // Cast(Of T) の引数のかっこは VB では省ける。続くかっこは引数で、添字ではない
      if (isOp(peek(), "(")) { i++; group("(", ")"); } else out.push("()");
    }
  }

  // ( の位置から ) までの引数を読む
  function callArgs(): string[] {
    i++;
    const a: string[] = [];
    if (isOp(t[i], ")")) { i++; return a; }
    a.push(capture(argEnd));
    while (isOp(t[i], ",")) { i++; a.push(capture(argEnd)); }
    if (!isOp(t[i], ")")) throw new Error("かっこが閉じていない");
    i++;
    return a;
  }
  // VB の組み込み関数の呼び出しに、省いた引数の既定値を足す（tree: true）。"(引数...)" を返す
  function withDefaults(name: string, lc: string): string {
    const o = optionalArgs[lc];
    const a = callArgs();
    if (a.length !== o.max && !o.fill[a.length]) throw new Error(`${name} の引数 ${a.length} つの呼び出しは、省いた引数の既定値を決められない（C# の XAML の式は省略可能な引数を書けない。CS0854）。引数をすべて書く`);
    return `(${[...a, ...(o.fill[a.length] ?? [])].join(", ")})`;
  }
  // x.Split(1つ) → x.Split(new[] { ',' }) / x.Split(new[] { "," }, StringSplitOptions.None)。引数が文字か文字列か分からなければエラー
  function splitOne() {
    const first = t[i + 1];
    const one = isOp(t[i + 2], ")");
    const a = callArgs();
    if (a.length !== 1) { out.push(`(${a.join(", ")})`); return; }
    const declared = first?.k === "id" && one ? scope.get(names.get(first.v.toLowerCase()) ?? "") : undefined;
    const kind = one && first?.k === "chr" ? "char" : one && first?.k === "str" ? "string" : declared && /^(System\.)?Char$/i.test(declared) ? "char" : declared && /^(System\.)?String$/i.test(declared) ? "string" : undefined;
    if (!kind) throw new Error(`Split(${a[0]}) は引数が文字か文字列か分からない（C# の XAML の式は省略可能な引数を書けない。CS0854）。{ "vb": ..., "cs": ... } で書く`);
    out.push(kind === "char" ? `(new[] { ${a[0]} })` : `(new[] { ${a[0]} }, StringSplitOptions.None)`);
  }

  // k は "." の位置。その前がメソッド呼び出しで、名前が LINQ か
  function afterLinq(k: number): boolean {
    let j = k - 1;
    if (t[j]?.k === "id") return linqChain.has(t[j].v);
    if (!isOp(t[j], ")")) return false;
    for (let depth = 0; j >= 0; j--) {
      if (isOp(t[j], ")")) depth++;
      else if (isOp(t[j], "(") && --depth === 0) break;
    }
    return linqChain.has(t[j - 1]?.v ?? "");
  }

  function ternary(kind: string) {
    i += 2;
    const a: string[] = [capture(argEnd)];
    while (isOp(t[i], ",")) { i++; a.push(capture(argEnd)); }
    if (!isOp(t[i], ")")) throw new Error(`${kind} が閉じていない`);
    i++;
    if (a.length === 3) out.push(`(${a[0]} ? ${a[1]} : ${a[2]})`);
    else if (a.length === 2 && kind === "if") out.push(`(${a[0]} ?? ${a[1]})`);
    else throw new Error(`${kind} の引数は ${kind === "if" ? "2つか3つ" : "3つ"}`);
  }

  // Function(x) 式 → x => 式。引数は宣言済みの名前として扱う（r("A") → r["A"]）
  function lambda() {
    i += 2;
    const params: string[] = [], added: string[] = [];
    while (!isOp(t[i], ")")) {
      const p = t[i];
      if (p?.k !== "id") throw new Error("Function の引数が読めない");
      i++;
      let s = p.v;
      if (isId(t[i], "as")) { i++; s = `${typeName(true)} ${p.v}`; }
      params.push(s);
      if (!names.has(p.v.toLowerCase())) { names.set(p.v.toLowerCase(), p.v); added.push(p.v.toLowerCase()); }
      if (isOp(t[i], ",")) i++;
    }
    i++;
    noIndexAt = i;
    const body = capture(argEnd);
    for (const a of added) names.delete(a);
    out.push(`${params.length === 1 && !params[0].includes(" ") ? params[0] : `(${params.join(", ")})`} => ${body}`);
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
    else if (isId(peek(), "with")) {
      i++;
      if (!isOp(peek(), "{")) throw new Error("With の後に { が無い");
      i++;
      const items: string[] = [];
      while (!isOp(peek(), "}")) {
        if (!isOp(peek(), ".") || peek(1)?.k !== "id" || !isOp(peek(2), "=")) throw new Error("With の中は .名前 = 値 で書く");
        const member = peek(1)!.v;
        i += 3;
        items.push(`${member} = ${capture(argEnd)}`);
        if (isOp(peek(), ",")) i++;
      }
      i++;
      out.push(` { ${items.join(", ")} }`);
    }
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
export function vbDefaultToCs(expr: string, type: string, scope: Map<string, string>, opts: ConvertOptions = {}): Converted {
  const s = expr.trim();
  if (s.startsWith("{") && s.endsWith("}") && type.trim().endsWith("[]")) {
    const inner = vbToCs(s.slice(1, -1), scope, opts);
    if ("error" in inner) return inner;
    return { cs: `new ${csType(type)} { ${inner.cs} }` };
  }
  return vbToCs(s, scope, opts);
}

// IR の型名を C# の型名にする（List(Of String) → List<String>、Integer → int）
export function csType(t: string): string {
  return t.trim()
    .replace(/\(Of\s+/g, "<").replace(/\)/g, ">")
    .replace(/\b(Integer|Long|Short|Date|Single|Char)\b/g, (m) => typeAlias[m.toLowerCase()]);
}
