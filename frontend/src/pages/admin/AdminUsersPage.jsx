import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';

export const AdminUsersPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async (targetPage = page, search = searchTerm) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: targetPage, limit: 20 });
      if (search && search.trim()) {
        params.append('search', search.trim());
      }

      const res = await api.get(`/admin/users?${params.toString()}`);
      if (res?.data) {
        setUsers(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load users list.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    fetchUsers(page, searchTerm);
  }, [fetchUsers, page, searchTerm]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, searchTerm);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', marginBottom: '0.25rem' }}>User & Balance Directory</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Browse registered accounts, inspect multi-currency wallet balances, and manage adjustments
          </p>
        </div>
      </div>

      {error && (
        <Alert type="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', maxWidth: '600px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by email address or user name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setPage(1);
              fetchUsers(1, '');
            }}
            className="btn btn-secondary"
          >
            Clear
          </button>
        )}
      </form>

      {/* Users Table */}
      <div className="card glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-container" style={{ padding: '4rem 1rem' }}>
            <Spinner size="lg" />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading user accounts...</p>
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
            No users found matching your search.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>User / Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>VEs (Gold)</th>
                  <th>SVEs</th>
                  <th>Gems</th>
                  <th>Tokens</th>
                  <th>Spins</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const id = u.id || u._id;
                  const wallet = u.wallet || u;

                  return (
                    <tr key={id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {u.name ? `${u.name} ` : ''}
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({u.email})</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ID: {String(id)}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: u.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                            color: u.role === 'admin' ? '#c084fc' : 'var(--text-secondary)',
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            color: u.accountStatus === 'active' ? 'var(--success)' : 'var(--danger)',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                          }}
                        >
                          ● {u.accountStatus}
                        </span>
                      </td>
                      <td style={{ color: 'var(--ve-gold)', fontWeight: 700 }}>
                        {(wallet.VEs ?? 0).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--sve-cyan)', fontWeight: 600 }}>
                        {(wallet.SVEs ?? 0).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--gem-ruby)', fontWeight: 600 }}>
                        {(wallet.Gems ?? 0).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--token-emerald)', fontWeight: 600 }}>
                        {(wallet.Tokens ?? 0).toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--spin-purple)', fontWeight: 600 }}>
                        {(wallet.Spins ?? 0).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <Link to={`/admin/users/${id}`} className="btn btn-secondary btn-sm">
                            Inspect & Adjust →
                          </Link>
                          <Link to={`/admin/reconcile?userId=${id}`} className="btn btn-secondary btn-sm" title="Reconcile user ledger">
                            ⚖️
                          </Link>
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
              Page {pagination.page} of {pagination.pages} ({pagination.total} total accounts)
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

export default AdminUsersPage;
