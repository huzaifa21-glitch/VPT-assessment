import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
