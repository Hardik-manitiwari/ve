import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';

export const RequireAuth = () => {
  const { user, loading } = useAuth();
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('veloop_token') : null;

  if (loading && token) {
    return (
      <div className="loading-container">
        <Spinner size="lg" />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          Authenticating secure session...
        </p>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default RequireAuth;
