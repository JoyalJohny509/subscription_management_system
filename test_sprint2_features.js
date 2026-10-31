const http = require('http');

function apiCall(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: '/api' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        let parsed = null;
        if (contentType.includes('application/json')) {
          try { parsed = JSON.parse(raw.toString()); } catch (e) { parsed = raw.toString(); }
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
          raw: raw
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runVerification() {
  console.log('===========================================================');
  console.log('🧪 COMPREHENSIVE VERIFICATION OF SPRINT 1 & 2 FEATURES');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. Authenticate Customer & Admin
    // -------------------------------------------------------------
    console.log('1. Authenticating test users...');
    const custAuth = await apiCall('POST', '/auth/login', {
      email: 'ravi@acmecorp.com',
      password: 'Customer@1234'
    });
    assert(custAuth.status === 200 && custAuth.data.data?.token, 'Customer login succeeded');
    const custToken = custAuth.data.data?.token;

    const adminAuth = await apiCall('POST', '/auth/login', {
      email: 'admin@brightloop.com',
      password: 'Admin@1234'
    });
    assert(adminAuth.status === 200 && adminAuth.data.data?.token, 'Admin login succeeded');
    const adminToken = adminAuth.data.data?.token;

    // -------------------------------------------------------------
    // 2. Test Customer Active Subscription
    // -------------------------------------------------------------
    console.log('\n2. Testing Customer Subscriptions Retrieval...');
    const custSubs = await apiCall('GET', '/subscriptions', null, custToken);
    assert(custSubs.status === 200, 'Customer can view own subscriptions');
    const subList = custSubs.data.data || [];
    assert(subList.length > 0, `Customer has ${subList.length} subscriptions`);
    const activeSub = subList.find(s => s.status === 'active') || subList[0];
    console.log(`     Target active subscription: ID ${activeSub.id} (${activeSub.sub_number}), Plan: ${activeSub.plan_name}`);

    // -------------------------------------------------------------
    // 3. Test Live Prorated Seat Upgrade (Member 1 Engine + Member 2 UI API)
    // -------------------------------------------------------------
    console.log('\n3. Testing Live Prorated Seat Upgrade API...');
    const currentSubData = await apiCall('GET', `/subscriptions/${activeSub.id}`, null, custToken);
    const currentLine = currentSubData.data.data?.lines?.[0];
    const currentQty = currentLine?.qty || 5;
    const targetSeats = currentQty >= 20 ? 5 : currentQty + 2;
    console.log(`     Upgrading seats from ${currentQty} to ${targetSeats}...`);

    const upgradeRes = await apiCall('POST', `/subscriptions/${activeSub.id}/upgrade-seats`, {
      new_qty: targetSeats,
      effective_date: new Date().toISOString().slice(0, 10)
    }, custToken);

    assert(upgradeRes.status === 200, `Seat upgrade API responded with 200 (changed ${currentQty} -> ${targetSeats})`);
    assert(upgradeRes.data.data?.new_qty === targetSeats, `Quantity updated to ${targetSeats} seats`);
    const proratedInvId = upgradeRes.data.data?.invoice?.id;
    const proratedAmount = upgradeRes.data.data?.invoice?.grand_total;
    assert(proratedInvId !== undefined, `Prorated invoice auto-generated: Invoice ID #${proratedInvId} (Amount: ₹${proratedAmount})`);

    // Verify customer's subscription lines show updated seats
    const checkSub = await apiCall('GET', `/subscriptions/${activeSub.id}`, null, custToken);
    const updatedLine = checkSub.data.data?.lines?.[0];
    assert(updatedLine?.qty === targetSeats, `Database confirmed seat quantity is now ${updatedLine?.qty}`);

    // -------------------------------------------------------------
    // 4. Test Official PDF Generation (Member 3 Engine + Member 2 Download)
    // -------------------------------------------------------------
    console.log('\n4. Testing Official Branded PDF Invoice Generation...');
    const pdfRes = await apiCall('GET', `/invoices/${proratedInvId}/pdf`, null, custToken);
    assert(pdfRes.status === 200, 'PDF endpoint responded with HTTP 200');
    assert(pdfRes.headers['content-type'] === 'application/pdf', `Content-Type is application/pdf`);
    const isRealPdf = pdfRes.raw.slice(0, 5).toString() === '%PDF-';
    assert(isRealPdf, `PDF magic bytes validated (%PDF-1.3 / %PDF-1.4 stream) - Size: ${pdfRes.raw.length} bytes`);

    // -------------------------------------------------------------
    // 5. Test Dynamic UPI QR Code Generation (Member 3 Engine + Member 2 Modal)
    // -------------------------------------------------------------
    console.log('\n5. Testing Dynamic UPI QR Code Generation...');
    const upiRes = await apiCall('GET', `/payments/${proratedInvId}/upi-qr`, null, custToken);
    assert(upiRes.status === 200, 'UPI QR endpoint responded with HTTP 200');
    const qrData = upiRes.data.data;
    const qrImg = qrData?.qr_code || qrData?.qrCodeDataUrl;
    const upiLink = qrData?.upi_uri || qrData?.upiUri;
    assert(qrImg?.startsWith('data:image/png;base64,'), 'QR code is valid base64 PNG data URL');
    assert(upiLink?.startsWith('upi://pay?'), `UPI URI string valid: ${upiLink}`);
    assert(Number(qrData?.amount) === Number(proratedAmount), `QR code encoded amount matches invoice due: ₹${qrData?.amount}`);

    // -------------------------------------------------------------
    // 6. Test Instant UPI Payment Settlement via Webhook Simulation
    // -------------------------------------------------------------
    console.log('\n6. Testing Instant Payment Settlement via Webhook...');
    const txnId = 'UPI-TEST-' + Date.now();
    const webhookRes = await apiCall('POST', '/payments/webhook', {
      invoice_id: proratedInvId,
      amount: proratedAmount,
      method: 'upi',
      transaction_id: txnId,
      status: 'completed'
    }, adminToken);
    assert(webhookRes.status === 200, 'Payment webhook simulated successfully');

    // Verify invoice marked paid
    const paidInvCheck = await apiCall('GET', `/invoices/${proratedInvId}`, null, custToken);
    assert(paidInvCheck.data.data?.status === 'paid', `Invoice status automatically transitioned to "${paidInvCheck.data.data?.status}"`);

    // -------------------------------------------------------------
    // 7. Test Automated Billing Cron Trigger (Admin Dashboard Action)
    // -------------------------------------------------------------
    console.log('\n7. Testing Auto-Billing Cron Trigger from Dashboard...');
    const cronRes = await apiCall('POST', '/subscriptions/trigger-billing-cron', {}, adminToken);
    assert(cronRes.status === 200, 'Trigger billing cron endpoint responded with HTTP 200');
    assert(cronRes.data.message?.includes('executed successfully'), 'Cron job executed and returned summary');

    // -------------------------------------------------------------
    // 8. Test Renewal Notification Dispatch (Admin Dashboard Action)
    // -------------------------------------------------------------
    console.log('\n8. Testing Automated Renewal Alerts Dispatch...');
    const alertRes = await apiCall('POST', '/notifications/renewal-reminder', { days_before: 14 }, adminToken);
    assert(alertRes.status === 200, 'Renewal reminder notification endpoint responded with HTTP 200');

    // -------------------------------------------------------------
    // 9. Test Executive Dashboard Summary & Financial Metrics
    // -------------------------------------------------------------
    console.log('\n9. Testing Executive Dashboard Metrics (MRR, ARR, Collections)...');
    const dashRes = await apiCall('GET', '/dashboard/summary', null, adminToken);
    assert(dashRes.status === 200, 'Dashboard summary endpoint responded with HTTP 200');
    const metrics = dashRes.data.data;
    assert(typeof metrics.total_revenue === 'number', `Total revenue is numeric: ₹${metrics.total_revenue}`);
    assert(typeof metrics.outstanding === 'number', `Outstanding receivables is numeric: ₹${metrics.outstanding}`);
    assert(Array.isArray(metrics.monthly_revenue), `Monthly revenue trend array present (${metrics.monthly_revenue.length} months)`);
    assert(Array.isArray(metrics.recent_invoices), `Recent invoices array present (${metrics.recent_invoices.length} invoices)`);

    // -------------------------------------------------------------
    // 10. Role-Based Access Security Test (RBAC)
    // -------------------------------------------------------------
    console.log('\n10. Testing Security & Role-Based Access Control...');
    const forbiddenAdminCall = await apiCall('GET', '/users', null, custToken);
    assert(forbiddenAdminCall.status === 403, 'Customer correctly forbidden (HTTP 403) from accessing admin users API');

    console.log('\n===========================================================');
    console.log(`📊 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unexpected error during verification:', err);
    process.exit(1);
  }
}

runVerification();
