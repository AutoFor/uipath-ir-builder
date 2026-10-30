// samples/data/excel/Macro.xlsm を作る（npm の依存なし）。作り直し: node samples/data/excel/make-macro.mjs
// VBA のバイナリ（vbaProject.bin）はスクリプトで作りにくいので、マクロは Excel 4.0 のマクロシート（XML）で書く。
// 実行するのは次の2つだけで、ブックの外には何もしない:
//   Hello         … 1 を返す
//   AddNumbers(a, b) … a + b を返す

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const P = "http://schemas.openxmlformats.org/package/2006/relationships";
const files = {
  "[Content_Types].xml": `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/macrosheets/sheet1.xml" ContentType="application/vnd.ms-excel.macrosheet+xml"/></Types>`,
  "_rels/.rels": `${X}<Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `${X}<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/><sheet name="Macro1" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="AddNumbers" function="1" xlm="1" functionGroupId="14">Macro1!$A$1</definedName><definedName name="Hello" function="1" xlm="1" functionGroupId="14">Macro1!$B$1</definedName></definedNames></workbook>`,
  "xl/_rels/workbook.xml.rels": `${X}<Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2006/relationships/xlMacrosheet" Target="macrosheets/sheet1.xml"/></Relationships>`,
  "xl/worksheets/sheet1.xml": `${X}<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>`,
  "xl/macrosheets/sheet1.xml": `${X}<xm:macrosheet xmlns="${NS}" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><sheetData><row r="1"><c r="A1"><f>ARGUMENT("a")</f></c><c r="B1"><f>RETURN(1)</f></c></row><row r="2"><c r="A2"><f>ARGUMENT("b")</f></c></row><row r="3"><c r="A3"><f>RETURN(a+b)</f></c></row></sheetData></xm:macrosheet>`,
};

// ---- zip（無圧縮）----
const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const local = [], central = [];
let offset = 0;
for (const [name, text] of Object.entries(files)) {
  const data = Buffer.from(text, "utf8"), fn = Buffer.from(name, "utf8"), crc = crc32(data);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0x21, 12);
  h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(fn.length, 26);
  local.push(h, fn, data);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0x21, 14);
  c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(fn.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, fn);
  offset += 30 + fn.length + data.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
const out = join(dirname(fileURLToPath(import.meta.url)), "Macro.xlsm");
writeFileSync(out, Buffer.concat([...local, cd, end]));
console.log(out);
