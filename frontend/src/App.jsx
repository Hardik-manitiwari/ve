import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import WalletPage from './pages/WalletPage.jsx';
import PayoutPage from './pages/PayoutPage.jsx';
import WithdrawalsPage from './pages/WithdrawalsPage.jsx';

export const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/wallet" replace />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/payout" element={<PayoutPage />} />
              <Route path="/withdrawals" element={<WithdrawalsPage />} />
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
