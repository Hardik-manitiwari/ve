import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import RequireAdmin from './auth/RequireAdmin.jsx';
import Layout from './components/Layout.jsx';
import AdminLayout from './components/AdminLayout.jsx';

// Public pages
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

// User pages
import WalletPage from './pages/WalletPage.jsx';
import PayoutPage from './pages/PayoutPage.jsx';
import WithdrawalsPage from './pages/WithdrawalsPage.jsx';

// Admin pages
import AdminOverviewPage from './pages/admin/AdminOverviewPage.jsx';
import AdminWithdrawalsPage from './pages/admin/AdminWithdrawalsPage.jsx';
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx';
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage.jsx';
import AdminLedgerPage from './pages/admin/AdminLedgerPage.jsx';
import AdminReconcilePage from './pages/admin/AdminReconcilePage.jsx';
import AdminAuditPage from './pages/admin/AdminAuditPage.jsx';
import AdminTestPage from './pages/admin/AdminTestPage.jsx';

export const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes with standard Layout */}
          <Route
            element={
              <Layout>
                <Outlet />
              </Layout>
            }
          >
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* User Protected Routes with User Layout */}
          <Route element={<RequireAuth />}>
            <Route
              element={
                <Layout>
                  <Outlet />
                </Layout>
              }
            >
              <Route path="/" element={<Navigate to="/wallet" replace />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/payout" element={<PayoutPage />} />
              <Route path="/withdrawals" element={<WithdrawalsPage />} />
            </Route>

            {/* Admin Routes with RequireAdmin and AdminLayout (dedicated sidebar) */}
            <Route path="/admin" element={<RequireAdmin />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminOverviewPage />} />
                <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="users/:userId" element={<AdminUserDetailPage />} />
                <Route path="ledger" element={<AdminLedgerPage />} />
                <Route path="reconcile" element={<AdminReconcilePage />} />
                <Route path="audit" element={<AdminAuditPage />} />
                <Route path="test" element={<AdminTestPage />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/wallet" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
