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
import { creditWallet, debitWallet, getWallet } from '../src/services/walletService.js';
import { reconcileUserWallet } from '../src/services/reconciliationService.js';
import { Wallet } from '../src/models/Wallet.js';
import { Withdrawal } from '../src/models/Withdrawal.js';
import { WalletTransaction } from '../src/models/WalletTransaction.js';

describe('VELoop Rewards Wallet & Payout System - Test Suite', () => {
  before(async () => {
    await setupTestDB();
  });

  after(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  // Scenario 1: Credit then credit (1000 + 500 = 1500)
  it('1. Credit then credit (1000 + 500 = 1500)', async () => {
    const { user } = await createTestUser();

    await creditWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 1000,
      category: 'BONUS',
      description: 'First credit',
    });

    let wallet = await getWallet(user._id);
    assert.equal(wallet.VEs, 1000);

    await creditWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 500,
      category: 'REWARD',
      description: 'Second credit',
    });

    wallet = await getWallet(user._id);
    assert.equal(wallet.VEs, 1500);

    // Verify ledger records
    const txs = await WalletTransaction.find({ userId: user._id }).sort({ createdAt: 1 });
    assert.equal(txs.length, 2);
    assert.equal(txs[0].balanceBefore, 0);
    assert.equal(txs[0].balanceAfter, 1000);
    assert.equal(txs[1].balanceBefore, 1000);
    assert.equal(txs[1].balanceAfter, 1500);
  });

  // Scenario 2: Debit (1500 - 1000 = 500)
  it('2. Debit (1500 - 1000 = 500)', async () => {
    const { user } = await createTestUser();

    await creditWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 1500,
      category: 'BONUS',
    });

    await debitWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 1000,
      category: 'WITHDRAWAL',
      description: 'Test debit',
    });

    const wallet = await getWallet(user._id);
    assert.equal(wallet.VEs, 500);

    const debitTx = await WalletTransaction.findOne({ userId: user._id, type: 'DEBIT' });
    assert.ok(debitTx);
    assert.equal(debitTx.balanceBefore, 1500);
    assert.equal(debitTx.balanceAfter, 500);
  });

  // Scenario 3: Insufficient balance rejected, balance unchanged
  it('3. Insufficient balance rejected, balance unchanged', async () => {
    const { user } = await createTestUser();

    await creditWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 500,
      category: 'BONUS',
    });

    await assert.rejects(
      async () => {
        await debitWallet({
          userId: user._id,
          currency: 'VEs',
          amount: 1000,
          category: 'WITHDRAWAL',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, 'INSUFFICIENT_BALANCE');
        assert.equal(err.message, 'Insufficient VEs balance.');
        return true;
      }
    );

    const wallet = await getWallet(user._id);
    assert.equal(wallet.VEs, 500);
  });

  // Scenario 4: Double-submit with the same Idempotency-Key creates one withdrawal and one debit
  it('4. Double-submit with the same Idempotency-Key creates one withdrawal and one debit', async () => {
    const { user, authHeader } = await createTestUser();

    await creditWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 10000,
      category: 'BONUS',
    });

    const idempotencyKey = 'idem-key-test-4-unique-9988';
    const payload = {
      optionId: 'upi_10', // requires 2400 VEs
      payoutDetails: { upiId: 'gamer@okaxis' },
    };

    // First submit
    const res1 = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', authHeader)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    assert.equal(res1.status, 201);
    assert.equal(res1.body.success, true);
    assert.equal(res1.body.duplicate, false);

    // Second submit with same key
    const res2 = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', authHeader)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    assert.equal(res2.status, 200);
    assert.equal(res2.body.success, true);
    assert.equal(res2.body.duplicate, true);
    assert.equal(res2.body.message, 'This withdrawal request has already been submitted.');

    // Assert only 1 withdrawal document in DB
    const withdrawals = await Withdrawal.find({ userId: user._id });
    assert.equal(withdrawals.length, 1);

    // Assert only 1 debit was made (10,000 - 2,400 = 7,600)
    const wallet = await getWallet(user._id);
    assert.equal(wallet.VEs, 7600);

    const debits = await WalletTransaction.find({ userId: user._id, type: 'DEBIT' });
    assert.equal(debits.length, 1);
  });

  // Scenario 5: Two concurrent debits of 8,000 on 10,000: exactly one succeeds
  it('5. Two concurrent debits of 8,000 on 10,000: exactly one succeeds', async () => {
    const { user } = await createTestUser();

    await creditWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 10000,
      category: 'BONUS',
    });

    const results = await Promise.allSettled([
      debitWallet({
        userId: user._id,
        currency: 'VEs',
        amount: 8000,
        category: 'WITHDRAWAL',
        referenceId: 'concurrent_1',
      }),
      debitWallet({
        userId: user._id,
        currency: 'VEs',
        amount: 8000,
        category: 'WITHDRAWAL',
        referenceId: 'concurrent_2',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Exactly one concurrent debit must succeed');
    assert.equal(rejected.length, 1, 'Exactly one concurrent debit must fail');
    assert.equal(rejected[0].reason.statusCode, 422);

    const wallet = await getWallet(user._id);
    assert.equal(wallet.VEs, 2000, 'Remaining balance must be exactly 10,000 - 8,000 = 2,000');
  });

  // Scenario 6: Invalid optionId rejected
  it('6. Invalid optionId rejected', async () => {
    const { user, authHeader } = await createTestUser();

    await creditWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 5000,
      category: 'BONUS',
    });

    const res = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', authHeader)
      .set('Idempotency-Key', 'idem-test-invalid-option-1234')
      .send({
        optionId: 'non_existent_option_id',
        payoutDetails: { upiId: 'test@okaxis' },
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'INVALID_PAYOUT_OPTION');
    assert.equal(res.body.message, 'Selected payout option is unavailable.');
  });

  // Scenario 7: Another user cannot read GET /withdrawals/:id (404)
  it('7. Another user cannot read GET /withdrawals/:id (404)', async () => {
    const userA = await createTestUser({ email: 'userA@test.com' });
    const userB = await createTestUser({ email: 'userB@test.com' });

    await creditWallet({
      userId: userA.user._id,
      currency: 'VEs',
      amount: 10000,
      category: 'BONUS',
    });

    const createRes = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', userA.authHeader)
      .set('Idempotency-Key', 'idem-test-user-a-withdrawal-1')
      .send({
        optionId: 'upi_10',
        payoutDetails: { upiId: 'userA@okaxis' },
      });

    assert.equal(createRes.status, 201);
    const withdrawalId = createRes.body.data.withdrawalId;

    // User A can read it
    const resA = await request(app)
      .get(`/api/withdrawals/${withdrawalId}`)
      .set('Authorization', userA.authHeader);
    assert.equal(resA.status, 200);

    // User B cannot read it (returns 404)
    const resB = await request(app)
      .get(`/api/withdrawals/${withdrawalId}`)
      .set('Authorization', userB.authHeader);
    assert.equal(resB.status, 404);
    assert.equal(resB.body.success, false);
  });

  // Scenario 8: Rejecting a withdrawal restores the balance and writes a REVERSAL row
  it('8. Rejecting a withdrawal restores the balance and writes a REVERSAL row', async () => {
    const userObj = await createTestUser();
    const adminObj = await createTestUser({ role: 'admin' });

    await creditWallet({
      userId: userObj.user._id,
      currency: 'VEs',
      amount: 5000,
      category: 'BONUS',
    });

    // Create withdrawal for 2,400 VEs
    const createRes = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', userObj.authHeader)
      .set('Idempotency-Key', 'idem-test-reject-refund-1234')
      .send({
        optionId: 'upi_10',
        payoutDetails: { upiId: 'tester@okhdfcbank' },
      });

    assert.equal(createRes.status, 201);
    const withdrawalId = createRes.body.data.withdrawalId;

    let wallet = await getWallet(userObj.user._id);
    assert.equal(wallet.VEs, 2600); // 5000 - 2400

    // Admin rejects withdrawal
    const reviewRes = await request(app)
      .post(`/api/admin/withdrawals/${withdrawalId}/review`)
      .set('Authorization', adminObj.authHeader)
      .send({
        status: 'REJECTED',
        reviewNotes: 'Suspicious UPI handle',
      });

    assert.equal(reviewRes.status, 200);
    assert.equal(reviewRes.body.data.status, 'REJECTED');

    // Verify balance is restored
    wallet = await getWallet(userObj.user._id);
    assert.equal(wallet.VEs, 5000, 'Balance must be restored to 5000');

    // Verify REVERSAL ledger row
    const reversalTx = await WalletTransaction.findOne({
      userId: userObj.user._id,
      category: 'REVERSAL',
      referenceId: withdrawalId,
    });
    assert.ok(reversalTx, 'Reversal transaction must exist in ledger');
    assert.equal(reversalTx.amount, 2400);
    assert.equal(reversalTx.balanceAfter, 5000);
  });

  // Scenario 9: Client-sent amount is ignored (request with amount: 1 still deducts requiredAmount)
  it('9. Client-sent amount is ignored (request with amount: 1 still deducts requiredAmount)', async () => {
    const { user, authHeader } = await createTestUser();

    await creditWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 10000,
      category: 'BONUS',
    });

    const res = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', authHeader)
      .set('Idempotency-Key', 'idem-test-ignored-amount-1234')
      .send({
        optionId: 'upi_10', // requiredAmount is 2400
        amount: 1, // client tries to exploit by sending 1
        payoutDetails: { upiId: 'hacker@okaxis' },
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.requiredAmount, 2400);

    const wallet = await getWallet(user._id);
    assert.equal(wallet.VEs, 7600, 'Must deduct 2400, not 1');
  });

  // Scenario 10: Reconciliation matches after a mix of operations
  it('10. Reconciliation matches after a mix of operations', async () => {
    const { user, authHeader } = await createTestUser();
    const adminObj = await createTestUser({ role: 'admin' });

    // Mix of credits across multiple currencies
    await creditWallet({ userId: user._id, currency: 'VEs', amount: 30000, category: 'BONUS' });
    await creditWallet({ userId: user._id, currency: 'VEs', amount: 100, category: 'AD_REWARD' });
    await creditWallet({ userId: user._id, currency: 'VEs', amount: 100, category: 'DAILY_REWARD' });
    await creditWallet({ userId: user._id, currency: 'SVEs', amount: 500, category: 'BONUS' });
    await creditWallet({ userId: user._id, currency: 'Gems', amount: 50, category: 'BONUS' });

    // Create withdrawal (debit 2400)
    const w1Res = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', authHeader)
      .set('Idempotency-Key', 'mix-op-withdrawal-1')
      .send({ optionId: 'upi_10', payoutDetails: { upiId: 'mix1@okaxis' } });
    assert.equal(w1Res.status, 201);

    // Create another withdrawal (debit 5800) then cancel it (refund 5800)
    const w2Res = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', authHeader)
      .set('Idempotency-Key', 'mix-op-withdrawal-2')
      .send({ optionId: 'upi_25', payoutDetails: { upiId: 'mix2@okaxis' } });
    assert.equal(w2Res.status, 201);

    const cancelRes = await request(app)
      .post(`/api/withdrawals/${w2Res.body.data.withdrawalId}/cancel`)
      .set('Authorization', authHeader);
    assert.equal(cancelRes.status, 200);

    // Create another withdrawal and admin rejects it (refund 2400)
    const w3Res = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', authHeader)
      .set('Idempotency-Key', 'mix-op-withdrawal-3')
      .send({ optionId: 'upi_10', payoutDetails: { upiId: 'mix3@okaxis' } });
    assert.equal(w3Res.status, 201);

    const rejectRes = await request(app)
      .post(`/api/admin/withdrawals/${w3Res.body.data.withdrawalId}/review`)
      .set('Authorization', adminObj.authHeader)
      .send({ status: 'REJECTED', reviewNotes: 'Rejected test' });
    assert.equal(rejectRes.status, 200);

    // Perform reconciliation
    const reconciliation = await reconcileUserWallet(user._id);
    assert.equal(reconciliation.matches, true, 'Overall reconciliation must be true');

    // Check all currencies have zero difference
    for (const currency of ['VEs', 'SVEs', 'Gems', 'Tokens', 'Spins']) {
      assert.equal(
        reconciliation.perCurrency[currency].matches,
        true,
        `Reconciliation for ${currency} must match`
      );
      assert.equal(
        reconciliation.perCurrency[currency].difference,
        0,
        `Difference for ${currency} must be 0`
      );
    }
  });

  // Scenario 11: Daily reward can only be claimed once per UTC day
  it('11. Daily reward can only be claimed once per UTC day', async () => {
    const { user, authHeader } = await createTestUser();

    // First claim succeeds
    const res1 = await request(app)
      .post('/api/rewards/daily')
      .set('Authorization', authHeader);

    assert.equal(res1.status, 200);
    assert.equal(res1.body.success, true);
    assert.equal(res1.body.data.amount, 100);

    const wallet = await getWallet(user._id);
    assert.equal(wallet.VEs, 100);

    // Second claim fails
    const res2 = await request(app)
      .post('/api/rewards/daily')
      .set('Authorization', authHeader);

    assert.equal(res2.status, 400);
    assert.equal(res2.body.success, false);
    assert.equal(res2.body.code, 'DAILY_REWARD_ALREADY_CLAIMED');
  });

  // Scenario 12: More than 3 pending withdrawals returns 409
  it('12. More than 3 pending withdrawals returns 409', async () => {
    const { user, authHeader } = await createTestUser();

    await creditWallet({
      userId: user._id,
      currency: 'VEs',
      amount: 50000,
      category: 'BONUS',
    });

    // Create 3 pending withdrawals
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post('/api/withdrawals')
        .set('Authorization', authHeader)
        .set('Idempotency-Key', `pending-test-key-0000000${i}`)
        .send({
          optionId: 'upi_10',
          payoutDetails: { upiId: `user${i}@okaxis` },
        });
      assert.equal(res.status, 201);
    }

    // 4th pending withdrawal attempt must fail with 409
    const res4 = await request(app)
      .post('/api/withdrawals')
      .set('Authorization', authHeader)
      .set('Idempotency-Key', 'pending-test-key-overflow-4')
      .send({
        optionId: 'upi_10',
        payoutDetails: { upiId: 'user4@okaxis' },
      });

    assert.equal(res4.status, 409);
    assert.equal(res4.body.success, false);
    assert.equal(res4.body.code, 'TOO_MANY_PENDING');
    assert.equal(res4.body.message, 'Maximum pending withdrawal requests reached.');
  });

  // Scenario 13: Unauthenticated request to a protected route returns 401
  it('13. Unauthenticated request to a protected route returns 401', async () => {
    const res = await request(app).get('/api/wallet');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'UNAUTHORIZED');
    assert.equal(res.body.message, 'Authentication required.');
  });

  // Scenario 14: Non-admin calling /wallet/credit gets 403
  it('14. Non-admin calling /wallet/credit gets 403', async () => {
    const { user, authHeader } = await createTestUser({ role: 'user' });

    const res = await request(app)
      .post('/api/wallet/credit')
      .set('Authorization', authHeader)
      .send({
        userId: user._id,
        amount: 5000,
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'FORBIDDEN');
  });
});
