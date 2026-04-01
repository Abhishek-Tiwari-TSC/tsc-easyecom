/**
 * ═══════════════════════════════════════════════════════════════════
 *  TSC EasyEcom – Google Apps Script (code.gs)
 *  
 *  SETUP INSTRUCTIONS:
 *  1. Open Google Sheets → Extensions → Apps Script
 *  2. Paste this entire code into Code.gs
 *  3. Click "Deploy" → "New Deployment"
 *  4. Type: "Web App"
 *  5. Execute as: "Me"
 *  6. Who has access: "Anyone"
 *  7. Click Deploy → Copy the Web App URL
 *  8. Paste the URL into app.js → CONFIG.SHEET_URL
 *
 *  The script auto-creates these sheets:
 *    - "Orders"    → all order records
 *    - "Settings"  → config (API key etc.)
 * ═══════════════════════════════════════════════════════════════════
 */

// ─── SHEET NAMES ─────────────────────────────────────────────────────────────
var ORDERS_SHEET   = 'Orders';
var SETTINGS_SHEET = 'Settings';

// ─── COLUMN HEADERS FOR ORDERS SHEET ─────────────────────────────────────────
var ORDER_HEADERS = [
  'Timestamp',
  'Order Number',
  'Order Type / Marketplace',
  'Marketplace ID',
  'Invoice Number',
  'Invoice Amount (₹)',
  'Order Date',
  'Expected Delivery Date',
  'Payment Mode',
  'Payment Gateway',
  'Payment Transaction No',
  'Shipping Cost (₹)',
  'Discount (₹)',
  'Wallet Discount (₹)',
  'Promo Code Discount (₹)',
  'Prepaid Discount (₹)',
  'Total Base Amount (₹)',
  'Total Tax Amount (₹)',
  'Sub-order No',
  'QC Pass Date',
  'Shipping Method',
  'Is Market Shipped',
  'Remarks 1',
  'Remarks 2',
  'Package Weight (g)',
  'Item Count',
  'Items Summary',
  // Billing
  'Billing Name',
  'Billing Contact',
  'Billing Email',
  'Billing City',
  'Billing State',
  'Billing Postal',
  'Billing Address',
  'Billing GST',
  // Shipping
  'Shipping Name',
  'Shipping Contact',
  'Shipping Email',
  'Shipping City',
  'Shipping State',
  'Shipping Postal',
  'Shipping Address',
  'Shipping Latitude',
  'Shipping Longitude',
  // Meta
  'API Status',
  'API Response',
];

