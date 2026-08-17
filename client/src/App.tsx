import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MyBookingsPage from './pages/MyBookingsPage';
import ProfilePage from './pages/ProfilePage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboard from './pages/AdminDashboard';
import WorkerDashboard from './pages/WorkerDashboard';
import LoadingSpinner from './components/LoadingSpinner';

// Protected route for users
const UserRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!token || role !== 'user') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Protected route for admins
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!token || role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

// Protected route for workers
const WorkerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!token || role !== 'worker') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

// Redirect if already logged in
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (token) {
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'worker') return <Navigate to="/worker" replace />;
    if (role === 'user') return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#1e293b',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#1e293b',
              },
            },
          }}
        />

        <Routes>
          {/* Landing Page (Publicly accessible) */}
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/admin/login"
            element={
              <PublicRoute>
                <AdminLoginPage />
              </PublicRoute>
            }
          />

          {/* User routes */}
          <Route
            path="/dashboard"
            element={
              <UserRoute>
                <DashboardPage />
              </UserRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <UserRoute>
                <MyBookingsPage />
              </UserRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <UserRoute>
                <ProfilePage />
              </UserRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          {/* Worker routes */}
          <Route
            path="/worker"
            element={
              <WorkerRoute>
                <WorkerDashboard />
              </WorkerRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
