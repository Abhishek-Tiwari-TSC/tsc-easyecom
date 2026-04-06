/* TSC EasyEcom - app.js */

const CONFIG = {
  USE_BACKEND: true,
  BACKEND_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://tsc-easyecom-render-1.onrender.com',
  SHEET_URL: 'https://script.google.com/macros/s/AKfycby-tRXUB5f1CJNtU9aBw0jSePFtkFLinQ2pvT2I10cTcTJQuITck_VQH7bUEvxRya1b-A/exec',
};

// Marketplace -> marketplaceId mapping
const MARKETPLACE_MAP = {
  'Pepperfry': { id: 54 },
  'TataCliq': { id: 948 },
};

// Approvers — name shown in cards, number sent to Gupshup
const APPROVERS = [
  { name: 'Ruta', number: '9730083299' },
  { name: 'Nirav', number: '9619390710' },
  { name: 'Abhishek', number: '9819833605' },
];

let itemCount = 0;
let allOrders = [];
let currentEditOrder = null;

// Holds the pending payload while waiting for OTP confirmation
let _pendingPayload = null;

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  var now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('orderDate').value = now.toISOString().slice(0, 16);
  addItem();
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
function doLogout() {
  if (!confirm('Logout from TSC EasyEcom?')) return;
  sessionStorage.clear();
  window.location.href = 'login.html';
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── TAB SWITCH ────────────────────────────────────────────────────────────────
function switchTab(tab, el) {
  document.querySelectorAll('.tab-pane').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function (n) { n.classList.remove('active'); });
  document.getElementById('tab-' + tab).classList.add('active');
  if (el) el.classList.add('active');
  var labels = { create: 'Create Order', edit: 'View & Edit Orders' };
  document.getElementById('crumbCurrent').textContent = labels[tab] || tab;
  if (tab === 'edit') loadOrders();
}

// ── MARKETPLACE CHANGE ────────────────────────────────────────────────────────
function onMarketplaceChange(sel) {
  var config = MARKETPLACE_MAP[sel.value];
  document.getElementById('marketplaceId').value = config ? config.id : '';

  var warehouseField = document.getElementById('warehouseField');
  var warehouseSelect = document.getElementById('warehouseName');
  if (sel.value === 'Pepperfry') {
    warehouseField.style.display = 'flex';
    warehouseSelect.required = true;
  } else {
    warehouseField.style.display = 'none';
    warehouseSelect.required = false;
    warehouseSelect.value = '';
  }
}

// ── WAREHOUSE CHANGE ──────────────────────────────────────────────────────────
function onWarehouseChange(sel) {
  if (sel.value) {
    var hint = sel.parentElement.querySelector('.field-hint');
    if (hint) hint.textContent = 'Token: ' + sel.value + ' warehouse JWT will be used';
  }
}

// ── ADD ITEM ──────────────────────────────────────────────────────────────────
function addItem() {
  itemCount++;
  var id = itemCount;
  var div = document.createElement('div');
  div.className = 'item-card';
  div.id = 'item-' + id;
  div.innerHTML =
    '<div class="item-card-header">' +
    '<span class="item-pill">Item #' + id + '</span>' +
    '<button type="button" class="item-remove" onclick="removeItem(' + id + ')">' +
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
    'Remove' +
    '</button>' +
    '</div>' +
    '<div class="item-body">' +
    '<div class="item-grid">' +
    '<div class="field">' +
    '<label class="field-label">EasyEcom SKU <span class="req-star">*</span></label>' +
    '<input type="text" class="field-input item-sku" placeholder="e.g. TSCNPP001_EASY" required>' +
    '<span class="field-hint">Used as Sku, productName and ListingIdentifier</span>' +
    '</div>' +
    '<div class="field">' +
    '<label class="field-label">Quantity <span class="req-star">*</span></label>' +
    '<input type="number" class="field-input item-qty" placeholder="1" min="1" required>' +
    '</div>' +
    '<div class="field">' +
    '<label class="field-label">Price (Rs.) <span class="req-star">*</span></label>' +
    '<input type="number" class="field-input item-price" placeholder="0.00" step="0.01" required>' +
    '</div>' +
    '<div class="field">' +
    '<label class="field-label">Item Discount (Rs.)</label>' +
    '<input type="number" class="field-input item-disc" placeholder="0.00" step="0.01">' +
    '</div>' +
    '</div>' +
    '</div>';
  document.getElementById('itemsContainer').appendChild(div);
}

