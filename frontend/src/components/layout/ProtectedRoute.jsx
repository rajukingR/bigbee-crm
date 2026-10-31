import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

/** Requires login; optionally a module permission (string or array = any of). */
export default function ProtectedRoute({ children, module, action = 'view' }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();
  if (loading) return <Loader full />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (module) {
    const list = Array.isArray(module) ? module : [module];
    if (!list.some((m) => can(m, action))) {
      return (
        <div className="card mx-auto mt-10 max-w-lg p-10 text-center">
          <div className="text-lg font-semibold">Access denied</div>
          <p className="mt-2 text-sm text-slate-500">Your role does not have permission to view this page. Contact your administrator.</p>
        </div>
      );
    }
  }
  return children;
}
