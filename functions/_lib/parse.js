// 解析第一銀行外匯牌告頁（ibank.firstbank.com.tw/NetBank/7/0201.html）
export const SOURCE_URL = 'https://ibank.firstbank.com.tw/NetBank/7/0201.html';

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

export function parseFirstBank(html) {
  const t = toText(html);
  const when = t.match(/Effective Date of Data\s*[：:]\s*(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
  const spot = t.match(/USD Spot ([\d.]+) ([\d.]+)/);
  const cash = t.match(/USD Cash ([\d.]+) ([\d.]+)/);
  if (!when || !spot) throw new Error('找不到美金即期牌告，銀行頁面格式可能改了');
  const out = {
    bank: '第一銀行',
    bankTime: when[1], // 銀行公告時間，台灣時間
    spotBuy: Number(spot[1]),
    spotSell: Number(spot[2]),
    cashBuy: cash ? Number(cash[1]) : null,
    cashSell: cash ? Number(cash[2]) : null,
  };
  // 合理性檢查：數字離譜就寧可報錯，不要拿去報價
  const ok = (n) => Number.isFinite(n) && n > 20 && n < 50;
  if (!ok(out.spotBuy) || !ok(out.spotSell) || out.spotSell <= out.spotBuy) {
    throw new Error('解析出的匯率不合理：' + JSON.stringify(out));
  }
  return out;
}
