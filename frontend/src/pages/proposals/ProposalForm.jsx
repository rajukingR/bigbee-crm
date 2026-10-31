import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuPlus, LuTrash2, LuSave, LuTriangleAlert } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import { FormRenderer } from '../../components/common/FormFields';
import { inr, pct } from '../../utils/format';

const HEADER_FIELDS = [
  { name: 'title', label: 'Proposal Title', required: true, col: 'full' },
  {
    name: 'opportunity_id',
    label: 'Opportunity',
    type: 'select',
    remote: { endpoint: '/opportunities', label: (r) => `${r.opp_code} – ${r.title}` },
  },
  { name: 'company_id', label: 'Client Company', type: 'select', remote: { endpoint: '/companies', label: (r) => r.name }, onChange: (v) => ({ ...v, contact_id: '' }) },
  { name: 'contact_id', label: 'Client Contact', type: 'select', remote: { endpoint: '/contacts', label: (r) => r.name, params: (v) => ({ company_id: v.company_id }), enabledIf: (v) => !!v.company_id } },
  { name: 'event_type_id', label: 'Event Type', type: 'select', lookup: 'lead-event-types' },
  { name: 'event_date', label: 'Event Date', type: 'date' },
  { name: 'venue', label: 'Venue / City' },
  { name: 'pax', label: 'Guest Count (Pax)', type: 'number' },
  { name: 'owner_id', label: 'Proposal Owner', type: 'select', lookup: 'employees', labelKey: 'full_name' },
  { name: 'payment_terms', label: 'Payment Terms', col: 'full', placeholder: 'e.g. 50% advance, 40% before event, 10% after event' },
  { name: 'assumptions', label: 'Commercial Assumptions / Scope', type: 'textarea' },
  { name: 'exclusions', label: 'Exclusions', type: 'textarea' },
];

const blankItem = () => ({ section: '', description: '', quantity: 1, unit: 'Nos', unit_rate: 0, unit_cost: 0 });
const n = (v) => Number(v) || 0;

