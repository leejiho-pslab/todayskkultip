// 로컬 미리보기 서버: node automation/serve.mjs  ->  http://localhost:8080
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC_DIR } from "./lib.mjs";

const PORT = Number(process.env.PORT || 8080);
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    // basePath(/site) 로 시작하면 제거 (로컬에서 루트로 서빙)
    p = p.replace(/^\/site/, "");
    let file = path.join(PUBLIC_DIR, p);
    if (p.endsWith("/") || !path.extname(file)) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>404</h1>");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`[serve] http://localhost:${PORT}  (Ctrl+C 종료)`));
