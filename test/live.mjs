// 用第一銀行真實頁面驗證解析（不是假資料）
import { SOURCE_URL, parseFirstBank } from '../functions/_lib/parse.js';

const res = await fetch(SOURCE_URL, { headers: { 'user-agent': 'Mozilla/5.0' } });
const html = await res.text();
const r = parseFirstBank(html);
console.log(r);

// 壞資料必須報錯，不能默默算出數字
for (const bad of ['<html>nothing</html>', 'Effective Date of Data ： 2026/10/30 09:00:00 USD Spot 5.0 4.0']) {
  try { parseFirstBank(bad); console.log('FAIL 該報錯卻沒報錯'); process.exitCode = 1; }
  catch (e) { console.log('OK 壞資料被擋：', e.message.slice(0, 30)); }
}
