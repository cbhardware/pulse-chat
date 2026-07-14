import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ChatPage } from './pages/ChatPage';
import { GroupsPage } from './pages/GroupsPage';
import { LoginPage } from './pages/LoginPage';

function LoadingScreen() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>PulseChat</h1>
        <p className="muted">Loading session...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/groups" element={user ? <GroupsPage /> : <Navigate to="/login" replace />} />
      <Route path="/groups/:groupId" element={user ? <ChatPage /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={user ? '/groups' : '/login'} replace />} />
    </Routes>
  );
}
