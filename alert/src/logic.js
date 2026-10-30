// 匯率警示的判斷邏輯（純函式，不碰網路與儲存，方便測試）
// zone：'low'＝賣出價 <= LOW（台幣升值，買美金便宜）、'high'＝賣出價 >= HIGH（台幣貶值，成本變高）、'ok'
export const HYST = 0.05; // 離開警示區要多走這麼遠才算回到正常，避免在門檻附近來回跳就一直通知

export function nextZone(sell, low, high, prev) {
  if (sell <= low) return 'low';
  if (sell >= high) return 'high';
  // 還在警示區邊緣（沒超過緩衝）就維持原狀態
  if (prev === 'low' && sell <= low + HYST) return 'low';
  if (prev === 'high' && sell >= high - HYST) return 'high';
  return 'ok';
}

// 回傳新狀態與要不要通知；只有「進入」警示區才通知
export function decide(sell, low, high, prev) {
  const zone = nextZone(sell, low, high, prev || 'ok');
  return { zone, notify: zone !== 'ok' && zone !== (prev || 'ok') };
}

export function buildMessage(zone, d, low, high) {
  const rate = d.spotSell.toFixed(3);
  if (zone === 'low') {
    return {
      title: `美金匯率偏低 ${rate}`,
      tags: 'chart_with_downwards_trend',
      body: `第一銀行美金即期賣出 ${rate}，已低於 ${low}。台幣偏強，買美金成本較低，可考慮分批買匯。\n買入 ${d.spotBuy.toFixed(3)}｜銀行公告時間 ${d.bankTime}`,
    };
  }
  return {
    title: `美金匯率偏高 ${rate}`,
    tags: 'chart_with_upwards_trend',
    body: `第一銀行美金即期賣出 ${rate}，已高於 ${high}。台幣偏弱，向 Google 付款的台幣成本變高，報價請留意匯損。\n買入 ${d.spotBuy.toFixed(3)}｜銀行公告時間 ${d.bankTime}`,
  };
}
