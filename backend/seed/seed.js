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

    // 3. Reset demo user's wallet, transactions, claims, and withdrawals
    await Promise.all([
      Wallet.deleteOne({ userId: demoUser._id }),
      WalletTransaction.deleteMany({ userId: demoUser._id }),
      Withdrawal.deleteMany({ userId: demoUser._id }),
      DailyClaim.deleteMany({ userId: demoUser._id }),
      AdClaim.deleteMany({ userId: demoUser._id }),
    ]);
    console.log('[Seed] Cleaned existing wallet & ledger data for demo user.');

    // Ensure empty wallet
    await ensureWallet(demoUser._id);

    // 4. Seed balances via creditWallet so append-only ledger strictly reconciles
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

    console.log('[Seed] Seeded balances credited: VEs 25,000, SVEs 5,000, Gems 100, Tokens 500, Spins 3.');

    // 5. Upsert Payout Options
    for (const opt of DEFAULT_PAYOUT_OPTIONS) {
      await PayoutOption.findOneAndUpdate(
        { optionId: opt.optionId },
        { $set: opt },
        { upsert: true, new: true }
      );
    }
    console.log(`[Seed] Upserted ${DEFAULT_PAYOUT_OPTIONS.length} payout options.`);

    // 6. Verify ledger reconciliation for demo user
    const reconciliation = await reconcileUserWallet(demoUser._id);
    if (!reconciliation.matches) {
      throw new Error('Reconciliation check failed for demo user after seed!');
    }
    console.log('[Seed] Reconciliation verified: Ledger matches wallet 100% across all currencies.');
    console.log('[Seed] Database seeding completed successfully.');
  } catch (error) {
    console.error('[Seed] Seeding failed with error:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

seed();
