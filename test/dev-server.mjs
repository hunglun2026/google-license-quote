// 本機驗證用：同時提供 index.html 與 /api/rate（直接呼叫 Pages 函式）
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { onRequestGet } from '../functions/api/rate.js';

const port = Number(process.env.PORT || 8788);
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/rate')) {
    const r = await onRequestGet();
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(await readFile(new URL('../index.html', import.meta.url)));
}).listen(port, () => console.log('listening ' + port));
