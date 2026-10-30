import React from 'react';
import { NavLink, Link, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/admin', label: 'Overview', icon: '📊', end: true },
    { to: '/admin/withdrawals', label: 'Withdrawals', icon: '💳' },
    { to: '/admin/users', label: 'Users', icon: '👥' },
    { to: '/admin/ledger', label: 'Ledger', icon: '📜' },
    { to: '/admin/reconcile', label: 'Reconciliation', icon: '⚖️' },
    { to: '/admin/audit', label: 'Audit', icon: '🛡️' },
    { to: '/admin/test', label: 'Test', icon: '🧪' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Admin Sidebar */}
      <aside
        style={{
          width: '260px',
          background: 'rgba(16, 22, 35, 0.95)',
          borderRight: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 50,
          flexShrink: 0,
        }}
      >
        {/* Brand & Sidebar Label */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              boxShadow: '0 0 16px rgba(168, 85, 247, 0.4)',
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              VELoop
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#c084fc',
              }}
            >
              Admin
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
          <div
            style={{
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              padding: '0 0.75rem 0.5rem',
              fontWeight: 700,
            }}
          >
            Management
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.7rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                background: isActive ? 'linear-gradient(90deg, rgba(168, 85, 247, 0.22) 0%, rgba(99, 102, 241, 0.12) 100%)' : 'transparent',
                borderLeft: isActive ? '3px solid #a855f7' : '3px solid transparent',
                transition: 'all 0.15s ease',
              })}
            >
              <span style={{ fontSize: '1.15rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div
          style={{
            padding: '1.25rem 1rem',
            borderTop: '1px solid var(--border-glass)',
            background: 'rgba(10, 13, 20, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
              }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link
              to="/wallet"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: '0.8rem', justifyContent: 'center' }}
              title="Open User Wallet"
            >
              User App
            </Link>
            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              title="Sign Out"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Admin Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        <header
          style={{
            height: '60px',
            borderBottom: '1px solid var(--border-glass)',
            background: 'rgba(16, 22, 35, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                color: '#c084fc',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              🛡️ Admin Console
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              VELoop High-Concurrency Ledger & Payouts
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              to="/wallet"
              style={{
                fontSize: '0.85rem',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
              }}
            >
              <span>←</span>
              <span>Back to User Wallet</span>
            </Link>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
