import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AdminRoute from './auth/AdminRoute.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import WalletPage from './pages/WalletPage.jsx';
import PayoutPage from './pages/PayoutPage.jsx';
import WithdrawalsPage from './pages/WithdrawalsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

export const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected User Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/wallet" replace />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/payout" element={<PayoutPage />} />
              <Route path="/withdrawals" element={<WithdrawalsPage />} />
            </Route>

            {/* Protected Admin Console Routes */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/wallet" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
