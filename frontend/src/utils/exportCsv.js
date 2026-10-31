import api from '../api/axios';

/**
 * Export rows to CSV (opens in Excel).
 * columns: [{ key, label, exportValue?: (row) => any }]
 */
export function exportCsv(filename, columns, rows, meta = {}) {
  const cols = columns.filter((c) => c.key && c.label && c.export !== false);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [cols.map((c) => esc(c.label)).join(',')];
  rows.forEach((r) => {
    lines.push(cols.map((c) => esc(c.exportValue ? c.exportValue(r) : r[c.key])).join(','));
  });
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  // Audit trail of exports
  api.post('/reports/log-export', { report: filename, rows: rows.length, module: meta.module, filters: meta.filters }).catch(() => {});
}