function removeItem(id) {
  var el = document.getElementById('item-' + id);
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = 'scale(0.97)';
  el.style.transition = 'all 0.18s ease';
  setTimeout(function () { el.remove(); }, 180);
}

// ── COPY BILLING ──────────────────────────────────────────────────────────────
function copyBilling() {
  var pairs = [
    ['billingName', 'shippingName'], ['billingContact', 'shippingContact'],
    ['billingAddress1', 'shippingAddress1'], ['billingAddress2', 'shippingAddress2'],
    ['billingCity', 'shippingCity'], ['billingState', 'shippingState'],
    ['billingPostal', 'shippingPostal'], ['billingCountry', 'shippingCountry'],
    ['billingEmail', 'shippingEmail'],
  ];
  pairs.forEach(function (pair) {
    var from = document.getElementById(pair[0]);
    var to = document.getElementById(pair[1]);
    if (from && to) to.value = from.value;
  });
  showToast('success', 'Copied', 'Billing details copied to shipping.');
}

// ── RESET ─────────────────────────────────────────────────────────────────────
function resetForm() {
  if (!confirm('Reset all form fields?')) return;
  _resetFormFields();
}

function resetFormSilent() {
  _resetFormFields();
}

function _resetFormFields() {
  document.getElementById('createOrderForm').reset();
  document.getElementById('itemsContainer').innerHTML = '';
  itemCount = 0;
  addItem();
  var now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('orderDate').value = now.toISOString().slice(0, 16);
  document.getElementById('marketplaceId').value = '';
  document.getElementById('warehouseField').style.display = 'none';
  document.getElementById('warehouseName').required = false;
}

// ── BUILD PAYLOAD ─────────────────────────────────────────────────────────────
// paymentMode is always 1 (Prepaid/Online) as per EasyEcom API.
// gst_number is optional — only included when filled in.
function buildPayload() {
  var g = function (id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  };

  var rawDate = g('orderDate');
  var orderDate = rawDate ? rawDate.replace('T', ' ') + ':00' : '';
  var orderNumber = g('orderNumber');

  var items = Array.from(document.querySelectorAll('#itemsContainer .item-card')).map(function (card, idx) {
    var sku = ((card.querySelector('.item-sku') || {}).value || '').trim();
    var qty = parseInt((card.querySelector('.item-qty') || {}).value || 1);
    var price = parseFloat((card.querySelector('.item-price') || {}).value || 0);
    var disc = parseFloat((card.querySelector('.item-disc') || {}).value || 0);
    return {
      OrderItemId: orderNumber + '_' + (idx + 1),
      Sku: sku,
      productName: sku,
      Quantity: qty,
      Price: price,
      ListingIdentifier: sku,
      itemDiscount: disc || 0,
    };
  });

  var mktId = parseInt(g('marketplaceId')) || 0;
  var warehouse = g('warehouseName');
  var gstNumber = g('gstNumber');

  // Build customer object — gst_number only added when provided
  var customerObj = {
    billing: {
      name: g('billingName'),
      addressLine1: g('billingAddress1'),
      addressLine2: g('billingAddress2'),
      postalCode: g('billingPostal'),
      city: g('billingCity'),
      state: g('billingState'),
      country: g('billingCountry') || 'India',
      contact: g('billingContact'),
      email: g('billingEmail'),
    },
    shipping: {
      name: g('shippingName'),
      addressLine1: g('shippingAddress1'),
      addressLine2: g('shippingAddress2'),
      postalCode: g('shippingPostal'),
      city: g('shippingCity'),
      state: g('shippingState'),
      country: g('shippingCountry') || 'India',
      contact: g('shippingContact'),
      email: g('shippingEmail'),
      latitude: g('shippingLat') || undefined,
      longitude: g('shippingLng') || undefined,
    },
  };

  // Only attach gst_number if user filled it in
  if (gstNumber) customerObj.gst_number = gstNumber;

  var payload = {
    orderType: 'retailorder',
    orderNumber: orderNumber,
    invoiceAmount: g('invoiceAmount'),  // server strips before EasyEcom call
    orderDate: orderDate,
    paymentMode: 1,                  // Always Prepaid (1 = Online/Prepaid in EasyEcom)
    marketplaceId: mktId,
    items: items,
    customer: [customerObj],
  };

  if (warehouse) payload.warehouse = warehouse;
  return payload;
}

