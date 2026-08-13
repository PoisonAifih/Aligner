import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { homePathForRole } from '../lib/roles';
import type { AppRole } from '../lib/roles';

export default function RequireAuth({ roles }: { roles?: AppRole[] }) {
  const { user, role, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-brand-green" />
          <p className="text-sm text-white/40">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/aligner" replace state={{ from: location.pathname }} />;
  }

  if (roles && !isAdmin && !roles.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <Outlet />;
}
