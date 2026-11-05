import { SOURCE_URL, parseFirstBank } from '../_lib/parse.js';

// GET /api/rate：向第一銀行取美金牌告，邊緣快取 10 秒（銀行本身約每分鐘更新一次，快取太久會讓畫面多落後）
export async function onRequestGet() {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=10',
  };
  try {
    const res = await fetch(SOURCE_URL, {
      headers: { 'user-agent': 'Mozilla/5.0' },
      cf: { cacheTtl: 10, cacheEverything: true },
    });
    if (!res.ok) throw new Error('第一銀行回應 HTTP ' + res.status);
    const data = parseFirstBank(await res.text());
    return new Response(JSON.stringify({ ok: true, fetchedAt: new Date().toISOString(), ...data }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), {
      status: 502,
      headers: { ...headers, 'cache-control': 'no-store' },
    });
  }
}
