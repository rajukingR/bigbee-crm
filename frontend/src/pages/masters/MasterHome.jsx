import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MASTER_MENU } from '../../config/menu';

/** /masters → first master page the user can open. */
export default function MasterHome() {
  const { can } = useAuth();
  const first = MASTER_MENU.find((m) => can(m.module));
  if (!first) return <div className="card p-10 text-center text-slate-500">You do not have access to any master.</div>;
  return <Navigate to={first.path} replace />;
}
