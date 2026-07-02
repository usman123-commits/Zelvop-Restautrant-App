/**
 * Phase 4 Test Suite: Profile Update + Stats API
 * Run from backend directory: node test_phase4.js
 */
const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const BASE = 'http://localhost:5000/api/v1';
const results = [];

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: {} });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function test(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? '[OK]' : '[FAIL]'} ${name}${detail ? ' -- ' + detail : ''}`);
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

async function run() {
  section('Setup');
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.db.dropDatabase();
  console.log('  DB dropped');
  await mongoose.disconnect();
  await new Promise((r) => setTimeout(r, 2000));

  // Create owner
  let r = await request('POST', '/auth/signup', {
    name: 'Otto', email: 'otto@test.com', password: 'test123', role: 'owner',
  });
  const OWNER_TOKEN = r.data.token;
  console.log('  Owner created: Otto');

  // Create rider
  r = await request('POST', '/auth/signup', {
    name: 'Ali Khan', email: 'ali@test.com', password: 'test123',
    role: 'rider', contactNumber: '03001234567',
  });
  const RIDER_TOKEN = r.data.token;
  const RIDER_ID = r.data.user._id;
  console.log('  Rider created: Ali Khan');

  // Go online
  await request('PATCH', '/riders/me/status', { isOnline: true }, RIDER_TOKEN);

  // ---- Profile Update Tests ----
  section('Profile Update');

  // Update name
  r = await request('PATCH', '/auth/profile', { name: 'Ali Ahmed Khan' }, RIDER_TOKEN);
  test('T1: Update name', r.status === 200 && r.data.user.name === 'Ali Ahmed Khan',
    `name: ${r.data.user?.name}`);

  // Update phone
  r = await request('PATCH', '/auth/profile', { contactNumber: '03009876543' }, RIDER_TOKEN);
  test('T2: Update phone', r.status === 200 && r.data.user.contactNumber === '03009876543',
    `phone: ${r.data.user?.contactNumber}`);

  // Update email
  r = await request('PATCH', '/auth/profile', { email: 'ali.new@test.com' }, RIDER_TOKEN);
  test('T3: Update email', r.status === 200 && r.data.user.email === 'ali.new@test.com',
    `email: ${r.data.user?.email}`);

  // Duplicate email rejected
  r = await request('PATCH', '/auth/profile', { email: 'otto@test.com' }, RIDER_TOKEN);
  test('T4: Duplicate email rejected', r.status === 400 && r.data.error.includes('already'),
    r.data.error || '');

  // Empty update rejected
  r = await request('PATCH', '/auth/profile', {}, RIDER_TOKEN);
  test('T5: Empty update rejected', r.status === 400, r.data.error || '');

  // Unauthenticated rejected
  r = await request('PATCH', '/auth/profile', { name: 'Hacker' });
  test('T6: Unauthenticated rejected', r.status === 401);

  // ---- Rider Stats Tests ----
  section('Rider Stats');

  r = await request('GET', '/riders/me/stats', null, RIDER_TOKEN);
  test('T7: Stats endpoint works', r.status === 200,
    `deliveries: ${r.data.todayDeliveries}, rate: ${r.data.acceptanceRate}%`);
  test('T8: Zero deliveries initially', r.data.todayDeliveries === 0);
  test('T9: Acceptance rate default', r.data.acceptanceRate === 100);

  // Create and complete an order to verify stats update
  r = await request('POST', '/owner/orders', {
    customerName: 'Usman', customerPhone: '03001111111',
    deliveryAddress: 'DHA Phase 6', items: [{ name: 'Burger', quantity: 1, price: 500 }],
    paymentMethod: 'prepaid', source: 'dashboard',
  }, OWNER_TOKEN);
  const ORDER_ID = r.data.order._id;

  await request('PATCH', `/orders/${ORDER_ID}/accept`, null, RIDER_TOKEN);
  await request('PATCH', `/orders/${ORDER_ID}/pickup`, null, RIDER_TOKEN);
  await request('PATCH', `/orders/${ORDER_ID}/deliver`, {
    riderDeliveryNotes: 'Delivered to customer',
  }, RIDER_TOKEN);

  r = await request('GET', '/riders/me/stats', null, RIDER_TOKEN);
  test('T10: Deliveries count after delivery', r.data.todayDeliveries === 1,
    `deliveries: ${r.data.todayDeliveries}`);

  // ---- Profile persists after re-auth ----
  section('Profile Persistence');

  r = await request('GET', '/auth/me', null, RIDER_TOKEN);
  test('T11: Profile changes persist (name)', r.data.user.name === 'Ali Ahmed Khan');
  test('T12: Profile changes persist (email)', r.data.user.email === 'ali.new@test.com');
  test('T13: Profile changes persist (phone)', r.data.user.contactNumber === '03009876543');

  // ---- Summary ----
  console.log('\n' + '='.repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${results.length} tests`);
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  [FAIL] ${r.name}: ${r.detail}`));
  }
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
