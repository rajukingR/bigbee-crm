import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuCheck, LuX } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import usePagedList from '../../hooks/usePagedList';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import ListToolbar from '../../components/common/ListToolbar';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { Textarea } from '../../components/common/FormFields';
import { inr, fmtDateTime } from '../../utils/format';
import { toOptions } from '../../utils/constants';

const LINKS = {
  proposal: (id) => `/proposals/${id}`,
  purchase_order: () => '/vendors/purchase-orders',
  expense: () => '/finance/expenses',
  change_request: () => '/feedback/change-requests',
};

export default function Approvals() {
  const { user, can } = useAuth();
  const list = usePagedList('/approvals', { initialFilters: { status: 'Pending' } });
  const [decision, setDecision] = useState(null);

  const decide = async () => {
    try {
      await api.post(`/approvals/${decision.row.id}/decide`, { decision: decision.type, remarks: decision.remarks });
      toast.success(decision.type);
      setDecision(null);
      list.reload();
    } catch (e) {
      showError(e);
    }
  };

  const canDecide = (r) => r.status === 'Pending' && can('approvals', 'approve') && r.requested_by !== user.id && (r.approver_id === user.id || user.is_super_admin || user.data_scope === 'all');

  return (
    <div className="card">
      <div className="border-b border-line px-5 py-4">
        <ListToolbar
          title="Approval Queue"
          search={list.search}
          onSearch={list.setSearch}
          filters={[
            { name: 'status', label: 'All Status', options: toOptions(['Pending', 'Approved', 'Rejected']) },
            { name: 'entity_type', label: 'All Types', options: [{ value: 'proposal', label: 'Proposals' }, { value: 'purchase_order', label: 'Purchase Orders' }, { value: 'expense', label: 'Expenses' }, { value: 'change_request', label: 'Change Requests' }] },
            { name: 'view', label: 'Queue', options: [{ value: 'mine', label: 'My requests' }] },
          ]}
          filterValues={list.filters}
          onFilter={list.setFilter}
        />
      </div>
      <div className="px-2">
        <DataTable
          loading={list.loading}
          rows={list.rows}
          emptyText="Nothing awaiting approval"
          columns={[
            { key: 'created_at', label: 'Requested', render: (r) => fmtDateTime(r.created_at) },
            { key: 'request_type', label: 'Type', render: (r) => <span className="chip bg-slate-100 text-slate-700">{r.request_type}</span> },
            { key: 'title', label: 'Item', render: (r) => <div><Link className="link" to={(LINKS[r.entity_type] || (() => '#'))(r.entity_id)}>{r.title}</Link><div className="text-xs text-slate-500">{r.reason}</div></div> },
            { key: 'amount', label: 'Amount', render: (r) => (r.amount !== null ? inr(r.amount) : '—') },
            { key: 'requested_by_name', label: 'Requested by' },
            { key: 'approver_name', label: 'Approver' },
            { key: 'status', label: 'Status', render: (r) => <div><Badge>{r.status}</Badge>{r.decided_by_name && <div className="mt-0.5 text-[11px] text-slate-500">{r.decided_by_name}{r.remarks ? ` – “${r.remarks}”` : ''}</div>}</div> },
            {
              key: 'actions',
              label: '',
              align: 'right',
              render: (r) =>
                canDecide(r) && (
                  <div className="flex justify-end gap-1">
                    <button className="btn-success btn-sm" onClick={() => setDecision({ row: r, type: 'Approved', remarks: '' })}><LuCheck size={13} /> Approve</button>
                    <button className="btn-outline btn-sm !text-red-600" onClick={() => setDecision({ row: r, type: 'Rejected', remarks: '' })}><LuX size={13} /> Reject</button>
                  </div>
                ),
            },
          ]}
        />
        <Pagination page={list.page} total={list.total} limit={list.limit} onPage={list.setPage} />
      </div>
      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision ? `${decision.type === 'Approved' ? 'Approve' : 'Reject'}: ${decision.row.title}` : ''}
        size="sm"
        footer={<><button className="btn-outline" onClick={() => setDecision(null)}>Cancel</button><button className={decision && decision.type === 'Approved' ? 'btn-success' : 'btn-danger'} onClick={decide}>Confirm</button></>}
      >
        {decision && (
          <>
            <label className="label">Remarks {decision.type === 'Rejected' && <span className="text-red-500">*</span>}</label>
            <Textarea rows={3} value={decision.remarks} onChange={(e) => setDecision({ ...decision, remarks: e.target.value })} />
          </>
        )}
      </Modal>
    </div>
  );
}
