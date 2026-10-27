import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import api from '../api/client.js';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';

export const AdminPage = () => {
  const { user, wallet, refreshWallet } = useAuth();
  const navigate = useNavigate();

  // Navigation tab: 'withdrawals' | 'users' | 'payout-options' | 'audit-logs'
  const [activeTab, setActiveTab] = useState('withdrawals');

  // Stats state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState('');
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState(null); // { withdrawal, targetStatus, notes, loading }

  // Users state
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Payout options state
  const [payoutOptions, setPayoutOptions] = useState([]);
  const [payoutOptionsLoading, setPayoutOptionsLoading] = useState(false);
  const [editingOption, setEditingOption] = useState(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Reconciliation modal state
  const [reconcileResult, setReconcileResult] = useState(null);
  const [reconcilingUser, setReconcilingUser] = useState(null);

  // Adjustment modal state
  const [adjustModal, setAdjustModal] = useState(null); // { targetUser, type, currency, amount, reason, loading, error }

  // Global alerts
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/admin/stats');
      if (res && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.warn('Failed to load admin stats:', err.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async (statusFilter = '') => {
    try {
      setWithdrawalsLoading(true);
      const query = new URLSearchParams({ limit: 50 });
      if (statusFilter) query.append('status', statusFilter);
      const res = await api.get(`/admin/withdrawals?${query.toString()}`);
      if (res && res.data) {
        setWithdrawals(res.data);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load withdrawals');
    } finally {
      setWithdrawalsLoading(false);
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async (search = '') => {
    try {
      setUsersLoading(true);
      const query = new URLSearchParams({ limit: 50 });
      if (search) query.append('search', search);
      const res = await api.get(`/admin/users?${query.toString()}`);
      if (res && res.data) {
        setUsers(res.data);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load users list');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Fetch payout options
  const fetchPayoutOptions = useCallback(async () => {
    try {
      setPayoutOptionsLoading(true);
      const res = await api.get('/admin/payout-options');
      if (res && res.data) {
        setPayoutOptions(res.data);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load payout options');
    } finally {
      setPayoutOptionsLoading(false);
    }
  }, []);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const res = await api.get('/admin/audit-logs?limit=40');
      if (res && res.data) {
        setAuditLogs(res.data);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchWithdrawals(withdrawalFilter);
  }, [fetchStats, fetchWithdrawals, withdrawalFilter]);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) fetchUsers(userSearch);
    if (activeTab === 'payout-options' && payoutOptions.length === 0) fetchPayoutOptions();
    if (activeTab === 'audit-logs' && auditLogs.length === 0) fetchAuditLogs();
  }, [activeTab, fetchUsers, fetchPayoutOptions, fetchAuditLogs, users.length, payoutOptions.length, auditLogs.length, userSearch]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewModal) return;

    try {
      setReviewModal((prev) => ({ ...prev, loading: true }));
      setActionError(null);
      const { withdrawal, targetStatus, notes } = reviewModal;
      const res = await api.post(`/admin/withdrawals/${withdrawal.withdrawalId || withdrawal.id}/review`, {
        status: targetStatus,
        reviewNotes: notes,
      });

      setActionSuccess(res.message || `Withdrawal updated to ${targetStatus}`);
      setReviewModal(null);
      await fetchWithdrawals(withdrawalFilter);
      await fetchStats();
      await refreshWallet();
    } catch (err) {
      setActionError(err.message || 'Failed to update withdrawal status');
      setReviewModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustModal) return;

    try {
      setAdjustModal((prev) => ({ ...prev, loading: true, error: null }));
      const endpoint = adjustModal.type === 'CREDIT' ? '/admin/credit' : '/admin/debit';
      const res = await api.post(endpoint, {
        userId: adjustModal.targetUser._id,
        currency: adjustModal.currency,
        amount: Number(adjustModal.amount),
        reason: adjustModal.reason || `Admin ${adjustModal.type.toLowerCase()} adjustment`,
      });

      setActionSuccess(res.message || `Successfully adjusted user balance`);
      setAdjustModal(null);
      await fetchUsers(userSearch);
      await fetchStats();
      await refreshWallet();
    } catch (err) {
      setAdjustModal((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Adjustment failed',
      }));
    }
  };

  const handleReconcileUser = async (targetUser) => {
    try {
      setReconcilingUser(targetUser);
      setReconcileResult(null);
      const res = await api.get(`/admin/reconcile/${targetUser._id}`);
      if (res && res.data) {
        setReconcileResult(res.data);
      }
    } catch (err) {
      setActionError(err.message || 'Reconciliation failed for user');
      setReconcilingUser(null);
    }
  };

  const handleUpdateOption = async (e) => {
    e.preventDefault();
    if (!editingOption) return;

    try {
      await api.patch(`/admin/payout-options/${editingOption.optionId}`, {
        requiredAmount: Number(editingOption.requiredAmount),
        feePercentage: Number(editingOption.feePercentage),
        minAmount: Number(editingOption.minAmount),
        maxAmount: Number(editingOption.maxAmount),
        isActive: Boolean(editingOption.isActive),
      });

      setActionSuccess(`Payout option "${editingOption.optionId}" updated successfully`);
      setEditingOption(null);
      await fetchPayoutOptions();
    } catch (err) {
      setActionError(err.message || 'Failed to update payout option');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Admin Executive Header */}
      <div
        className="card glass-panel"
        style={{
          borderLeft: '4px solid #c084fc',
          padding: '1.75rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="admin-badge">⚡ Root Administrator</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Node: <strong style={{ color: 'var(--success)' }}>rs0 (Primary Replica Set)</strong>
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
            System Operations & Rewards Control
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Review real-time withdrawals, inspect append-only ledger accounting, adjust user balances, and manage payout gateways.
          </p>
        </div>

        {/* Admin Testing Balance Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: 700 }}>
              Admin Test Balance
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ve-gold)' }}>
              🟡 {wallet?.VEs?.toLocaleString() ?? 0} VEs
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              💎 {wallet?.Gems ?? 0} Gems &bull; 🎟️ {wallet?.Tokens ?? 0} Tokens
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <button
              onClick={() => navigate('/payout')}
              className="btn btn-primary btn-sm"
              title="Test user redemption flow with admin points"
            >
              Test Redeem
            </button>
            <button
              onClick={() => {
                fetchStats();
                fetchWithdrawals(withdrawalFilter);
                refreshWallet();
              }}
              className="btn btn-secondary btn-sm"
              title="Refresh all metrics"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
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

      {/* Executive KPI Stats Cards */}
      <div className="admin-stats-grid">
        <div className="card glass-panel admin-stat-card">
          <div className="admin-stat-label">Pending Review Queue</div>
          <div className="admin-stat-value" style={{ color: stats?.pendingWithdrawalsCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {statsLoading ? '...' : stats?.pendingWithdrawalsCount ?? 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {statsLoading ? 'Calculating...' : `${(stats?.pendingWithdrawalsAmount ?? 0).toLocaleString()} VEs pending payout`}
          </div>
        </div>

        <div className="card glass-panel admin-stat-card">
          <div className="admin-stat-label">Total Registered Users</div>
          <div className="admin-stat-value" style={{ color: 'var(--info)' }}>
            {statsLoading ? '...' : stats?.totalUsers ?? 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Active rewards participants
          </div>
        </div>

        <div className="card glass-panel admin-stat-card">
          <div className="admin-stat-label">Circulating Points</div>
          <div className="admin-stat-value" style={{ color: 'var(--ve-gold)' }}>
            {statsLoading ? '...' : `${(stats?.totalCirculatingVEs ?? 0).toLocaleString()} VEs`}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            +{(stats?.totalCirculatingSVEs ?? 0).toLocaleString()} SVEs
          </div>
        </div>

        <div className="card glass-panel admin-stat-card">
          <div className="admin-stat-label">Immutable Ledger Rows</div>
          <div className="admin-stat-value" style={{ color: 'var(--success)' }}>
            {statsLoading ? '...' : (stats?.totalTransactions ?? 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            100% append-only verified
          </div>
        </div>
      </div>

      {/* Admin Panel Navigation Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab-btn ${activeTab === 'withdrawals' ? 'active' : ''}`}
          onClick={() => setActiveTab('withdrawals')}
        >
          <span>📋 Review Queue</span>
          {stats?.pendingWithdrawalsCount > 0 && (
            <span className="admin-count-pill">{stats.pendingWithdrawalsCount}</span>
          )}
        </button>

        <button
          className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <span>👥 Users & Wallets</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === 'payout-options' ? 'active' : ''}`}
          onClick={() => setActiveTab('payout-options')}
        >
          <span>⚙️ Payout Gateways</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === 'audit-logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit-logs')}
        >
          <span>📜 Audit Trails</span>
        </button>
      </div>

      {/* TAB 1: WITHDRAWALS REVIEW QUEUE */}
      {activeTab === 'withdrawals' && (
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Withdrawal Requests</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Approve requests or reject to trigger instant atomic ledger refund.
              </p>
            </div>

            {/* Status Filter Buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { label: 'All', value: '' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Processing', value: 'PROCESSING' },
                { label: 'Approved', value: 'APPROVED' },
                { label: 'Rejected', value: 'REJECTED' },
                { label: 'Cancelled', value: 'CANCELLED' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setWithdrawalFilter(f.value)}
                  className={`btn btn-sm ${withdrawalFilter === f.value ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {withdrawalsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Spinner size="lg" />
              <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>Loading withdrawal requests...</p>
            </div>
          ) : withdrawals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No withdrawal requests found for filter: "{withdrawalFilter || 'ALL'}"
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Created At</th>
                    <th>User / ID</th>
                    <th>Method & Details</th>
                    <th>Payout Value</th>
                    <th>VEs Debited</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => {
                    const isPending = w.status === 'PENDING';
                    const isProcessing = w.status === 'PROCESSING';
                    const canReview = isPending || isProcessing;

                    let statusBadgeClass = 'badge-warning';
                    if (w.status === 'APPROVED') statusBadgeClass = 'badge-success';
                    if (w.status === 'REJECTED') statusBadgeClass = 'badge-danger';
                    if (w.status === 'PROCESSING') statusBadgeClass = 'badge-info';
                    if (w.status === 'CANCELLED') statusBadgeClass = 'badge-secondary';

                    return (
                      <tr key={w.withdrawalId || w.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {new Date(w.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {w.userEmail || (w.userId?.email ?? 'Unknown User')}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            #{w.withdrawalId?.substring(0, 12)}...
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{w.method}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {w.payoutDetails?.paypalEmail ||
                              w.payoutDetails?.upiId ||
                              w.payoutDetails?.email ||
                              JSON.stringify(w.payoutDetails || {})}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {w.payoutCurrency === 'INR' ? '₹' : '$'}
                          {w.payoutValue?.toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--ve-gold)' }}>
                          🟡 {w.requiredAmount?.toLocaleString()} VEs
                        </td>
                        <td>
                          <span className={`badge ${statusBadgeClass}`}>{w.status}</span>
                          {w.reviewNotes && (
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                marginTop: '0.25rem',
                                maxWidth: '180px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={w.reviewNotes}
                            >
                              Note: {w.reviewNotes}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {canReview ? (
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              {isPending && (
                                <button
                                  onClick={() =>
                                    setReviewModal({
                                      withdrawal: w,
                                      targetStatus: 'PROCESSING',
                                      notes: 'Under active administrator verification',
                                      loading: false,
                                    })
                                  }
                                  className="btn btn-secondary btn-sm"
                                  title="Mark as processing"
                                >
                                  Process
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setReviewModal({
                                    withdrawal: w,
                                    targetStatus: 'APPROVED',
                                    notes: 'Payout dispatched successfully',
                                    loading: false,
                                  })
                                }
                                className="btn btn-success btn-sm"
                                title="Approve payout"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  setReviewModal({
                                    withdrawal: w,
                                    targetStatus: 'REJECTED',
                                    notes: 'Declined - points refunded to user wallet',
                                    loading: false,
                                  })
                                }
                                className="btn btn-danger btn-sm"
                                title="Reject and issue atomic refund"
                              >
                                Reject & Refund
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Finalized
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USERS & WALLET DIRECTORY */}
      {activeTab === 'users' && (
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>User Directory & Balances</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Adjust points via atomic ledger movements or audit ledger consistency per user.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search by email..."
                className="form-input"
                style={{ width: '220px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  fetchUsers(e.target.value);
                }}
              />
            </div>
          </div>

          {usersLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Spinner size="lg" />
              <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>Loading registered users...</p>
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No users matching search.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>VEs Balance</th>
                    <th>SVEs</th>
                    <th>Gems / Tokens</th>
                    <th>Registered</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.email}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          ID: {u._id}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: u.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                            color: u.role === 'admin' ? '#c084fc' : '#818cf8',
                            border: `1px solid ${u.role === 'admin' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(99, 102, 241, 0.3)'}`,
                          }}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--ve-gold)' }}>
                        🟡 {(u.wallet?.VEs ?? 0).toLocaleString()} VEs
                      </td>
                      <td style={{ color: 'var(--sve-cyan)', fontWeight: 600 }}>
                        {(u.wallet?.SVEs ?? 0).toLocaleString()}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        💎 {u.wallet?.Gems ?? 0} &bull; 🎟️ {u.wallet?.Tokens ?? 0}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() =>
                              setAdjustModal({
                                targetUser: u,
                                type: 'CREDIT',
                                currency: 'VEs',
                                amount: 1000,
                                reason: 'Administrative test grant',
                                loading: false,
                                error: null,
                              })
                            }
                            className="btn btn-secondary btn-sm"
                            title="Credit or Debit user points"
                          >
                            Adjust Balance
                          </button>
                          <button
                            onClick={() => handleReconcileUser(u)}
                            className="btn btn-secondary btn-sm"
                            title="Run ledger reconciliation test"
                          >
                            Reconcile
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYOUT OPTIONS CONFIGURATION */}
      {activeTab === 'payout-options' && (
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Payout Gateways & Redemption Catalog</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Configure required point amounts, redemption limits, processing fees, and active availability.
            </p>
          </div>

          {payoutOptionsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Spinner size="lg" />
              <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>Loading payout options...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {payoutOptions.map((opt) => (
                <div
                  key={opt.optionId}
                  className="card glass-panel"
                  style={{
                    padding: '1.25rem',
                    border: opt.isActive ? '1px solid var(--border-glass)' : '1px solid rgba(239, 68, 68, 0.3)',
                    background: opt.isActive ? 'var(--bg-card)' : 'rgba(239, 68, 68, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{opt.icon || '🎁'}</span>
                      <span className={`badge ${opt.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {opt.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{opt.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      {opt.description}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Required VEs:</span>
                        <strong style={{ color: 'var(--ve-gold)' }}>🟡 {opt.requiredAmount?.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Payout Value:</span>
                        <strong>{opt.payoutCurrency === 'INR' ? '₹' : '$'}{opt.payoutValue?.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Fee %:</span>
                        <span>{opt.feePercentage ?? 0}%</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditingOption({ ...opt })}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%' }}
                  >
                    Configure Option
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUDIT TRAILS */}
      {activeTab === 'audit-logs' && (
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>System Audit Trails</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Immutable transaction event stream capturing all administrative and user movements.
            </p>
          </div>

          {auditLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Spinner size="lg" />
              <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>Loading audit records...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No audit logs recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor ID</th>
                    <th>Target User</th>
                    <th>Metadata / Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log._id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: log.action.includes('REJECT')
                              ? 'var(--danger-bg)'
                              : log.action.includes('APPROV')
                              ? 'var(--success-bg)'
                              : 'rgba(99, 102, 241, 0.15)',
                            color: log.action.includes('REJECT')
                              ? 'var(--danger)'
                              : log.action.includes('APPROV')
                              ? 'var(--success)'
                              : 'var(--accent-primary)',
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {log.actorId}
                      </td>
                      <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {log.targetUserId || '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                        <code>{JSON.stringify(log.metadata || {})}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* REVIEW WITHDRAWAL MODAL */}
      {reviewModal && (
        <div className="admin-modal-overlay">
          <div className="card glass-panel admin-modal-content">
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
              {reviewModal.targetStatus === 'APPROVED' && '✅ Approve Withdrawal'}
              {reviewModal.targetStatus === 'REJECTED' && '❌ Reject & Refund Withdrawal'}
              {reviewModal.targetStatus === 'PROCESSING' && '⏳ Mark as Processing'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              {reviewModal.targetStatus === 'REJECTED'
                ? 'Rejecting will immediately refund all debited VEs back to the user wallet using an atomic REVERSAL ledger record.'
                : `Update request #${reviewModal.withdrawal.withdrawalId?.substring(0, 8)} to ${reviewModal.targetStatus}.`}
            </p>

            <form onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label className="form-label">Reviewer Notes (Recorded in Audit Trail)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={reviewModal.notes}
                  onChange={(e) => setReviewModal({ ...reviewModal, notes: e.target.value })}
                  placeholder="Optional notes or external transaction reference (e.g. PayPal Transaction ID)"
                  required={reviewModal.targetStatus === 'REJECTED'}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setReviewModal(null)}
                  className="btn btn-secondary"
                  disabled={reviewModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${
                    reviewModal.targetStatus === 'APPROVED'
                      ? 'btn-success'
                      : reviewModal.targetStatus === 'REJECTED'
                      ? 'btn-danger'
                      : 'btn-primary'
                  }`}
                  disabled={reviewModal.loading}
                >
                  {reviewModal.loading ? 'Updating...' : `Confirm ${reviewModal.targetStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BALANCE ADJUSTMENT MODAL */}
      {adjustModal && (
        <div className="admin-modal-overlay">
          <div className="card glass-panel admin-modal-content">
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
              ⚡ Adjust Balance: {adjustModal.targetUser.email}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Executes atomic balance mutation with strict ledger row creation.
            </p>

            {adjustModal.error && (
              <Alert type="danger" onClose={() => setAdjustModal({ ...adjustModal, error: null })}>
                {adjustModal.error}
              </Alert>
            )}

            <form onSubmit={handleAdjustSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Action</label>
                  <select
                    className="form-input"
                    value={adjustModal.type}
                    onChange={(e) => setAdjustModal({ ...adjustModal, type: e.target.value })}
                  >
                    <option value="CREDIT">CREDIT (+ Add Points)</option>
                    <option value="DEBIT">DEBIT (- Deduct Points)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Currency</label>
                  <select
                    className="form-input"
                    value={adjustModal.currency}
                    onChange={(e) => setAdjustModal({ ...adjustModal, currency: e.target.value })}
                  >
                    <option value="VEs">VEs (Main Currency)</option>
                    <option value="SVEs">SVEs</option>
                    <option value="Gems">Gems</option>
                    <option value="Tokens">Tokens</option>
                    <option value="Spins">Spins</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Amount</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-input"
                  value={adjustModal.amount}
                  onChange={(e) => setAdjustModal({ ...adjustModal, amount: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Reference Note</label>
                <input
                  type="text"
                  className="form-input"
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal({ ...adjustModal, reason: e.target.value })}
                  placeholder="e.g. VIP test bonus, support dispute correction"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setAdjustModal(null)}
                  className="btn btn-secondary"
                  disabled={adjustModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${adjustModal.type === 'CREDIT' ? 'btn-success' : 'btn-danger'}`}
                  disabled={adjustModal.loading}
                >
                  {adjustModal.loading ? 'Mutating...' : `Confirm ${adjustModal.type}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECONCILIATION RESULT MODAL */}
      {reconcilingUser && (
        <div className="admin-modal-overlay">
          <div className="card glass-panel admin-modal-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>
              🔍 Ledger Reconciliation Audit
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Target: <strong>{reconcilingUser.email}</strong>
            </p>

            {!reconcileResult ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Spinner size="md" />
                <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  Computing Sum(CREDIT) - Sum(DEBIT) across all ledger transactions...
                </p>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    background: reconcileResult.matches ? 'var(--success-bg)' : 'var(--danger-bg)',
                    border: `1px solid ${reconcileResult.matches ? 'var(--success)' : 'var(--danger)'}`,
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{reconcileResult.matches ? '🛡️' : '⚠️'}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: reconcileResult.matches ? 'var(--success)' : 'var(--danger)' }}>
                      {reconcileResult.matches ? 'LEDGER 100% RECONCILED' : 'DISCREPANCY DETECTED'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Every balance perfectly matches cumulative transaction movements.
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Currency</th>
                        <th>Wallet Balance</th>
                        <th>Ledger Net Movement</th>
                        <th>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(reconcileResult.details || {}).map((curr) => {
                        const item = reconcileResult.details[curr];
                        return (
                          <tr key={curr}>
                            <td style={{ fontWeight: 600 }}>{curr}</td>
                            <td>{item.walletBalance?.toLocaleString()}</td>
                            <td>{item.ledgerBalance?.toLocaleString()}</td>
                            <td>
                              <span className={`badge ${item.matches ? 'badge-success' : 'badge-danger'}`}>
                                {item.matches ? '✓ Match' : 'Mismatch'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setReconcilingUser(null)} className="btn btn-secondary">
                    Close Audit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT PAYOUT OPTION MODAL */}
      {editingOption && (
        <div className="admin-modal-overlay">
          <div className="card glass-panel admin-modal-content">
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
              ⚙️ Configure: {editingOption.name}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Option ID: <code>{editingOption.optionId}</code>
            </p>

            <form onSubmit={handleUpdateOption}>
              <div className="form-group">
                <label className="form-label">Required Points (VEs)</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={editingOption.requiredAmount}
                  onChange={(e) => setEditingOption({ ...editingOption, requiredAmount: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Fee Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    className="form-input"
                    value={editingOption.feePercentage}
                    onChange={(e) => setEditingOption({ ...editingOption, feePercentage: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-input"
                    value={editingOption.isActive ? 'true' : 'false'}
                    onChange={(e) => setEditingOption({ ...editingOption, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Active & Visible</option>
                    <option value="false">Disabled / Paused</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setEditingOption(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
