import { connectDB, disconnectDB } from '../src/config/db.js';
import config from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Wallet } from '../src/models/Wallet.js';
import { WalletTransaction } from '../src/models/WalletTransaction.js';
import { Withdrawal } from '../src/models/Withdrawal.js';
import { PayoutOption } from '../src/models/PayoutOption.js';
import { DailyClaim } from '../src/models/DailyClaim.js';
import { AdClaim } from '../src/models/AdClaim.js';
import { DEFAULT_PAYOUT_OPTIONS } from './payoutOptions.js';
import { creditWallet, ensureWallet } from '../src/services/walletService.js';
import { reconcileUserWallet } from '../src/services/reconciliationService.js';
import { createWithdrawal } from '../src/services/withdrawalService.js';
import bcrypt from 'bcryptjs';

const seed = async () => {
  if (config.NODE_ENV === 'production') {
    console.error('ERROR: Seed script cannot be run in production environment!');
    process.exit(1);
  }

  console.log('[Seed] Starting database seed...');
  await connectDB();

  try {
    // 1. Seed or update Admin User
    const adminEmail = 'admin@veloop.test';
    const adminPassword = config.ADMIN_PASSWORD;
    const adminHashed = await bcrypt.hash(adminPassword, 12);

    let adminUser = await User.findOneAndUpdate(
      { email: adminEmail },
      {
        $set: {
          email: adminEmail,
          password: adminHashed,
          role: 'admin',
          accountStatus: 'active',
        },
      },
      { upsert: true, new: true }
    );
    console.log(`[Seed] Admin user ready: ${adminEmail}`);

    // 2. Seed or update Demo User
    const demoEmail = 'demo@veloop.test';
    const demoPassword = config.DEMO_PASSWORD;
    const demoHashed = await bcrypt.hash(demoPassword, 12);

    let demoUser = await User.findOneAndUpdate(
      { email: demoEmail },
      {
        $set: {
          email: demoEmail,
          password: demoHashed,
          role: 'user',
          accountStatus: 'active',
        },
      },
      { upsert: true, new: true }
    );
    console.log(`[Seed] Demo user ready: ${demoEmail}`);

    // 3. Reset demo and admin users' wallets, transactions, claims, and withdrawals
    await Promise.all([
      Wallet.deleteMany({ userId: { $in: [demoUser._id, adminUser._id] } }),
      WalletTransaction.deleteMany({ userId: { $in: [demoUser._id, adminUser._id] } }),
      Withdrawal.deleteMany({ userId: { $in: [demoUser._id, adminUser._id] } }),
      DailyClaim.deleteMany({ userId: { $in: [demoUser._id, adminUser._id] } }),
      AdClaim.deleteMany({ userId: { $in: [demoUser._id, adminUser._id] } }),
    ]);
    console.log('[Seed] Cleaned existing wallet & ledger data for demo and admin users.');

    // Ensure empty wallets
    await ensureWallet(demoUser._id);
    await ensureWallet(adminUser._id);

    // 4. Seed balances for Admin User (100,000 VEs for thorough testing)
    await creditWallet({
      userId: adminUser._id,
      currency: 'VEs',
      amount: 100000,
      category: 'BONUS',
      referenceId: 'seed_admin_ves_100k',
      source: 'SYSTEM',
      description: 'Admin testing grant (+100,000 VEs)',
    });

    await creditWallet({
      userId: adminUser._id,
      currency: 'SVEs',
      amount: 25000,
      category: 'BONUS',
      referenceId: 'seed_admin_sves_25k',
      source: 'SYSTEM',
      description: 'Admin testing grant (+25,000 SVEs)',
    });

    await creditWallet({
      userId: adminUser._id,
      currency: 'Gems',
      amount: 500,
      category: 'BONUS',
      referenceId: 'seed_admin_gems_500',
      source: 'SYSTEM',
      description: 'Admin testing grant (+500 Gems)',
    });

    await creditWallet({
      userId: adminUser._id,
      currency: 'Tokens',
      amount: 2500,
      category: 'BONUS',
      referenceId: 'seed_admin_tokens_2500',
      source: 'SYSTEM',
      description: 'Admin testing grant (+2,500 Tokens)',
    });

    await creditWallet({
      userId: adminUser._id,
      currency: 'Spins',
      amount: 20,
      category: 'BONUS',
      referenceId: 'seed_admin_spins_20',
      source: 'SYSTEM',
      description: 'Admin testing grant (+20 Spins)',
    });
    console.log('[Seed] Admin balances credited: VEs 100,000, SVEs 25,000, Gems 500, Tokens 2,500, Spins 20.');

    // 5. Seed balances for Demo User via creditWallet so append-only ledger strictly reconciles
    // VEs 25,000 as:
    // - 20,000 bonus
    // - 3,000 ad reward
    // - 2,000 daily reward
    await creditWallet({
      userId: demoUser._id,
      currency: 'VEs',
      amount: 20000,
      category: 'BONUS',
      referenceId: 'seed_bonus_20k',
      source: 'SYSTEM',
      description: 'Demo seed: Welcome onboarding bonus (+20,000 VEs)',
    });

    await creditWallet({
      userId: demoUser._id,
      currency: 'VEs',
      amount: 3000,
      category: 'AD_REWARD',
      referenceId: 'seed_ad_3k',
      source: 'SYSTEM',
      description: 'Demo seed: Accumulated video ad reward (+3,000 VEs)',
    });

    await creditWallet({
      userId: demoUser._id,
      currency: 'VEs',
      amount: 2000,
      category: 'DAILY_REWARD',
      referenceId: 'seed_daily_2k',
      source: 'SYSTEM',
      description: 'Demo seed: 7-day daily streak reward (+2,000 VEs)',
    });

    // SVEs 5,000
    await creditWallet({
      userId: demoUser._id,
      currency: 'SVEs',
      amount: 5000,
      category: 'BONUS',
      referenceId: 'seed_sves_5k',
      source: 'SYSTEM',
      description: 'Demo seed: Special VEs bonus (+5,000 SVEs)',
    });

    // Gems 100
    await creditWallet({
      userId: demoUser._id,
      currency: 'Gems',
      amount: 100,
      category: 'BONUS',
      referenceId: 'seed_gems_100',
      source: 'SYSTEM',
      description: 'Demo seed: Achievement gems (+100 Gems)',
    });

    // Tokens 500
    await creditWallet({
      userId: demoUser._id,
      currency: 'Tokens',
      amount: 500,
      category: 'BONUS',
      referenceId: 'seed_tokens_500',
      source: 'SYSTEM',
      description: 'Demo seed: Arcade tokens pack (+500 Tokens)',
    });

    // Spins 3
    await creditWallet({
      userId: demoUser._id,
      currency: 'Spins',
      amount: 3,
      category: 'BONUS',
      referenceId: 'seed_spins_3',
      source: 'SYSTEM',
      description: 'Demo seed: Daily lucky wheel spins (+3 Spins)',
    });

    console.log('[Seed] Demo balances credited: VEs 25,000, SVEs 5,000, Gems 100, Tokens 500, Spins 3.');

    // 6. Upsert Payout Options
    for (const opt of DEFAULT_PAYOUT_OPTIONS) {
      await PayoutOption.findOneAndUpdate(
        { optionId: opt.optionId },
        { $set: opt },
        { upsert: true, new: true }
      );
    }
    console.log(`[Seed] Upserted ${DEFAULT_PAYOUT_OPTIONS.length} payout options.`);

    // 7. Create a real sample pending withdrawal from Demo User so Admin can test review queue immediately
    await createWithdrawal({
      userId: demoUser._id,
      optionId: 'paypal_500',
      payoutDetails: { paypalEmail: 'demo.payout@veloop.test' },
      idempotencyKey: 'seed_sample_pending_withdrawal_001',
      ip: '127.0.0.1',
    });
    console.log('[Seed] Seeded sample pending withdrawal: PayPal ₹500 (5,000 VEs debited) ready for Admin review.');

    // 8. Verify ledger reconciliation for both users
    const [demoReconciliation, adminReconciliation] = await Promise.all([
      reconcileUserWallet(demoUser._id),
      reconcileUserWallet(adminUser._id),
    ]);
    if (!demoReconciliation.matches) {
      throw new Error('Reconciliation check failed for demo user after seed!');
    }
    if (!adminReconciliation.matches) {
      throw new Error('Reconciliation check failed for admin user after seed!');
    }
    console.log('[Seed] Reconciliation verified: Ledger matches wallet 100% across all currencies for both demo & admin.');
    console.log('[Seed] Database seeding completed successfully.');
  } catch (error) {
    console.error('[Seed] Seeding failed with error:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

seed();
