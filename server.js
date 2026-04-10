const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── WAREHOUSE JWT TOKENS ──────────────────────────────────────────────────────
const WAREHOUSE_TOKENS = {
  'Bhiwandi': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2xvYWRiYWxhbmNlci1tLmVhc3llY29tLmlvL2FjY2Vzcy90b2tlbiIsImlhdCI6MTc3NTAzOTA5NywiZXhwIjoxNzgyOTIzMDk3LCJuYmYiOjE3NzUwMzkwOTcsImp0aSI6ImdPWlcxSk5JZU9VaXF1RWoiLCJzdWIiOiIyNDgxNzUiLCJwcnYiOiJhODRkZWY2NGFkMDExNWQ1ZWNjYzFmODg0NWJjZDBlN2ZlNmM0YjYwIiwidXNlcl9pZCI6MjQ4MTc1LCJjb21wYW55X2lkIjoxMDM4MDksInJvbGVfdHlwZV9pZCI6MiwicGlpX2FjY2VzcyI6MSwicGlpX3JlcG9ydF9hY2Nlc3MiOjEsInJvbGVzIjpudWxsLCJjX2lkIjoxNzI0NjQsInVfaWQiOjI0ODE3NSwibG9jYXRpb25fcmVxdWVzdGVkX2ZvciI6MTcyNDY0fQ.5FzmIeP_kS_4WWRs7pMSiO1D6O-zBCrlXLzhlw3Wmh4',
  'Kolkata': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2xvYWRiYWxhbmNlci1tLmVhc3llY29tLmlvL2FjY2Vzcy90b2tlbiIsImlhdCI6MTc3NTE0OTA3NywiZXhwIjoxNzgzMDMzMDc3LCJuYmYiOjE3NzUxNDkwNzcsImp0aSI6IlhIbUI5Q1VSZ05TMDc5ZU8iLCJzdWIiOiIyNDgxNzUiLCJwcnYiOiJhODRkZWY2NGFkMDExNWQ1ZWNjYzFmODg0NWJjZDBlN2ZlNmM0YjYwIiwidXNlcl9pZCI6MjQ4MTc1LCJjb21wYW55X2lkIjoxMDM4MDksInJvbGVfdHlwZV9pZCI6MiwicGlpX2FjY2VzcyI6MSwicGlpX3JlcG9ydF9hY2Nlc3MiOjEsInJvbGVzIjpudWxsLCJjX2lkIjoxODAzOTEsInVfaWQiOjI0ODE3NSwibG9jYXRpb25fcmVxdWVzdGVkX2ZvciI6MTgwMzkxfQ.Q0TYIqye2pa1suFkHuFrsTCjg0TrGEGwYhV065kNzbk',
  'New Bangalore': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2xvYWRiYWxhbmNlci1tLmVhc3llY29tLmlvL2FjY2Vzcy90b2tlbiIsImlhdCI6MTc3NTE0OTEzNSwiZXhwIjoxNzgzMDMzMTM1LCJuYmYiOjE3NzUxNDkxMzUsImp0aSI6IlB2Z1YwQ3JId3NMV3dYdHkiLCJzdWIiOiIyNDgxNzUiLCJwcnYiOiJhODRkZWY2NGFkMDExNWQ1ZWNjYzFmODg0NWJjZDBlN2ZlNmM0YjYwIiwidXNlcl9pZCI6MjQ4MTc1LCJjb21wYW55X2lkIjoxMDM4MDksInJvbGVfdHlwZV9pZCI6MiwicGlpX2FjY2VzcyI6MSwicGlpX3JlcG9ydF9hY2Nlc3MiOjEsInJvbGVzIjpudWxsLCJjX2lkIjoyNDM4NjUsInVfaWQiOjI0ODE3NSwibG9jYXRpb25fcmVxdWVzdGVkX2ZvciI6MjQzODY1fQ.VBHJzjXLw5XMY1qyM1m9ov1k8NgGMY4SKmmZASk88ok',
  'Gurgaon': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2xvYWRiYWxhbmNlci1tLmVhc3llY29tLmlvL2FjY2Vzcy90b2tlbiIsImlhdCI6MTc3NTE0OTE4NiwiZXhwIjoxNzgzMDMzMTg2LCJuYmYiOjE3NzUxNDkxODYsImp0aSI6ImlYdk9tR0J3bnBJQUp6MDciLCJzdWIiOiIyNDgxNzUiLCJwcnYiOiJhODRkZWY2NGFkMDExNWQ1ZWNjYzFmODg0NWJjZDBlN2ZlNmM0YjYwIiwidXNlcl9pZCI6MjQ4MTc1LCJjb21wYW55X2lkIjoxMDM4MDksInJvbGVfdHlwZV9pZCI6MiwicGlpX2FjY2VzcyI6MSwicGlpX3JlcG9ydF9hY2Nlc3MiOjEsInJvbGVzIjpudWxsLCJjX2lkIjoxNzI0NjYsInVfaWQiOjI0ODE3NSwibG9jYXRpb25fcmVxdWVzdGVkX2ZvciI6MTcyNDY2fQ.9JSaMYqWSl8u5zqVf1nVxQaWW3qjxx9CFWsmJvUsQh8',
};

