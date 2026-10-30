import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';

export const AdminOverviewPage = () => {
  const [summary, setSummary] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumRes, auditRes] = await Promise.all([
        api.get('/admin/summary'),
        api.get('/admin/audit?limit=20'),
      ]);

      if (sumRes?.data) {
        setSummary(sumRes.data);
      }
      if (auditRes?.data) {
        setAuditRows(auditRes.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load admin summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '50vh' }}>
        <Spinner size="lg" />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          Loading system summary and telemetry...
        </p>
      </div>
    );
  }

  const wCounts = summary?.withdrawalCounts || {};
  const cTotals = summary?.currencyTotals || {};
  const today = summary?.today || { approved: summary?.approvedToday || 0, rejected: summary?.rejectedToday || 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', marginBottom: '0.25rem' }}>System Overview</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Live metrics from immutable ledger & withdrawal state machine
          </p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>🔄</span>
          <span>Refresh Data</span>
        </button>
      </div>

      {error && (
        <Alert type="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Withdrawal Queue Status Cards */}
      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Withdrawal Pipeline
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="card glass-panel" style={{ borderLeft: '4px solid var(--warning)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Pending Review
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--warning)' }}>
              {wCounts.PENDING ?? 0}
            </div>
            <Link to="/admin/withdrawals?status=PENDING" style={{ fontSize: '0.8rem', marginTop: '0.5rem', display: 'inline-block' }}>
              Review Queue →
            </Link>
          </div>

          <div className="card glass-panel" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Processing
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem', color: '#60a5fa' }}>
              {wCounts.PROCESSING ?? 0}
            </div>
            <Link to="/admin/withdrawals?status=PROCESSING" style={{ fontSize: '0.8rem', marginTop: '0.5rem', display: 'inline-block' }}>
              In Flight →
            </Link>
          </div>

          <div className="card glass-panel" style={{ borderLeft: '4px solid var(--success)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Approved (Total)
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--success)' }}>
              {wCounts.APPROVED ?? 0}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Today (UTC): <strong style={{ color: 'var(--success)' }}>+{today.approved ?? 0}</strong>
            </div>
          </div>

          <div className="card glass-panel" style={{ borderLeft: '4px solid var(--danger)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Rejected / Reversals
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--danger)' }}>
              {wCounts.REJECTED ?? 0}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Today (UTC): <strong style={{ color: 'var(--danger)' }}>{today.rejected ?? 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Circulating Balances across all wallets */}
      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Total Circulating Balances (All Wallets)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="card glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--ve-gold)', fontWeight: 700, fontSize: '0.85rem' }}>
              <span>🟡</span>
              <span>VEs (Points)</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--ve-gold)' }}>
              {Number(cTotals.VEs ?? 0).toLocaleString()}
            </div>
          </div>

          <div className="card glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--sve-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>
              <span>🔷</span>
              <span>SVEs</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--sve-cyan)' }}>
              {Number(cTotals.SVEs ?? 0).toLocaleString()}
            </div>
          </div>

          <div className="card glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gem-ruby)', fontWeight: 700, fontSize: '0.85rem' }}>
              <span>💎</span>
              <span>Gems</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--gem-ruby)' }}>
              {Number(cTotals.Gems ?? 0).toLocaleString()}
            </div>
          </div>

          <div className="card glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--token-emerald)', fontWeight: 700, fontSize: '0.85rem' }}>
              <span>🪙</span>
              <span>Tokens</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--token-emerald)' }}>
              {Number(cTotals.Tokens ?? 0).toLocaleString()}
            </div>
          </div>

          <div className="card glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--spin-purple)', fontWeight: 700, fontSize: '0.85rem' }}>
              <span>🎡</span>
              <span>Spins</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--spin-purple)' }}>
              {Number(cTotals.Spins ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Recent 20 Audit Rows */}
      <div className="card glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>Recent System Audit Events</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              20 most recent immutable audit log records
            </p>
          </div>
          <Link to="/admin/audit" className="btn btn-secondary btn-sm">
            View All Audit Logs →
          </Link>
        </div>

        {auditRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No audit records logged yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Action</th>
                  <th>Target Type</th>
                  <th>Target User / Ref</th>
                  <th>IP Address</th>
                  <th>Metadata Summary</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((log) => (
                  <tr key={log._id}>
                    <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
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
                    <td>{log.targetType}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {log.targetUserId ? (
                        <Link to={`/admin/users/${log.targetUserId}`} style={{ color: 'var(--accent-primary)' }}>
                          {String(log.targetUserId).substring(0, 8)}...
                        </Link>
                      ) : (
                        log.referenceId || '-'
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {log.ip || '-'}
                    </td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(log.metadata || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOverviewPage;
