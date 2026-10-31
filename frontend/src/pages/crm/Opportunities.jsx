import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuKanban, LuList, LuSearch } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Loader from '../../components/common/Loader';
import { FormRenderer, Select } from '../../components/common/FormFields';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useLookups } from '../../context/LookupContext';
import { inr, lakhs, fmtDate, pct } from '../../utils/format';

export const OPP_FIELDS = (canOverride) => [
  { name: 'title', label: 'Opportunity Title', required: true, col: 'full' },
  { name: 'company_id', label: 'Company', type: 'select', remote: { endpoint: '/companies', label: (r) => r.name }, onChange: (v) => ({ ...v, contact_id: '' }) },
  { name: 'contact_id', label: 'Contact', type: 'select', remote: { endpoint: '/contacts', label: (r) => r.name, params: (v) => ({ company_id: v.company_id }), enabledIf: (v) => !!v.company_id } },
  { name: 'owner_id', label: 'Owner', type: 'select', lookup: 'employees', labelKey: 'full_name' },
  { name: 'service_id', label: 'Service Line', type: 'select', lookup: 'services' },
  { name: 'event_type_id', label: 'Event Type', type: 'select', lookup: 'lead-event-types' },
  { name: 'lead_source_id', label: 'Lead Source', type: 'select', lookup: 'lead-sources' },
  { name: 'campaign_id', label: 'Campaign', type: 'select', remote: { endpoint: '/campaigns', label: (r) => r.name } },
  { name: 'city', label: 'City' },
  { name: 'expected_value', label: 'Expected Value (₹)', type: 'number', required: true },
  { name: 'funnel_status_id', label: 'Stage', type: 'select', lookup: 'funnel-statuses', filter: (r) => r.stage_type !== 'won', help: 'Use “Mark as Won” on the opportunity to win it' },
  { name: 'probability', label: 'Probability override %', type: 'number', hidden: () => !canOverride, help: 'Leave empty to use the stage probability' },
  { name: 'loss_reason_id', label: 'Loss Reason', type: 'select', lookup: 'loss-reasons' },
  { name: 'expected_close_date', label: 'Expected Close Date', type: 'date' },
  { name: 'event_date', label: 'Event Date', type: 'date' },
  { name: 'next_action', label: 'Next Action' },
  { name: 'next_follow_up', label: 'Next Follow-up', type: 'datetime' },
  { name: 'competitor', label: 'Competitor (if known)' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

function Board({ onMoved }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { lookups } = useLookups();
  const [f, setF] = useState({ owner_id: '', search: '' });
  const { data, loading, reload } = useFetch('/opportunities/pipeline', f);
  const [drag, setDrag] = useState(null);
  const [lost, setLost] = useState(null);

  const move = async (opp, stage) => {
    if (stage.id === opp.funnel_status_id) return;
    if (stage.stage_type === 'won') {
      toast('Open the opportunity and use “Mark as Won” to attach confirmation evidence', { icon: 'ℹ️' });
      navigate(`/opportunities/${opp.id}`);
      return;
    }
    if (stage.stage_type === 'lost') {
      setLost({ opp, stage, loss_reason_id: '', competitor: '', loss_notes: '' });
      return;
    }
    try {
      await api.post(`/opportunities/${opp.id}/stage`, { funnel_status_id: stage.id });
      reload();
      onMoved && onMoved();
    } catch (e) {
      showError(e);
    }
  };

  const saveLost = async () => {
    try {
      await api.post(`/opportunities/${lost.opp.id}/stage`, { funnel_status_id: lost.stage.id, loss_reason_id: lost.loss_reason_id, competitor: lost.competitor, loss_notes: lost.loss_notes, lost_value: lost.opp.expected_value });
      setLost(null);
      reload();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <LuSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input className="input !w-56 !py-1.5 pl-8 text-[13px]" placeholder="Search opportunities…" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
        </div>
        <Select className="!w-52 !py-1.5 text-[13px]" placeholder="All owners" value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })} options={(lookups.employees || []).map((e) => ({ value: e.id, label: e.full_name }))} />
        {data && (
          <div className="ml-auto text-sm text-slate-600">
            Open pipeline: <b>{lakhs(data.filter((s) => s.stage_type === 'open').reduce((a, s) => a + s.value, 0))}</b> · Weighted:{' '}
            <b>{lakhs(data.filter((s) => s.stage_type === 'open').reduce((a, s) => a + s.weighted, 0))}</b>
          </div>
        )}
      </div>
      {loading && !data ? (
        <Loader />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(data || []).map((s) => (
            <div
              key={s.id}
              className="flex w-[270px] shrink-0 flex-col rounded-lg border border-line bg-slate-50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drag && can('opportunities', 'edit') && move(drag, s)}
            >
              <div className="border-b border-line px-3 py-2.5" style={{ borderTop: `3px solid ${s.color}`, borderRadius: '8px 8px 0 0' }}>
                <div className="flex items-center justify-between text-sm font-medium text-ink">
                  <span>{s.name}</span>
                  <span className="rounded-full bg-white px-2 text-xs text-slate-500">{s.count}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {lakhs(s.value)} · {Number(s.probability)}% · wtd {lakhs(s.weighted)}
                </div>
              </div>
              <div className="max-h-[62vh] flex-1 space-y-2 overflow-y-auto p-2">
                {s.items.map((o) => (
                  <div
                    key={o.id}
                    draggable={can('opportunities', 'edit')}
                    onDragStart={() => setDrag(o)}
                    onDragEnd={() => setDrag(null)}
                    onClick={() => navigate(`/opportunities/${o.id}`)}
                    className="cursor-pointer rounded-md border border-line bg-white p-3 shadow-card hover:border-brand/40"
                  >
                    <div className="text-[11px] text-slate-400">{o.opp_code}</div>
                    <div className="text-sm font-medium leading-snug text-ink">{o.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{o.company_name || '—'}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">{lakhs(o.expected_value)}</span>
                      <span className={Number(o.stage_age_days) > 15 && o.stage_type === 'open' ? 'text-red-600' : 'text-slate-400'}>{o.stage_age_days}d in stage</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{o.owner_name}</span>
                      <span>Close {fmtDate(o.expected_close_date)}</span>
                    </div>
                  </div>
                ))}
                {s.items.length === 0 && <div className="py-6 text-center text-xs text-slate-400">Drop here</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!lost} onClose={() => setLost(null)} title="Mark as Lost" size="sm" footer={<><button className="btn-outline" onClick={() => setLost(null)}>Cancel</button><button className="btn-danger" onClick={saveLost} disabled={!lost || !lost.loss_reason_id}>Mark Lost</button></>}>
        {lost && (
          <FormRenderer
            values={lost}
            onChange={(n, v) => setLost((s) => ({ ...s, [n]: v }))}
            fields={[
              { name: 'loss_reason_id', label: 'Loss Reason', type: 'select', lookup: 'loss-reasons', required: true, col: 'full' },
              { name: 'competitor', label: 'Competitor', col: 'full' },
              { name: 'loss_notes', label: 'Notes', type: 'textarea' },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}

export default function Opportunities() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [view, setView] = useState('board');
  const [addNow, setAddNow] = useState(false);
  const fields = OPP_FIELDS(can('opportunities', 'approve'));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-md border border-line bg-white p-0.5">
          <button onClick={() => setView('board')} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${view === 'board' ? 'bg-brand text-white' : 'text-slate-600'}`}>
            <LuKanban size={15} /> Funnel Board
          </button>
          <button onClick={() => setView('list')} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${view === 'list' ? 'bg-brand text-white' : 'text-slate-600'}`}>
            <LuList size={15} /> List
          </button>
        </div>
        {view === 'board' && can('opportunities', 'create') && (
          <button className="btn-primary" onClick={() => { setAddNow(true); setView('list'); }}>
            + Add Opportunity
          </button>
        )}
      </div>

      {view === 'board' ? (
        <Board />
      ) : (
        <CrudPage
          title="Opportunities"
          endpoint="/opportunities"
          module="opportunities"
          addLabel="Add Opportunity"
          exportName="opportunities"
          modalSize="lg"
          initialAdd={addNow ? {} : null}
          onRowClick={(r) => navigate(`/opportunities/${r.id}`)}
          filters={[
            { name: 'funnel_status_id', label: 'All Stages', lookup: 'funnel-statuses' },
            { name: 'owner_id', label: 'All Owners', lookup: 'employees', labelKey: 'full_name' },
            { name: 'service_id', label: 'All Services', lookup: 'services' },
            { name: 'industry_id', label: 'All Industries', lookup: 'industries' },
            { name: 'lead_source_id', label: 'All Sources', lookup: 'lead-sources' },
            { name: 'close_period', label: 'Any close date', options: [{ value: 'week', label: 'Closing this week' }, { value: 'month', label: 'Closing this month' }, { value: 'quarter', label: 'Closing this quarter' }] },
          ]}
          columns={[
            { key: 'opp_code', label: 'ID', render: (r) => <Link className="link" to={`/opportunities/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.opp_code}</Link>, exportValue: (r) => r.opp_code },
            { key: 'title', label: 'Opportunity', render: (r) => <div><div className="font-medium text-ink">{r.title}</div><div className="text-xs text-slate-500">{r.company_name}</div></div> },
            { key: 'expected_value', label: 'Value', render: (r) => inr(r.expected_value) },
            { key: 'effective_probability', label: 'Prob.', render: (r) => pct(r.effective_probability) },
            { key: 'weighted_value', label: 'Weighted', render: (r) => inr(r.weighted_value) },
            { key: 'stage_name', label: 'Stage', render: (r) => <Badge color={r.stage_color}>{r.stage_name}</Badge> },
            { key: 'stage_age_days', label: 'Age (d)' },
            { key: 'expected_close_date', label: 'Close', render: (r) => fmtDate(r.expected_close_date) },
            { key: 'owner_name', label: 'Owner' },
          ]}
          defaults={{}}
          fields={fields}
          toPayload={(v) => Object.fromEntries(fields.filter((f) => f.name).map((f) => [f.name, v[f.name]]))}
          canEditRow={(r) => r.stage_type !== 'won'}
        />
      )}
    </div>
  );
}
