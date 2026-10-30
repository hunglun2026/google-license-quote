// 每 5 分鐘檢查第一銀行美金即期賣出價，進入過低或過高區間就通知（ntfy 推播＋email）。
// 狀態存 KV，只有「進入」警示區才通知一次；連續抓不到 3 次也通知一次（銀行改版會讓警示默默失效）。
import { SOURCE_URL, parseFirstBank } from '../../functions/_lib/parse.js';
import { decide, buildMessage } from './logic.js';

const FAIL_LIMIT = 3;

function b64title(s) {
  // header 只能放 ASCII，中文標題用 RFC 2047 編碼
  return `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(s)))}?=`;
}

async function notify(env, { title, body, tags, priority = 'high' }) {
  if (!env.NTFY_TOPIC) throw new Error('沒有設定 NTFY_TOPIC');
  const headers = { Title: b64title(title), Priority: priority, Tags: tags };
  if (env.ALERT_EMAIL) headers.Email = env.ALERT_EMAIL; // ntfy 會同時轉寄 email
  const res = await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, { method: 'POST', headers, body });
  if (!res.ok) throw new Error('ntfy 回應 HTTP ' + res.status);
}

export async function check(env) {
  const low = Number(env.LOW), high = Number(env.HIGH);
  const st = JSON.parse((await env.STATE.get('state')) || '{}');
  let d;
  try {
    const res = await fetch(SOURCE_URL, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('第一銀行回應 HTTP ' + res.status);
    d = parseFirstBank(await res.text());
  } catch (e) {
    st.fails = (st.fails || 0) + 1;
    if (st.fails === FAIL_LIMIT) {
      await notify(env, {
        title: '匯率警示抓不到第一銀行牌價',
        tags: 'warning',
        body: `連續 ${FAIL_LIMIT} 次抓不到牌價，警示暫時失效，請檢查。原因：${e.message}`,
      });
    }
    await env.STATE.put('state', JSON.stringify(st));
    return { ok: false, error: e.message };
  }
  const r = decide(d.spotSell, low, high, st.zone);
  if (r.notify) await notify(env, buildMessage(r.zone, d, low, high));
  // 通知成功才更新狀態；通知失敗會丟例外，下一輪會再試
  await env.STATE.put('state', JSON.stringify({ zone: r.zone, fails: 0, sell: d.spotSell, bankTime: d.bankTime }));
  return { ok: true, zone: r.zone, notified: r.notify, sell: d.spotSell };
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(check(env));
  },
};
