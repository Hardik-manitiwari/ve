import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import {
  setupTestDB,
  teardownTestDB,
  clearCollections,
  createTestUser,
} from './testHelper.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { WalletTransaction } from '../src/models/WalletTransaction.js';
import { PayoutOption } from '../src/models/PayoutOption.js';
import { creditWallet, debitWallet, getWallet } from '../src/services/walletService.js';
import { reconcileUserWallet } from '../src/services/reconciliationService.js';

describe('Admin Security & Management Endpoints - Test Suite', () => {
  before(async () => {
    await setupTestDB();
  });

  after(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  // 1. Unauthenticated request to each /api/admin/* route returns 401
  it('1. Unauthenticated request to each /api/admin/* route returns 401', async () => {
    const adminRoutes = [
      { method: 'get', path: '/api/admin/summary' },
      { method: 'get', path: '/api/admin/stats' },
      { method: 'get', path: '/api/admin/users' },
      { method: 'get', path: '/api/admin/users/6530a0000000000000000001' },
      { method: 'get', path: '/api/admin/withdrawals' },
      { method: 'post', path: '/api/admin/withdrawals/some_id/review', body: { status: 'APPROVED' } },
      { method: 'get', path: '/api/admin/reconcile/6530a0000000000000000001' },
      { method: 'get', path: '/api/admin/payout-options' },
      { method: 'patch', path: '/api/admin/payout-options/upi_10', body: { active: false } },
      { method: 'get', path: '/api/admin/ledger' },
      { method: 'get', path: '/api/admin/audit' },
      { method: 'post', path: '/api/admin/credit', body: { userId: '123', amount: 100, reason: 'test' } },
      { method: 'post', path: '/api/admin/debit', body: { userId: '123', amount: 100, reason: 'test' } },
    ];

    for (const r of adminRoutes) {
      const res = await request(app)[r.method](r.path).send(r.body || {});
      assert.equal(
        res.status,
        401,
        `Expected 401 for unauthenticated ${r.method.toUpperCase()} ${r.path}, got ${res.status}`
      );
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'UNAUTHORIZED');
    }
  });

  // 2. A user token on each /api/admin/* route returns 403
  it('2. A user token on each /api/admin/* route returns 403', async () => {
    const { authHeader } = await createTestUser({ role: 'user' });

    const adminRoutes = [
      { method: 'get', path: '/api/admin/summary' },
      { method: 'get', path: '/api/admin/stats' },
      { method: 'get', path: '/api/admin/users' },
      { method: 'get', path: '/api/admin/users/6530a0000000000000000001' },
      { method: 'get', path: '/api/admin/withdrawals' },
      { method: 'post', path: '/api/admin/withdrawals/some_id/review', body: { status: 'APPROVED' } },
      { method: 'get', path: '/api/admin/reconcile/6530a0000000000000000001' },
      { method: 'get', path: '/api/admin/payout-options' },
      { method: 'patch', path: '/api/admin/payout-options/upi_10', body: { active: false } },
      { method: 'get', path: '/api/admin/ledger' },
      { method: 'get', path: '/api/admin/audit' },
      { method: 'post', path: '/api/admin/credit', body: { userId: '123', amount: 100, reason: 'test' } },
      { method: 'post', path: '/api/admin/debit', body: { userId: '123', amount: 100, reason: 'test' } },
    ];

    for (const r of adminRoutes) {
      const res = await request(app)[r.method](r.path)
        .set('Authorization', authHeader)
        .send(r.body || {});
      assert.equal(
        res.status,
        403,
        `Expected 403 for user role on ${r.method.toUpperCase()} ${r.path}, got ${res.status}`
      );
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'FORBIDDEN');
    }
  });

  // 3. Registration with role: "admin" in the body creates a user with role user
  it('3. Registration with role: "admin" in the body creates a user with role user', async () => {
    const email = `test_reg_admin_${Date.now()}@veloop.test`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Password123!',
        role: 'admin',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.role, 'user', 'Role must remain user regardless of body');

    // Confirm by logging in with the newly created user and checking /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.data.token}`);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.user.role, 'user');
  });

  // 4. No response includes passwordHash
  it('4. No response includes passwordHash or plain password', async () => {
    const adminObj = await createTestUser({ role: 'admin' });
    const userObj = await createTestUser({ role: 'user' });

    // Check register response
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: `pwtest_${Date.now()}@veloop.test`, password: 'Password123!' });
    assert.equal(regRes.body.data.user.passwordHash, undefined);
    assert.equal(regRes.body.data.user.password, undefined);

    // Check login response
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: userObj.user.email, password: 'Password123!' });
    assert.equal(loginRes.body.data.user.passwordHash, undefined);
    assert.equal(loginRes.body.data.user.password, undefined);

    // Check /api/auth/me response
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', userObj.authHeader);
    assert.equal(meRes.body.data.user.passwordHash, undefined);
    assert.equal(meRes.body.data.user.password, undefined);

    // Check /api/admin/users response
    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', adminObj.authHeader);
    assert.equal(listRes.status, 200);
    for (const u of listRes.body.data) {
      assert.equal(u.passwordHash, undefined);
      assert.equal(u.password, undefined);
    }

    // Check /api/admin/users/:userId response
    const detailRes = await request(app)
      .get(`/api/admin/users/${userObj.user._id}`)
      .set('Authorization', adminObj.authHeader);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.data.user.passwordHash, undefined);
    assert.equal(detailRes.body.data.user.password, undefined);
  });

  // 5. Rejection without a reason returns 400
  it('5. Rejection without a reason returns 400', async () => {
    const adminObj = await createTestUser({ role: 'admin' });
    const userObj = await createTestUser({ role: 'user' });

    await creditWallet({
      userId: userObj.user._id,
      currency: 'VEs',
      amount: 10000,
      category: 'BONUS',
    });

    const createRes = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', userObj.authHeader)
      .set('Idempotency-Key', 'reject-test-key-no-reason-1')
      .send({
        optionId: 'upi_10',
        payoutDetails: { upiId: 'user@okaxis' },
      });
    assert.equal(createRes.status, 201);
    const withdrawalId = createRes.body.data.withdrawalId;

    // Reject without reviewNotes
    const resNoNotes = await request(app)
      .post(`/api/admin/withdrawals/${withdrawalId}/review`)
      .set('Authorization', adminObj.authHeader)
      .send({ status: 'REJECTED' });

    assert.equal(resNoNotes.status, 400);
    assert.equal(resNoNotes.body.success, false);
    assert.equal(resNoNotes.body.code, 'VALIDATION_ERROR');

    // Reject with empty/whitespace reviewNotes
    const resEmptyNotes = await request(app)
      .post(`/api/admin/withdrawals/${withdrawalId}/review`)
      .set('Authorization', adminObj.authHeader)
      .send({ status: 'REJECTED', reviewNotes: '   ' });

    assert.equal(resEmptyNotes.status, 400);
    assert.equal(resEmptyNotes.body.success, false);
    assert.equal(resEmptyNotes.body.code, 'VALIDATION_ERROR');

    // Also test admin credit without reason returns 400
    const creditNoReason = await request(app)
      .post('/api/admin/credit')
      .set('Authorization', adminObj.authHeader)
      .send({ userId: userObj.user._id, amount: 100 });
    assert.equal(creditNoReason.status, 400);

    // Also test admin debit without reason returns 400
    const debitNoReason = await request(app)
      .post('/api/admin/debit')
      .set('Authorization', adminObj.authHeader)
      .send({ userId: userObj.user._id, amount: 100 });
    assert.equal(debitNoReason.status, 400);
  });

  // 6. Credit with correction: true writes a BALANCE_CORRECTION audit row and a CORRECTION ledger row
  it('6. Credit with correction: true writes a BALANCE_CORRECTION audit row and a CORRECTION ledger row', async () => {
    const adminObj = await createTestUser({ role: 'admin' });
    const userObj = await createTestUser({ role: 'user' });

    const creditRes = await request(app)
      .post('/api/wallet/credit')
      .set('Authorization', adminObj.authHeader)
      .send({
        userId: userObj.user._id,
        currency: 'VEs',
        amount: 2500,
        reason: 'Adjusting discrepancy from failed job',
        correction: true,
      });

    assert.equal(creditRes.status, 200);
    assert.equal(creditRes.body.success, true);

    // Verify ledger row has category 'CORRECTION'
    const ledgerRow = await WalletTransaction.findOne({
      userId: userObj.user._id,
      amount: 2500,
      type: 'CREDIT',
    });
    assert.ok(ledgerRow, 'Ledger transaction must exist');
    assert.equal(ledgerRow.category, 'CORRECTION');

    // Verify audit log row has action 'BALANCE_CORRECTION'
    const auditRow = await AuditLog.findOne({
      targetUserId: userObj.user._id,
      action: 'BALANCE_CORRECTION',
    });
    assert.ok(auditRow, 'Audit log row with action BALANCE_CORRECTION must exist');
    assert.equal(auditRow.actorId.toString(), adminObj.user._id.toString());

    // Also verify normal credit without correction: true uses WALLET_CREDIT and ADMIN_CREDIT
    const normalCreditRes = await request(app)
      .post('/api/wallet/credit')
      .set('Authorization', adminObj.authHeader)
      .send({
        userId: userObj.user._id,
        currency: 'VEs',
        amount: 1000,
        reason: 'Regular loyalty bonus grant',
      });
    assert.equal(normalCreditRes.status, 200);

    const normalLedger = await WalletTransaction.findOne({
      userId: userObj.user._id,
      amount: 1000,
      type: 'CREDIT',
    });
    assert.equal(normalLedger.category, 'ADMIN_CREDIT');

    const normalAudit = await AuditLog.findOne({
      targetUserId: userObj.user._id,
      action: 'WALLET_CREDIT',
    });
    assert.ok(normalAudit);
  });

  // 7. Reconciliation returns matches: true after a mix of credits, debits, reversals and admin adjustments
  it('7. Reconciliation returns matches: true after a mix of credits, debits, reversals and admin adjustments', async () => {
    const adminObj = await createTestUser({ role: 'admin' });
    const userObj = await createTestUser({ role: 'user' });

    // Step 1: Admin credit (+15000 VEs)
    await request(app)
      .post('/api/admin/credit')
      .set('Authorization', adminObj.authHeader)
      .send({ userId: userObj.user._id, currency: 'VEs', amount: 15000, reason: 'Initial load' });

    // Step 2: Withdrawal submit (-2400 VEs)
    const w1 = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', userObj.authHeader)
      .set('Idempotency-Key', 'recon-mix-w1-key-0001')
      .send({ optionId: 'upi_10', payoutDetails: { upiId: 'mix1@okaxis' } });
    assert.equal(w1.status, 201);

    // Step 3: Admin rejects w1 (+2400 reversal)
    await request(app)
      .post(`/api/admin/withdrawals/${w1.body.data.withdrawalId}/review`)
      .set('Authorization', adminObj.authHeader)
      .send({ status: 'REJECTED', reviewNotes: 'Invalid account number' });

    // Step 4: Admin correction debit (-1000 VEs)
    await request(app)
      .post('/api/admin/debit')
      .set('Authorization', adminObj.authHeader)
      .send({ userId: userObj.user._id, currency: 'VEs', amount: 1000, reason: 'Correction deduction', correction: true });

    // Step 5: SVEs credit (+5000 SVEs)
    await creditWallet({
      userId: userObj.user._id,
      currency: 'SVEs',
      amount: 5000,
      category: 'BONUS',
    });

    // Step 6: Gems credit (+100 Gems) and debit (-30 Gems)
    await creditWallet({
      userId: userObj.user._id,
      currency: 'Gems',
      amount: 100,
      category: 'BONUS',
    });
    await debitWallet({
      userId: userObj.user._id,
      currency: 'Gems',
      amount: 30,
      category: 'WITHDRAWAL',
    });

    // Query reconciliation endpoint
    const reconRes = await request(app)
      .get(`/api/admin/reconcile/${userObj.user._id}`)
      .set('Authorization', adminObj.authHeader);

    assert.equal(reconRes.status, 200);
    assert.equal(reconRes.body.success, true);
    assert.equal(reconRes.body.data.matches, true, 'Overall reconciliation matches must be true');

    for (const currency of ['VEs', 'SVEs', 'Gems', 'Tokens', 'Spins']) {
      const c = reconRes.body.data.perCurrency[currency];
      assert.equal(c.matches, true, `Currency ${currency} matches must be true`);
      assert.equal(c.computedBalance, c.storedBalance, `Currency ${currency} computed matches stored`);
      assert.equal(c.difference, 0);
    }
  });

  // 8. PATCH on payout options writes a PAYOUT_CONFIG_CHANGED audit row with before and after values
  it('8. PATCH on payout options writes a PAYOUT_CONFIG_CHANGED audit row with before and after values', async () => {
    const adminObj = await createTestUser({ role: 'admin' });

    // Option upi_10 has requiredAmount: 2400, payoutValue: 10
    const patchRes = await request(app)
      .patch('/api/admin/payout-options/upi_10')
      .set('Authorization', adminObj.authHeader)
      .send({
        requiredAmount: 2500,
        sortOrder: 5,
        active: true,
      });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.success, true);
    assert.equal(patchRes.body.data.requiredAmount, 2500);

    const auditRow = await AuditLog.findOne({
      action: 'PAYOUT_CONFIG_CHANGED',
      referenceId: 'upi_10',
    });

    assert.ok(auditRow, 'PAYOUT_CONFIG_CHANGED audit row must exist');
    assert.equal(auditRow.actorId.toString(), adminObj.user._id.toString());
    assert.ok(auditRow.metadata.before, 'Before snapshot must exist');
    assert.ok(auditRow.metadata.after, 'After snapshot must exist');
    assert.equal(auditRow.metadata.before.requiredAmount, 2400);
    assert.equal(auditRow.metadata.after.requiredAmount, 2500);
  });

  // 9. PATCH with optionId, method or currency in the body is rejected
  it('9. PATCH with optionId, method or currency in the body is rejected', async () => {
    const adminObj = await createTestUser({ role: 'admin' });

    // Try changing optionId
    const res1 = await request(app)
      .patch('/api/admin/payout-options/upi_10')
      .set('Authorization', adminObj.authHeader)
      .send({ optionId: 'upi_new_id' });
    assert.equal(res1.status, 400);
    assert.equal(res1.body.code, 'VALIDATION_ERROR');

    // Try changing method
    const res2 = await request(app)
      .patch('/api/admin/payout-options/upi_10')
      .set('Authorization', adminObj.authHeader)
      .send({ method: 'PAYPAL' });
    assert.equal(res2.status, 400);
    assert.equal(res2.body.code, 'VALIDATION_ERROR');

    // Try changing currency
    const res3 = await request(app)
      .patch('/api/admin/payout-options/upi_10')
      .set('Authorization', adminObj.authHeader)
      .send({ currency: 'USD' });
    assert.equal(res3.status, 400);
    assert.equal(res3.body.code, 'VALIDATION_ERROR');
  });
});
