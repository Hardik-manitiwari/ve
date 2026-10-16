import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner size="lg" />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          Authenticating secure session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