const DEFAULT_JWT = process.env.EASYECOM_JWT || WAREHOUSE_TOKENS['Bhiwandi'];
const EASYECOM_API_KEY = process.env.EASYECOM_API_KEY || '9150cbbea336c87bfcc5d1aa435957c424762b8d';
const GUPSHUP_USERID = '2000197692';
const GUPSHUP_PASSWORD = '9LzraftQ';

const APPROVER_NUMBERS = ['9730083299', '9619390710', '9819833605'];

const EASYECOM_WEBHOOK = 'https://api.easyecom.io/webhook/v2';
const EASYECOM_ORDERS = 'https://api.easyecom.io/orders/V2';

function easyecomHeaders(warehouse) {
  const jwt = (warehouse && WAREHOUSE_TOKENS[warehouse]) ? WAREHOUSE_TOKENS[warehouse] : DEFAULT_JWT;
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + jwt,
    'x-api-key': EASYECOM_API_KEY,
  };
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

// ── HEALTH & PING (Important for Render free tier) ───────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'TSC EasyEcom Backend is running'
  });
});

app.get('/ping', (req, res) => {
  res.json({
    status: 'pong',
    timestamp: new Date().toISOString()
  });
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// ── SEND OTP VIA WHATSAPP ─────────────────────────────────────────────────────
app.post('/api/sendOtp', async (req, res) => {
  // productName is WhatsApp-only — it is never forwarded to EasyEcom
  const { name, orderNumber, item, productName, amount, otp, sendTo } = req.body;

  if (!name || !orderNumber || !item || !productName || !amount || !otp || !sendTo) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  if (!APPROVER_NUMBERS.includes(String(sendTo))) {
    return res.status(400).json({ success: false, message: 'Invalid approver number.' });
  }

  const message =
    `Hi ${name},\n\n` +
    `As per your recent request, here are your order details:\n\n` +
    `*Order ID:* ${orderNumber}\n\n` +
    `*SKU id:* ${item}\n\n` +
    `*Product Name*: ${productName}\n\n` +
    `*Amount:* ${amount}\n\n` +
    `*Reference Code:* ${otp}\n\n` +
    `Please review the order details`;

  const url = `https://mediaapi.smsgupshup.com/GatewayAPI/rest?userid=${GUPSHUP_USERID}&password=${GUPSHUP_PASSWORD}&send_to=${sendTo}&v=1.1&format=json&msg_type=TEXT&method=SENDMESSAGE&msg=${encodeURIComponent(message)}`;

  console.log(`[${new Date().toISOString()}] SEND OTP -> order: ${orderNumber} | to: ${sendTo} (${name}) | product: ${productName}`);

  try {
    const response = await fetch(url, { method: 'GET' });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }

    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'Gupshup failed', raw: data });
    }

    res.json({ success: true, message: 'OTP sent via WhatsApp.', data });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] SEND OTP ERROR:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CREATE ORDER ──────────────────────────────────────────────────────────────
