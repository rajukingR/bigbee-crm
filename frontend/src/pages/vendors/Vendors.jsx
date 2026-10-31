import { useState } from 'react';
import { LuEye, LuLock } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Tabs from '../../components/common/Tabs';
import DetailGrid from '../../components/common/DetailGrid';
import Attachments from '../../components/common/Attachments';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { inr, fmtDate } from '../../utils/format';
import { toOptions } from '../../utils/constants';

function VendorView({ vendor, onClose }) {
  const { can } = useAuth();
  const [tab, setTab] = useState('details');
  const { data } = useFetch(vendor ? `/vendors/${vendor.id}/history` : null, null, { enabled: !!vendor });
  if (!vendor) return null;
  const v = vendor;
  return (
    <Modal open={!!vendor} onClose={onClose} title={`${v.vendor_code} · ${v.name}`} size="lg">
      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'details', label: 'Details' }, { key: 'history', label: 'Project History' }, { key: 'docs', label: 'Compliance Documents' }]} />
      <div className="pt-4">
        {tab === 'details' && (
          <DetailGrid
            items={[
              { label: 'Category', value: v.category_name },
              { label: 'Services', value: v.services },
              { label: 'Contact Person', value: v.contact_person },
              { label: 'Phone', value: v.phone },
              { label: 'Email', value: v.email },
              { label: 'City / Locations', value: [v.city, v.locations].filter(Boolean).join(', ') },
              { label: 'GST No.', value: v.gst_no },
              { label: 'PAN', value: v.pan_no },
              { label: 'Payment Terms', value: v.payment_terms },
              { label: 'Bank', value: v.bank_restricted ? <span className="inline-flex items-center gap-1 text-slate-400"><LuLock size={12} /> Restricted</span> : `${v.bank_name || '—'} · ${v.bank_account_no || ''} · ${v.bank_ifsc || ''}` },
              { label: 'Rating', value: `${'★'.repeat(Number(v.rating) || 0)}${'☆'.repeat(5 - (Number(v.rating) || 0))}` },
              { label: 'Outstanding Payable', value: inr(v.outstanding) },
              { label: 'Performance Notes / Quality Issues', value: v.performance_notes, full: true },
              { label: 'Address', value: v.address, full: true },
            ]}
          />
        )}
        {tab === 'history' && data && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-sm font-semibold">Purchase Orders</div>
              {data.purchase_orders.length === 0 && <div className="text-sm text-slate-400">None</div>}
              {data.purchase_orders.map((p) => (
                <div key={p.id} className="flex justify-between border-b border-line py-1.5 text-sm">
                  <span>{p.po_code} · {p.project_code || '—'} {p.project_name}</span>
                  <span>{inr(p.total_amount)} <Badge>{p.status}</Badge></span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-sm font-semibold">Quotations</div>
              {data.quotations.map((q) => (
                <div key={q.id} className="flex justify-between border-b border-line py-1.5 text-sm">
                  <span>{fmtDate(q.quote_date)} · {q.requirement} · {q.project_code || ''}</span>
                  <span>{inr(q.negotiated_amount || q.quoted_amount)} <Badge>{q.status}</Badge></span>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'docs' && <Attachments entityType="vendor" entityId={v.id} docTypes={['GST Certificate', 'PAN', 'Cancelled Cheque', 'MSME', 'Agreement', 'Other']} readOnly={!can('vendors', 'edit')} />}
      </div>
    </Modal>
  );
}

export default function Vendors() {
  const { can } = useAuth();
  const [view, setView] = useState(null);
  const bankEdit = can('vendor_bank', 'edit');
  const fields = [
    { name: 'name', label: 'Vendor Name', required: true },
    { name: 'category_id', label: 'Category', type: 'select', lookup: 'categories' },
    { name: 'services', label: 'Services Offered', col: 'full' },
    { name: 'contact_person', label: 'Contact Person' },
    { name: 'phone', label: 'Phone' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'city', label: 'City' },
    { name: 'locations', label: 'Service Locations' },
    { name: 'gst_no', label: 'GST No.' },
    { name: 'pan_no', label: 'PAN' },
    { name: 'payment_terms', label: 'Payment Terms' },
    { name: 'rating', label: 'Rating (1-5)', type: 'select', options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: '★'.repeat(n) })) },
    { name: 'status', label: 'Status', type: 'select', options: toOptions(['Active', 'Inactive', 'Blacklisted']), allowEmpty: false },
    { type: 'section', label: bankEdit ? 'Bank / Payment Details (restricted)' : '' },
    { name: 'bank_name', label: 'Bank Name', hidden: () => !bankEdit },
    { name: 'bank_account_name', label: 'Account Name', hidden: () => !bankEdit },
    { name: 'bank_account_no', label: 'Account No.', hidden: () => !bankEdit },
    { name: 'bank_ifsc', label: 'IFSC', hidden: () => !bankEdit },
    { name: 'address', label: 'Address', type: 'textarea' },
    { name: 'performance_notes', label: 'Performance Notes / Quality Issues', type: 'textarea' },
  ].filter((f) => f.type !== 'section' || f.label);

  return (
    <>
      <CrudPage
        title="Vendor Master"
        endpoint="/vendors"
        module="vendors"
        addLabel="Add Vendor"
        exportName="vendors"
        modalSize="lg"
        filters={[
          { name: 'category_id', label: 'All Categories', lookup: 'categories' },
          { name: 'status', label: 'All Status', options: toOptions(['Active', 'Inactive', 'Blacklisted']) },
        ]}
        columns={[
          { key: 'vendor_code', label: 'Code' },
          { key: 'name', label: 'Vendor', render: (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-slate-500">{r.services}</div></div> },
          { key: 'category_name', label: 'Category' },
          { key: 'contact_person', label: 'Contact', render: (r) => <div>{r.contact_person || '—'}<div className="text-xs text-slate-500">{r.phone}</div></div> },
          { key: 'city', label: 'City' },
          { key: 'gst_no', label: 'GST' },
          { key: 'rating', label: 'Rating', render: (r) => <span className="text-amber-500">{'★'.repeat(Number(r.rating) || 0)}</span> },
          { key: 'project_count', label: 'Projects' },
          { key: 'outstanding', label: 'Payable', render: (r) => inr(r.outstanding) },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        defaults={{ status: 'Active' }}
        fields={fields}
        toForm={(r) => {
          const v = { ...r };
          if (r.bank_restricted) ['bank_name', 'bank_account_no', 'bank_ifsc', 'bank_account_name'].forEach((k) => delete v[k]);
          return v;
        }}
        toPayload={(v) => Object.fromEntries(fields.filter((f) => f.name).map((f) => [f.name, v[f.name]]))}
        rowActions={(r) => (
          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="View" onClick={() => setView(r)}>
            <LuEye size={15} />
          </button>
        )}
      />
      <VendorView vendor={view} onClose={() => setView(null)} />
    </>
  );
}
