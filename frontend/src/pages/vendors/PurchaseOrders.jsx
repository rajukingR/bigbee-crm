import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuShieldCheck, LuSend, LuPackageCheck, LuBan, LuPaperclip } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Attachments from '../../components/common/Attachments';
import api, { showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { inr, fmtDate } from '../../utils/format';
import { toOptions } from '../../utils/constants';

const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Issued', 'Delivered', 'Cancelled'];

export default function PurchaseOrders() {
  const { can } = useAuth();
  const [params] = useSearchParams();
  const [key, setKey] = useState(0);
  const [files, setFiles] = useState(null);
  const quotationId = params.get('quotation_id');

  const act = async (fn, msg) => {
    try {
      await fn();
      toast.success(msg);
      setKey((k) => k + 1);
    } catch (e) {
      showError(e);
    }
  };

  const fields = [
    { name: 'po_type', label: 'Type', type: 'select', options: toOptions(['Purchase Order', 'Work Order']), allowEmpty: false },
    { name: 'quotation_id', label: 'From Selected Quotation', type: 'select', remote: { endpoint: '/quotations', label: (r) => `${r.quote_code} – ${r.vendor_name} – ${r.requirement}`, params: () => ({ status: 'Selected' }) }, help: 'Vendor, project, scope and amount are copied' },
    { name: 'project_id', label: 'Project', type: 'select', remote: { endpoint: '/projects', label: (r) => `${r.project_code} – ${r.name}` } },
    { name: 'vendor_id', label: 'Vendor', type: 'select', remote: { endpoint: '/vendors', label: (r) => r.name } },
    { name: 'amount', label: 'Amount (₹, excl. GST)', type: 'number' },
    { name: 'tax_pct', label: 'GST %', type: 'number' },
    { name: 'po_date', label: 'PO Date', type: 'date' },
    { name: 'delivery_date', label: 'Delivery Date', type: 'date' },
    { name: 'payment_terms', label: 'Payment Terms', col: 'full' },
    { name: 'scope', label: 'Scope of Work', type: 'textarea' },
  ];

  return (
    <>
      <CrudPage
        title="Purchase & Work Orders"
        endpoint="/purchase-orders"
        module="purchase_orders"
        addLabel="Create PO"
        exportName="purchase_orders"
        modalSize="lg"
        reloadKey={key}
        initialAdd={quotationId ? { quotation_id: quotationId } : null}
        filters={[
          { name: 'status', label: 'All Status', options: toOptions(STATUSES) },
          { name: 'project_id', label: 'All Projects', remote: { endpoint: '/projects', label: (r) => r.project_code } },
          { name: 'vendor_id', label: 'All Vendors', remote: { endpoint: '/vendors', label: (r) => r.name } },
          { name: 'delivery_status', label: 'Any Delivery', options: toOptions(['Pending', 'Partial', 'Delivered']) },
        ]}
        columns={[
          { key: 'po_code', label: 'PO', render: (r) => <div><div className="font-medium text-ink">{r.po_code}</div><div className="text-xs text-slate-500">{r.po_type}</div></div>, exportValue: (r) => r.po_code },
          { key: 'vendor_name', label: 'Vendor' },
          { key: 'project_code', label: 'Project', render: (r) => r.project_code || '—' },
          { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) },
          { key: 'total_amount', label: 'Total incl. GST', render: (r) => inr(r.total_amount) },
          { key: 'billed_amount', label: 'Billed / Paid', render: (r) => <span className="text-xs">{inr(r.billed_amount)} / {inr(r.paid_amount)}</span>, exportValue: (r) => r.billed_amount },
          { key: 'delivery_date', label: 'Delivery', render: (r) => <div>{fmtDate(r.delivery_date)}<div className="text-xs"><Badge>{r.delivery_status}</Badge></div></div>, exportValue: (r) => r.delivery_date },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        defaults={{ po_type: 'Purchase Order', tax_pct: 18 }}
        fields={fields}
        toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
        canEditRow={(r) => ['Draft', 'Rejected', 'Approved', 'Issued'].includes(r.status)}
        canDeleteRow={(r) => ['Draft', 'Rejected', 'Cancelled'].includes(r.status)}
        rowActions={(r) => (
          <>
            <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Documents" onClick={() => setFiles(r)}>
              <LuPaperclip size={15} />
            </button>
            {can('purchase_orders', 'edit') && ['Draft', 'Rejected'].includes(r.status) && (
              <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Submit for approval" onClick={() => act(() => api.post(`/purchase-orders/${r.id}/submit`), 'Submitted')}>
                <LuShieldCheck size={15} />
              </button>
            )}
            {can('purchase_orders', 'edit') && r.status === 'Approved' && (
              <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Mark issued to vendor" onClick={() => act(() => api.post(`/purchase-orders/${r.id}/status`, { status: 'Issued' }), 'PO issued')}>
                <LuSend size={15} />
              </button>
            )}
            {can('purchase_orders', 'edit') && r.status === 'Issued' && (
              <button className="rounded p-1.5 text-slate-500 hover:bg-green-50 hover:text-green-600" title="Mark delivered" onClick={() => act(() => api.post(`/purchase-orders/${r.id}/status`, { status: 'Delivered' }), 'Marked delivered')}>
                <LuPackageCheck size={15} />
              </button>
            )}
            {can('purchase_orders', 'edit') && ['Draft', 'Approved', 'Issued', 'Rejected'].includes(r.status) && (
              <button className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Cancel PO" onClick={() => window.confirm('Cancel this PO?') && act(() => api.post(`/purchase-orders/${r.id}/status`, { status: 'Cancelled' }), 'PO cancelled')}>
                <LuBan size={15} />
              </button>
            )}
          </>
        )}
      />
      <Modal open={!!files} onClose={() => setFiles(null)} title={files ? `${files.po_code} documents` : ''} size="lg">
        {files && <Attachments entityType="purchase_order" entityId={files.id} docTypes={['Signed PO', 'Vendor Acceptance', 'Delivery Challan', 'Other']} />}
      </Modal>
    </>
  );
}
