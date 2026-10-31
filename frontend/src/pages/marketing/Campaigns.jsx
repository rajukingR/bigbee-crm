import { useState } from 'react';
import { LuPaperclip } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Attachments from '../../components/common/Attachments';
import { inr, fmtDate, pct } from '../../utils/format';
import { CAMPAIGN_STATUSES, toOptions } from '../../utils/constants';

export default function Campaigns() {
  const [files, setFiles] = useState(null);
  const fields = [
    { name: 'name', label: 'Campaign Name', required: true, col: 'full' },
    { name: 'campaign_type_id', label: 'Campaign Type', type: 'select', lookup: 'campaign-types' },
    { name: 'channel_id', label: 'Channel', type: 'select', lookup: 'marketing-channels' },
    { name: 'advertising_type_id', label: 'Type of Advertising', type: 'select', lookup: 'advertising-types' },
    { name: 'status', label: 'Status', type: 'select', options: toOptions(CAMPAIGN_STATUSES), allowEmpty: false },
    { name: 'start_date', label: 'Start Date', type: 'date' },
    { name: 'end_date', label: 'End Date', type: 'date' },
    { name: 'budget', label: 'Budget (₹)', type: 'number' },
    { name: 'actual_spend', label: 'Actual Spend (₹)', type: 'number' },
    { name: 'impressions', label: 'Impressions', type: 'number' },
    { name: 'clicks', label: 'Clicks', type: 'number' },
    { name: 'attribution_method', label: 'Revenue Attribution', type: 'select', options: toOptions(['First Touch', 'Last Touch', 'Manual']), help: 'ROI is shown only when an attribution method is set' },
    { name: 'owner_id', label: 'Owner', type: 'select', lookup: 'employees', labelKey: 'full_name' },
    { name: 'objective', label: 'Objective', type: 'textarea' },
    { name: 'target_audience', label: 'Target Audience', type: 'textarea' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return (
    <>
      <CrudPage
        title="Marketing Campaigns"
        endpoint="/campaigns"
        module="campaigns"
        addLabel="New Campaign"
        exportName="campaigns"
        modalSize="lg"
        filters={[
          { name: 'status', label: 'All Status', options: toOptions(CAMPAIGN_STATUSES) },
          { name: 'channel_id', label: 'All Channels', lookup: 'marketing-channels' },
          { name: 'campaign_type_id', label: 'All Types', lookup: 'campaign-types' },
        ]}
        columns={[
          { key: 'name', label: 'Campaign', render: (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-slate-500">{r.campaign_code} · {r.channel_name || '—'} · {fmtDate(r.start_date)}</div></div>, exportValue: (r) => r.name },
          { key: 'actual_spend', label: 'Spend / Budget', render: (r) => <div>{inr(r.actual_spend)}<div className="text-xs text-slate-500">of {inr(r.budget)}</div></div>, exportValue: (r) => r.actual_spend },
          { key: 'leads', label: 'Leads' },
          { key: 'qualified_leads', label: 'Qualified' },
          { key: 'opportunities', label: 'Opps' },
          { key: 'wins', label: 'Wins' },
          { key: 'won_revenue', label: 'Won Revenue', render: (r) => inr(r.won_revenue) },
          { key: 'cost_per_lead', label: 'CPL', render: (r) => (r.cost_per_lead === null ? 'N/A' : inr(r.cost_per_lead)) },
          { key: 'roi_pct', label: 'ROI', render: (r) => (r.roi_pct === null ? <span className="text-slate-400">N/A</span> : <span className={r.roi_pct >= 0 ? 'text-green-700' : 'text-red-600'}>{pct(r.roi_pct)}</span>) },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        defaults={{ status: 'Planned', attribution_method: 'Last Touch' }}
        fields={fields}
        toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
        rowActions={(r) => (
          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Creatives & reports" onClick={() => setFiles(r)}>
            <LuPaperclip size={15} />
          </button>
        )}
      />
      <Modal open={!!files} onClose={() => setFiles(null)} title={files ? `${files.name} – files` : ''} size="lg">
        {files && <Attachments entityType="campaign" entityId={files.id} docTypes={['Creative', 'Ad Report', 'Invoice', 'Other']} />}
      </Modal>
    </>
  );
}