// ── OTP HELPERS ───────────────────────────────────────────────────────────────
function generateOtp() {
  var arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

function storeOtp(otp) {
  localStorage.setItem('tsc_order_otp', otp);
}

function getStoredOtp() {
  return localStorage.getItem('tsc_order_otp');
}

function clearOtp() {
  localStorage.removeItem('tsc_order_otp');
}

// ── SUBMIT CREATE ORDER ───────────────────────────────────────────────────────
async function submitCreateOrder(e) {
  e.preventDefault();
  var payload = buildPayload();

  if (!payload.orderNumber) {
    showToast('error', 'Validation Error', 'Marketplace Order ID is required.');
    return;
  }
  var mktName = document.getElementById('marketplaceName').value;
  if (!mktName) {
    showToast('error', 'Validation Error', 'Please select a Marketplace.');
    return;
  }
  if (mktName === 'Pepperfry' && !payload.warehouse) {
    showToast('error', 'Validation Error', 'Please select a Warehouse for Pepperfry orders.');
    return;
  }
  if (!payload.items.length) {
    showToast('error', 'Validation Error', 'At least one item is required.');
    return;
  }
  for (var i = 0; i < payload.items.length; i++) {
    var item = payload.items[i];
    if (!item.Sku) { showToast('error', 'Validation Error', 'Item ' + (i + 1) + ': SKU is required.'); return; }
    if (!item.Price) { showToast('error', 'Validation Error', 'Item ' + (i + 1) + ': Price is required.'); return; }
  }

  _pendingPayload = payload;
  showOtpDialog(payload.orderNumber);
}

// ── OTP DIALOG ────────────────────────────────────────────────────────────────
function showOtpDialog(orderNumber) {
  document.getElementById('otpOrderRef').textContent = orderNumber;
  document.getElementById('otpApprover').value = '';
  document.getElementById('otpInput').value = '';
  document.getElementById('otpError').textContent = '';
  document.getElementById('otpSendError').textContent = '';
  document.getElementById('otpCodeSection').style.display = 'none';

  var sendBtn = document.getElementById('otpSendBtn');
  sendBtn.disabled = false;
  sendBtn.textContent = 'Send Code on WhatsApp';
  sendBtn.style.background = '';

  // Reset radio buttons
  document.querySelectorAll('.approver-radio').forEach(function (r) { r.checked = false; });

  document.getElementById('otpModal').classList.add('open');
}

function closeOtpDialog() {
  document.getElementById('otpModal').classList.remove('open');
  clearOtp();
  _pendingPayload = null;
}

function otpKeydown(e) {
  if (e.key === 'Enter') confirmOtp();
}

// ── SEND CODE ─────────────────────────────────────────────────────────────────
async function sendOtpCode() {
  var selectedIdx = document.getElementById('otpApprover').value;

  document.getElementById('otpSendError').textContent = '';

  if (selectedIdx === '') {
    document.getElementById('otpSendError').textContent = 'Please select an approver first.';
    return;
  }

  var approver = APPROVERS[parseInt(selectedIdx)];
  if (!approver) {
    document.getElementById('otpSendError').textContent = 'Invalid approver selected.';
    return;
  }

  var payload = _pendingPayload;
  if (!payload) {
    document.getElementById('otpSendError').textContent = 'Order data lost. Please close and try again.';
    return;
  }

  var otp = generateOtp();
  storeOtp(otp);

  var itemSummary = payload.items.map(function (it) { return it.Sku + ' x' + it.Quantity; }).join(', ');
  var amountDisplay = payload.invoiceAmount ? 'Rs. ' + parseFloat(payload.invoiceAmount).toLocaleString('en-IN') : 'N/A';

  var sendBtn = document.getElementById('otpSendBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    var otpRes = await fetch(CONFIG.BACKEND_URL + '/api/sendOtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: approver.name,
        orderNumber: payload.orderNumber,
        item: itemSummary,
        amount: amountDisplay,
        otp: otp,
        sendTo: approver.number,
      }),
    });
    var otpData = await otpRes.json();

    if (!otpRes.ok || !otpData.success) {
      throw new Error(otpData.message || 'Failed to send code via WhatsApp.');
    }

    sendBtn.textContent = '✓ Code Sent';
    sendBtn.style.background = '#065F46';

    document.getElementById('otpSentTo').textContent = approver.name + ' (' + approver.number + ')';
    document.getElementById('otpCodeSection').style.display = 'block';
    document.getElementById('otpInput').focus();

  } catch (err) {
    clearOtp();
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Code on WhatsApp';
    sendBtn.style.background = '';
    document.getElementById('otpSendError').textContent = err.message;
  }
}

