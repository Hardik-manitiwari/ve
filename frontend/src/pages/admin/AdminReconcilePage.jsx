import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';

export const AdminReconcilePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUserId = searchParams.get('userId') || '';

  const [userIdInput, setUserIdInput] = useState(initialUserId);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runReconciliation = useCallback(async (targetUserId) => {
    if (!targetUserId || !targetUserId.trim()) {
      setError('Please enter a target User ID.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/admin/reconcile/${targetUserId.trim()}`);
      if (res?.data) {
        setReconcileResult(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to reconcile user wallet.');
      setReconcileResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUserId) {
      runReconciliation(initialUserId);
    }
  }, [initialUserId, runReconciliation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userIdInput.trim()) {
      setSearchParams({ userId: userIdInput.trim() });
      runReconciliation(userIdInput.trim());
    }
  };

  const perCurrency = reconcileResult?.perCurrency || {};
  const allMatch = reconcileResult?.matches;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1100px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.85rem', marginBottom: '0.25rem' }}>Wallet & Ledger Reconciliation</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Real-time mathematical audit: verifies computed ledger balance against stored wallet document
        </p>
      </div>

      {error && (
        <Alert type="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Target User ID Form Card */}
      <div className="card glass-panel" style={{ padding: '1.5rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '280px', marginBottom: 0 }}>
            <label className="form-label">Target User ID *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 6530a... or UUID"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: '42px', minWidth: '160px' }}>
            {loading ? <Spinner size="sm" /> : 'Run Reconciliation'}
          </button>
        </form>
      </div>

      {/* Results View */}
      {reconcileResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Overall Verdict Banner */}
          <div
            style={{
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              background: allMatch ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.2)',
              border: allMatch ? '2px solid rgba(16, 185, 129, 0.5)' : '3px solid #ef4444',
              boxShadow: allMatch ? '0 0 24px rgba(16, 185, 129, 0.2)' : '0 0 30px rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  fontSize: '2.5rem',
                  lineHeight: 1,
                }}
              >
                {allMatch ? '🛡️' : '🚨'}
              </div>
              <div>
                <h3
                  style={{
                    fontSize: '1.4rem',
                    color: allMatch ? 'var(--success)' : '#ef4444',
                    fontWeight: 800,
                  }}
                >
                  {allMatch ? 'RECONCILIATION PASSED: 100% MATCH' : 'CRITICAL MISMATCH DETECTED!'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  User ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{reconcileResult.userId}</span> • Reconciled at: {new Date(reconcileResult.reconciledAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to={`/admin/users/${reconcileResult.userId}`} className="btn btn-secondary btn-sm">
                View User Profile →
              </Link>
              <Link to={`/admin/ledger?userId=${reconcileResult.userId}`} className="btn btn-secondary btn-sm">
                Inspect Ledger Rows →
              </Link>
            </div>
          </div>

          {/* Per-Currency Details Table */}
          <div className="card glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-glass)' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Per-Currency Breakdown</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Formula: Computed Balance = Total Credits − Total Debits. Must equal Stored Balance.
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th style={{ textAlign: 'right' }}>Ledger Credits (Σ)</th>
                    <th style={{ textAlign: 'right' }}>Ledger Debits (Σ)</th>
                    <th style={{ textAlign: 'right' }}>Computed Balance</th>
                    <th style={{ textAlign: 'right' }}>Stored Balance</th>
                    <th style={{ textAlign: 'right' }}>Difference</th>
                    <th style={{ textAlign: 'center' }}>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(perCurrency).map(([currency, data]) => {
                    const isMatched = data.matches;
                    const diff = data.difference ?? (data.storedBalance - data.computedBalance);

                    return (
                      <tr
                        key={currency}
                        style={{
                          background: isMatched ? 'transparent' : 'rgba(239, 68, 68, 0.15)',
                        }}
                      >
                        <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          {currency}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                          +{(data.credits ?? 0).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>
                          -{(data.debits ?? 0).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {(data.computedBalance ?? data.ledgerBalance ?? 0).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ve-gold)' }}>
                          {(data.storedBalance ?? data.walletBalance ?? 0).toLocaleString()}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            color: isMatched ? 'var(--text-muted)' : '#ef4444',
                          }}
                        >
                          {diff === 0 ? '0' : (diff > 0 ? `+${diff}` : `${diff}`)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isMatched ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: 'var(--success)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              MATCH ✓
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                fontWeight: 900,
                                background: '#ef4444',
                                color: '#ffffff',
                                border: '2px solid #b91c1c',
                                animation: 'pulse 1.5s infinite',
                              }}
                            >
                              MISMATCH ⚠️
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReconcilePage;
