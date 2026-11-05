// 每日牌價紀錄（純函式）。第一銀行沒有歷史資料可抓，所以由 Worker 每次讀到牌價就累積「開高低收」。
// 以銀行公告日期分日（不用 Worker 的時鐘，避免時區差一天）。結構：{ cfg:{low,high}, days:{ 'YYYY-MM-DD': {o,h,l,c,t} } }
export const KEEP_DAYS = 400;

export const dayOf = (bankTime) => bankTime.slice(0, 10).replace(/\//g, '-');

export function updateHistory(prev, d, low, high) {
  const hist = prev && prev.days ? prev : { days: {} };
  let changed = !prev || !prev.cfg || prev.cfg.low !== low || prev.cfg.high !== high;
  hist.cfg = { low, high };
  const day = dayOf(d.bankTime), cur = hist.days[day], sell = d.spotSell;
  if (!cur) {
    hist.days[day] = { o: sell, h: sell, l: sell, c: sell, t: d.bankTime };
    changed = true;
  } else if (d.bankTime > cur.t) { // 銀行公告時間沒變就不重複寫，省 KV 寫入
    cur.h = Math.max(cur.h, sell); cur.l = Math.min(cur.l, sell); cur.c = sell; cur.t = d.bankTime;
    changed = true;
  }
  const keys = Object.keys(hist.days).sort();
  keys.slice(0, Math.max(0, keys.length - KEEP_DAYS)).forEach((k) => { delete hist.days[k]; changed = true; });
  return { hist, changed };
}