// ─── CORS HEADERS ─────────────────────────────────────────────────────────────
function setCorsHeaders(output) {
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── HANDLE GET REQUESTS ───────────────────────────────────────────────────────
function doGet(e) {
  var action = e.parameter.action || 'getOrders';

  try {
    if (action === 'getOrders') {
      return setCorsHeaders(ContentService
        .createTextOutput(JSON.stringify(getOrders()))
        .setMimeType(ContentService.MimeType.JSON));
    }

    if (action === 'getSettings') {
      return setCorsHeaders(ContentService
        .createTextOutput(JSON.stringify(getSettings()))
        .setMimeType(ContentService.MimeType.JSON));
    }

    if (action === 'setup') {
      setupSheets();
      return setCorsHeaders(ContentService
        .createTextOutput(JSON.stringify({ success: true, message: 'Sheets setup complete.' }))
        .setMimeType(ContentService.MimeType.JSON));
    }

    return setCorsHeaders(ContentService
      .createTextOutput(JSON.stringify({ error: 'Unknown action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON));

  } catch (err) {
    return setCorsHeaders(ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON));
  }
}

// ─── HANDLE POST REQUESTS ──────────────────────────────────────────────────────
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || 'createOrder';

    if (action === 'createOrder') {
      var result = appendOrder(body.data);
      return setCorsHeaders(ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON));
    }

    if (action === 'updateOrder') {
      var result = updateOrder(body.orderNumber, body.data);
      return setCorsHeaders(ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON));
    }

    return setCorsHeaders(ContentService
      .createTextOutput(JSON.stringify({ error: 'Unknown action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON));

  } catch (err) {
    return setCorsHeaders(ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON));
  }
}

// ─── SETUP SHEETS ─────────────────────────────────────────────────────────────
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Orders Sheet
  var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
  if (!ordersSheet) {
    ordersSheet = ss.insertSheet(ORDERS_SHEET);
  }

  // Set headers if empty
  if (ordersSheet.getLastRow() === 0) {
    var headerRange = ordersSheet.getRange(1, 1, 1, ORDER_HEADERS.length);
    headerRange.setValues([ORDER_HEADERS]);
    headerRange.setBackground('#1F4E79');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setFontSize(11);
    ordersSheet.setFrozenRows(1);
    ordersSheet.setColumnWidth(1, 160);   // Timestamp
    ordersSheet.setColumnWidth(2, 180);   // Order Number
    ordersSheet.setColumnWidth(3, 160);   // Marketplace
    ordersSheet.setColumnWidth(7, 160);   // Order Date
    ordersSheet.setColumnWidth(27, 250);  // Items Summary
    ordersSheet.setColumnWidth(33, 200);  // Billing Address
    ordersSheet.setColumnWidth(42, 200);  // Shipping Address
    ordersSheet.setColumnWidth(46, 300);  // API Response
  }

  // Settings Sheet
  var settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SETTINGS_SHEET);
    settingsSheet.getRange('A1').setValue('Setting');
    settingsSheet.getRange('B1').setValue('Value');
    settingsSheet.getRange('A1:B1').setBackground('#1F4E79').setFontColor('#FFFFFF').setFontWeight('bold');
    settingsSheet.getRange('A2').setValue('EasyEcom API Key');
    settingsSheet.getRange('B2').setValue('YOUR_API_KEY_HERE');
    settingsSheet.getRange('A3').setValue('Created');
    settingsSheet.getRange('B3').setValue(new Date().toISOString());
  }

  Logger.log('Sheets setup complete.');
}

// ─── APPEND ORDER ROW ─────────────────────────────────────────────────────────
function appendOrder(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ORDERS_SHEET);

  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName(ORDERS_SHEET);
  }

  var row = [
    data.timestamp        || new Date().toISOString(),
    data.orderNumber      || '',
    data.orderType        || '',
    data.marketplaceId    || '',
    data.invoiceNumber    || '',
    data.invoiceAmount    || '',
    data.orderDate        || '',
    data.expDeliveryDate  || '',
    data.paymentMode      || '',
    data.paymentGateway   || '',
    data.paymentTransactionNumber || '',
    data.shippingCost     || 0,
    data.discount         || 0,
    data.walletDiscount   || 0,
    data.promoCodeDiscount || 0,
    data.prepaidDiscount  || 0,
    data.totalBaseAmount  || '',
    data.totalTaxAmount   || '',
    data.suborderNo       || '',
    data.qcPassDate       || '',
    data.shippingMethod   || '',
    data.isMarketShipped  || '',
    data.remarks1         || '',
    data.remarks2         || '',
    data.packageWeight    || '',
    data.itemCount        || 0,
    data.itemsSummary     || '',
    // Billing
    data.billingName      || '',
    data.billingContact   || '',
    data.billingEmail     || '',
    data.billingCity      || '',
    data.billingState     || '',
    data.billingPostal    || '',
    data.billingAddress   || '',
    data.billingGst       || '',
    // Shipping
    data.shippingName     || '',
    data.shippingContact  || '',
    data.shippingEmail    || '',
    data.shippingCity     || '',
    data.shippingState    || '',
    data.shippingPostal   || '',
    data.shippingAddress  || '',
    data.shippingLat      || '',
    data.shippingLng      || '',
    // Meta
    data.apiStatus        || 'submitted',
    data.apiResponse      || '',
  ];

  sheet.appendRow(row);

  // Style the new row
  var lastRow = sheet.getLastRow();
  var rowRange = sheet.getRange(lastRow, 1, 1, ORDER_HEADERS.length);
  if (lastRow % 2 === 0) {
    rowRange.setBackground('#F0F7FF');
  }

  // Color API status cell
  var statusCell = sheet.getRange(lastRow, 45);
  if (data.apiStatus === 'error') {
    statusCell.setBackground('#FEE2E2').setFontColor('#DC2626');
  } else {
    statusCell.setBackground('#D1FAE5').setFontColor('#065F46');
  }

  Logger.log('Order saved: ' + data.orderNumber);
  return { success: true, row: lastRow, orderNumber: data.orderNumber };
}