app.post('/api/createOrder', async (req, res) => {
  const { warehouse, invoiceAmount, ...payload } = req.body;

  console.log(`[${new Date().toISOString()}] CREATE ORDER -> ${payload.orderNumber || 'NO_ORDER_NUM'} ${warehouse ? `| Warehouse: ${warehouse}` : ''}`);

  if (!payload.orderNumber) {
    return res.status(400).json({ success: false, message: 'orderNumber is required' });
  }

  try {
    const url = EASYECOM_WEBHOOK + '/createOrder';
    const headers = easyecomHeaders(warehouse);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      console.error(`[${new Date().toISOString()}] NON-JSON RESPONSE (${response.status}):`, text.slice(0, 300));
      return res.status(502).json({ success: false, message: 'EasyEcom returned non-JSON', raw: text.slice(0, 300) });
    }

    console.log(`[${new Date().toISOString()}] EasyEcom Response ${response.status}:`, JSON.stringify(data).slice(0, 300));
    res.status(response.status).json(data);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] CREATE ORDER ERROR:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET ALL ORDERS (Improved error handling) ─────────────────────────────────
app.get('/api/getAllOrders', async (req, res) => {
  console.log(`[${new Date().toISOString()}] GET ALL ORDERS started`);

  try {
    let allOrders = [];
    let page = 1;
    const perPage = 50;

    while (true) {
      const url = `${EASYECOM_ORDERS}/getAllOrders?page=${page}&per_page=${perPage}`;
      const headers = easyecomHeaders();

      console.log(`Fetching page ${page}...`);

      const response = await fetch(url, { method: 'GET', headers });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        console.error(`[${new Date().toISOString()}] NON-JSON on page ${page}:`, text.slice(0, 200));
        break;
      }

      if (!response.ok) {
        console.error(`EasyEcom API Error ${response.status}:`, data);
        return res.status(response.status).json({
          success: false,
          message: data.message || `API Error ${response.status}`,
          error: data
        });
      }

      const orders = data?.data?.orders || [];
      allOrders = allOrders.concat(orders);

      console.log(`Page ${page} → ${orders.length} orders (Total: ${allOrders.length})`);

      if (orders.length < perPage) break;
      page++;
    }

    console.log(`[${new Date().toISOString()}] GET ALL ORDERS completed → ${allOrders.length} orders`);
    res.json({
      code: 200,
      message: 'Successful',
      data: {
        orders: allOrders,
        total: allOrders.length
      }
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET ALL ORDERS CRITICAL ERROR:`, err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders from EasyEcom',
      error: err.message
    });
  }
});

// ── EDIT ORDER (placeholder) ─────────────────────────────────────────────────
app.put('/api/editOrder/:orderNumber', async (req, res) => {
  res.status(501).json({ success: false, message: 'Edit Order API not yet configured.' });
});

// ── LOCAL ORDER STORE (optional) ─────────────────────────────────────────────
const ORDERS_FILE = path.join(__dirname, 'orders_store.json');
function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); }
  catch (e) { return []; }
}
function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

app.post('/api/orders', (req, res) => { /* ... existing code ... */ });
app.get('/api/orders', (req, res) => { /* ... existing code ... */ });

// ── SERVE FRONTEND ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── START SERVER ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 TSC EasyEcom Server running on http://localhost:${PORT}`);
  console.log(`Warehouses configured: ${Object.keys(WAREHOUSE_TOKENS).join(', ')}`);
  console.log(`API Key used: ${EASYECOM_API_KEY.slice(0, 8)}...`);
  console.log(`\n🌐 Open the app in your browser:`);
  console.log(`   → http://localhost:${PORT}/index.html`);
  console.log(`\n✅ API endpoints:`);
  console.log(`   → http://localhost:${PORT}/health`);
  console.log(`   → http://localhost:${PORT}/ping`);
  console.log(`\n💡 For Render: Set up UptimeRobot / cron-job.org to ping /ping every 10-14 minutes to prevent sleeping.`);
});