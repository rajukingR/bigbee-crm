import { useEffect, useState } from 'react';
import api from '../api/axios';

const cache = new Map();
const TTL = 60 * 1000;

/** Drop cached option lists (call after creating / editing a record). */
export function invalidateOptions(prefix = '') {
  [...cache.keys()].forEach((k) => {
    if (k.startsWith(prefix)) cache.delete(k);
  });
}

/**
 * Load dropdown options from a list endpoint (uses ?all=1).
 * label: (row) => string
 */
export default function useRemoteOptions(endpoint, { label = (r) => r.name, params = {}, enabled = true } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const key = `${endpoint}?${JSON.stringify(params)}`;

  useEffect(() => {
    if (!endpoint || !enabled) {
      setRows([]);
      return undefined;
    }
    let alive = true;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      setRows(hit.rows);
      return undefined;
    }
    setLoading(true);
    api
      .get(endpoint, { params: { all: 1, ...params } })
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : r.data.data || [];
        cache.set(key, { at: Date.now(), rows: data });
        if (alive) setRows(data);
      })
      .catch(() => alive && setRows([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { options: rows.map((r) => ({ value: r.id, label: label(r), raw: r })), rows, loading };
}
