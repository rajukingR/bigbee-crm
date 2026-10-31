import { useState } from 'react';
import toast from 'react-hot-toast';
import { LuWallet, LuTrash2 } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Attachments from '../../components/common/Attachments';
import { FormRenderer } from '../../components/common/FormFields';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { inr, fmtDate, today } from '../../utils/format';
import { PAYMENT_MODES, toOptions } from '../../utils/constants';

function Payments({ bill: row, onClose, onChanged }) {
  const { can } = useAuth();
  const { data, reload } = useFetch(row ? `/vendor-bills/${row.id}/payments` : null, null, { enabled: !!row });
  const fresh = useFetch(row ? `/vendor-bills/${row.id}` : null, null, { enabled: !!row });
  const bill = fresh.data && row && fresh.data.id === row.id ? fresh.data : row;
  const [v, setV] = useState({ payment_date: today(), mode: 'NEFT' });
  if (!bill) return null;
  const add = async () => {
    try {
      await api.post(`/vendor-bills/${bill.id}/payments`, v);
      toast.success('Payment recorded');
      setV({ payment_date: today(), mode: 'NEFT' });
      reload();
      fresh.reload();
      onChanged();
    } catch (e) {
      showError(e);
    }
  };
  const remove = async (p) => {
    if (!window.confirm('Remove this payment?')) return;
    try {
      await api.delete(`/vendor-bills/payments/${p.id}`);
      reload();
      fresh.reload();
      onChanged();
    } catch (e) {
      showError(e);
    }
  };
  return (
    <Modal open={!!bill} onClose={onClose} title={`Payments – ${bill.bill_no} (${bill.vendor_name})`} size="lg">
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">Bill Total</div><div className="font-semibold">{inr(bill.total_amount)}</div></div>
        <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">Paid</div><div className="font-semibold">{inr(bill.paid_amount)}</div></div>
        <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">Balance</div><div className="font-semibold text-red-600">{inr(bill.balance)}</div></div>
      </div>
      {can('vendor_bills', 'edit') && Number(bill.balance) > 0 && (
        <div className="mb-5 rounded-md border border-line p-4">
          <FormRenderer
            values={v}
            onChange={(n, val) => setV((s) => ({ ...s, [n]: val }))}
            fields={[
              { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
              { name: 'payment_date', label: 'Payment Date', type: 'date' },
              { name: 'mode', label: 'Mode', type: 'select', options: toOptions(PAYMENT_MODES), allowEmpty: false },
              { name: 'reference', label: 'UTR / Cheque Ref.' },
            ]}
          />
          <div className="mt-3 flex justify-end"><button className="btn-primary" onClick={add}>Record Payment</button></div>
        </div>
      )}
      <table className="min-w-full">
        <thead className="border-b border-line"><tr>{['Date', 'Amount', 'Mode', 'Reference', 'By', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
        <tbody>
          {(data || []).map((p) => (
            <tr key={p.id} className="border-b border-line">
              <td className="table-cell">{fmtDate(p.payment_date)}</td>
              <td className="table-cell">{inr(p.amount)}</td>
              <td className="table-cell">{p.mode}</td>
              <td className="table-cell">{p.reference || '—'}</td>
              <td className="table-cell">{p.created_by_name}</td>
              <td className="table-cell text-right">{can('vendor_bills', 'delete') && <button className="text-slate-400 hover:text-red-600" onClick={() => remove(p)}><LuTrash2 size={14} /></button>}</td>
            </tr>
          ))}
          {(data || []).length === 0 && <tr><td colSpan={6} className="py-4 text-center text-sm text-slate-400">No payments yet</td></tr>}
        </tbody>
      </table>
      <div className="mt-5"><Attachments entityType="vendor_bill" entityId={bill.id} docTypes={['Vendor Invoice', 'Payment Advice', 'Other']} title="Bill copy & documents" /></div>
    </Modal>
  );
}

export default function VendorBills() {
  const [pay, setPay] = useState(null);
  const [key, setKey] = useState(0);
  const fields = [
    { name: 'bill_no', label: 'Vendor Bill / Invoice No.', required: true },
    { name: 'bill_type', label: 'Bill Type', type: 'select', options: toOptions(['Advance', 'Running', 'Final']), allowEmpty: false },
    { name: 'po_id', label: 'Against PO', type: 'select', remote: { endpoint: '/purchase-orders', label: (r) => `${r.po_code} – ${r.vendor_name} – ${inr(r.total_amount)}` } },
    { name: 'vendor_id', label: 'Vendor', type: 'select', remote: { endpoint: '/vendors', label: (r) => r.name }, help: 'Auto-filled from PO' },
    { name: 'project_id', label: 'Project', type: 'select', remote: { endpoint: '/projects', label: (r) => `${r.project_code} – ${r.name}` } },
    { name: 'bill_date', label: 'Bill Date', type: 'date' },
    { name: 'due_date', label: 'Due Date', type: 'date' },
    { name: 'amount', label: 'Amount (₹, excl. GST)', type: 'number', required: true },
    { name: 'tax_amount', label: 'GST Amount (₹)', type: 'number', help: 'Leave empty to use the PO GST %' },
    { name: 'status', label: 'Status', type: 'select', options: toOptions(['Pending', 'Partially Paid', 'Paid', 'Disputed']), hidden: (v) => !v.id },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return (
    <>
      <CrudPage
        title="Vendor Bills & Payments"
        endpoint="/vendor-bills"
        module="vendor_bills"
        addLabel="Record Bill"
        exportName="vendor_bills"
        modalSize="lg"
        reloadKey={key}
        filters={[
          { name: 'status', label: 'All Status', options: toOptions(['Pending', 'Partially Paid', 'Paid', 'Disputed']) },
          { name: 'vendor_id', label: 'All Vendors', remote: { endpoint: '/vendors', label: (r) => r.name } },
          { name: 'project_id', label: 'All Projects', remote: { endpoint: '/projects', label: (r) => r.project_code } },
        ]}
        columns={[
          { key: 'bill_no', label: 'Bill', render: (r) => <div><div className="font-medium text-ink">{r.bill_no}</div><div className="text-xs text-slate-500">{r.bill_type} · {r.po_code || 'no PO'}</div></div>, exportValue: (r) => r.bill_no },
          { key: 'vendor_name', label: 'Vendor' },
          { key: 'project_code', label: 'Project', render: (r) => r.project_code || '—' },
          { key: 'bill_date', label: 'Date', render: (r) => fmtDate(r.bill_date) },
          { key: 'due_date', label: 'Due', render: (r) => <span className={Number(r.overdue_days) > 0 ? 'text-red-600' : ''}>{fmtDate(r.due_date)}</span> },
          { key: 'total_amount', label: 'Total', render: (r) => inr(r.total_amount) },
          { key: 'paid_amount', label: 'Paid', render: (r) => inr(r.paid_amount) },
          { key: 'balance', label: 'Balance', render: (r) => <span className={Number(r.balance) > 0 ? 'font-medium text-red-600' : ''}>{inr(r.balance)}</span> },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        defaults={{ bill_type: 'Final', bill_date: today() }}
        fields={fields}
        toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
        rowActions={(r) => (
          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Payments & documents" onClick={() => setPay(r)}>
            <LuWallet size={15} />
          </button>
        )}
      />
      <Payments bill={pay} onClose={() => setPay(null)} onChanged={() => setKey((k) => k + 1)} />
    </>
  );
}
