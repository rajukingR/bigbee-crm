import { useState } from 'react';
import usePagedList from '../../hooks/usePagedList';
import useFetch from '../../hooks/useFetch';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import ListToolbar from '../../components/common/ListToolbar';
import Modal from '../../components/common/Modal';
import { fmtDateTime } from '../../utils/format';
import { toOptions } from '../../utils/constants';

const ACTIONS = ['create', 'update', 'delete', 'login', 'export', 'approve', 'reject', 'reassign', 'stage_change', 'won', 'convert', 'upload', 'import', 'update_permissions'];

export default function AuditLogs() {
  const list = usePagedList('/audit-logs', { limit: 25 });
  const { data: modules } = useFetch('/audit-logs/modules');
  const [detail, setDetail] = useState(null);
  return (
    <div className="card">
      <div className="border-b border-line px-5 py-4">
        <ListToolbar
          title="Audit Trail (read-only)"
          search={list.search}
          onSearch={list.setSearch}
          filters={[
            { name: 'module', label: 'All Modules', options: toOptions(modules || []) },
            { name: 'action', label: 'All Actions', options: toOptions(ACTIONS) },
            { name: 'user_id', label: 'All Users', lookup: 'employees', labelKey: 'full_name' },
            { name: 'from', label: 'From', type: 'date' },
            { name: 'to', label: 'To', type: 'date' },
          ]}
          filterValues={list.filters}
          onFilter={list.setFilter}
        />
      </div>
      <div className="px-2">
        <DataTable
          loading={list.loading}
          rows={list.rows}
          onRowClick={(r) => setDetail(r)}
          columns={[
            { key: 'created_at', label: 'When', render: (r) => fmtDateTime(r.created_at) },
            { key: 'user_name', label: 'User', render: (r) => r.user_name || 'System' },
            { key: 'action', label: 'Action', render: (r) => <span className="chip bg-slate-100 text-slate-700">{r.action}</span> },
            { key: 'module', label: 'Module' },
            { key: 'entity_id', label: 'Record ID' },
            { key: 'details', label: 'Details', render: (r) => <span className="line-clamp-1 max-w-md font-mono text-[11px] text-slate-500">{r.details ? (typeof r.details === 'string' ? r.details : JSON.stringify(r.details)) : '—'}</span> },
            { key: 'ip_address', label: 'IP' },
          ]}
        />
        <Pagination page={list.page} total={list.total} limit={list.limit} onPage={list.setPage} onLimit={list.setLimit} />
      </div>
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.action} · ${detail.module} #${detail.entity_id || ''}` : ''} size="lg">
        {detail && (
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
            {JSON.stringify(typeof detail.details === 'string' ? JSON.parse(detail.details || 'null') : detail.details, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
  );
}
