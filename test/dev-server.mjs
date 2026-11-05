// 本機驗證用：同時提供 index.html 與 /api/rate（直接呼叫 Pages 函式）
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { onRequestGet } from '../functions/api/rate.js';
import { onRequestGet as historyGet } from '../functions/api/history.js';

// 假的走勢資料（只給本機畫面測試用，30 天）
const days = {};
for (let i = 0; i < 30; i++) {
  const d = new Date(Date.UTC(2026, 9, 6 + i)).toISOString().slice(0, 10);
  const c = 32.2 + Math.sin(i / 4) * 0.5 + i * 0.01;
  days[d] = { o: c - 0.05, h: c + 0.12, l: c - 0.14, c, t: d.replace(/-/g, '/') + ' 16:00:00' };
}
const fakeKv = { get: async () => JSON.stringify({ cfg: { low: 31, high: 32.5 }, days }) };

const port = Number(process.env.PORT || 8788);
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/rate')) {
    const r = await onRequestGet();
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
    return;
  }
  if (req.url.startsWith('/api/history')) {
    const r = await historyGet({ env: { HISTORY: fakeKv }, request: new Request('http://x' + req.url) });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(await readFile(new URL('../public/index.html', import.meta.url)));
}).listen(port, () => console.log('listening ' + port));