// ── CONFIRM OTP & PLACE ORDER ─────────────────────────────────────────────────
async function confirmOtp() {
  var entered = (document.getElementById('otpInput').value || '').trim();
  var stored = getStoredOtp();

  document.getElementById('otpError').textContent = '';

  if (!entered) {
    document.getElementById('otpError').textContent = 'Please enter the 6-digit code.';
    return;
  }
  if (!stored) {
    document.getElementById('otpError').textContent = 'No code found. Please send the code again.';
    return;
  }
  if (entered !== stored) {
    document.getElementById('otpError').textContent = 'Incorrect code. Please try again.';
    document.getElementById('otpInput').value = '';
    document.getElementById('otpInput').focus();
    return;
  }

  document.getElementById('otpModal').classList.remove('open');
  clearOtp();

  var payload = _pendingPayload;
  _pendingPayload = null;

  if (!payload) {
    showToast('error', 'Error', 'Order payload lost. Please try again.');
    return;
  }

  showLoading(true);

  try {
    var url = CONFIG.USE_BACKEND
      ? CONFIG.BACKEND_URL + '/api/createOrder'
      : 'https://api.easyecom.io/webhook/v2/createOrder';

    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var data = await res.json();

    if (!res.ok || (data.code && data.code !== 200)) {
      throw new Error(data.message || data.error || ('API Error ' + res.status));
    }

    try {
      await fetch(CONFIG.SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createOrder', data: buildSheetRow(payload, data) }),
      });
    } catch (sheetErr) { console.warn('Sheet save failed', sheetErr); }

    showLoading(false);
    showApiResponseModal(data, payload.orderNumber, payload.warehouse);
    setTimeout(function () { resetFormSilent(); }, 4000);

  } catch (err) {
    showLoading(false);
    showApiResponseModal(
      { code: 0, message: err.message || 'Failed to create order.', data: {} },
      payload.orderNumber,
      payload.warehouse
    );
  }
}

