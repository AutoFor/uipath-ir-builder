// Coded のオブジェクトリポジトリ（Descriptors）：Studio が作る <P>/.local/.codedworkflows/ObjectRepository.cs を読み、
// 「Reference（<ライブラリ Id>/<Id>）→ C# で書く名前（Descriptors.<アプリ>.<画面>.<要素>）」の表を作る。
//
// 名前は ObjectRepository.cs から読む（Studio の名前の付け方（記号を _ にする、先頭に _ を足す など）を真似しない）。
// ObjectRepository.cs は Studio のビルド（uip rpa build / run / validate）で .objects から作り直される。
// .objects を変えたら、先にビルドしてから gen-coded.ts で生成する（古い ObjectRepository.cs だと名前が無い）。
//
// ObjectRepository.cs の形（moneyforward_cs、Studio 26.10 で確かめた）:
//   namespace <ns>.ObjectRepository {
//     public static class Descriptors {
//       public static class <アプリ> { static string _reference = "..."; public static _Implementation.<..>.<画面の型> <画面> { get; private set; } = new ...; }
//   namespace _<アプリ> { public class <画面の型> : IScreenDescriptor { ... Reference = "..."; ... public _Implementation.<..>.<要素の型> <要素> { get; private set; } } }
//   namespace _<アプリ>._<画面> { public class <要素の型> : IElementDescriptor { ... Reference = "..."; ... } }
//   要素の下の要素（子）は、要素の型のプロパティになる

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DescriptorEntry = { path: string; kind: "app" | "screen" | "element"; namespace: string };
export type DescriptorMap = Map<string, DescriptorEntry>; // Reference → 名前

const ID = String.raw`[^\s{}();,=<>]+`;

export function parseDescriptors(src: string): DescriptorMap {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const rootNs = src.match(/namespace\s+(\S+)\.ObjectRepository\b/)?.[1] ?? "";
  // _Implementation の型（相対名 "_Implementation.<ns>.<型>"）→ Reference とプロパティ
  type Cls = { kind: "screen" | "element"; reference?: string; props: [string, string][] };
  const classes = new Map<string, Cls>();
  let ns = "";
  let cur: Cls | undefined;
  const propRe = new RegExp(String.raw`^\s*public (?:static )?(_Implementation\.${ID}) (${ID}) \{ get; private set; \}`);
  for (const l of lines) {
    const n = l.match(new RegExp(String.raw`^\s*namespace (${ID})\s*$`));
    if (n) { ns = n[1]; cur = undefined; continue; }
    const c = l.match(new RegExp(String.raw`^\s*public class (${ID}) : I(Element|Screen)Descriptor\b`));
    if (c) {
      cur = { kind: c[2] === "Screen" ? "screen" : "element", props: [] };
      classes.set(`_Implementation.${ns}.${c[1]}`, cur);
      continue;
    }
    if (!cur) continue;
    const r = l.match(/^\s*Reference = "([^"]+)"/);
    if (r) cur.reference = r[1];
    const p = l.match(propRe);
    if (p) cur.props.push([p[2], p[1]]);
  }
  const out: DescriptorMap = new Map();
  const start = lines.findIndex((l) => /public static class Descriptors\b/.test(l));
  if (start < 0) return out;
  let app: string | undefined;
  for (const l of lines.slice(start + 1)) {
    const a = l.match(new RegExp(String.raw`^\s*public static class (${ID})\s*$`));
    if (a) { app = a[1]; continue; }
    if (!app) continue;
    const ar = l.match(/^\s*static string _reference = "([^"]+)"/);
    if (ar) out.set(ar[1], { path: `Descriptors.${app}`, kind: "app", namespace: rootNs });
    const s = l.match(new RegExp(String.raw`^\s*public static (_Implementation\.${ID}) (${ID}) \{ get; private set; \}`));
    if (s) {
      const walk = (type: string, path: string, seen: Set<string>) => {
        const k = classes.get(type);
        if (!k || seen.has(type)) return;
        seen.add(type);
        if (k.reference && !out.has(k.reference)) out.set(k.reference, { path, kind: k.kind, namespace: rootNs });
        for (const [prop, t] of k.props) walk(t, `${path}.${prop}`, seen);
      };
      walk(s[1], `Descriptors.${app}.${s[2]}`, new Set());
    }
    if (/^\s{4}\}\s*$/.test(l)) break; // Descriptors の終わり
  }
  return out;
}

export function descriptorsFile(project: string): string {
  return join(project, ".local", ".codedworkflows", "ObjectRepository.cs");
}

export function readDescriptors(project: string): DescriptorMap | undefined {
  const f = descriptorsFile(project);
  return existsSync(f) ? parseDescriptors(readFileSync(f, "utf8")) : undefined;
}
