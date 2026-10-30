// 警示邏輯測試：假 KV＋攔截 fetch，不碰真實網路與真實通知
import assert from 'node:assert/strict';
import { check } from '../alert/src/index.js';

const kv = () => { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v), m }; };
const page = (sell, buy = sell - 0.1) =>
  `<html>Effective Date of Data ： 2026/10/30 10:00:00 &nbsp;USD Spot ${buy.toFixed(5)} ${sell.toFixed(5)} --> &nbsp;USD Cash 32.1 33.1</html>`;

let sent, bankSell, bankFail, ntfyFail;
globalThis.fetch = async (url, opt = {}) => {
  if (String(url).includes('firstbank')) {
    if (bankFail) return new Response('x', { status: 500 });
    return new Response(page(bankSell), { status: 200 });
  }
  if (String(url).startsWith('https://ntfy.sh/')) {
    if (ntfyFail) return new Response('no', { status: 500 });
    sent.push({ url, headers: opt.headers, body: opt.body });
    return new Response('ok');
  }
  throw new Error('未預期的網址 ' + url);
};

const env = () => ({ LOW: '31', HIGH: '33', ALERT_EMAIL: 'slash@hunglun.com', NTFY_TOPIC: 'test-topic', STATE: kv() });
const run = async (e, sell) => { bankSell = sell; bankFail = false; return check(e); };
const t = (name, fn) => fn().then(() => console.log('OK  ', name)).catch((e) => { console.log('FAIL', name, e.message); process.exitCode = 1; });

await t('正常區間不通知', async () => {
  sent = []; const e = env();
  const r = await run(e, 32.7);
  assert.equal(r.zone, 'ok'); assert.equal(sent.length, 0);
});

await t('跌到 31 以下通知一次，內容與 email 標頭正確', async () => {
  sent = []; const e = env();
  await run(e, 32.7);
  const r = await run(e, 30.98);
  assert.equal(r.zone, 'low'); assert.equal(sent.length, 1);
  assert.equal(sent[0].url, 'https://ntfy.sh/test-topic');
  assert.equal(sent[0].headers.Email, undefined); // ntfy 匿名不能寄信，不能帶 Email 標頭
  assert.match(sent[0].body, /30\.980/); assert.match(sent[0].body, /低於 31/);
  assert.ok(/^=\?UTF-8\?B\?/.test(sent[0].headers.Title));
});

await t('停留在過低區不重複通知', async () => {
  sent = []; const e = env();
  await run(e, 30.9); await run(e, 30.8); await run(e, 30.95);
  assert.equal(sent.length, 1);
});

await t('門檻附近來回跳不洗版（緩衝 0.05）', async () => {
  sent = []; const e = env();
  await run(e, 30.9);          // 進入 low，通知
  await run(e, 31.03);         // 在緩衝內，仍視為 low
  await run(e, 30.99);         // 還是 low，不再通知
  assert.equal(sent.length, 1);
  assert.equal((await run(e, 31.2)).zone, 'ok'); // 超過緩衝才算回到正常
  await run(e, 30.9);          // 再次進入，才會再通知
  assert.equal(sent.length, 2);
});

await t('漲到 33 以上通知（偏高）', async () => {
  sent = []; const e = env();
  const r = await run(e, 33.2);
  assert.equal(r.zone, 'high'); assert.equal(sent.length, 1);
  assert.match(sent[0].body, /高於 33/);
});

await t('剛好等於門檻就算', async () => {
  sent = []; const e = env();
  await run(e, 31.0); assert.equal(sent.length, 1);
  sent = []; const e2 = env();
  await run(e2, 33.0); assert.equal(sent.length, 1);
});

await t('連續抓不到第 3 次才通知一次，成功後歸零', async () => {
  sent = []; const e = env(); bankFail = true;
  await check(e); await check(e); assert.equal(sent.length, 0);
  await check(e); assert.equal(sent.length, 1);
  await check(e); assert.equal(sent.length, 1); // 第 4 次不重複
  bankFail = false; bankSell = 32.7; await check(e);
  assert.equal(JSON.parse(e.STATE.m.get('state')).fails, 0);
});

await t('ntfy 失敗時不更新狀態，下一輪會重試', async () => {
  sent = []; const e = env(); ntfyFail = true;
  await assert.rejects(() => run(e, 30.5));
  assert.equal(e.STATE.m.get('state') ?? null, null);
  ntfyFail = false;
  await run(e, 30.5); assert.equal(sent.length, 1);
});

await t('沒設 NTFY_TOPIC 會明確報錯，不默默吞掉', async () => {
  const e = env(); delete e.NTFY_TOPIC;
  await assert.rejects(() => run(e, 30.5), /NTFY_TOPIC/);
});

await t('有 EMAIL 綁定時另外寄信，內容與收件人正確', async () => {
  sent = []; const e = env(); const mails = [];
  e.EMAIL = { send: async (m) => void mails.push(m) }; e.MAIL_FROM = 'alert@hunglun.com';
  await run(e, 30.5);
  assert.equal(sent.length, 1); assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'slash@hunglun.com'); assert.equal(mails[0].from, 'alert@hunglun.com');
  assert.match(mails[0].subject, /偏低/); assert.match(mails[0].text, /30\.500/);
});

await t('email 寄失敗不影響推播與狀態，也不會重複推播', async () => {
  sent = []; const e = env();
  e.EMAIL = { send: async () => { throw new Error('boom'); } }; e.MAIL_FROM = 'alert@hunglun.com';
  const r = await run(e, 30.5);
  assert.equal(r.notified, true); assert.equal(sent.length, 1);
  await run(e, 30.4); assert.equal(sent.length, 1);
});

await t('沒有 EMAIL 綁定時只推播不報錯', async () => {
  sent = []; const e = env(); // 沒有 EMAIL
  const r = await run(e, 33.5);
  assert.equal(r.notified, true); assert.equal(sent.length, 1);
});