// ── API RESPONSE MODAL ────────────────────────────────────────────────────────
function showApiResponseModal(data, orderNumber, warehouse) {
  var isSuccess = data.code === 200;
  var d = data.data || {};

  var rows = '';
  if (d.OrderID) rows += makeRespRow('Order ID', d.OrderID);
  if (d.SuborderID) rows += makeRespRow('Suborder ID', d.SuborderID);
  if (d.InvoiceID) rows += makeRespRow('Invoice ID', d.InvoiceID);
  if (d.queueId) rows += makeRespRow('Queue ID', d.queueId);
  if (d.Message) rows += makeRespRow('EasyEcom Msg', d.Message);
  if (warehouse) rows += makeRespRow('Warehouse', warehouse);

  document.getElementById('apiRespIcon').innerHTML = isSuccess
    ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

  document.getElementById('apiRespIcon').className = 'api-resp-icon ' + (isSuccess ? 'resp-success' : 'resp-error');
  document.getElementById('apiRespStatusText').textContent = isSuccess ? 'Order Created Successfully' : 'Order Failed';
  document.getElementById('apiRespStatusText').className = 'api-resp-status-text ' + (isSuccess ? 'resp-success' : 'resp-error');
  document.getElementById('apiRespMessage').textContent = data.message || '';
  document.getElementById('apiRespOrderNum').textContent = 'Order #' + orderNumber;
  document.getElementById('apiRespRows').innerHTML = rows || '<p class="resp-empty">No structured fields returned.</p>';
  document.getElementById('apiRespRaw').textContent = JSON.stringify(data, null, 2);
  document.getElementById('apiRespModal').classList.add('open');
}

function makeRespRow(label, value) {
  return '<div class="resp-row">' +
    '<span class="resp-label">' + label + '</span>' +
    '<span class="resp-val">' + value + '</span>' +
    '</div>';
}

function closeApiRespModal() {
  document.getElementById('apiRespModal').classList.remove('open');
}

