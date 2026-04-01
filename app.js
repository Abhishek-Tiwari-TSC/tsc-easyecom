/* TSC EasyEcom - app.js */

const CONFIG = {
  USE_BACKEND: true,
  BACKEND_URL: 'https://tsc-easyecom-render-1.onrender.com',
  SHEET_URL: 'https://script.google.com/macros/s/AKfycby-tRXUB5f1CJNtU9aBw0jSePFtkFLinQ2pvT2I10cTcTJQuITck_VQH7bUEvxRya1b-A/exec',
};

// Marketplace -> marketplaceId mapping
const MARKETPLACE_MAP = {
  'Pepperfry': { id: 54 },
  'TataCliq': { id: 948 },
};

let itemCount = 0;
let allOrders = [];
let currentEditOrder = null;

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
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
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (el) el.classList.add('active');
  const labels = { create: 'Create Order', edit: 'View & Edit Orders' };
  document.getElementById('crumbCurrent').textContent = labels[tab] || tab;
  if (tab === 'edit') loadOrders();
}

// ── MARKETPLACE CHANGE ────────────────────────────────────────────────────────
function onMarketplaceChange(sel) {
  const config = MARKETPLACE_MAP[sel.value];
  if (config) {
    document.getElementById('marketplaceId').value = config.id;
  } else {
    document.getElementById('marketplaceId').value = '';
  }
}

// ── ADD ITEM ──────────────────────────────────────────────────────────────────
function addItem() {
  itemCount++;
  const id = itemCount;
  const div = document.createElement('div');
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
    '</div>' +
    '<div class="field">' +
    '<label class="field-label">Product Name <span class="req-star">*</span></label>' +
    '<input type="text" class="field-input item-name" placeholder="Full product name" required>' +
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
  const el = document.getElementById('item-' + id);
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = 'scale(0.97)';
  el.style.transition = 'all 0.18s ease';
  setTimeout(() => el.remove(), 180);
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
  document.getElementById('createOrderForm').reset();
  document.getElementById('itemsContainer').innerHTML = '';
  itemCount = 0;
  addItem();
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('orderDate').value = now.toISOString().slice(0, 16);
  document.getElementById('marketplaceId').value = '';
}

// ── BUILD PAYLOAD ─────────────────────────────────────────────────────────────
function buildPayload() {
  var g = function (id) { var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };

  // Format datetime for EasyEcom: "2026-04-01 13:30:00"
  var rawDate = g('orderDate');
  var orderDate = rawDate ? rawDate.replace('T', ' ') + ':00' : '';

  // Build items — SKU is always used, OrderItemId = productName per API example
  var items = Array.from(document.querySelectorAll('#itemsContainer .item-card')).map(function (card) {
    var sku = (card.querySelector('.item-sku') || {}).value || '';
    var name = (card.querySelector('.item-name') || {}).value || '';
    var qty = parseInt((card.querySelector('.item-qty') || {}).value || 1);
    var price = parseFloat((card.querySelector('.item-price') || {}).value || 0);
    var disc = parseFloat((card.querySelector('.item-disc') || {}).value || 0);
    return {
      OrderItemId: name.trim(),
      Sku: sku.trim(),
      productName: name.trim(),
      Quantity: qty,
      Price: price,
      ListingIdentifier: sku.trim(),
      itemDiscount: disc || 0,
    };
  });

  var mktId = parseInt(g('marketplaceId')) || 0;

  var payload = {
    orderType: 'retailorder',
    orderNumber: g('orderNumber'),
    orderDate: orderDate,
    paymentMode: 2,            // Always Prepaid
    marketplaceId: mktId,
    items: items,
    customer: [{
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
    }],
  };

  return payload;
}

