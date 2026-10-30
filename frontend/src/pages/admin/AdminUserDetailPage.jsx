import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';

const CURRENCIES = ['VEs', 'SVEs', 'Gems', 'Tokens', 'Spins'];

export const AdminUserDetailPage = () => {
  const { userId } = useParams();

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Credit Form State
  const [creditCurrency, setCreditCurrency] = useState('VEs');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditCorrection, setCreditCorrection] = useState(false);
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  // Debit Form State
  const [debitCurrency, setDebitCurrency] = useState('VEs');
  const [debitAmount, setDebitAmount] = useState('');
  const [debitReason, setDebitReason] = useState('');
  const [debitCorrection, setDebitCorrection] = useState(false);
  const [debitSubmitting, setDebitSubmitting] = useState(false);

  const fetchUserDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/admin/users/${userId}`);
      if (res?.data) {
        setUserData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch user profile.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserDetail();
  }, [fetchUserDetail]);

  const handleCreditSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    const amountNum = parseInt(creditAmount, 10);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      setActionError('Credit amount must be a positive whole number.');
      return;
    }

    if (!creditReason.trim()) {
      setActionError('A reason is required for administrative credit.');
      return;
    }

    try {
      setCreditSubmitting(true);
      const res = await api.post('/admin/credit', {
        userId,
        currency: creditCurrency,
        amount: amountNum,
        reason: creditReason.trim(),
        correction: creditCorrection,
      });

      const updatedWallet = res?.data?.wallet || res?.data;
      const returnedBalance = updatedWallet?.[creditCurrency] ?? 'updated';
      setActionSuccess(
        `Successfully credited ${amountNum} ${creditCurrency}! New balance: ${returnedBalance.toLocaleString()} ${creditCurrency}.`
      );
      setCreditAmount('');
      setCreditReason('');
      setCreditCorrection(false);
      await fetchUserDetail();
    } catch (err) {
      setActionError(err.message || 'Failed to credit user wallet.');
    } finally {
      setCreditSubmitting(false);
    }
  };

  const handleDebitSubmit = async (e) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    const amountNum = parseInt(debitAmount, 10);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      setActionError('Debit amount must be a positive whole number.');
      return;
    }

    if (!debitReason.trim()) {
      setActionError('A reason is required for administrative debit.');
      return;
    }

    const currentBalance = userData?.wallet?.[debitCurrency] ?? 0;
    if (amountNum > currentBalance) {
      setActionError(`Cannot debit ${amountNum} ${debitCurrency}: current balance is ${currentBalance}.`);
      return;
    }

    try {
      setDebitSubmitting(true);
      const res = await api.post('/admin/debit', {
        userId,
        currency: debitCurrency,
        amount: amountNum,
        reason: debitReason.trim(),
        correction: debitCorrection,
      });

      const updatedWallet = res?.data?.wallet || res?.data;
      const returnedBalance = updatedWallet?.[debitCurrency] ?? 'updated';
      setActionSuccess(
        `Successfully debited ${amountNum} ${debitCurrency}! New balance: ${returnedBalance.toLocaleString()} ${debitCurrency}.`
      );
      setDebitAmount('');
      setDebitReason('');
      setDebitCorrection(false);
      await fetchUserDetail();
    } catch (err) {
      setActionError(err.message || 'Failed to debit user wallet.');
    } finally {
      setDebitSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '50vh' }}>
        <Spinner size="lg" />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading user account & ledger...</p>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
        <Alert type="danger">{error || 'User not found.'}</Alert>
        <Link to="/admin/users" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          ← Back to User Directory
        </Link>
      </div>
    );
  }

  const { user, wallet = {}, ledger = [] } = userData;
  const currentDebitBalance = wallet[debitCurrency] ?? 0;
  const debitAmountNum = parseInt(debitAmount, 10) || 0;
  const isDebitDisabled = debitAmountNum > currentDebitBalance || debitAmountNum <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
            <Link to="/admin/users" style={{ color: 'var(--text-secondary)' }}>
              Users
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {user.email}
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>
            {user.name ? `${user.name} ` : ''}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({user.email})</span>
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link
            to={`/admin/reconcile?userId=${user.id || user._id}`}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>⚖️</span>
            <span>Reconcile Ledger</span>
          </Link>
          <button onClick={fetchUserDetail} className="btn btn-secondary btn-sm">
            <span>🔄</span> <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <Alert type="success" onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}

      {actionError && (
        <Alert type="danger" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* User Info Bar */}
      <div className="card glass-panel" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User ID</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600 }}>{user.id || user._id}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Account Role</div>
          <div style={{ fontWeight: 600, color: user.role === 'admin' ? '#c084fc' : 'var(--text-primary)' }}>
            {user.role}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
          <div style={{ fontWeight: 600, color: user.accountStatus === 'active' ? 'var(--success)' : 'var(--danger)' }}>
            ● {user.accountStatus}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Joined</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
          </div>
        </div>
      </div>

      {/* Five Balances Grid */}
      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Current Wallet Balances
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="card glass-panel" style={{ borderLeft: '4px solid var(--ve-gold)' }}>
            <div style={{ color: 'var(--ve-gold)', fontWeight: 700, fontSize: '0.85rem' }}>🟡 VEs (Points)</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--ve-gold)' }}>
              {(wallet.VEs ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="card glass-panel" style={{ borderLeft: '4px solid var(--sve-cyan)' }}>
            <div style={{ color: 'var(--sve-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>🔷 SVEs</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--sve-cyan)' }}>
              {(wallet.SVEs ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="card glass-panel" style={{ borderLeft: '4px solid var(--gem-ruby)' }}>
            <div style={{ color: 'var(--gem-ruby)', fontWeight: 700, fontSize: '0.85rem' }}>💎 Gems</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--gem-ruby)' }}>
              {(wallet.Gems ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="card glass-panel" style={{ borderLeft: '4px solid var(--token-emerald)' }}>
            <div style={{ color: 'var(--token-emerald)', fontWeight: 700, fontSize: '0.85rem' }}>🪙 Tokens</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--token-emerald)' }}>
              {(wallet.Tokens ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="card glass-panel" style={{ borderLeft: '4px solid var(--spin-purple)' }}>
            <div style={{ color: 'var(--spin-purple)', fontWeight: 700, fontSize: '0.85rem' }}>🎡 Spins</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--spin-purple)' }}>
              {(wallet.Spins ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Credit & Debit Adjustment Forms Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Credit Form */}
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem', color: 'var(--success)' }}>
            ➕ Admin Credit Adjustment
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Grant points or tokens with automatic immutable ledger recording
          </p>

          <form onSubmit={handleCreditSubmit}>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select
                className="form-input"
                value={creditCurrency}
                onChange={(e) => setCreditCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c} (Current: {(wallet[c] ?? 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Amount (Whole Number) *</label>
              <input
                type="number"
                step="1"
                min="1"
                className="form-input"
                placeholder="e.g. 500"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reason *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Reason for adjustment..."
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="creditCorrection"
                checked={creditCorrection}
                onChange={(e) => setCreditCorrection(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="creditCorrection" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Correction flag (logs <code style={{ color: '#f472b6' }}>BALANCE_CORRECTION</code> audit action)
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              disabled={creditSubmitting}
            >
              {creditSubmitting ? <Spinner size="sm" /> : `Credit ${creditCurrency}`}
            </button>
          </form>
        </div>

        {/* Debit Form */}
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem', color: 'var(--danger)' }}>
            ➖ Admin Debit Adjustment
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Deduct balance with server-enforced atomic overdraft guards
          </p>

          <form onSubmit={handleDebitSubmit}>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select
                className="form-input"
                value={debitCurrency}
                onChange={(e) => setDebitCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c} (Available: {(wallet[c] ?? 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Amount (Max available: {currentDebitBalance.toLocaleString()}) *</label>
              <input
                type="number"
                step="1"
                min="1"
                max={currentDebitBalance}
                className="form-input"
                placeholder={`Max ${currentDebitBalance}`}
                value={debitAmount}
                onChange={(e) => setDebitAmount(e.target.value)}
                required
              />
              {debitAmountNum > currentDebitBalance && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                  Amount exceeds current balance ({currentDebitBalance.toLocaleString()} {debitCurrency}).
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Reason *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Reason for adjustment..."
                value={debitReason}
                onChange={(e) => setDebitReason(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="debitCorrection"
                checked={debitCorrection}
                onChange={(e) => setDebitCorrection(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="debitCorrection" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Correction flag (logs <code style={{ color: '#f472b6' }}>BALANCE_CORRECTION</code> audit action)
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-danger"
              style={{ width: '100%' }}
              disabled={debitSubmitting || isDebitDisabled}
            >
              {debitSubmitting ? <Spinner size="sm" /> : `Debit ${debitCurrency}`}
            </button>
          </form>
        </div>
      </div>

      {/* 20 Most Recent Ledger Rows Table */}
      <div className="card glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>Recent Ledger Transactions</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              20 most recent ledger entries for this account
            </p>
          </div>
          <Link to={`/admin/ledger?userId=${user.id || user._id}`} className="btn btn-secondary btn-sm">
            View Complete Ledger →
          </Link>
        </div>

        {ledger.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            No ledger transactions found for this user.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Currency</th>
                  <th>Type & Category</th>
                  <th>Balance Before</th>
                  <th>Signed Amount</th>
                  <th>Balance After</th>
                  <th>Reference</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((tx) => {
                  const isCredit = tx.type === 'CREDIT';
                  return (
                    <tr key={tx._id || tx.transactionId}>
                      <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{tx.currency}</td>
                      <td>
                        <span
                          style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: isCredit ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: isCredit ? 'var(--success)' : 'var(--danger)',
                          }}
                        >
                          {tx.category || tx.type}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {tx.balanceBefore?.toLocaleString()}
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: isCredit ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {isCredit ? `+${tx.amount?.toLocaleString()}` : `-${tx.amount?.toLocaleString()}`}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {tx.balanceAfter?.toLocaleString()}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {tx.referenceId ? `${String(tx.referenceId).substring(0, 8)}...` : '-'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserDetailPage;
