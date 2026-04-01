const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;
const EASYECOM_JWT = process.env.EASYECOM_JWT;
const EASYECOM_API_KEY = process.env.EASYECOM_API_KEY;
const GUPSHUP_USERID = process.env.GUPSHUP_USERID;
const GUPSHUP_PASSWORD = process.env.GUPSHUP_PASSWORD;
const APPROVAL_PHONE = process.env.APPROVAL_PHONE;

const EASYECOM_WEBHOOK = 'https://api.easyecom.io/webhook/v2';
const EASYECOM_ORDERS = 'https://api.easyecom.io/orders/V2';
const RENDER_BASE_URL = 'https://tsc-easyecom-render-1.onrender.com';

// In-memory pending orders store { orderNumber -> { payload, expiresAt } }
const pendingOrders = new Map();

function easyecomHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + EASYECOM_JWT,
    'x-api-key': EASYECOM_API_KEY,
  };
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── APPROVAL LANDING PAGE ─────────────────────────────────────────────────────
app.get('/', async (req, res) => {
  const orderid = req.query.orderid;

  // No orderid param — serve the normal app
  if (!orderid) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  const pending = pendingOrders.get(orderid);

  // Expired or not found
  if (!pending) {
    return res.send(approvalPage('expired', orderid, null));
  }

  if (Date.now() > pending.expiresAt) {
    pendingOrders.delete(orderid);
    return res.send(approvalPage('expired', orderid, null));
  }

  // Valid — call EasyEcom
  try {
    const url = EASYECOM_WEBHOOK + '/createOrder';
    const response = await fetch(url, {
      method: 'POST',
      headers: easyecomHeaders(),
      body: JSON.stringify(pending.payload),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { message: text }; }

    pendingOrders.delete(orderid);

    if (!response.ok || (data.code && data.code !== 200)) {
      return res.send(approvalPage('error', orderid, data.message || 'EasyEcom error'));
    }

    const queueId = (data.data && data.data.queueId) ? data.data.queueId : '';
    return res.send(approvalPage('success', orderid, queueId));

  } catch (err) {
    return res.send(approvalPage('error', orderid, err.message));
  }
});

// ── APPROVAL PAGE HTML ────────────────────────────────────────────────────────
function approvalPage(status, orderid, extra) {
  const states = {
    success: {
      icon: '✓',
      iconColor: '#16a34a',
      iconBg: '#dcfce7',
      title: 'Order Approved!',
      message: 'Order <strong>#' + orderid + '</strong> has been successfully pushed to EasyEcom.' + (extra ? '<br><span style="font-size:13px;color:#6b7280;">Queue ID: ' + extra + '</span>' : ''),
    },
    expired: {
      icon: '⏱',
      iconColor: '#d97706',
      iconBg: '#fef3c7',
      title: 'Link Expired',
      message: 'The approval link for order <strong>#' + orderid + '</strong> has expired (5 min limit). Please create the order again.',
    },
    error: {
      icon: '✕',
      iconColor: '#dc2626',
      iconBg: '#fee2e2',
      title: 'Something went wrong',
      message: 'Could not push order <strong>#' + orderid + '</strong> to EasyEcom.<br><span style="font-size:13px;color:#6b7280;">' + (extra || 'Unknown error') + '</span>',
    },
  };

  const s = states[status];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TSC EasyEcom — Order Approval</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Outfit', sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 48px 40px; max-width: 440px; width: 100%; text-align: center; }
  .icon-wrap { width: 72px; height: 72px; border-radius: 50%; background: ${s.iconBg}; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 28px; color: ${s.iconColor}; font-weight: 700; }
  .title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 12px; }
  .message { font-size: 15px; color: #4b5563; line-height: 1.6; }
  .brand { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; }
  .brand strong { color: #6b7280; }
</style>
</head>
<body>
<div class="card">
  <div class="icon-wrap">${s.icon}</div>
  <h1 class="title">${s.title}</h1>
  <p class="message">${s.message}</p>
  <div class="brand">Product by <strong>Abhishek Tiwari</strong> · D2C · TSC EasyEcom</div>
</div>
</body>
</html>`;
}

// ── CREATE ORDER (stores pending + fires WhatsApp) ────────────────────────────
app.post('/api/createOrder', async (req, res) => {
  const payload = req.body;
  console.log('[' + new Date().toISOString() + '] CREATE ORDER REQUEST -> ' + payload.orderNumber);

  if (!payload.orderNumber) {
    return res.status(400).json({ success: false, message: 'orderNumber is required' });
  }

  // Build approval URL
  const approvalUrl = RENDER_BASE_URL + '?orderid=' + encodeURIComponent(payload.orderNumber);

  // Store in pending map with 5 min expiry
  pendingOrders.set(payload.orderNumber, {
    payload,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  console.log('[' + new Date().toISOString() + '] Stored pending order: ' + payload.orderNumber + ' (expires in 5 min)');

  // Build WhatsApp message
  const itemsSummary = (payload.items || []).map(i => i.productName).join(', ');
  const invoiceAmount = payload.invoiceAmount || (payload.items || []).reduce((sum, i) => sum + (i.Price * i.Quantity), 0).toLocaleString('en-IN');

  const msg =
    'Hi Abhishek,\n\n' +
    'Here are the order details:\n\n' +
    '*Order ID:* ' + payload.orderNumber + '\n\n' +
    '*Item:* ' + itemsSummary + '\n\n' +
    '*Amount:* ' + invoiceAmount + '/-\n\n' +
    'Please review the order details and click on the button below to approve';

  const waUrl = 'https://mediaapi.smsgupshup.com/GatewayAPI/rest' +
    '?userid=' + encodeURIComponent(GUPSHUP_USERID) +
    '&password=' + encodeURIComponent(GUPSHUP_PASSWORD) +
    '&send_to=' + encodeURIComponent(APPROVAL_PHONE) +
    '&v=1.1&format=json&msg_type=TEXT&method=SENDMESSAGE' +
    '&msg=' + encodeURIComponent(msg) +
    '&isTemplate=true' +
    '&buttonUrlParam=' + encodeURIComponent(approvalUrl);

  try {
    const waRes = await fetch(waUrl);
    const waText = await waRes.text();
    console.log('[' + new Date().toISOString() + '] Gupshup response:', waText.slice(0, 200));
  } catch (waErr) {
    console.error('[' + new Date().toISOString() + '] Gupshup error:', waErr.message);
    // Don't fail the whole request if WA fails
  }

  res.json({
    success: true,
    code: 200,
    message: 'Approval request sent on WhatsApp. Order will be created once approved.',
    data: { orderNumber: payload.orderNumber, approvalUrl },
  });
});

// ── GET ALL ORDERS ────────────────────────────────────────────────────────────
app.get('/api/getAllOrders', async (req, res) => {
  console.log('[' + new Date().toISOString() + '] GET ALL ORDERS - all pages');
  try {
    let allOrders = [];
    let page = 1;
    const perPage = 50;

    while (true) {
      const url = EASYECOM_ORDERS + '/getAllOrders?page=' + page + '&per_page=' + perPage;
      const response = await fetch(url, { method: 'GET', headers: easyecomHeaders() });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch (_) {
        console.error('[' + new Date().toISOString() + '] NON-JSON page ' + page + ':', text.slice(0, 200));
        break;
      }

      if (!response.ok) return res.status(response.status).json(data);

      const orders = data && data.data && data.data.orders ? data.data.orders : [];
      allOrders = allOrders.concat(orders);
      console.log('[' + new Date().toISOString() + '] Page ' + page + ' -> ' + orders.length + ' orders (total: ' + allOrders.length + ')');

      if (orders.length < perPage) break;
      page++;
    }

    console.log('[' + new Date().toISOString() + '] DONE - ' + allOrders.length + ' total orders');
    res.json({ code: 200, message: 'Successful', data: { orders: allOrders, total: allOrders.length } });

  } catch (err) {
    console.error('[' + new Date().toISOString() + '] GET ORDERS ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── EDIT ORDER ────────────────────────────────────────────────────────────────
app.put('/api/editOrder/:orderNumber', async (req, res) => {
  console.log('[' + new Date().toISOString() + '] EDIT ORDER -> ' + req.params.orderNumber);
  res.status(501).json({ success: false, message: 'Edit Order API not yet configured.' });
});

// ── LOCAL ORDER STORE ─────────────────────────────────────────────────────────
const ORDERS_FILE = path.join(__dirname, 'orders_store.json');
function readOrders() { try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); } catch (e) { return []; } }
function writeOrders(orders) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2)); }

app.post('/api/orders', (req, res) => {
  try {
    const orders = readOrders();
    const newOrder = Object.assign({}, req.body, { _id: Date.now().toString(), savedAt: new Date().toISOString() });
    orders.unshift(newOrder);
    writeOrders(orders.slice(0, 1000));
    res.json({ success: true, order: newOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/orders', (req, res) => {
  try {
    res.json({ success: true, orders: readOrders() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── STATIC + FALLBACK ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

app.use(function (req, res, next) {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  console.log('TSC EasyEcom Server running on http://localhost:' + PORT);
  console.log('JWT: ' + (EASYECOM_JWT || '').slice(0, 20) + '...');
  console.log('API Key: ' + (EASYECOM_API_KEY || '').slice(0, 8) + '...');
});