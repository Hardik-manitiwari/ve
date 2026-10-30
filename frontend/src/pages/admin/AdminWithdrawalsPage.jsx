import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

export const AdminWithdrawalsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [withdrawals, setWithdrawals] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Action Confirmation Modal state:
  // { withdrawal, targetStatus, reason, loading, error, balanceEffect }
  const [confirmModal, setConfirmModal] = useState(null);

  const fetchWithdrawals = useCallback(async (targetPage = page, status = statusFilter) => {
    try {
      setLoading(true);
      setActionError(null);
      const params = new URLSearchParams({ page: targetPage, limit: 20 });
      if (status) params.append('status', status);

      const res = await api.get(`/admin/withdrawals?${params.toString()}`);
      if (res?.data) {
        setWithdrawals(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setActionError(err.message || 'Failed to fetch withdrawals.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchWithdrawals(page, statusFilter);
  }, [fetchWithdrawals, page, statusFilter]);

  const handleFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
    setSearchParams(newStatus ? { status: newStatus } : {});
  };

  const openActionModal = (withdrawal, targetStatus) => {
    let balanceEffect = '';
    if (targetStatus === 'PROCESSING') {
      balanceEffect = 'No balance effect. Points were already debited upon submission.';
    } else if (targetStatus === 'APPROVED') {
      balanceEffect = 'Points remain debited permanently. Payout is marked completed.';
    } else if (targetStatus === 'REJECTED') {
      balanceEffect = `Will immediately restore +${withdrawal.requiredAmount?.toLocaleString()} ${withdrawal.currency} back to the user's wallet via an atomic REVERSAL ledger entry.`;
    }

    setConfirmModal({
      withdrawal,
      targetStatus,
      reason: '',
      loading: false,
      error: null,
      balanceEffect,
    });
  };

  const executeReviewAction = async () => {
    if (!confirmModal) return;
    const { withdrawal, targetStatus, reason } = confirmModal;

    if (targetStatus === 'REJECTED') {
      if (!reason || reason.trim().length < 3) {
        setConfirmModal((prev) => ({
          ...prev,
          error: 'A rejection reason of at least 3 characters is required.',
        }));
        return;
      }
    }

    try {
      setConfirmModal((prev) => ({ ...prev, loading: true, error: null }));
      const payload = {
        status: targetStatus,
        reviewNotes: reason ? reason.trim() : `Admin marked ${targetStatus}`,
      };

      await api.post(`/admin/withdrawals/${withdrawal.withdrawalId || withdrawal.id}/review`, payload);

      setActionSuccess(`Withdrawal #${(withdrawal.withdrawalId || withdrawal.id).substring(0, 8)} successfully updated to ${targetStatus}.`);
      setConfirmModal(null);
      await fetchWithdrawals(page, statusFilter);
    } catch (err) {
      if (err.status === 409) {
        // State collision: reload list as requested by requirements
        setActionError(`Conflict (409): ${err.message}. Reloading latest withdrawal state.`);
        setConfirmModal(null);
        await fetchWithdrawals(page, statusFilter);
      } else {
        setConfirmModal((prev) => ({
          ...prev,
          loading: false,
          error: err.message || 'Failed to update withdrawal status.',
        }));
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', marginBottom: '0.25rem' }}>Withdrawal Review Queue</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Inspect, process, approve, or reject user redemption requests with atomic balance reversals
          </p>
        </div>
        <button
          onClick={() => fetchWithdrawals(page, statusFilter)}
          className="btn btn-secondary btn-sm"
        >
          <span>🔄</span> <span>Refresh</span>
        </button>
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

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
        {['', 'PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
          <button
            key={st}
            onClick={() => handleFilterChange(st)}
            className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontWeight: 600 }}
          >
            {st === '' ? 'All Statuses' : st}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-container" style={{ padding: '4rem 1rem' }}>
            <Spinner size="lg" />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading withdrawal queue...</p>
          </div>
        ) : withdrawals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
            No withdrawal requests match the selected criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>Withdrawal ID</th>
                  <th>User Email</th>
                  <th>Amount Debited</th>
                  <th>Payout Target</th>
                  <th>Status</th>
                  <th>Date (UTC)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => {
                  const id = w.withdrawalId || w._id;
                  const canProcess = w.status === 'PENDING';
                  const canApprove = w.status === 'PENDING' || w.status === 'PROCESSING';
                  const canReject = w.status === 'PENDING' || w.status === 'PROCESSING';

                  return (
                    <tr key={id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {id.substring(0, 8)}...
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>
                        {w.userEmail || w.userId?.email || String(w.userId).substring(0, 8)}
                      </td>
                      <td>
                        <strong style={{ color: 'var(--ve-gold)' }}>
                          {w.requiredAmount?.toLocaleString()} {w.currency}
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {w.payoutCurrency} {w.payoutValue}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {w.method} {w.payoutDetails ? `(${Object.values(w.payoutDetails)[0]})` : ''}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={w.status} />
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(w.createdAt).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          {canProcess && (
                            <button
                              onClick={() => openActionModal(w, 'PROCESSING')}
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.4)' }}
                              title="Set to PROCESSING"
                            >
                              Process
                            </button>
                          )}
                          {canApprove && (
                            <button
                              onClick={() => openActionModal(w, 'APPROVED')}
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                              title="Approve Withdrawal"
                            >
                              Approve
                            </button>
                          )}
                          {canReject && (
                            <button
                              onClick={() => openActionModal(w, 'REJECTED')}
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                              title="Reject & Refund User"
                            >
                              Reject
                            </button>
                          )}
                          {!canProcess && !canApprove && !canReject && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Terminal ({w.status})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
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
              Page {pagination.page} of {pagination.pages} ({pagination.total} total items)
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

      {/* Confirmation & Rejection Reason Modal */}
      {confirmModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '480px', width: '90%' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Confirm {confirmModal.targetStatus}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Withdrawal ID:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {confirmModal.withdrawal.withdrawalId || confirmModal.withdrawal._id}
              </span>
            </p>

            {/* Balance Effect Statement */}
            <div
              style={{
                background:
                  confirmModal.targetStatus === 'REJECTED'
                    ? 'rgba(239, 68, 68, 0.12)'
                    : confirmModal.targetStatus === 'APPROVED'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(59, 130, 246, 0.12)',
                border:
                  confirmModal.targetStatus === 'REJECTED'
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : confirmModal.targetStatus === 'APPROVED'
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid rgba(59, 130, 246, 0.3)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                lineHeight: 1.5,
              }}
            >
              <strong>Balance Effect:</strong> {confirmModal.balanceEffect}
            </div>

            {/* Rejection Reason Input */}
            {confirmModal.targetStatus === 'REJECTED' && (
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">
                  Rejection Reason (at least 3 characters required) *
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Invalid UPI VPA handle, Suspicious velocity activity..."
                  value={confirmModal.reason}
                  onChange={(e) =>
                    setConfirmModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  required
                />
              </div>
            )}

            {confirmModal.error && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {confirmModal.error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="btn btn-secondary"
                disabled={confirmModal.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeReviewAction}
                className={`btn ${
                  confirmModal.targetStatus === 'REJECTED' ? 'btn-danger' : 'btn-primary'
                }`}
                disabled={confirmModal.loading}
              >
                {confirmModal.loading ? <Spinner size="sm" /> : `Confirm ${confirmModal.targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWithdrawalsPage;
