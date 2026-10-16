import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import api from '../api/client.js';
import BalanceCard from '../components/BalanceCard.jsx';
import TransactionList from '../components/TransactionList.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';

export const WalletPage = () => {
  const { wallet, refreshWallet } = useAuth();
  const navigate = useNavigate();

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState(null);

  // Rewards claim state
  const [rewardStatus, setRewardStatus] = useState(null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [claimingAd, setClaimingAd] = useState(false);
  const [rewardMessage, setRewardMessage] = useState(null);
  const [rewardError, setRewardError] = useState(null);

  // Reconciliation state
  const [reconcileResult, setReconcileResult] = useState(null);
  const [reconciling, setReconciling] = useState(false);

  const fetchTransactions = useCallback(async (page = 1, currency = '') => {
    try {
      setTxLoading(true);
      setTxError(null);
      const query = new URLSearchParams({ page, limit: 10 });
      if (currency) query.append('currency', currency);

      const res = await api.get(`/wallet/transactions?${query.toString()}`);
      if (res && res.data) {
        setTransactions(res.data);
        setPagination(res.pagination || { page, limit: 10, total: res.data.length, pages: 1 });
      }
    } catch (err) {
      setTxError(err.message || 'Failed to load transaction history');
    } finally {
      setTxLoading(false);
    }
  }, []);

  const fetchRewardStatus = useCallback(async () => {
    try {
      const res = await api.get('/rewards/status');
      if (res && res.data) {
        setRewardStatus(res.data);
      }
    } catch (err) {
      console.warn('Failed to load reward status:', err.message);
    }
  }, []);

  const handleReconcile = async () => {
    try {
      setReconciling(true);
      const res = await api.get('/wallet/reconcile');
      setReconcileResult(res.data);
    } catch (err) {
      console.error('Reconciliation check failed:', err);
    } finally {
      setReconciling(false);
    }
  };

  useEffect(() => {
    fetchTransactions(pagination.page, currencyFilter);
    fetchRewardStatus();
    handleReconcile();
  }, [fetchTransactions, fetchRewardStatus, pagination.page, currencyFilter]);

  const handleClaimDaily = async () => {
    try {
      setClaimingDaily(true);
      setRewardError(null);
      setRewardMessage(null);
      const res = await api.post('/rewards/daily');
      setRewardMessage(res.message || 'Daily check-in reward claimed successfully! (+100 VEs)');
      await refreshWallet();
      await fetchRewardStatus();
      await fetchTransactions(1, currencyFilter);
      await handleReconcile();
    } catch (err) {
      setRewardError(err.message || 'Failed to claim daily reward.');
    } finally {
      setClaimingDaily(false);
    }
  };

  const handleClaimAd = async () => {
    try {
      setClaimingAd(true);
      setRewardError(null);
      setRewardMessage(null);
      const res = await api.post('/rewards/ad');
      setRewardMessage(res.message || 'Ad reward claimed successfully! (+100 VEs)');
      await refreshWallet();
      await fetchRewardStatus();
      await fetchTransactions(1, currencyFilter);
      await handleReconcile();
    } catch (err) {
      setRewardError(err.message || 'Failed to claim ad reward.');
    } finally {
      setClaimingAd(false);
    }
  };

  return (
    <div>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Rewards Wallet</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Multi-currency balances backed by append-only ledger transactions
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {reconcileResult && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '9999px',
                background: reconcileResult.matches ? 'var(--success-bg)' : 'var(--danger-bg)',
                border: `1px solid ${reconcileResult.matches ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: reconcileResult.matches ? 'var(--success)' : 'var(--danger)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
              title="Ledger validation check (sum(CREDIT) - sum(DEBIT) vs Wallet)"
            >
              <span>{reconcileResult.matches ? '🛡️' : '⚠️'}</span>
              <span>{reconcileResult.matches ? 'Ledger Reconciled (100%)' : 'Audit Mismatch'}</span>
            </div>
          )}

          <button
            onClick={() => navigate('/payout')}
            className="btn btn-primary btn-lg"
            id="redeem-btn"
          >
            <span>🎁</span>
            <span>Withdraw / Redeem</span>
          </button>
        </div>
      </div>

      {rewardMessage && (
        <Alert type="success" onClose={() => setRewardMessage(null)}>
          {rewardMessage}
        </Alert>
      )}

      {rewardError && (
        <Alert type="danger" onClose={() => setRewardError(null)}>
          {rewardError}
        </Alert>
      )}

      {/* Rewards Claim Bar */}
      <div className="rewards-banner">
        <div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Earn Daily VEs Boosts</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Daily check-in resets at 00:00 UTC. Video rewards available up to 10 times daily.
          </p>
        </div>

        <div className="rewards-actions">
          {/* Daily Reward Button */}
          <button
            onClick={handleClaimDaily}
            disabled={claimingDaily || rewardStatus?.dailyReward?.claimedToday}
            className="btn btn-secondary"
            id="claim-daily-btn"
            style={{
              borderColor: rewardStatus?.dailyReward?.claimedToday
                ? 'rgba(255, 255, 255, 0.05)'
                : 'var(--ve-gold)',
            }}
          >
            {claimingDaily ? (
              <Spinner size="sm" />
            ) : rewardStatus?.dailyReward?.claimedToday ? (
              <span>✓ Daily Claimed</span>
            ) : (
              <>
                <span>📅</span>
                <span>Claim Daily (+100 VEs)</span>
              </>
            )}
          </button>

          {/* Ad Reward Button */}
          <button
            onClick={handleClaimAd}
            disabled={claimingAd || (rewardStatus && rewardStatus.adReward?.remainingToday <= 0)}
            className="btn btn-secondary"
            id="claim-ad-btn"
            style={{
              borderColor:
                rewardStatus && rewardStatus.adReward?.remainingToday > 0
                  ? 'var(--accent-primary)'
                  : 'rgba(255, 255, 255, 0.05)',
            }}
          >
            {claimingAd ? (
              <Spinner size="sm" />
            ) : (
              <>
                <span>📺</span>
                <span>
                  Watch Ad (+100 VEs){' '}
                  {rewardStatus?.adReward
                    ? `(${rewardStatus.adReward.remainingToday}/10 left)`
                    : ''}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5 Currency Balances Grid */}
      <div className="balances-grid">
        <BalanceCard
          currency="VEs"
          amount={wallet?.VEs}
          isMain={true}
          description="Primary rewards currency. Redeemable for instant UPI transfers."
          onAction={() => navigate('/payout')}
          actionLabel="Redeem VEs →"
        />
        <BalanceCard currency="SVEs" amount={wallet?.SVEs} />
        <BalanceCard currency="Gems" amount={wallet?.Gems} />
        <BalanceCard currency="Tokens" amount={wallet?.Tokens} />
        <BalanceCard currency="Spins" amount={wallet?.Spins} />
      </div>

      {/* Paginated Transactions List */}
      <TransactionList
        transactions={transactions}
        loading={txLoading}
        error={txError}
        pagination={pagination}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        currencyFilter={currencyFilter}
        onCurrencyFilterChange={(curr) => {
          setCurrencyFilter(curr);
          setPagination((prev) => ({ ...prev, page: 1 }));
        }}
      />
    </div>
  );
};

export default WalletPage;
