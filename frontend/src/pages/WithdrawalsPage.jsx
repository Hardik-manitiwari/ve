import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';

export const WithdrawalsPage = () => {
  const { refreshWallet } = useAuth();

  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Cancel item state
  const [cancellingId, setCancellingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Detail modal state
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);

  const fetchWithdrawals = useCallback(async (page = 1, status = '') => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({ page, limit: 10 });
      if (status) query.append('status', status);

      const res = await api.get(`/withdrawals?${query.toString()}`);
      if (res?.data) {
        setWithdrawals(res.data);
        setPagination(res.pagination || { page, limit: 10, total: res.data.length, pages: 1 });
      }
    } catch (err) {
      setError(err.message || 'Failed to load withdrawals list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWithdrawals(pagination.page, statusFilter);
  }, [fetchWithdrawals, pagination.page, statusFilter]);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this withdrawal? Your VEs balance will be refunded immediately.')) {
      return;
    }

    try {
      setCancellingId(id);
      setActionError(null);
      setActionMessage(null);

      const res = await api.post(`/withdrawals/${id}/cancel`);
      setActionMessage(res.message || 'Withdrawal cancelled and balance refunded successfully.');

      // Refresh list & wallet
      await refreshWallet();
      await fetchWithdrawals(pagination.page, statusFilter);
    } catch (err) {
      setActionError(err.message || 'Failed to cancel withdrawal.');
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statuses = ['ALL', 'PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED'];

  return (
    <div>
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
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Withdrawal Requests</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Track the status of your redemption payouts and claim refunds.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {statuses.map((s) => {
            const isSelected = (s === 'ALL' && !statusFilter) || statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s === 'ALL' ? '' : s);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="btn btn-sm"
                style={{
                  background: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: isSelected ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-glass)',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {actionMessage && (
        <Alert type="success" onClose={() => setActionMessage(null)}>
          {actionMessage}
        </Alert>
      )}

      {actionError && (
        <Alert type="danger" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <div className="card" style={{ padding: '1.5rem' }}>
        {loading ? (
          <div className="loading-container">
            <Spinner />
            <p>Loading withdrawal requests...</p>
          </div>
        ) : error ? (
          <Alert type="danger">{error}</Alert>
        ) : withdrawals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🎁</span>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>No withdrawal requests found</p>
            <p style={{ fontSize: '0.85rem' }}>
              Redeem your available VEs points on the Payout page to submit a withdrawal.
            </p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Method</th>
                    <th>Payout Value</th>
                    <th>Required VEs</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((item) => {
                    const isPending = item.status === 'PENDING';
                    const isCancellingThis = cancellingId === item.id || cancellingId === item.withdrawalId;

                    return (
                      <tr key={item.id || item.withdrawalId}>
                        <td>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                            }}
                          >
                            #{item.withdrawalId ? item.withdrawalId.substring(0, 8) : item.id?.substring(0, 8)}
                          </span>
                        </td>
                        <td>
                          <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.85rem' }}>
                            {item.method}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1rem' }}>
                            ₹{item.payoutValue} {item.payoutCurrency}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--ve-gold)', fontWeight: 600 }}>
                            {item.requiredAmount?.toLocaleString()} {item.currency}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {formatDate(item.createdAt)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => setSelectedWithdrawal(item)}
                              className="btn btn-secondary btn-sm"
                              title="View details"
                            >
                              Details
                            </button>

                            {isPending && (
                              <button
                                onClick={() => handleCancel(item.withdrawalId || item.id)}
                                disabled={isCancellingThis}
                                className="btn btn-danger btn-sm"
                                title="Cancel and refund balance immediately"
                              >
                                {isCancellingThis ? <Spinner size="sm" /> : 'Cancel'}
                              </button>
                            )}
                          </div>
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
                  Page {pagination.page} of {pagination.pages} ({pagination.total} requests)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
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

      {/* Detail Modal */}
      {selectedWithdrawal && (
        <div className="modal-overlay" onClick={() => setSelectedWithdrawal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Withdrawal Details</h3>
              <StatusBadge status={selectedWithdrawal.status} />
            </div>

            <div
              style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.9rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedWithdrawal.withdrawalId || selectedWithdrawal.id}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Method:</span>
                <span>{selectedWithdrawal.method?.toUpperCase()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payout Amount:</span>
                <strong style={{ color: 'var(--success)' }}>
                  ₹{selectedWithdrawal.payoutValue} {selectedWithdrawal.payoutCurrency}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Deducted Points:</span>
                <strong style={{ color: 'var(--ve-gold)' }}>
                  {selectedWithdrawal.requiredAmount?.toLocaleString()} {selectedWithdrawal.currency}
                </strong>
              </div>

              {selectedWithdrawal.payoutDetails && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Recipient (Masked):</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {selectedWithdrawal.payoutDetails.upiId || selectedWithdrawal.payoutDetails.email || '—'}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Requested On:</span>
                <span>{formatDate(selectedWithdrawal.createdAt)}</span>
              </div>

              {selectedWithdrawal.reviewNotes && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-glass)' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                    Reviewer Notes:
                  </span>
                  <span style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>
                    "{selectedWithdrawal.reviewNotes}"
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {selectedWithdrawal.status === 'PENDING' && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    const idToCancel = selectedWithdrawal.withdrawalId || selectedWithdrawal.id;
                    setSelectedWithdrawal(null);
                    handleCancel(idToCancel);
                  }}
                >
                  Cancel Withdrawal
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedWithdrawal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WithdrawalsPage;
