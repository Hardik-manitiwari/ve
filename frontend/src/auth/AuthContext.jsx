import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const fetchCurrentUser = useCallback(async () => {
    const token = sessionStorage.getItem('veloop_token');
    if (!token) {
      setUser(null);
      setWallet(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setAuthError(null);
      const res = await api.get('/auth/me');
      if (res && res.data) {
        setUser(res.data.user);
        setWallet(res.data.wallet);
      }
    } catch (err) {
      console.warn('[Auth] Failed to restore session:', err.message);
      sessionStorage.removeItem('veloop_token');
      setUser(null);
      setWallet(null);
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const handleAuthExpired = () => {
      setUser(null);
      setWallet(null);
    };

    window.addEventListener('veloop_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('veloop_auth_expired', handleAuthExpired);
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    setAuthError(null);
    const res = await api.post('/auth/login', { email, password });
    if (res?.data?.token) {
      sessionStorage.setItem('veloop_token', res.data.token);
      setUser(res.data.user);
      // Fetch fresh wallet
      await fetchCurrentUser();
    }
    return res;
  };

  const register = async (email, password) => {
    setAuthError(null);
    const res = await api.post('/auth/register', { email, password });
    if (res?.data?.token) {
      sessionStorage.setItem('veloop_token', res.data.token);
      setUser(res.data.user);
      await fetchCurrentUser();
    }
    return res;
  };

  const logout = () => {
    sessionStorage.removeItem('veloop_token');
    setUser(null);
    setWallet(null);
  };

  const refreshWallet = async () => {
    try {
      const res = await api.get('/wallet');
      if (res?.data) {
        setWallet(res.data);
      }
      return res?.data;
    } catch (err) {
      console.error('[Auth] Failed to refresh wallet:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        loading,
        authError,
        login,
        register,
        logout,
        refreshWallet,
        fetchCurrentUser,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
