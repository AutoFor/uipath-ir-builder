// IR の式（VB の式・{ lit }・{ cs }）を TypeScript の式にする（AUT-1219。ir-to-pw.ts から使う）。
// 画面操作のワークフローで使う範囲だけを直す。直せないものは理由を返す（黙って別の意味にしない）。
//
// 直せるもの：
//   文字列・数値・真偽値・Nothing / null、変数と引数の名前（VB は大文字小文字を区別しないので、宣言の名前にそろえる）
//   演算子：VB の & + - * / Mod = <> < > <= >= Not And AndAlso Or OrElse Is IsNot、C# の == != ! && || など
//   メソッド：Trim・ToUpper・ToLower・ToString・Contains・StartsWith・EndsWith・Replace・Length
//   New Exception(...) / new Exception(...) → new Error(...)
// 直せないもの：それ以外のメソッド・型の名前（String.Format、DateTime.Now など）、ラムダ、If(...)、C# の $"..." など
import type { Value } from "../ir/types.ts";

export type ExprResult = { ts: string } | { why: string };

type Tok = { k: "str" | "num" | "id" | "op"; v: string };

const METHODS: Record<string, { ts: string; call: boolean }> = {
  trim: { ts: "trim", call: true },
  toupper: { ts: "toUpperCase", call: true },
  tolower: { ts: "toLowerCase", call: true },
  tostring: { ts: "toString", call: true },
  contains: { ts: "includes", call: true },
  startswith: { ts: "startsWith", call: true },
  endswith: { ts: "endsWith", call: true },
  replace: { ts: "replaceAll", call: true },
  length: { ts: "length", call: false },
};
const EXCEPTIONS = new Set(["exception", "system.exception", "businessruleexception", "uipath.core.businessruleexception"]);

function tokenize(src: string, lang: "vb" | "cs"): Tok[] | string {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let s = "";
      i++;
      for (;;) {
        if (i >= src.length) return "文字列が閉じていない";
        if (lang === "vb" && src[i] === '"' && src[i + 1] === '"') { s += '"'; i += 2; continue; }
        if (lang === "cs" && src[i] === "\\") {
          const n = src[i + 1];
          const esc: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'", "0": "\0" };
          if (!(n in esc)) return `C# のエスケープ \\${n} は直せない`;
          s += esc[n]; i += 2; continue;
        }
        if (src[i] === '"') { i++; break; }
        s += src[i++];
      }
      if (lang === "vb" && /^[cC]\b/.test(src.slice(i))) i++; // "x"c（文字）
      out.push({ k: "str", v: s });
      continue;
    }
    if (lang === "cs" && (c === "$" || c === "@") && src[i + 1] === '"') return `C# の ${c}"..." は直せない`;
    const num = src.slice(i).match(/^\d+(\.\d+)?/);
    if (num) { out.push({ k: "num", v: num[0] }); i += num[0].length; continue; }
    const id = src.slice(i).match(/^[\p{L}_][\p{L}\p{N}_]*/u);
    if (id) { out.push({ k: "id", v: id[0] }); i += id[0].length; continue; }
    const op = src.slice(i).match(lang === "vb" ? /^(<>|<=|>=|[=<>&+\-*/(),.])/ : /^(==|!=|<=|>=|&&|\|\||[<>+\-*/%!(),.])/);
    if (op) { out.push({ k: "op", v: op[0] }); i += op[0].length; continue; }
    return `「${c}」は直せない`;
  }
  return out;
}

// names：使える名前（変数・引数）。キーは小文字、値は宣言の名前
export function exprToTs(v: Value, names: Map<string, string>): ExprResult {
  if (typeof v === "number" || typeof v === "boolean") return { ts: String(v) };
  if (typeof v === "object" && "lit" in v) return { ts: JSON.stringify(v.lit) };
  if (typeof v === "object") return codeToTs(v.cs, "cs", names);
  return codeToTs(v, "vb", names);
}

