import { useCallback, useEffect, useState } from 'react';
import api, { showError } from '../api/axios';

/** GET an endpoint and keep the result; reload() re-fetches. */
export default function useFetch(endpoint, params = null, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params || {});

  const load = useCallback(async () => {
    if (!enabled || !endpoint) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(endpoint, { params: params || undefined });
      setData(res.data);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, key, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load, setData };
}
