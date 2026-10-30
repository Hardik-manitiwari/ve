import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';

const CURRENCIES = ['', 'VEs', 'SVEs', 'Gems', 'Tokens', 'Spins'];
const TYPES = ['', 'CREDIT', 'DEBIT'];
const CATEGORIES = [
  '',
  'REWARD',
  'BONUS',
  'DAILY_REWARD',
  'AD_REWARD',
  'WITHDRAWAL',
  'ADMIN_CREDIT',
  'ADMIN_DEBIT',
  'CORRECTION',
  'REVERSAL',
];

export const AdminLedgerPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [userIdFilter, setUserIdFilter] = useState(searchParams.get('userId') || '');
  const [currencyFilter, setCurrencyFilter] = useState(searchParams.get('currency') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
  const [toDate, setToDate] = useState(searchParams.get('to') || '');

  const [page, setPage] = useState(1);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLedger = useCallback(async (targetPage = page) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: targetPage, limit: 20 });
      if (userIdFilter) params.append('userId', userIdFilter.trim());
      if (currencyFilter) params.append('currency', currencyFilter);
      if (typeFilter) params.append('type', typeFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (fromDate) params.append('from', new Date(fromDate).toISOString());
      if (toDate) params.append('to', new Date(toDate).toISOString());

      const res = await api.get(`/admin/ledger?${params.toString()}`);
      if (res?.data) {
        setLedgerRows(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch ledger rows.');
    } finally {
      setLoading(false);
    }
  }, [page, userIdFilter, currencyFilter, typeFilter, categoryFilter, fromDate, toDate]);

  useEffect(() => {
    fetchLedger(page);
  }, [fetchLedger, page]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLedger(1);
  };

  const handleClearFilters = () => {
    setUserIdFilter('');
    setCurrencyFilter('');
    setTypeFilter('');
    setCategoryFilter('');
    setFromDate('');
    setToDate('');
    setSearchParams({});
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', marginBottom: '0.25rem' }}>Immutable Ledger Records</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Append-only double-entry audit rows with balance before, signed amounts, and balance after
          </p>
        </div>
        <button onClick={() => fetchLedger(page)} className="btn btn-secondary btn-sm">
          <span>🔄</span> <span>Refresh</span>
        </button>
      </div>

      {error && (
        <Alert type="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filter Form Card */}
      <div className="card glass-panel" style={{ padding: '1.25rem' }}>
        <form onSubmit={handleFilterSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>User ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="Target User ID..."
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Currency</label>
              <select
                className="form-input"
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c === '' ? 'All Currencies' : c}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Type</label>
              <select
                className="form-input"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === '' ? 'All Types' : t}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Category</label>
              <select
                className="form-input"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === '' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>From Date</label>
              <input
                type="date"
                className="form-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>To Date</label>
              <input
                type="date"
                className="form-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Filter
              </button>
              <button type="button" onClick={handleClearFilters} className="btn btn-secondary">
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Ledger Table */}
      <div className="card glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-container" style={{ padding: '4rem 1rem' }}>
            <Spinner size="lg" />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Querying ledger records...</p>
          </div>
        ) : ledgerRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
            No ledger transactions found matching the filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>User ID</th>
                  <th>Currency</th>
                  <th>Type & Category</th>
                  <th style={{ textAlign: 'right' }}>Balance Before</th>
                  <th style={{ textAlign: 'right' }}>Signed Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance After</th>
                  <th>Reference</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((tx) => {
                  const isCredit = tx.type === 'CREDIT';
                  const isWithdrawalRef =
                    tx.category === 'WITHDRAWAL' || tx.category === 'REVERSAL' || tx.referenceId;

                  return (
                    <tr key={tx._id || tx.transactionId}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        <Link to={`/admin/users/${tx.userId}`} style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {String(tx.userId).substring(0, 8)}...
                        </Link>
                      </td>
                      <td style={{ fontWeight: 600 }}>{tx.currency}</td>
                      <td>
                        <span
                          style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            background:
                              tx.category === 'CORRECTION'
                                ? 'rgba(236, 72, 153, 0.2)'
                                : isCredit
                                ? 'var(--success-bg)'
                                : 'var(--danger-bg)',
                            color:
                              tx.category === 'CORRECTION'
                                ? '#f472b6'
                                : isCredit
                                ? 'var(--success)'
                                : 'var(--danger)',
                          }}
                        >
                          {tx.category || tx.type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {tx.balanceBefore?.toLocaleString()}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          color: isCredit ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {isCredit ? `+${tx.amount?.toLocaleString()}` : `-${tx.amount?.toLocaleString()}`}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {tx.balanceAfter?.toLocaleString()}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {isWithdrawalRef && tx.referenceId ? (
                          <Link
                            to="/admin/withdrawals"
                            style={{ color: '#60a5fa', textDecoration: 'underline' }}
                            title="Open in Withdrawals review queue"
                          >
                            {String(tx.referenceId).substring(0, 8)}...
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{tx.referenceId ? `${String(tx.referenceId).substring(0, 8)}...` : '-'}</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-glass)',
              background: 'rgba(10, 13, 20, 0.5)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page {pagination.page} of {pagination.pages} ({pagination.total} total rows)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLedgerPage;
