import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export const Layout = ({ children }) => {
  const { user, wallet, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      <header className="navbar">
        <div className="navbar-inner">
          <div className="brand" onClick={() => navigate('/wallet')}>
            <div className="brand-icon">⚡</div>
            <span>VELoop</span>
          </div>

          {user && (
            <nav className="nav-links">
              {user.role === 'admin' && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => `nav-link admin-nav-link ${isActive ? 'active' : ''}`}
                >
                  <span>🛡️</span>
                  <span>Admin Panel</span>
                </NavLink>
              )}
              <NavLink
                to="/wallet"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Wallet
              </NavLink>
              <NavLink
                to="/payout"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Redeem
              </NavLink>
              <NavLink
                to="/withdrawals"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                History
              </NavLink>
            </nav>
          )}

          {user ? (
            <div className="nav-user">
              {user.role === 'admin' && (
                <span className="admin-badge" title="Administrator Privileges Enabled">
                  🛡️ Admin
                </span>
              )}

              {wallet && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '9999px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: 'var(--ve-gold)',
                  }}
                  title="Your current VEs balance"
                >
                  <span>🟡</span>
                  <span>{wallet.VEs?.toLocaleString() ?? 0} VEs</span>
                </div>
              )}

              <span className="user-email-badge" title={user.email}>
                {user.email}
              </span>

              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                title="Log out of session"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="nav-user">
              <NavLink to="/login" className="btn btn-secondary btn-sm">
                Login
              </NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">
                Register
              </NavLink>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">{children}</main>

      <footer
        style={{
          borderTop: '1px solid var(--border-glass)',
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          background: 'rgba(10, 13, 20, 0.95)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>© 2026 VELoop Rewards. Atomic multi-document ledger backed by MongoDB replica set rs0.</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>Single-Node Replica Set Active</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
