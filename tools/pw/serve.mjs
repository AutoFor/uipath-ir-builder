// 題材のページを http://127.0.0.1:<port>/ で配る（AUT-1219）。ロボットの Chrome の拡張は file:/// に入れないことがあるので http にする。
//   node tools/pw/serve.mjs <フォルダ> [--port 8765]
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const pi = process.argv.indexOf("--port");
const port = pi > 0 ? Number(process.argv[pi + 1]) : 8765;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)));
  if (!path.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    if (!statSync(path).isFile()) throw new Error();
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(readFileSync(path));
  } catch { res.writeHead(404); res.end(); }
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/ → ${root}`));
