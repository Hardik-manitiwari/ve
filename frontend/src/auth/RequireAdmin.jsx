import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import api from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

export const RequireAdmin = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const [role, setRole] = useState(user?.role || null);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const verifyAdminRole = async () => {
      try {
        setVerifying(true);
        // Explicitly verify role fresh from GET /api/auth/me as required
        const res = await api.get('/auth/me');
        if (isMounted) {
          if (res?.data?.user?.role) {
            setRole(res.data.user.role);
          } else {
            setRole(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to verify administrative authorization.');
          setRole(null);
        }
      } finally {
        if (isMounted) {
          setVerifying(false);
        }
      }
    };

    verifyAdminRole();

    return () => {
      isMounted = false;
    };
  }, []);

  if (authLoading || verifying) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <Spinner size="lg" />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          Verifying administrative permissions from server...
        </p>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div style={{ maxWidth: '520px', margin: '4rem auto', textAlign: 'center', padding: '1rem' }}>
        <div className="card glass-panel" style={{ padding: '2.5rem 2rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: 'var(--danger)',
              fontSize: '2rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}
          >
            🚫
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem', color: 'var(--danger)' }}>
            403 - Access Forbidden
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            You do not have administrative privileges to access the VELoop Admin Console.
            Your current account role is <strong style={{ color: 'var(--text-primary)' }}>{role || 'user'}</strong>.
          </p>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                color: '#fca5a5',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/wallet" className="btn btn-primary">
              Return to Wallet
            </Link>
            <button onClick={logout} className="btn btn-secondary">
              Sign In as Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default RequireAdmin;
