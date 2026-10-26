// Yayın çıktısını (out/) GitHub Pages'teki gibi bir alt dizinde sunar:
//   PAGES_BASE_PATH=/memeyap npm run build && npm run preview
// → http://localhost:4173/memeyap/
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? 4173);
const basePath = process.env.PAGES_BASE_PATH ?? "/memeyap";
const root = "out";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith(basePath)) {
    response.writeHead(302, { Location: `${basePath}/` }).end();
    return;
  }
  let file = join(
    root,
    normalize(decodeURIComponent(url.pathname.slice(basePath.length))),
  );
  if (!file.startsWith(root)) return response.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory())
    file = join(file, "index.html");
  const found = existsSync(file);
  if (!found) file = join(root, "404.html");
  response.writeHead(found ? 200 : 404, {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`http://localhost:${port}${basePath}/`));
