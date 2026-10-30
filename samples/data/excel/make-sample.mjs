// samples/data/excel/Sample.xlsx を作る（npm の依存なし。xlsx は XML を zip にしたもの）。
// 中身を変えたら、このスクリプトを直して作り直す: node samples/data/excel/make-sample.mjs
//
// Sheet1:            Sheet2:
//   A      B   C        A
// 1 Name   Age Double   1 シート2
// 2 太郎   30  =B2*2
// 3 花子   25  =B3*2
// 4 次郎   41  =B4*2
// A1 は背景が赤（FF0000）。Get Cell Color の確認用

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sheets = {
  Sheet1: [
    [{ s: "Name", style: 1 }, { s: "Age" }, { s: "Double" }],
    [{ s: "太郎" }, { n: 30 }, { f: "B2*2", n: 60 }],
    [{ s: "花子" }, { n: 25 }, { f: "B3*2", n: 50 }],
    [{ s: "次郎" }, { n: 41 }, { f: "B4*2", n: 82 }],
  ],
  Sheet2: [[{ s: "シート2" }]],
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const strings = [];
const sid = (s) => (strings.includes(s) ? strings.indexOf(s) : strings.push(s) - 1);
const col = (i) => String.fromCharCode(65 + i);

const sheetXml = (rows) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
  rows.map((cells, r) => `<row r="${r + 1}">` + cells.map((c, i) => {
    const ref = `${col(i)}${r + 1}`, st = c.style ? ` s="${c.style}"` : "";
    if (c.f) return `<c r="${ref}"${st}><f>${esc(c.f)}</f><v>${c.n}</v></c>`;
    if (c.s !== undefined) return `<c r="${ref}"${st} t="s"><v>${sid(c.s)}</v></c>`;
    return `<c r="${ref}"${st}><v>${c.n}</v></c>`;
  }).join("") + `</row>`).join("") +
  `</sheetData></worksheet>`;

const names = Object.keys(sheets);
const files = {};
names.forEach((n, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(sheets[n])));
files["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`;
files["_rels/.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
files["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
files["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${names.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
files["xl/styles.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF0000"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
// sharedStrings は sheetXml を作った後（strings が埋まってから）
files["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`;

// ---- zip（無圧縮）----
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const local = [], central = [];
let offset = 0;
for (const [name, text] of Object.entries(files)) {
  const data = Buffer.from(text, "utf8"), fn = Buffer.from(name, "utf8"), crc = crc32(data);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
  h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22);
  h.writeUInt16LE(fn.length, 26); h.writeUInt16LE(0, 28);
  local.push(h, fn, data);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
  c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
  c.writeUInt16LE(fn.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, fn);
  offset += 30 + fn.length + data.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
const out = join(dirname(fileURLToPath(import.meta.url)), "Sample.xlsx");
writeFileSync(out, Buffer.concat([...local, cd, end]));
console.log(`${out}（${offset + cd.length + 22} バイト）`);