export function codeToTs(src: string, lang: "vb" | "cs", names: Map<string, string>): ExprResult {
  const toks = tokenize(src, lang);
  if (typeof toks === "string") return { why: `${toks}（${src}）` };
  const out: string[] = [];
  // VB の Not は比較より弱い（Not a = b は Not (a = b)）。閉じるところまで括弧で包む
  const nots: number[] = []; // Not を開いたときの括弧の深さ
  let depth = 0;
  const closeNots = (d: number) => { while (nots.length && nots[nots.length - 1] >= d) { nots.pop(); out.push(")"); } };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const low = t.v.toLowerCase();
    const prev = toks[i - 1];
    const afterDot = prev?.k === "op" && prev.v === ".";
    if (t.k === "str") { out.push(JSON.stringify(t.v)); continue; }
    if (t.k === "num") { out.push(t.v); continue; }
    if (t.k === "op") {
      if (t.v === "(") { depth++; out.push("("); continue; }
      if (t.v === ")") { closeNots(depth); depth--; out.push(")"); continue; }
      if (t.v === ",") { closeNots(depth); out.push(", "); continue; }
      if (t.v === ".") { out.push("."); continue; }
      const map: Record<string, string> = lang === "vb"
        ? { "&": " + ", "=": " === ", "<>": " !== ", "+": " + ", "-": " - ", "*": " * ", "/": " / ", "<": " < ", ">": " > ", "<=": " <= ", ">=": " >= " }
        : { "==": " === ", "!=": " !== ", "&&": " && ", "||": " || ", "!": "!", "+": " + ", "-": " - ", "*": " * ", "/": " / ", "%": " % ", "<": " < ", ">": " > ", "<=": " <= ", ">=": " >= " };
      if (!(t.v in map)) return { why: `演算子 ${t.v} は直せない（${src}）` };
      out.push(map[t.v]);
      continue;
    }
    // 名前
    if (afterDot) {
      const m = METHODS[low];
      if (!m) return { why: `メソッド・プロパティ ${t.v} は直せない（${src}）` };
      out.push(m.ts);
      if (m.call && !(toks[i + 1]?.k === "op" && toks[i + 1].v === "(")) out.push("()");
      continue;
    }
    if (lang === "vb") {
      const kw: Record<string, string> = { and: " && ", andalso: " && ", or: " || ", orelse: " || ", true: "true", false: "false", nothing: "null", is: " === ", isnot: " !== ", mod: " % " };
      if (low === "not") { out.push("!("); nots.push(depth); continue; }
      if (low === "and" || low === "andalso" || low === "or" || low === "orelse") closeNots(depth);
      if (low in kw) { out.push(kw[low]); continue; }
    } else {
      const kw: Record<string, string> = { true: "true", false: "false", null: "null" };
      if (t.v in kw) { out.push(kw[t.v]); continue; }
    }
    if (low === "new") {
      const n: string[] = [];
      let j = i + 1;
      while (toks[j]?.k === "id" || (toks[j]?.k === "op" && toks[j].v === ".")) n.push(toks[j++].v);
      if (!EXCEPTIONS.has(n.join("").toLowerCase())) return { why: `New ${n.join("")} は直せない（${src}）` };
      out.push("new Error");
      i = j - 1;
      continue;
    }
    const decl = lang === "vb" ? names.get(low) : [...names.values()].find((x) => x === t.v);
    if (!decl) return { why: `名前 ${t.v} は、ワークフローの変数・引数ではないので直せない（${src}）` };
    out.push(decl);
  }
  closeNots(0);
  // !(x) は !x にする（名前 1 つだけのとき。VB の Not x と C# の !x から同じ式になるように）
  return { ts: out.join("").replace(/\s+/g, " ").trim().replace(/!\(([\p{L}_][\p{L}\p{N}_]*)\)/gu, "!$1") };
}
