import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuNotebookPen, LuPencil, LuTrophy, LuFilePlus2, LuArrowRightLeft } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Tabs from '../../components/common/Tabs';
import Badge from '../../components/common/Badge';
import DetailGrid from '../../components/common/DetailGrid';
import Modal from '../../components/common/Modal';
import Attachments from '../../components/common/Attachments';
import ActivityTimeline from '../../components/common/ActivityTimeline';
import LogActivityModal from '../../components/common/LogActivityModal';
import { FormRenderer } from '../../components/common/FormFields';
import { OPP_FIELDS } from './Opportunities';
import { inr, fmtDate, fmtDateTime, pct, isOverdue } from '../../utils/format';

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: o, loading, reload } = useFetch(`/opportunities/${id}/detail`);
  const [tab, setTab] = useState('activities');
  const [logOpen, setLogOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [stage, setStage] = useState(null);
  const [won, setWon] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !o) return <Loader />;
  if (!o) return null;
  const closed = o.stage_type === 'won' || o.stage_type === 'lost';
  const fields = OPP_FIELDS(can('opportunities', 'approve'));

  const saveEdit = async () => {
    try {
      await api.put(`/opportunities/${id}`, Object.fromEntries(fields.filter((f) => f.name).map((f) => [f.name, edit[f.name]])));
      toast.success('Opportunity updated');
      setEdit(null);
      reload();
    } catch (e) {
      showError(e);
    }
  };
  const saveStage = async () => {
    try {
      await api.post(`/opportunities/${id}/stage`, stage);
      toast.success('Stage updated');
      setStage(null);
      reload();
    } catch (e) {
      showError(e);
    }
  };
  const saveWon = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(won).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') fd.append(k, v);
      });
      const { data } = await api.post(`/opportunities/${id}/won`, fd);
      toast.success('Won! Project created – complete the handover');
      navigate(`/projects/${data.project_id}`);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };


  return (
    <div>
      <PageHeader
        back="/opportunities"
        title={`${o.opp_code} · ${o.title}`}
        subtitle={`${o.company_name || 'No company'} · Owner: ${o.owner_name || '—'}`}
        badge={<Badge color={o.stage_color}>{o.stage_name}</Badge>}
        actions={
          <>
            {can('activities', 'create') && (
              <button className="btn-outline" onClick={() => setLogOpen(true)}>
                <LuNotebookPen size={15} /> Log Activity
              </button>
            )}
            {!closed && can('proposals', 'create') && (
              <Link className="btn-outline" to={`/proposals/new?opportunity_id=${o.id}`}>
                <LuFilePlus2 size={15} /> Create Proposal
              </Link>
            )}
            {!closed && can('opportunities', 'edit') && (
              <>
                <button className="btn-outline" onClick={() => setStage({ funnel_status_id: '', remarks: '' })}>
                  <LuArrowRightLeft size={15} /> Change Stage
                </button>
                <button className="btn-outline" onClick={() => setEdit({ ...o })}>
                  <LuPencil size={15} /> Edit
                </button>
                <button className="btn-success" onClick={() => setWon({ win_evidence: '', confirmed_value: o.expected_value })}>
                  <LuTrophy size={15} /> Mark as Won
                </button>
              </>
            )}
            {o.project_id && (
              <Link className="btn-primary" to={`/projects/${o.project_id}`}>
                Open Project {o.project_code}
              </Link>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ['Expected Value', inr(o.expected_value)],
          ['Probability', `${pct(o.effective_probability)}${Number(o.probability_override) ? ' (override)' : ''}`],
          ['Weighted Value', inr(o.weighted_value)],
          ['Days in Stage', o.stage_age_days],
          ['Expected Close', fmtDate(o.expected_close_date)],
        ].map(([l, v]) => (
          <div key={l} className="card p-4">
            <div className="text-xs text-slate-500">{l}</div>
            <div className="mt-1 text-lg font-semibold text-ink">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <DetailGrid
            items={[
              { label: 'Company', value: o.company_id ? <Link className="link" to={`/companies/${o.company_id}`}>{o.company_name}</Link> : '—' },
              { label: 'Contact', value: o.contact_name },
              { label: 'Industry', value: o.industry_name },
              { label: 'Service Line', value: o.service_name },
              { label: 'Event Type', value: o.event_type_name },
              { label: 'Event Date', value: fmtDate(o.event_date) },
              { label: 'Source', value: o.source_name },
              { label: 'City', value: o.city },
              { label: 'Last Activity', value: fmtDateTime(o.last_activity_at) },
              { label: 'Competitor', value: o.competitor },
              { label: 'Lead', value: o.lead_id ? <Link className="link" to={`/leads/${o.lead_id}`}>View lead</Link> : '—' },
              { label: 'Win Evidence', value: o.win_evidence, hidden: !o.win_evidence },
              { label: 'Loss Reason', value: o.loss_reason_name, hidden: o.stage_type !== 'lost' },
              { label: 'Lost Value', value: inr(o.lost_value), hidden: o.stage_type !== 'lost' },
              { label: 'Loss Notes', value: o.loss_notes, full: true, hidden: !o.loss_notes },
              { label: 'Notes / Requirement', value: o.notes, full: true },
            ]}
          />
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-slate-500">Next Action</div>
          <div className="mt-1 text-sm">{o.next_action || 'No next action set'}</div>
          <div className="mt-3 text-xs font-medium text-slate-500">Next Follow-up</div>
          <div className={`mt-1 text-sm ${isOverdue(o.next_follow_up) && !closed ? 'font-semibold text-red-600' : ''}`}>{fmtDateTime(o.next_follow_up)}</div>
        </div>
      </div>

      <div className="card mt-5">
        <div className="px-3">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'activities', label: 'Activities', count: o.activities.length },
              { key: 'proposals', label: 'Proposals', count: o.proposals.length },
              { key: 'history', label: 'Stage History', count: o.history.length },
              { key: 'files', label: 'Files' },
            ]}
          />
        </div>
        <div className="p-5">
          {tab === 'activities' && <ActivityTimeline items={o.activities} />}
          {tab === 'proposals' && (
            <table className="min-w-full">
              <thead className="border-b border-line">
                <tr>{['Proposal', 'Version', 'Total', 'Margin', 'Sent', 'Status'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr>
              </thead>
              <tbody>
                {o.proposals.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-400">No proposals yet</td></tr>}
                {o.proposals.map((p) => (
                  <tr key={p.id} className="border-b border-line">
                    <td className="table-cell"><Link className="link" to={`/proposals/${p.id}`}>{p.proposal_code}</Link> {Number(p.is_latest) ? <span className="text-xs text-green-600">latest</span> : ''}</td>
                    <td className="table-cell">v{p.version}</td>
                    <td className="table-cell">{inr(p.total_amount)}</td>
                    <td className="table-cell">{pct(p.margin_pct)}</td>
                    <td className="table-cell">{fmtDate(p.sent_date)}</td>
                    <td className="table-cell"><Badge>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'history' && (
            <table className="min-w-full">
              <thead className="border-b border-line">
                <tr>{['Date', 'From', 'To', 'Probability', 'Remarks', 'By'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr>
              </thead>
              <tbody>
                {o.history.map((h) => (
                  <tr key={h.id} className="border-b border-line">
                    <td className="table-cell">{fmtDateTime(h.created_at)}</td>
                    <td className="table-cell">{h.from_stage || '—'}</td>
                    <td className="table-cell">{h.to_stage}</td>
                    <td className="table-cell">{pct(h.probability)}</td>
                    <td className="table-cell">{h.remarks || '—'}</td>
                    <td className="table-cell">{h.changed_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'files' && <Attachments entityType="opportunity" entityId={o.id} docTypes={['Client Brief', 'Purchase Order', 'Contract', 'Confirmation Email', 'Other']} />}
        </div>
      </div>

      <LogActivityModal open={logOpen} onClose={() => setLogOpen(false)} relatedType="opportunity" relatedId={o.id} onSaved={reload} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit Opportunity" size="lg" footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={saveEdit}>Save</button></>}>
        {edit && <FormRenderer fields={fields} values={edit} onChange={(n, v) => setEdit((s) => { const f = fields.find((x) => x.name === n); const nv = { ...s, [n]: v }; return f && f.onChange ? f.onChange(nv, v) : nv; })} />}
      </Modal>

      <Modal open={!!stage} onClose={() => setStage(null)} title="Change Stage" size="sm" footer={<><button className="btn-outline" onClick={() => setStage(null)}>Cancel</button><button className="btn-primary" onClick={saveStage} disabled={!stage || !stage.funnel_status_id}>Update</button></>}>
        {stage && (
          <FormRenderer
            values={stage}
            onChange={(n, v) => setStage((s) => ({ ...s, [n]: v }))}
            fields={[
              { name: 'funnel_status_id', label: 'New Stage', type: 'select', lookup: 'funnel-statuses', filter: (r) => r.stage_type !== 'won', col: 'full', required: true },
              { name: 'loss_reason_id', label: 'Loss Reason (required for Lost)', type: 'select', lookup: 'loss-reasons', col: 'full' },
              { name: 'competitor', label: 'Competitor', col: 'full' },
              { name: 'remarks', label: 'Remarks', type: 'textarea' },
            ]}
          />
        )}
      </Modal>

      <Modal
        open={!!won}
        onClose={() => setWon(null)}
        title="Mark Opportunity as Won"
        footer={<><button className="btn-outline" onClick={() => setWon(null)}>Cancel</button><button className="btn-success" onClick={saveWon} disabled={busy}>{busy ? 'Creating project…' : 'Confirm Won & Create Project'}</button></>}
      >
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          A deal is Won only with written confirmation (PO / signed proposal / contract / confirmation email). A project with a draft handover checklist is created automatically from this opportunity and its latest proposal.
        </p>
        {won && (
          <FormRenderer
            values={won}
            onChange={(n, v) => setWon((s) => ({ ...s, [n]: v }))}
            fields={[
              { name: 'win_evidence', label: 'Confirmation Evidence / Reference', col: 'full', placeholder: 'e.g. PO #4521 dated 12-Oct, signed proposal v3', required: true },
              { name: 'evidence', label: 'Upload PO / Confirmation (image or PDF)', type: 'file', col: 'full' },
              { name: 'confirmed_value', label: 'Confirmed Order Value (₹, excl. tax)', type: 'number' },
              { name: 'approved_budget', label: 'Approved Cost Budget (₹)', type: 'number', help: 'Default: proposal estimated cost' },
              { name: 'cs_owner_id', label: 'Client Servicing Owner (receives handover)', type: 'select', lookup: 'employees', labelKey: (e) => `${e.full_name} – ${e.role_name || ''}` },
              { name: 'ops_owner_id', label: 'Operations Owner', type: 'select', lookup: 'employees', labelKey: (e) => `${e.full_name} – ${e.role_name || ''}` },
              { name: 'manager_id', label: 'Project Manager', type: 'select', lookup: 'employees', labelKey: 'full_name' },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
