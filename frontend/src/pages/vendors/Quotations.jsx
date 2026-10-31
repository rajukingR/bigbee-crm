import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuList, LuColumns3, LuCheck, LuFileText } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import { Select } from '../../components/common/FormFields';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import useRemoteOptions from '../../hooks/useRemoteOptions';
import { useAuth } from '../../context/AuthContext';
import { inr, fmtDate } from '../../utils/format';
import { toOptions } from '../../utils/constants';

const STATUSES = ['Enquiry Sent', 'Received', 'Under Negotiation', 'Selected', 'Rejected'];

function Comparison() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [projectId, setProjectId] = useState('');
  const { options: projects } = useRemoteOptions('/projects', { label: (r) => `${r.project_code} – ${r.name}` });
  const { data, loading, reload } = useFetch('/quotations/compare', { project_id: projectId || undefined });

  const select = async (q) => {
    try {
      await api.post(`/quotations/${q.id}/select`, {});
      toast.success(`${q.vendor_name} selected`);
      reload();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div className="space-y-4">
      <Select className="!w-80" placeholder="All projects" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projects} />
      {loading && !data ? (
        <Loader />
      ) : (data || []).length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">No quotations to compare</div>
      ) : (
        data.map((g) => (
          <div key={`${g.project_id}-${g.requirement}`} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <div>
                <div className="text-sm font-semibold text-ink">{g.requirement}</div>
                <div className="text-xs text-slate-500">{g.project_code ? `${g.project_code} · ${g.project_name}` : 'No project'} · {g.quotes.length} quote(s) · Lowest {inr(g.lowest)}</div>
              </div>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="min-w-full">
                <thead>
                  <tr>{['Vendor', 'Quoted', 'Negotiated', 'GST %', 'Final (incl. GST)', 'Delivery', 'Rating', 'Status', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {g.quotes.map((q) => (
                    <tr key={q.id} className={`border-t border-line ${q.is_lowest ? 'bg-green-50/60' : ''}`}>
                      <td className="table-cell font-medium">{q.vendor_name} {q.is_lowest && <span className="chip ml-1 bg-green-100 text-green-700">lowest</span>}</td>
                      <td className="table-cell">{inr(q.quoted_amount)}</td>
                      <td className="table-cell">{Number(q.negotiated_amount) ? inr(q.negotiated_amount) : '—'}</td>
                      <td className="table-cell">{Number(q.tax_pct)}%</td>
                      <td className="table-cell font-medium">{inr(Number(q.final_amount) * (1 + Number(q.tax_pct) / 100))}</td>
                      <td className="table-cell">{q.delivery_days ? `${q.delivery_days} days` : '—'}</td>
                      <td className="table-cell text-amber-500">{'★'.repeat(Number(q.vendor_rating) || 0)}</td>
                      <td className="table-cell"><Badge>{q.status}</Badge></td>
                      <td className="table-cell text-right">
                        {Number(q.is_selected) ? (
                          can('purchase_orders', 'create') && (
                            <button className="btn-primary btn-sm" onClick={() => navigate(`/vendors/purchase-orders?quotation_id=${q.id}`)}>
                              <LuFileText size={13} /> Create PO
                            </button>
                          )
                        ) : (
                          can('quotations', 'edit') && (
                            <button className="btn-outline btn-sm" onClick={() => select(q)}>
                              <LuCheck size={13} /> Select
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function Quotations() {
  const [view, setView] = useState('compare');
  const fields = [
    { name: 'project_id', label: 'Project', type: 'select', remote: { endpoint: '/projects', label: (r) => `${r.project_code} – ${r.name}` } },
    { name: 'vendor_id', label: 'Vendor', type: 'select', remote: { endpoint: '/vendors', label: (r) => `${r.name}${r.category_name ? ' – ' + r.category_name : ''}` }, required: true },
    { name: 'requirement', label: 'Requirement (same text groups quotes for comparison)', required: true, col: 'full', placeholder: 'e.g. Stage & LED setup' },
    { name: 'quote_date', label: 'Quote Date', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: toOptions(STATUSES), allowEmpty: false },
    { name: 'quoted_amount', label: 'Quoted Amount (₹, excl. GST)', type: 'number', required: true },
    { name: 'negotiated_amount', label: 'Negotiated Amount (₹)', type: 'number' },
    { name: 'tax_pct', label: 'GST %', type: 'number' },
    { name: 'delivery_days', label: 'Delivery (days)', type: 'number' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border border-line bg-white p-0.5">
        <button onClick={() => setView('compare')} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${view === 'compare' ? 'bg-brand text-white' : 'text-slate-600'}`}>
          <LuColumns3 size={14} /> Comparison
        </button>
        <button onClick={() => setView('list')} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${view === 'list' ? 'bg-brand text-white' : 'text-slate-600'}`}>
          <LuList size={14} /> All Quotations
        </button>
      </div>
      {view === 'compare' ? (
        <Comparison />
      ) : (
        <CrudPage
          title="Vendor Quotations"
          endpoint="/quotations"
          module="quotations"
          addLabel="Add Quotation"
          exportName="vendor_quotations"
          modalSize="lg"
          filters={[
            { name: 'project_id', label: 'All Projects', remote: { endpoint: '/projects', label: (r) => r.project_code } },
            { name: 'vendor_id', label: 'All Vendors', remote: { endpoint: '/vendors', label: (r) => r.name } },
            { name: 'status', label: 'All Status', options: toOptions(STATUSES) },
          ]}
          columns={[
            { key: 'quote_code', label: 'Code' },
            { key: 'requirement', label: 'Requirement', render: (r) => <div><div className="font-medium text-ink">{r.requirement}</div><div className="text-xs text-slate-500">{r.project_code || '—'}</div></div> },
            { key: 'vendor_name', label: 'Vendor' },
            { key: 'quote_date', label: 'Date', render: (r) => fmtDate(r.quote_date) },
            { key: 'quoted_amount', label: 'Quoted', render: (r) => inr(r.quoted_amount) },
            { key: 'negotiated_amount', label: 'Negotiated', render: (r) => (Number(r.negotiated_amount) ? inr(r.negotiated_amount) : '—') },
            { key: 'final_with_tax', label: 'Final incl. GST', render: (r) => inr(r.final_with_tax) },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
          defaults={{ status: 'Received', tax_pct: 18 }}
          fields={fields}
          toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
        />
      )}
    </div>
  );
}
