import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const LookupContext = createContext({ lookups: {}, reload: () => {} });

/** All dropdown masters + employees / departments / roles, loaded once after login. */
export function LookupProvider({ children }) {
  const { user } = useAuth();
  const [lookups, setLookups] = useState({});

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get('/masters/lookups');
      setLookups(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (user) reload();
    else setLookups({});
  }, [user, reload]);

  return <LookupContext.Provider value={{ lookups, reload }}>{children}</LookupContext.Provider>;
}

export const useLookups = () => useContext(LookupContext);

/** Convert a lookup list into {value,label} options. */
export function useOptions(key, labelKey = 'name') {
  const { lookups } = useLookups();
  return (lookups[key] || []).map((r) => ({ value: r.id, label: typeof labelKey === 'function' ? labelKey(r) : r[labelKey], raw: r }));
}
