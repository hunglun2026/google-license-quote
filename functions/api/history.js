// GET /api/history?days=90：回傳每日牌價（開高低收）與警示門檻。
// 資料由警示 Worker 每次讀到第一銀行牌價時累積在 KV（同一個 KV，綁定名稱 HISTORY，設定在專案根目錄 wrangler.toml）。
export async function onRequestGet({ env, request }) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' };
  const fail = (error) => new Response(JSON.stringify({ ok: false, error }), { status: 503, headers: { ...headers, 'cache-control': 'no-store' } });
  if (!env.HISTORY) return fail('尚未綁定走勢資料庫');
  const hist = JSON.parse((await env.HISTORY.get('hist')) || 'null');
  if (!hist || !hist.days) return fail('還沒有走勢資料');
  const want = Number(new URL(request.url).searchParams.get('days')) || 90;
  const days = Object.keys(hist.days).sort().slice(-Math.min(Math.max(want, 1), 400))
    .map((date) => ({ date, ...hist.days[date] }));
  return new Response(JSON.stringify({ ok: true, cfg: hist.cfg || null, days }), { headers });
}
