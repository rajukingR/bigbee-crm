import { useState } from 'react';
import toast from 'react-hot-toast';
import { LuHandCoins, LuTrash2 } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Attachments from '../../components/common/Attachments';
import { FormRenderer } from '../../components/common/FormFields';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { inr, fmtDate, today } from '../../utils/format';
import { PAYMENT_MODES, INVOICE_TYPES, toOptions } from '../../utils/constants';

function Receipts({ invoice: row, onClose, onChanged }) {
  const { can } = useAuth();
  const { data, reload } = useFetch(row ? `/invoices/${row.id}/receipts` : null, null, { enabled: !!row });
  const fresh = useFetch(row ? `/invoices/${row.id}` : null, null, { enabled: !!row });
  const [v, setV] = useState({ receipt_date: today(), mode: 'NEFT' });
  const inv = fresh.data && row && fresh.data.id === row.id ? fresh.data : row;
  if (!inv) return null;
  const refresh = () => {
    reload();
    fresh.reload();
    onChanged();
  };
  const add = async () => {
    try {
      await api.post(`/invoices/${inv.id}/receipts`, v);
      toast.success('Receipt recorded');
      setV({ receipt_date: today(), mode: 'NEFT' });
      refresh();
    } catch (e) {
      showError(e);
    }
  };
  const remove = async (r) => {
    if (!window.confirm('Remove this receipt?')) return;
    try {
      await api.delete(`/invoices/receipts/${r.id}`);
      refresh();
    } catch (e) {
      showError(e);
    }
  };
  return (
    <Modal open={!!row} onClose={onClose} title={`Receipts – ${inv.invoice_no} (${inv.company_name || ''})`} size="lg">
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">Invoice Total</div><div className="font-semibold">{inr(inv.total_amount)}</div></div>
        <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">Received</div><div className="font-semibold text-green-700">{inr(inv.received_amount)}</div></div>
        <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">Outstanding</div><div className="font-semibold text-red-600">{inr(inv.outstanding)}</div></div>
      </div>
      {can('invoices', 'edit') && Number(inv.outstanding) > 0 && inv.status !== 'Cancelled' && (
        <div className="mb-5 rounded-md border border-line p-4">
          <FormRenderer
            values={v}
            onChange={(n, val) => setV((s) => ({ ...s, [n]: val }))}
            fields={[
              { name: 'amount', label: 'Amount Received (₹)', type: 'number', required: true },
              { name: 'receipt_date', label: 'Receipt Date', type: 'date' },
              { name: 'mode', label: 'Mode', type: 'select', options: toOptions(PAYMENT_MODES), allowEmpty: false },
              { name: 'reference', label: 'UTR / Cheque Ref.' },
            ]}
          />
          <div className="mt-3 flex justify-end"><button className="btn-primary" onClick={add}>Record Receipt</button></div>
        </div>
      )}
      <table className="min-w-full">
        <thead className="border-b border-line"><tr>{['Date', 'Amount', 'Mode', 'Reference', 'By', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
        <tbody>
          {(data || []).map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="table-cell">{fmtDate(r.receipt_date)}</td>
              <td className="table-cell">{inr(r.amount)}</td>
              <td className="table-cell">{r.mode}</td>
              <td className="table-cell">{r.reference || '—'}</td>
              <td className="table-cell">{r.created_by_name}</td>
              <td className="table-cell text-right">{can('invoices', 'delete') && <button className="text-slate-400 hover:text-red-600" onClick={() => remove(r)}><LuTrash2 size={14} /></button>}</td>
            </tr>
          ))}
          {(data || []).length === 0 && <tr><td colSpan={6} className="py-4 text-center text-sm text-slate-400">No receipts yet</td></tr>}
        </tbody>
      </table>
      <div className="mt-5"><Attachments entityType="invoice" entityId={inv.id} docTypes={['Tax Invoice', 'Payment Advice', 'Other']} title="Invoice copy & documents" /></div>
    </Modal>
  );
}

