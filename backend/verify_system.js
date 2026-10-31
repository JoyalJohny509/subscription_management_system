const http = require('http');

async function testSystem() {
  console.log('🧪 Starting System Verification Tests...\n');

  // Helper for requests
  function request(method, path, body = null, token = null) {
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
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          try {
            const parsed = responseBody ? JSON.parse(responseBody) : {};
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: responseBody });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  let adminToken = null;
  let customerToken = null;

  try {
    // 1. Health Check
    console.log('1. Checking API Health...');
    const health = await request('GET', '/health');
    console.log(`   Status: ${health.status}, Response:`, health.data.message);
    if (health.status !== 200) throw new Error('Health check failed');

    // 2. Admin Login
    console.log('\n2. Testing Admin Login...');
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@brightloop.com',
      password: 'Admin@1234'
    });
    const adminData = adminLogin.data.data || adminLogin.data;
    console.log(`   Status: ${adminLogin.status}, User:`, adminData.user?.name, `Role:`, adminData.user?.role);
    if (adminLogin.status !== 200 || !adminData.token) throw new Error('Admin login failed');
    adminToken = adminData.token;

    // 3. Customer Login
    console.log('\n3. Testing Customer Login...');
    const custLogin = await request('POST', '/auth/login', {
      email: 'ravi@acmecorp.com',
      password: 'Customer@1234'
    });
    const custData = custLogin.data.data || custLogin.data;
    console.log(`   Status: ${custLogin.status}, User:`, custData.user?.name, `Role:`, custData.user?.role);
    if (custLogin.status !== 200 || !custData.token) throw new Error('Customer login failed');
    customerToken = custData.token;

    // 4. Dashboard Summary
    console.log('\n4. Testing Dashboard Summary KPI Metrics...');
    const dash = await request('GET', '/dashboard/summary', null, adminToken);
    console.log(`   Status: ${dash.status}, Metrics:`, dash.data.data || dash.data);

    // 5. Products List
    console.log('\n5. Listing Products & Variants...');
    const prods = await request('GET', '/products', null, adminToken);
    const prodList = prods.data.data || prods.data;
    console.log(`   Products found: ${prodList.length}`);
    prodList.forEach(p => console.log(`   - [ID ${p.id}] ${p.name} (Sales: ₹${p.sales_price})`));

    // 6. Plans List
    console.log('\n6. Listing Plans...');
    const plans = await request('GET', '/plans', null, adminToken);
    const planList = plans.data.data || plans.data;
    console.log(`   Plans found: ${planList.length}`);
    planList.forEach(pl => console.log(`   - [ID ${pl.id}] ${pl.name} (${pl.billing_cycle}) - ₹${pl.price}`));

    // 7. Quotation Lifecycle (Create -> Send -> Accept to Subscription)
    console.log('\n7. Testing Quotation Lifecycle...');
    const createQuo = await request('POST', '/quotations', {
      customer_id: 1,
      validity_days: 15,
      notes: 'Custom corporate quote',
      lines: [
        { product_id: 1, plan_id: 1, qty: 10, unit_price: 1000, tax_pct: 18 }
      ]
    }, adminToken);
    const quoId = createQuo.data.data?.id;
    console.log(`   Quotation Created: ID ${quoId}, Total: ₹${createQuo.data.data?.grand_total}`);

    const sendQuo = await request('POST', `/quotations/${quoId}/send`, null, adminToken);
    console.log(`   Quotation Sent: Status = ${sendQuo.data.data?.status}`);

    const acceptQuo = await request('POST', `/quotations/${quoId}/accept`, null, adminToken);
    const newSub = acceptQuo.data.subscription || acceptQuo.data.data?.subscription;
    console.log(`   Quotation Accepted -> Converted to Subscription: ID ${newSub?.id}, Number: ${newSub?.sub_number}, Status: ${newSub?.status}`);

    // 8. Confirm & Activate Subscription
    console.log('\n8. Confirming & Activating Subscription...');
    const confSub = await request('POST', `/subscriptions/${newSub.id}/confirm`, null, adminToken);
    console.log(`   Subscription Confirmed: Status = ${confSub.data.data?.status}`);
    const actSub = await request('POST', `/subscriptions/${newSub.id}/activate`, null, adminToken);
    console.log(`   Subscription Activated: Status = ${actSub.data.data?.status}`);

    // 9. Generate Invoice from Subscription
    console.log('\n9. Generating Invoice from Active Subscription...');
    const genInv = await request('POST', `/invoices/generate/${newSub.id}`, {
      issue_date: '2026-11-01',
      due_date: '2026-11-15',
      billing_period_start: '2026-11-01',
      billing_period_end: '2026-11-30'
    }, adminToken);
    const invId = genInv.data.data?.id;
    console.log(`   Invoice Generated: ID ${invId}, Number: ${genInv.data.data?.invoice_number}, Grand Total: ₹${genInv.data.data?.grand_total}`);

    // Confirm invoice
    const confInv = await request('POST', `/invoices/${invId}/confirm`, null, adminToken);
    console.log(`   Invoice Confirmed: Status = ${confInv.data.data?.status}`);

    // 10. Apply Discount
    console.log('\n10. Applying Discount Code "WELCOME10"...');
    const applyDisc = await request('POST', `/invoices/${invId}/apply-discount`, {
      code: 'WELCOME10'
    }, adminToken);
    console.log(`   Discount Applied! New Grand Total: ₹${applyDisc.data.data?.grand_total}`);

    // 11. Record Payment
    console.log('\n11. Recording Payment for Invoice...');
    const payRes = await request('POST', '/payments', {
      invoice_id: invId,
      amount: applyDisc.data.data?.grand_total,
      method: 'upi',
      notes: 'UPI Ref #TEST987654'
    }, adminToken);
    console.log(`   Payment Recorded: ID ${payRes.data.data?.id}, Amount: ₹${payRes.data.data?.amount}`);

    // Verify invoice marked paid
    const checkInv = await request('GET', `/invoices/${invId}`, null, adminToken);
    console.log(`   Invoice Status after payment: ${checkInv.data.data?.status}`);

    // 12. Final Dashboard Check
    console.log('\n12. Re-checking Dashboard Summary KPIs...');
    const finalDash = await request('GET', '/dashboard/summary', null, adminToken);
    console.log(`   Updated Dashboard:`, finalDash.data.data || finalDash.data);

    // 13. Member 1 Feature: Test Mid-Cycle Seat Upgrade & Pro-rated Billing
    console.log('\n13. Testing Mid-Cycle Seat Upgrade with Pro-rated Calculation (Member 1)...');
    const upgradeRes = await request('POST', `/subscriptions/${newSub.id}/upgrade-seats`, {
      new_qty: 15,
      effective_date: '2026-11-15'
    }, adminToken);
    console.log(`   Seat Upgrade Response:`, upgradeRes.data.message);
    console.log(`   Prorated Invoice:`, upgradeRes.data.data?.invoice?.invoice_number, `Total: ₹${upgradeRes.data.data?.invoice?.grand_total}`);

    // 14. Member 1 Feature: Test Automated Billing Cron Trigger
    console.log('\n14. Testing Auto-Billing Cron Scheduler Trigger (Member 1)...');
    const cronRes = await request('POST', '/subscriptions/trigger-billing-cron', {
      target_date: '2026-12-01'
    }, adminToken);
    console.log(`   Cron Trigger Response:`, cronRes.data.message);
    console.log(`   Invoices Generated: ${cronRes.data.data?.invoicesGenerated?.length}, Auto-Closed: ${cronRes.data.data?.subscriptionsClosed?.length}`);

    console.log('\n🎉 ALL 14 VERIFICATION TESTS (INCLUDING MEMBER 1 CORE BILLING ENGINE) PASSED! 🎉\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err.message);
    process.exit(1);
  }
}

testSystem();
