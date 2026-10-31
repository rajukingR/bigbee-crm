import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuPencil, LuClipboardCheck } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Tabs from '../../components/common/Tabs';
import Badge from '../../components/common/Badge';
import DetailGrid from '../../components/common/DetailGrid';
import Modal from '../../components/common/Modal';
import ProgressBar from '../../components/common/ProgressBar';
import Attachments from '../../components/common/Attachments';
import { FormRenderer } from '../../components/common/FormFields';
import { PROJECT_FIELDS, HealthDot } from './Projects';
import HandoverTab from './tabs/HandoverTab';
import TasksTab from './tabs/TasksTab';
import MilestonesTab from './tabs/MilestonesTab';
import ServicingTab from './tabs/ServicingTab';
import FinancialsTab from './tabs/FinancialsTab';
import ClosureTab from './tabs/ClosureTab';
import { inr, fmtDate } from '../../utils/format';

export default function ProjectDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, loading, reload } = useFetch(`/projects/${id}/overview`);
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(null);

  if (loading && !data) return <Loader />;
  if (!data) return null;
  const p = data.project;
  const fields = PROJECT_FIELDS(can('project_financials', 'edit'));
  const openTasks = data.tasks.filter((t) => !['Completed', 'Cancelled'].includes(t.status));
  const overdueTasks = openTasks.filter((t) => t.due_date && new Date(String(t.due_date).replace(' ', 'T')) < new Date());

  const save = async () => {
    try {
      await api.put(`/projects/${id}`, Object.fromEntries(fields.map((f) => [f.name, edit[f.name]])));
      toast.success('Project updated');
      setEdit(null);
      reload();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div>
      <PageHeader
        back="/projects"
        title={`${p.project_code} · ${p.name}`}
        subtitle={`${p.company_name || '—'} · ${p.event_type_name || 'Event'} · ${fmtDate(p.event_start)}${p.event_end && p.event_end !== p.event_start ? ' – ' + fmtDate(p.event_end) : ''} · ${p.location || p.city || ''}`}
        badge={
          <>
            <Badge>{p.status}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <HealthDot h={p.health} /> {p.health}
            </span>
          </>
        }
        actions={
          <>
            {can('execution') && (
              <Link className="btn-outline" to={`/execution/${p.id}`}>
                <LuClipboardCheck size={15} /> Execution Tracker
              </Link>
            )}
            {can('projects', 'edit') && p.status !== 'Closed' && (
              <button className="btn-primary" onClick={() => setEdit({ ...p })}>
                <LuPencil size={15} /> Edit Project
              </button>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="card p-4">
          <div className="text-xs text-slate-500">Progress</div>
          <div className="mt-1 text-lg font-semibold">{data.progress}%</div>
          <ProgressBar value={data.progress} className="mt-2" />
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Confirmed Value</div>
          <div className="mt-1 text-lg font-semibold">{inr(Number(p.confirmed_value) + Number(p.change_order_value))}</div>
          {Number(p.change_order_value) > 0 && <div className="text-[11px] text-slate-500">incl. {inr(p.change_order_value)} change orders</div>}
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Open / Overdue Tasks</div>
          <div className="mt-1 text-lg font-semibold">
            {openTasks.length} <span className={overdueTasks.length ? 'text-red-600' : 'text-slate-400'}>/ {overdueTasks.length}</span>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Handover</div>
          <div className="mt-1"><Badge>{data.handover ? data.handover.status : 'Not started'}</Badge></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Open Escalations</div>
          <div className={`mt-1 text-lg font-semibold ${data.escalations.filter((e) => ['Open', 'In Progress'].includes(e.status)).length ? 'text-red-600' : ''}`}>
            {data.escalations.filter((e) => ['Open', 'In Progress'].includes(e.status)).length}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-3">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'handover', label: 'Handover' },
              { key: 'tasks', label: 'Tasks', count: data.tasks.length },
              { key: 'milestones', label: 'Milestones', count: data.milestones.length },
              { key: 'servicing', label: 'Client Servicing', count: data.communication_logs.length + data.change_requests.length },
              { key: 'financials', label: 'Financials', hidden: !can('project_financials') },
              { key: 'files', label: 'Documents' },
              { key: 'closure', label: 'Feedback & Closure' },
            ]}
          />
        </div>
        <div className="p-5">
          {tab === 'overview' && (
            <DetailGrid
              items={[
                { label: 'Client', value: p.company_id ? <Link className="link" to={`/companies/${p.company_id}`}>{p.company_name}</Link> : '—' },
                { label: 'Client Contact', value: p.contact_name },
                { label: 'Service Line', value: p.service_name },
                { label: 'From Opportunity', value: p.opportunity_id ? <Link className="link" to={`/opportunities/${p.opportunity_id}`}>{p.opp_code}</Link> : 'Created manually' },
                { label: 'Proposal', value: p.proposal_id ? <Link className="link" to={`/proposals/${p.proposal_id}`}>View proposal</Link> : '—' },
                { label: 'Venue / Location', value: p.location },
                { label: 'BD Owner', value: p.bd_owner_name },
                { label: 'Client Servicing', value: p.cs_owner_name },
                { label: 'Operations', value: p.ops_owner_name },
                { label: 'Finance Owner', value: p.finance_owner_name },
                { label: 'Project Manager', value: p.manager_name },
                { label: 'Event-day Status', value: p.event_day_status },
                { label: 'Payment Terms', value: p.payment_terms, full: true, hidden: !can('project_financials') },
                { label: 'Approved Scope', value: p.scope, full: true },
              ]}
            />
          )}
          {tab === 'handover' && <HandoverTab data={data} reload={reload} />}
          {tab === 'tasks' && <TasksTab data={data} reload={reload} />}
          {tab === 'milestones' && <MilestonesTab data={data} reload={reload} />}
          {tab === 'servicing' && <ServicingTab data={data} reload={reload} />}
          {tab === 'financials' && <FinancialsTab data={data} />}
          {tab === 'files' && (
            <Attachments
              entityType="project"
              entityId={p.id}
              docTypes={['Client Brief', 'Proposal', 'Purchase Order', 'Contract', 'Floor Plan', 'Technical Rider', 'Design / Render', 'Site Photo', 'Permit', 'Run of Show', 'Other']}
              readOnly={!can('projects', 'edit')}
            />
          )}
          {tab === 'closure' && <ClosureTab data={data} reload={reload} />}
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit Project" size="lg" footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
        {edit && <FormRenderer fields={fields} values={edit} onChange={(n, v) => setEdit((s) => { const f = fields.find((x) => x.name === n); const nv = { ...s, [n]: v }; return f && f.onChange ? f.onChange(nv, v) : nv; })} />}
      </Modal>
    </div>
  );
}