// ── SHEET ROW ─────────────────────────────────────────────────────────────────
function buildSheetRow(payload, response) {
  var g = function (id) { var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  var b = (payload.customer[0] || {}).billing || {};
  var s = (payload.customer[0] || {}).shipping || {};
  return {
    timestamp: new Date().toISOString(),
    orderNumber: payload.orderNumber,
    marketplace: g('marketplaceName'),
    warehouse: payload.warehouse || '',
    marketplaceId: payload.marketplaceId,
    invoiceAmount: payload.invoiceAmount,
    orderDate: payload.orderDate,
    paymentMode: payload.paymentMode,
    gstNumber: (payload.customer[0] || {}).gst_number || '',
    itemCount: payload.items.length,
    itemsSummary: payload.items.map(function (i) { return i.Sku + 'x' + i.Quantity; }).join(' | '),
    billingName: b.name, billingContact: b.contact, billingEmail: b.email || '',
    billingCity: b.city, billingState: b.state, billingPostal: b.postalCode,
    billingAddress: [b.addressLine1, b.addressLine2].filter(Boolean).join(', '),
    shippingName: s.name, shippingContact: s.contact, shippingEmail: s.email || '',
    shippingCity: s.city, shippingState: s.state, shippingPostal: s.postalCode,
    shippingAddress: [s.addressLine1, s.addressLine2].filter(Boolean).join(', '),
    shippingLat: s.latitude || '',
    shippingLng: s.longitude || '',
    queueId: (response.data && response.data.queueId) ? response.data.queueId : '',
    orderId: (response.data && response.data.OrderID) ? response.data.OrderID : '',
    suborderId: (response.data && response.data.SuborderID) ? response.data.SuborderID : '',
    invoiceId: (response.data && response.data.InvoiceID) ? response.data.InvoiceID : '',
    apiStatus: response.code === 200 ? 'success' : 'error',
    apiResponse: JSON.stringify(response),
  };
}

// ── LOAD ORDERS ───────────────────────────────────────────────────────────────
async function loadOrders() {
  var tbody = document.getElementById('ordersBody');
  var btn = document.getElementById('refreshBtn');
  document.getElementById('ordersMeta').style.display = 'none';
  btn.classList.add('spinning');
  tbody.innerHTML = '<tr><td colspan="8"><div class="table-empty"><div class="loading-ring" style="width:28px;height:28px;border-width:2px;margin:0;"></div><p>Fetching all orders from EasyEcom...</p></div></td></tr>';

  try {
    var res = await fetch(CONFIG.BACKEND_URL + '/api/getAllOrders');
    if (!res.ok) throw new Error('Server error ' + res.status);
    var data = await res.json();
    allOrders = (data.data && data.data.orders) ? data.data.orders : [];
    renderOrders(allOrders);
    document.getElementById('ordersCount').textContent = allOrders.length + ' order' + (allOrders.length !== 1 ? 's' : '');
    document.getElementById('ordersMeta').style.display = 'flex';
    showToast('success', 'Orders Loaded', allOrders.length + ' orders fetched.');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="table-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Failed: ' + err.message + '</p></div></td></tr>';
    showToast('error', 'Load Failed', err.message);
  } finally {
    btn.classList.remove('spinning');
  }
}

// ── RENDER ORDERS ─────────────────────────────────────────────────────────────
function renderOrders(orders) {
  var tbody = document.getElementById('ordersBody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="table-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><p>No orders found.</p></div></td></tr>';
    return;
  }

  function pmChip(m) {
    var map = { COD: ['chip-cod', 'COD'], PrePaid: ['chip-prepaid', 'Prepaid'], Prepaid: ['chip-prepaid', 'Prepaid'], Online: ['chip-prepaid', 'Prepaid'] };
    var r = map[m] || ['chip-online', m || '-'];
    return '<span class="payment-chip ' + r[0] + '">' + r[1] + '</span>';
  }

  function statusChip(s) {
    var map = { Open: ['#DBEAFE', '#1D4ED8'], Closed: ['#D1FAE5', '#065F46'], Cancelled: ['#FEE2E2', '#DC2626'], Hold: ['#FEF3C7', '#92400E'] };
    var r = map[s] || ['#F3F4F6', '#6B7280'];
    return '<span class="status-chip" style="background:' + r[0] + ';color:' + r[1] + ';">' + (s || '-') + '</span>';
  }

  tbody.innerHTML = orders.map(function (o, i) {
    var ref = o.reference_code || o.order_id || '-';
    var customer = o.customer_name || o.billing_name || '-';
    var amount = o.total_amount ? 'Rs.' + parseFloat(o.total_amount).toLocaleString('en-IN') : '-';
    var date = o.order_date ? new Date(o.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    return '<tr onclick="openModal(' + i + ')">' +
      '<td class="td-order-id">' + ref + '</td>' +
      '<td>' + (o.marketplace || o.order_type_key || '-') + '</td>' +
      '<td>' + customer + '</td>' +
      '<td class="td-amount">' + amount + '</td>' +
      '<td>' + pmChip(o.payment_mode) + '</td>' +
      '<td>' + statusChip(o.order_status) + '</td>' +
      '<td>' + date + '</td>' +
      '<td onclick="event.stopPropagation()">' +
      '<button class="btn-edit-row" onclick="openModal(' + i + ')">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
      ' Edit' +
      '</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

// ── FILTER ────────────────────────────────────────────────────────────────────
function filterOrders(q) {
  var ql = q.toLowerCase();
  renderOrders(allOrders.filter(function (o) {
    return (o.reference_code || '').toLowerCase().includes(ql) ||
      (o.customer_name || '').toLowerCase().includes(ql) ||
      (o.billing_name || '').toLowerCase().includes(ql) ||
      (o.marketplace || '').toLowerCase().includes(ql) ||
      String(o.order_id || '').includes(ql);
  }));
}

// ── ORDER DETAIL MODAL ────────────────────────────────────────────────────────
function openModal(idx) {
  var o = allOrders[idx];
  if (!o) return;
  currentEditOrder = o;
  document.getElementById('modalSubtitle').textContent = '#' + (o.reference_code || o.order_id) + '  -  ' + (o.marketplace || '');

  var subs = (o.suborders || []).map(function (s) {
    return '<div class="modal-item">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
      '<div><div class="modal-item-sku">' + (s.sku || s.AccountingSku || s.ean || '-') + '</div>' +
      '<div class="modal-item-name" style="margin-top:3px;">' + (s.productName || '-') + '</div></div>' +
      '<span style="font-size:13px;font-weight:700;color:var(--ink);">Rs.' + parseFloat(s.selling_price || 0).toLocaleString('en-IN') + '</span>' +
      '</div>' +
      '<div class="modal-item-meta">' +
      '<span>Qty: <b>' + s.item_quantity + '</b></span>' +
      '<span>Tax: <b>' + s.tax_rate + '%</b></span>' +
      '<span>Status: <b>' + (s.item_status || '-') + '</b></span>' +
      '</div>' +
      '</div>';
  }).join('');

  document.getElementById('modalBody').innerHTML =
    '<p class="modal-section">Order Info</p>' +
    '<div class="modal-grid">' +
    '<div class="modal-field"><label class="modal-label">Reference ID</label><input class="modal-input" value="' + (o.reference_code || '') + '" readonly></div>' +
    '<div class="modal-field"><label class="modal-label">Order Date</label><input class="modal-input" value="' + (o.order_date || '') + '" readonly></div>' +
    '<div class="modal-field"><label class="modal-label">Payment Mode</label><input class="modal-input" value="' + (o.payment_mode || '') + '" readonly></div>' +
    '<div class="modal-field"><label class="modal-label">Total Amount</label><input class="modal-input" value="Rs.' + (o.total_amount ? parseFloat(o.total_amount).toLocaleString('en-IN') : '-') + '" readonly></div>' +
    '</div>' +
    '<p class="modal-section">Customer</p>' +
    '<div class="modal-grid">' +
    '<div class="modal-field"><label class="modal-label">Name</label><input class="modal-input" id="edit_name" value="' + (o.customer_name || o.billing_name || '') + '"></div>' +
    '<div class="modal-field"><label class="modal-label">Contact</label><input class="modal-input" id="edit_contact" value="' + (o.contact_num || '') + '"></div>' +
    '<div class="modal-field col-span-2"><label class="modal-label">Address</label><input class="modal-input" id="edit_address" value="' + (o.address_line_1 || '') + '"></div>' +
    '<div class="modal-field"><label class="modal-label">City</label><input class="modal-input" id="edit_city" value="' + (o.city || '') + '"></div>' +
    '<div class="modal-field"><label class="modal-label">State</label><input class="modal-input" id="edit_state" value="' + (o.state || '') + '"></div>' +
    '</div>' +
    '<p class="modal-section">Items (' + (o.suborders || []).length + ')</p>' +
    '<div class="modal-items">' + (subs || '<p style="color:var(--muted);font-size:13px;">No items</p>') + '</div>' +
    '<p class="modal-section">Logistics</p>' +
    '<div class="modal-grid">' +
    '<div class="modal-field"><label class="modal-label">Warehouse</label><input class="modal-input" value="' + (o.import_warehouse_name || '-') + '" readonly></div>' +
    '<div class="modal-field"><label class="modal-label">Courier</label><input class="modal-input" value="' + (o.courier || '-') + '" readonly></div>' +
    '</div>' +
    '<div class="modal-info-note">' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
    '<span>Edit Order API will be wired once provided. Grey fields are read-only.</span>' +
    '</div>';

  document.getElementById('editModal').classList.add('open');
}

async function submitEditOrder() {
  showToast('info', 'Coming Soon', 'Edit Order API will be wired once you provide it.');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('open');
  currentEditOrder = null;
}

function handleBackdropClick(e) {
  if (e.target === document.getElementById('editModal')) closeModal();
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
var toastTimer;
function showToast(type, title, body) {
  var toast = document.getElementById('toast');
  var icons = {
    success: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    info: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };
  toast.className = 'toast ' + type;
  document.getElementById('toastIconWrap').innerHTML = icons[type] || '';
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastBody').textContent = body;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 5000);
}

function hideToast() {
  document.getElementById('toast').classList.remove('show');
}

// ── LOADING ───────────────────────────────────────────────────────────────────
function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('show', show);
  document.getElementById('createBtn').disabled = show;
}