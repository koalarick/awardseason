import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import OAuthCallback from './pages/OAuthCallback';
import Dashboard from './pages/Dashboard';
import PoolDetail from './pages/PoolDetail';
import PoolEdit from './pages/PoolEdit';
import PoolInvite from './pages/PoolInvite';
import GlobalWinners from './pages/GlobalWinners';
import NomineeMetadata from './pages/NomineeMetadata';
import Users from './pages/Users';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/pool/:poolId/invite" element={<PoolInvite />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pool/:poolId"
            element={
              <ProtectedRoute>
                <PoolDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pool/:poolId/edit"
            element={
              <ProtectedRoute>
                <PoolEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/winners/global"
            element={
              <ProtectedRoute>
                <GlobalWinners />
              </ProtectedRoute>
            }
          />
          <Route
            path="/nominees/metadata"
            element={
              <ProtectedRoute>
                <NomineeMetadata />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
