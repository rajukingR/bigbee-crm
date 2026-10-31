import { useState } from 'react';
import { LuPaperclip } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Attachments from '../../components/common/Attachments';
import { useAuth } from '../../context/AuthContext';
import { inr, fmtDate, today } from '../../utils/format';
import { toOptions } from '../../utils/constants';

const CATEGORIES = ['Travel', 'Local Conveyance', 'Food & Hospitality', 'Site Expenses', 'Printing', 'Courier', 'Miscellaneous'];

export default function Expenses() {
  const { can } = useAuth();
  const [files, setFiles] = useState(null);
  const fields = [
    { name: 'project_id', label: 'Project', type: 'select', remote: { endpoint: '/projects', label: (r) => `${r.project_code} – ${r.name}` } },
    { name: 'category', label: 'Category', type: 'select', options: toOptions(CATEGORIES) },
    { name: 'vendor_id', label: 'Paid to Vendor (optional)', type: 'select', remote: { endpoint: '/vendors', label: (r) => r.name } },
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
    { name: 'expense_date', label: 'Date', type: 'date' },
    { name: 'paid_by', label: 'Paid by', type: 'select', lookup: 'employees', labelKey: 'full_name' },
    { name: 'status', label: 'Status', type: 'select', options: toOptions(['Pending Approval', 'Approved', 'Rejected', 'Reimbursed']), hidden: (v) => !v.id || !can('expenses', 'approve') },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];
  return (
    <>
      <CrudPage
        title="Project Expenses"
        endpoint="/expenses"
        module="expenses"
        addLabel="Add Expense"
        exportName="expenses"
        filters={[
          { name: 'status', label: 'All Status', options: toOptions(['Pending Approval', 'Approved', 'Rejected', 'Reimbursed']) },
          { name: 'category', label: 'All Categories', options: toOptions(CATEGORIES) },
          { name: 'project_id', label: 'All Projects', remote: { endpoint: '/projects', label: (r) => r.project_code } },
        ]}
        columns={[
          { key: 'expense_code', label: 'Code' },
          { key: 'expense_date', label: 'Date', render: (r) => fmtDate(r.expense_date) },
          { key: 'project_code', label: 'Project', render: (r) => r.project_code || '—' },
          { key: 'category', label: 'Category' },
          { key: 'description', label: 'Description', render: (r) => <span className="line-clamp-1">{r.description || '—'}</span> },
          { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) },
          { key: 'paid_by_name', label: 'Paid by' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        defaults={{ expense_date: today() }}
        fields={fields}
        toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
        rowActions={(r) => (
          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Bills / receipts" onClick={() => setFiles(r)}>
            <LuPaperclip size={15} />
          </button>
        )}
      />
      <Modal open={!!files} onClose={() => setFiles(null)} title={files ? `${files.expense_code} – supporting bills` : ''} size="lg">
        {files && <Attachments entityType="expense" entityId={files.id} docTypes={['Bill / Receipt', 'Other']} />}
      </Modal>
    </>
  );
}
