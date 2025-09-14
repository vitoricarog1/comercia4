import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout/Layout';
import { apiService } from './services/api';
import { useAnalytics } from './hooks/useAnalytics';

// Lazy load components for better performance
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.default })));
const Agents = lazy(() => import('./pages/Agents').then(module => ({ default: module.Agents })));
const Conversations = lazy(() => import('./pages/Conversations').then(module => ({ default: module.Conversations })));
const Integrations = lazy(() => import('./pages/Integrations').then(module => ({ default: module.Integrations })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const WhatsApp = lazy(() => import('./pages/WhatsApp'));
const Chat = lazy(() => import('./pages/Chat'));
const Payments = lazy(() => import('./pages/Payments'));
const Admin = lazy(() => import('./pages/Admin'));
const Barbearia = lazy(() => import('./pages/Barbearia').then(module => ({ default: module.Barbearia })));


// Loading component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, dispatch } = useApp();

  useEffect(() => {
    const checkAuth = () => {
      if (apiService.isAuthenticated()) {
        const user = apiService.getCurrentUser();
        if (user) {
          dispatch({ type: 'SET_USER', payload: user });
        }
      }
    };

    checkAuth();
  }, [dispatch]);

  if (!apiService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Componente para rastrear mudanças de rota
const RouteTracker: React.FC = () => {
  const location = useLocation();
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    const pageName = location.pathname === '/' ? 'dashboard' : location.pathname.slice(1);
    trackPageView(pageName, {
      search: location.search,
      hash: location.hash,
    });
  }, [location, trackPageView]);

  return null;
};

const AppContent: React.FC = () => {
  return (
    <Router>
      <RouteTracker />
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/barbearia" 
            element={
              <ProtectedRoute>
                <Barbearia />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/barbearia/*" 
            element={
              <ProtectedRoute>
                <Barbearia />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/agents" element={<Agents />} />
                      <Route path="/conversations" element={<Conversations />} />
                      <Route path="/whatsapp" element={<WhatsApp />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/integrations" element={<Integrations />} />
                      <Route path="/analytics" element={<Dashboard />} />
                      <Route path="/training" element={<Dashboard />} />
                      <Route path="/channels" element={<Integrations />} />
                      <Route path="/alerts" element={<Dashboard />} />
                      <Route path="/payments" element={<Payments />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/settings" element={<Settings />} />
                    </Routes>
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;