export default function Invoices() {
  const [rec, setRec] = useState(null);
  const [key, setKey] = useState(0);
  const fields = [
    { name: 'project_id', label: 'Project', type: 'select', required: true, remote: { endpoint: '/projects', label: (r) => `${r.project_code} – ${r.name}${r.company_name ? ' (' + r.company_name + ')' : ''}` } },
    { name: 'invoice_type', label: 'Invoice Type', type: 'select', options: toOptions(INVOICE_TYPES), allowEmpty: false },
    { name: 'invoice_no', label: 'Invoice No.', placeholder: 'Auto-generated if empty' },
    { name: 'invoice_date', label: 'Invoice Date', type: 'date' },
    { name: 'due_date', label: 'Due Date', type: 'date' },
    { name: 'amount', label: 'Amount (₹, excl. GST)', type: 'number', required: true },
    { name: 'tax_pct', label: 'GST %', type: 'number', help: 'Defaults to the project GST %' },
    { name: 'owner_id', label: 'Collection Owner', type: 'select', lookup: 'employees', labelKey: 'full_name' },
    { name: 'next_follow_up', label: 'Next Collection Follow-up', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: toOptions(['Draft', 'Raised', 'Cancelled']), hidden: (v) => !v.id, help: 'Paid / Partially Paid is set automatically from receipts' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return (
    <>
      <CrudPage
        title="Client Invoices"
        endpoint="/invoices"
        module="invoices"
        addLabel="Raise Invoice"
        exportName="invoices"
        modalSize="lg"
        reloadKey={key}
        filters={[
          { name: 'status', label: 'All Status', options: toOptions(['Draft', 'Raised', 'Partially Paid', 'Paid', 'Cancelled']) },
          { name: 'invoice_type', label: 'All Types', options: toOptions(INVOICE_TYPES) },
          { name: 'project_id', label: 'All Projects', remote: { endpoint: '/projects', label: (r) => r.project_code } },
          { name: 'overdue', label: 'Any due date', options: [{ value: 1, label: 'Overdue only' }] },
        ]}
        columns={[
          { key: 'invoice_no', label: 'Invoice', render: (r) => <div><div className="font-medium text-ink">{r.invoice_no}</div><div className="text-xs text-slate-500">{r.invoice_type}</div></div>, exportValue: (r) => r.invoice_no },
          { key: 'company_name', label: 'Client / Project', render: (r) => <div>{r.company_name}<div className="text-xs text-slate-500">{r.project_code}</div></div>, exportValue: (r) => r.company_name },
          { key: 'invoice_date', label: 'Date', render: (r) => fmtDate(r.invoice_date) },
          { key: 'due_date', label: 'Due', render: (r) => <span className={Number(r.overdue_days) > 0 ? 'font-medium text-red-600' : ''}>{fmtDate(r.due_date)}{Number(r.overdue_days) > 0 ? ` (${r.overdue_days}d)` : ''}</span>, exportValue: (r) => r.due_date },
          { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) },
          { key: 'total_amount', label: 'Total incl. GST', render: (r) => inr(r.total_amount) },
          { key: 'received_amount', label: 'Received', render: (r) => inr(r.received_amount) },
          { key: 'outstanding', label: 'Outstanding', render: (r) => <span className={Number(r.outstanding) > 0 ? 'font-medium' : 'text-slate-400'}>{inr(r.outstanding)}</span> },
          { key: 'next_follow_up', label: 'Next F/U', render: (r) => fmtDate(r.next_follow_up) },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        defaults={{ invoice_type: 'Milestone', invoice_date: today() }}
        fields={fields}
        toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
        canDeleteRow={(r) => Number(r.received_amount) === 0}
        rowActions={(r) => (
          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Receipts & documents" onClick={() => setRec(r)}>
            <LuHandCoins size={15} />
          </button>
        )}
      />
      <Receipts invoice={rec} onClose={() => setRec(null)} onChanged={() => setKey((k) => k + 1)} />
    </>
  );
}
