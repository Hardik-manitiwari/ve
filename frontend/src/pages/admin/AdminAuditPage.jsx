import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';

const AUDIT_ACTIONS = [
  '',
  'WITHDRAWAL_CREATED',
  'WITHDRAWAL_PROCESSING',
  'WITHDRAWAL_APPROVED',
  'WITHDRAWAL_REJECTED',
  'WITHDRAWAL_CANCELLED',
  'WALLET_CREDIT',
  'WALLET_DEBIT',
  'BALANCE_CORRECTION',
  'PAYOUT_CONFIG_CHANGED',
];

export const AdminAuditPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [actionFilter, setActionFilter] = useState(searchParams.get('action') || '');
  const [targetUserFilter, setTargetUserFilter] = useState(searchParams.get('targetUserId') || '');
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMeta, setSelectedMeta] = useState(null);

  const fetchAudit = useCallback(async (targetPage = page) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: targetPage, limit: 20 });
      if (actionFilter) params.append('action', actionFilter);
      if (targetUserFilter) params.append('targetUserId', targetUserFilter.trim());

      const res = await api.get(`/admin/audit?${params.toString()}`);
      if (res?.data) {
        setLogs(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, targetUserFilter]);

  useEffect(() => {
    fetchAudit(page);
  }, [fetchAudit, page]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAudit(1);
  };

  const handleClearFilters = () => {
    setActionFilter('');
    setTargetUserFilter('');
    setSearchParams({});
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', marginBottom: '0.25rem' }}>System Audit Trails</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Immutable forensic logs capturing all administrative mutations, reviews, and config changes
          </p>
        </div>
        <button onClick={() => fetchAudit(page)} className="btn btn-secondary btn-sm">
          <span>🔄</span> <span>Refresh</span>
        </button>
      </div>

      {error && (
        <Alert type="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filter Card */}
      <div className="card glass-panel" style={{ padding: '1.25rem' }}>
        <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Filter by Action</label>
            <select
              className="form-input"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              {AUDIT_ACTIONS.map((act) => (
                <option key={act} value={act}>
                  {act === '' ? 'All Actions' : act}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Filter by Target User ID</label>
            <input
              type="text"
              className="form-input"
              placeholder="Target User ID..."
              value={targetUserFilter}
              onChange={(e) => setTargetUserFilter(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">
              Filter
            </button>
            <button type="button" onClick={handleClearFilters} className="btn btn-secondary">
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Table Card */}
      <div className="card glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-container" style={{ padding: '4rem 1rem' }}>
            <Spinner size="lg" />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
            No audit records match your filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Action</th>
                  <th>Target Type</th>
                  <th>Target User</th>
                  <th>Actor ID</th>
                  <th>IP Address</th>
                  <th style={{ textAlign: 'right' }}>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          background:
                            log.action === 'BALANCE_CORRECTION'
                              ? 'rgba(236, 72, 153, 0.2)'
                              : log.action.includes('APPROVED')
                              ? 'var(--success-bg)'
                              : log.action.includes('REJECTED')
                              ? 'var(--danger-bg)'
                              : 'rgba(99, 102, 241, 0.15)',
                          color:
                            log.action === 'BALANCE_CORRECTION'
                              ? '#f472b6'
                              : log.action.includes('APPROVED')
                              ? 'var(--success)'
                              : log.action.includes('REJECTED')
                              ? 'var(--danger)'
                              : 'var(--accent-primary)',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td>{log.targetType || 'N/A'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {log.targetUserId ? (
                        <Link to={`/admin/users/${log.targetUserId}`} style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {String(log.targetUserId).substring(0, 8)}...
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {log.actorId ? `${String(log.actorId).substring(0, 8)}...` : '-'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {log.ip || '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedMeta(log)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      >
                        Inspect Payload
                      </button>
                    </td>
                  </tr>
                ))}
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
              Page {pagination.page} of {pagination.pages} ({pagination.total} total log records)
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

      {/* Metadata Payload Modal */}
      {selectedMeta && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '600px', width: '90%' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
              Audit Event Payload
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Action: <strong style={{ color: 'var(--accent-primary)' }}>{selectedMeta.action}</strong> • Reference: {selectedMeta.referenceId || 'N/A'}
            </p>

            <pre
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                overflowX: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: '#e2e8f0',
                maxHeight: '360px',
                border: '1px solid var(--border-glass)',
              }}
            >
              {JSON.stringify(selectedMeta.metadata || {}, null, 2)}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setSelectedMeta(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditPage;