// ─── GET ALL ORDERS ───────────────────────────────────────────────────────────
function getOrders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ORDERS_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return { orders: [] };

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, ORDER_HEADERS.length).getValues();

  var orders = data.map(function(row) {
    return {
      timestamp:               row[0]  ? new Date(row[0]).toISOString() : '',
      orderNumber:             row[1]  || '',
      orderType:               row[2]  || '',
      marketplaceId:           row[3]  || '',
      invoiceNumber:           row[4]  || '',
      invoiceAmount:           row[5]  || '',
      orderDate:               row[6]  ? new Date(row[6]).toISOString() : '',
      expDeliveryDate:         row[7]  ? new Date(row[7]).toISOString() : '',
      paymentMode:             row[8]  || '',
      paymentGateway:          row[9]  || '',
      paymentTransactionNumber:row[10] || '',
      shippingCost:            row[11] || 0,
      discount:                row[12] || 0,
      walletDiscount:          row[13] || 0,
      promoCodeDiscount:       row[14] || 0,
      prepaidDiscount:         row[15] || 0,
      totalBaseAmount:         row[16] || '',
      totalTaxAmount:          row[17] || '',
      suborderNo:              row[18] || '',
      qcPassDate:              row[19] ? new Date(row[19]).toISOString() : '',
      shippingMethod:          row[20] || '',
      isMarketShipped:         row[21] || '',
      remarks1:                row[22] || '',
      remarks2:                row[23] || '',
      packageWeight:           row[24] || '',
      itemCount:               row[25] || 0,
      itemsSummary:            row[26] || '',
      billingName:             row[27] || '',
      billingContact:          row[28] || '',
      billingEmail:            row[29] || '',
      billingCity:             row[30] || '',
      billingState:            row[31] || '',
      billingPostal:           row[32] || '',
      billingAddress:          row[33] || '',
      billingGst:              row[34] || '',
      shippingName:            row[35] || '',
      shippingContact:         row[36] || '',
      shippingEmail:           row[37] || '',
      shippingCity:            row[38] || '',
      shippingState:           row[39] || '',
      shippingPostal:          row[40] || '',
      shippingAddress:         row[41] || '',
      shippingLat:             row[42] || '',
      shippingLng:             row[43] || '',
      apiStatus:               row[44] || '',
      apiResponse:             row[45] || '',
    };
  }).filter(function(o) { return o.orderNumber; });

  // Return newest first
  orders.reverse();
  return { orders: orders };
}

// ─── UPDATE ORDER ─────────────────────────────────────────────────────────────
function updateOrder(orderNumber, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ORDERS_SHEET);
  if (!sheet) return { success: false, message: 'Orders sheet not found' };

  var col2 = sheet.getRange(1, 2, sheet.getLastRow(), 1).getValues();
  var rowIndex = -1;
  for (var i = 1; i < col2.length; i++) {
    if (col2[i][0] == orderNumber) { rowIndex = i + 1; break; }
  }

  if (rowIndex === -1) return { success: false, message: 'Order not found: ' + orderNumber };

  // Update specific fields
  if (data.apiStatus) sheet.getRange(rowIndex, 45).setValue(data.apiStatus);
  if (data.apiResponse) sheet.getRange(rowIndex, 46).setValue(data.apiResponse);

  Logger.log('Order updated: ' + orderNumber + ' at row ' + rowIndex);
  return { success: true, row: rowIndex };
}

// ─── GET SETTINGS ─────────────────────────────────────────────────────────────
function getSettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) return { settings: {} };

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var settings = {};
  data.forEach(function(row) {
    if (row[0]) settings[row[0]] = row[1];
  });
  return { settings: settings };
}

// ─── RUN ONCE TO INITIALIZE ───────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TSC EasyEcom')
    .addItem('Setup Sheets', 'setupSheets')
    .addToUi();
}
