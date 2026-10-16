import React from 'react';
import Spinner from './Spinner.jsx';

export const TransactionList = ({
  transactions = [],
  loading = false,
  error = null,
  pagination = {},
  onPageChange,
  currencyFilter = '',
  onCurrencyFilterChange,
}) => {
  const currencies = ['ALL', 'VEs', 'SVEs', 'Gems', 'Tokens', 'Spins'];

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.25rem' }}>Ledger Activity</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Immutable, append-only transaction history
          </p>
        </div>

        {/* Currency Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {currencies.map((curr) => {
            const isSelected = (curr === 'ALL' && !currencyFilter) || currencyFilter === curr;
            return (
              <button
                key={curr}
                onClick={() => onCurrencyFilterChange && onCurrencyFilterChange(curr === 'ALL' ? '' : curr)}
                className="btn btn-sm"
                style={{
                  background: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: isSelected ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-glass)',
                  padding: '0.3rem 0.65rem',
                }}
              >
                {curr}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <Spinner />
          <p>Loading ledger entries...</p>
        </div>
      ) : error ? (
        <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '2rem' }}>
          <p>Error loading transactions: {error}</p>
        </div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📜</span>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>No transactions found</p>
          <p style={{ fontSize: '0.85rem' }}>
            Earn rewards or complete actions to generate verified ledger entries.
          </p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Balance After</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isCredit = tx.type === 'CREDIT';
                  return (
                    <tr key={tx._id || tx.transactionId}>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: isCredit ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: isCredit ? 'var(--success)' : 'var(--danger)',
                            border: `1px solid ${isCredit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          }}
                        >
                          {isCredit ? '↓ CREDIT' : '↑ DEBIT'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {tx.category}
                        </span>
                      </td>
                      <td>
                        <span className={isCredit ? 'amount-credit' : 'amount-debit'}>
                          {isCredit ? '+' : '-'}{tx.amount?.toLocaleString()} {tx.currency}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '320px' }}>
                        {tx.description || '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {tx.balanceAfter?.toLocaleString()} {tx.currency}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {formatDate(tx.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="pagination">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Page {pagination.page} of {pagination.pages} ({pagination.total} records)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TransactionList;