// ── SUBMIT CREATE ORDER ───────────────────────────────────────────────────────
async function submitCreateOrder(e) {
  e.preventDefault();
  const payload = buildPayload();

  if (!payload.orderNumber) { showToast('error', 'Validation Error', 'Marketplace Order ID is required.'); return; }
  if (!document.getElementById('marketplaceName').value) { showToast('error', 'Validation Error', 'Please select a Marketplace.'); return; }
  if (!payload.items.length) { showToast('error', 'Validation Error', 'At least one item is required.'); return; }

  for (var i = 0; i < payload.items.length; i++) {
    var item = payload.items[i];
    if (!item.Sku) { showToast('error', 'Validation Error', 'Item ' + (i + 1) + ': SKU is required.'); return; }
    if (!item.productName) { showToast('error', 'Validation Error', 'Item ' + (i + 1) + ': Product Name is required.'); return; }
    if (!item.Price) { showToast('error', 'Validation Error', 'Item ' + (i + 1) + ': Price is required.'); return; }
  }

  showLoading(true);

  try {
    const url = CONFIG.USE_BACKEND
      ? CONFIG.BACKEND_URL + '/api/createOrder'
      : 'https://api.easyecom.io/webhook/v2/createOrder';

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || (data.code && data.code !== 200)) {
      throw new Error(data.message || data.error || ('API Error ' + res.status));
    }

    const queueId = (data.data && data.data.queueId) ? data.data.queueId : '';

    // Save to Google Sheet
    try {
      await fetch(CONFIG.SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createOrder', data: buildSheetRow(payload, data) }),
      });
    } catch (sheetErr) { console.warn('Sheet save failed', sheetErr); }

    showLoading(false);
    showToast('success', 'Order Queued!', 'Order ' + payload.orderNumber + ' accepted.' + (queueId ? ' Queue ID: ' + queueId : ''));
    setTimeout(function () { resetForm(); }, 2500);

  } catch (err) {
    showLoading(false);
    showToast('error', 'API Error', err.message || 'Failed to create order.');
  }
}

// ── SHEET ROW ─────────────────────────────────────────────────────────────────
function buildSheetRow(payload, response) {
  var g = function (id) { var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  var b = (payload.customer[0] || {}).billing || {};
  var s = (payload.customer[0] || {}).shipping || {};
  return {
    timestamp: new Date().toISOString(),
    orderNumber: payload.orderNumber,
    orderType: payload.orderType,
    marketplace: g('marketplaceName'),
    marketplaceId: payload.marketplaceId,
    invoiceAmount: g('invoiceAmount'),
    orderDate: payload.orderDate,
    paymentMode: payload.paymentMode,
    itemCount: payload.items.length,
    itemsSummary: payload.items.map(function (i) { return i.productName + 'x' + i.Quantity; }).join(' | '),
    billingName: b.name, billingContact: b.contact, billingEmail: b.email || '',
    billingCity: b.city, billingState: b.state, billingPostal: b.postalCode,
    billingAddress: [b.addressLine1, b.addressLine2].filter(Boolean).join(', '),
    shippingName: s.name, shippingContact: s.contact, shippingEmail: s.email || '',
    shippingCity: s.city, shippingState: s.state, shippingPostal: s.postalCode,
    shippingAddress: [s.addressLine1, s.addressLine2].filter(Boolean).join(', '),
    shippingLat: s.latitude || '', shippingLng: s.longitude || '',
    queueId: (response.data && response.data.queueId) ? response.data.queueId : '',
    apiStatus: response.code === 200 ? 'success' : 'error',
    apiResponse: JSON.stringify(response),
  };
}

// ── LOAD ORDERS ───────────────────────────────────────────────────────────────
async function loadOrders() {
  const tbody = document.getElementById('ordersBody');
  const btn = document.getElementById('refreshBtn');
  document.getElementById('ordersMeta').style.display = 'none';
  btn.classList.add('spinning');
  tbody.innerHTML = '<tr><td colspan="8"><div class="table-empty"><div class="loading-ring" style="width:28px;height:28px;border-width:2px;margin:0;"></div><p>Fetching all orders from EasyEcom...</p></div></td></tr>';

  try {
    const res = await fetch(CONFIG.BACKEND_URL + '/api/getAllOrders');
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    allOrders = (data.data && data.data.orders) ? data.data.orders : [];
    renderOrders(allOrders);
    document.getElementById('ordersCount').textContent = allOrders.length + ' order' + (allOrders.length !== 1 ? 's' : '');
    document.getElementById('ordersMeta').style.display = 'flex';
    showToast('success', 'Orders Loaded', allOrders.length + ' orders fetched.');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="table-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Failed to load: ' + err.message + '</p></div></td></tr>';
    showToast('error', 'Load Failed', err.message);
  } finally {
    btn.classList.remove('spinning');
  }
}

// ── RENDER ORDERS ─────────────────────────────────────────────────────────────
function renderOrders(orders) {
  const tbody = document.getElementById('ordersBody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="table-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><p>No orders found.</p></div></td></tr>';
    return;
  }

  function pmChip(m) {
    var map = { COD: ['chip-cod', 'COD'], PrePaid: ['chip-prepaid', 'Prepaid'], Prepaid: ['chip-prepaid', 'Prepaid'] };
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
      (String(o.order_id || '')).includes(ql);
  }));
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
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