export default function ProposalForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [header, setHeader] = useState({ discount_pct: 0, agency_fee_pct: 0, tax_pct: 18 });
  const [items, setItems] = useState([blankItem()]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then((r) => setSettings(Object.fromEntries(r.data.map((s) => [s.setting_key, s.setting_value])))).catch(() => {});
    if (id) {
      api
        .get(`/proposals/${id}`)
        .then((r) => {
          setHeader(r.data);
          setItems(r.data.items.length ? r.data.items : [blankItem()]);
        })
        .catch(showError)
        .finally(() => setLoading(false));
    } else if (params.get('opportunity_id')) {
      api
        .get(`/opportunities/${params.get('opportunity_id')}`)
        .then(({ data: o }) =>
          setHeader((h) => ({
            ...h,
            opportunity_id: o.id,
            title: `Proposal – ${o.title}`,
            company_id: o.company_id,
            contact_id: o.contact_id,
            event_type_id: o.event_type_id,
            event_date: o.event_date,
            venue: o.city,
          }))
        )
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((a, i) => a + n(i.quantity) * n(i.unit_rate), 0);
    const cost = items.reduce((a, i) => a + n(i.quantity) * n(i.unit_cost), 0);
    const discount = (subtotal * n(header.discount_pct)) / 100;
    const agency = ((subtotal - discount) * n(header.agency_fee_pct)) / 100;
    const taxable = subtotal - discount + agency;
    const tax = (taxable * n(header.tax_pct)) / 100;
    const margin = taxable - cost;
    return { subtotal, cost, discount, agency, taxable, tax, total: taxable + tax, margin, marginPct: taxable ? (margin / taxable) * 100 : 0 };
  }, [items, header.discount_pct, header.agency_fee_pct, header.tax_pct]);

  const warnings = [];
  if (n(header.discount_pct) > n(settings.discount_threshold_pct || 10)) warnings.push(`Discount above ${settings.discount_threshold_pct || 10}% needs approval`);
  if (totals.taxable > 0 && totals.marginPct < n(settings.margin_threshold_pct || 20)) warnings.push(`Margin below ${settings.margin_threshold_pct || 20}% needs approval`);

  const setItem = (idx, k, v) => setItems((list) => list.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));

  const save = async () => {
    if (!header.title) return toast.error('Title is required');
    const lines = items.filter((i) => i.description);
    if (!lines.length) return toast.error('Add at least one line item');
    setSaving(true);
    try {
      const body = { ...Object.fromEntries(HEADER_FIELDS.map((f) => [f.name, header[f.name]])), discount_pct: header.discount_pct, agency_fee_pct: header.agency_fee_pct, tax_pct: header.tax_pct, items: lines };
      const { data } = id ? await api.put(`/proposals/${id}`, body) : await api.post('/proposals', body);
      toast.success('Proposal saved');
      navigate(`/proposals/${data.id}`);
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
    return null;
  };

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        back
        title={id ? `Edit ${header.proposal_code || 'Proposal'} v${header.version || 1}` : 'Create Proposal / Quotation'}
        actions={
          <button className="btn-primary" onClick={save} disabled={saving}>
            <LuSave size={15} /> {saving ? 'Saving…' : 'Save Proposal'}
          </button>
        }
      />
      <div className="card p-5">
        <FormRenderer
          fields={HEADER_FIELDS}
          values={header}
          onChange={(name, v) =>
            setHeader((h) => {
              const f = HEADER_FIELDS.find((x) => x.name === name);
              const nv = { ...h, [name]: v };
              return f && f.onChange ? f.onChange(nv, v) : nv;
            })
          }
        />
      </div>

      <div className="card mt-5">
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="card-title">Line Items & Costing</h3>
          <button className="btn-outline btn-sm" onClick={() => setItems((l) => [...l, blankItem()])}>
            <LuPlus size={14} /> Add line
          </button>
        </div>
        <div className="overflow-x-auto p-3">
          <table className="min-w-full">
            <thead className="border-b border-line">
              <tr>
                {['Section', 'Description', 'Qty', 'Unit', 'Rate (₹)', 'Amount', 'Unit Cost (₹)', 'Cost', 'Margin', ''].map((h) => (
                  <th key={h} className="table-head !px-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const amt = n(it.quantity) * n(it.unit_rate);
                const cost = n(it.quantity) * n(it.unit_cost);
                return (
                  <tr key={idx} className="border-b border-line">
                    <td className="px-2 py-2"><input className="input w-32 !py-1.5" value={it.section || ''} onChange={(e) => setItem(idx, 'section', e.target.value)} placeholder="Production" /></td>
                    <td className="px-2 py-2"><input className="input min-w-[220px] !py-1.5" value={it.description || ''} onChange={(e) => setItem(idx, 'description', e.target.value)} placeholder="LED wall 20x10 ft" /></td>
                    <td className="px-2 py-2"><input type="number" className="input w-20 !py-1.5" value={it.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} /></td>
                    <td className="px-2 py-2"><input className="input w-20 !py-1.5" value={it.unit || ''} onChange={(e) => setItem(idx, 'unit', e.target.value)} /></td>
                    <td className="px-2 py-2"><input type="number" className="input w-28 !py-1.5" value={it.unit_rate} onChange={(e) => setItem(idx, 'unit_rate', e.target.value)} /></td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm">{inr(amt)}</td>
                    <td className="px-2 py-2"><input type="number" className="input w-28 !py-1.5" value={it.unit_cost} onChange={(e) => setItem(idx, 'unit_cost', e.target.value)} /></td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-slate-600">{inr(cost)}</td>
                    <td className={`whitespace-nowrap px-2 py-2 text-sm ${amt - cost < 0 ? 'text-red-600' : 'text-green-700'}`}>{amt ? pct(((amt - cost) / amt) * 100) : '—'}</td>
                    <td className="px-2 py-2">
                      <button className="rounded p-1.5 text-slate-400 hover:text-red-600" onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, i) => i !== idx) : [blankItem()]))} aria-label="Remove line">
                        <LuTrash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-5 border-t border-line p-5 lg:grid-cols-2">
          <div className="grid grid-cols-3 gap-3 self-start">
            <div>
              <label className="label">Discount %</label>
              <input type="number" className="input" value={header.discount_pct ?? 0} onChange={(e) => setHeader({ ...header, discount_pct: e.target.value })} />
            </div>
            <div>
              <label className="label">Agency / Mgmt Fee %</label>
              <input type="number" className="input" value={header.agency_fee_pct ?? 0} onChange={(e) => setHeader({ ...header, agency_fee_pct: e.target.value })} />
            </div>
            <div>
              <label className="label">GST %</label>
              <input type="number" className="input" value={header.tax_pct ?? 18} onChange={(e) => setHeader({ ...header, tax_pct: e.target.value })} />
            </div>
            {warnings.length > 0 && (
              <div className="col-span-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {warnings.map((w) => (
                  <div key={w} className="flex items-center gap-1.5">
                    <LuTriangleAlert size={13} /> {w}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5 rounded-md bg-slate-50 p-4 text-sm">
            {[
              ['Subtotal', totals.subtotal],
              [`Discount (${n(header.discount_pct)}%)`, -totals.discount],
              [`Agency / Management Fee (${n(header.agency_fee_pct)}%)`, totals.agency],
              ['Taxable Value', totals.taxable],
              [`GST (${n(header.tax_pct)}%)`, totals.tax],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span className="text-slate-600">{l}</span>
                <span>{inr(v, 2)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <span>Total Proposal Value</span>
              <span>{inr(totals.total, 2)}</span>
            </div>
            <div className="flex justify-between pt-2 text-slate-600">
              <span>Estimated Cost</span>
              <span>{inr(totals.cost, 2)}</span>
            </div>
            <div className={`flex justify-between font-medium ${totals.marginPct < n(settings.margin_threshold_pct || 20) ? 'text-red-600' : 'text-green-700'}`}>
              <span>Estimated Gross Margin</span>
              <span>
                {inr(totals.margin, 2)} ({pct(totals.marginPct)})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
