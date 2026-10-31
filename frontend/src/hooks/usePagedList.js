import { useCallback, useEffect, useRef, useState } from 'react';
import api, { showError } from '../api/axios';

/**
 * Server-side paginated list with search + filters.
 * Returns { rows, total, page, setPage, limit, setLimit, search, setSearch, filters, setFilter, setFilters, reload, loading }
 */
export default function usePagedList(endpoint, { initialFilters = {}, limit: initialLimit = 10, enabled = true } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearchState] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!enabled || !endpoint) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const params = { page, limit, search: debounced || undefined };
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) params[k] = v;
      });
      const { data } = await api.get(endpoint, { params });
      if (id !== reqId.current) return;
      if (Array.isArray(data)) {
        setRows(data);
        setTotal(data.length);
      } else {
        setRows(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      if (id === reqId.current) showError(e);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [endpoint, page, limit, debounced, filters, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const setSearch = (v) => {
    setSearchState(v);
    setPage(1);
  };
  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  /** Fetch every row matching the current filters (for export). */
  const fetchAll = async () => {
    const params = { all: 1, search: debounced || undefined };
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) params[k] = v;
    });
    const { data } = await api.get(endpoint, { params });
    return Array.isArray(data) ? data : data.data || [];
  };

  return { rows, total, page, setPage, limit, setLimit, search, setSearch, filters, setFilter, setFilters, reload: load, loading, fetchAll };
}
