const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

const PORT = process.env.PORT || 3000;

const EASYECOM_JWT = process.env.EASYECOM_JWT ||
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2xvYWRiYWxhbmNlci1tLmVhc3llY29tLmlvL2FjY2Vzcy90b2tlbiIsImlhdCI6MTc3NTAzOTA5NywiZXhwIjoxNzgyOTIzMDk3LCJuYmYiOjE3NzUwMzkwOTcsImp0aSI6ImdPWlcxSk5JZU9VaXF1RWoiLCJzdWIiOiIyNDgxNzUiLCJwcnYiOiJhODRkZWY2NGFkMDExNWQ1ZWNjYzFmODg0NWJjZDBlN2ZlNmM0YjYwIiwidXNlcl9pZCI6MjQ4MTc1LCJjb21wYW55X2lkIjoxMDM4MDksInJvbGVfdHlwZV9pZCI6MiwicGlpX2FjY2VzcyI6MSwicGlpX3JlcG9ydF9hY2Nlc3MiOjEsInJvbGVzIjpudWxsLCJjX2lkIjoxNzI0NjQsInVfaWQiOjI0ODE3NSwibG9jYXRpb25fcmVxdWVzdGVkX2ZvciI6MTcyNDY0fQ.5FzmIeP_kS_4WWRs7pMSiO1D6O-zBCrlXLzhlw3Wmh4';

const EASYECOM_API_KEY = process.env.EASYECOM_API_KEY || '9150cbbea336c87bfcc5d1aa435957c424762b8d';

const EASYECOM_WEBHOOK = 'https://api.easyecom.io/webhook/v2';
const EASYECOM_ORDERS = 'https://api.easyecom.io/orders/V2';

function easyecomHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + EASYECOM_JWT,
    'x-api-key': EASYECOM_API_KEY,
  };
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/createOrder', async (req, res) => {
  const payload = req.body;
  console.log('[' + new Date().toISOString() + '] CREATE ORDER -> ' + payload.orderNumber);

  if (!payload.orderNumber) {
    return res.status(400).json({ success: false, message: 'orderNumber is required' });
  }

  try {
    const url = EASYECOM_WEBHOOK + '/createOrder';
    console.log('[' + new Date().toISOString() + '] Calling: ' + url);
    console.log('[' + new Date().toISOString() + '] Payload:', JSON.stringify(payload));

    const response = await fetch(url, {
      method: 'POST',
      headers: easyecomHeaders(),
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      console.error('[' + new Date().toISOString() + '] NON-JSON (' + response.status + '):', text.slice(0, 300));
      return res.status(502).json({
        success: false,
        message: 'EasyEcom returned non-JSON (status ' + response.status + '). Check credentials.',
        raw: text.slice(0, 300),
      });
    }

    console.log('[' + new Date().toISOString() + '] RESPONSE ' + response.status + ':', JSON.stringify(data).slice(0, 300));
    res.status(response.status).json(data);

  } catch (err) {
    console.error('[' + new Date().toISOString() + '] ERROR:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/getAllOrders', async (req, res) => {
  console.log('[' + new Date().toISOString() + '] GET ALL ORDERS - all pages');
  try {
    let allOrders = [];
    let page = 1;
    const perPage = 50;

    while (true) {
      const url = EASYECOM_ORDERS + '/getAllOrders?page=' + page + '&per_page=' + perPage;
      const response = await fetch(url, {
        method: 'GET',
        headers: easyecomHeaders(),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        console.error('[' + new Date().toISOString() + '] NON-JSON page ' + page + ':', text.slice(0, 200));
        break;
      }

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

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

app.put('/api/editOrder/:orderNumber', async (req, res) => {
  console.log('[' + new Date().toISOString() + '] EDIT ORDER -> ' + req.params.orderNumber);
  res.status(501).json({ success: false, message: 'Edit Order API not yet configured.' });
});

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

app.use(express.static(path.join(__dirname)));

app.use(function (req, res, next) {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  console.log('TSC EasyEcom Server running on http://localhost:' + PORT);
  console.log('JWT: ' + EASYECOM_JWT.slice(0, 20) + '...');
  console.log('API Key: ' + EASYECOM_API_KEY.slice(0, 8) + '...');
});