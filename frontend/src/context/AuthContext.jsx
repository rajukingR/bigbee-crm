import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('bb_token')) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {
      localStorage.removeItem('bb_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('bb_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('bb_token');
    setUser(null);
  };

  /** can('leads','create') */
  const can = useCallback(
    (module, action = 'view') => {
      if (!user) return false;
      if (user.is_super_admin) return true;
      const p = user.permissions && user.permissions[module];
      return !!(p && p[action]);
    },
    [user]
  );

  const canAny = useCallback((modules, action = 'view') => modules.some((m) => can(m, action)), [can]);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, refresh, can, canAny }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
