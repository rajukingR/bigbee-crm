import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuPencil, LuPlus, LuNotebookPen } from 'react-icons/lu';
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
import { COMPANY_FIELDS } from './Companies';
import { CONTACT_FIELDS } from './Contacts';
import { inr, lakhs, fmtDate } from '../../utils/format';

function MiniTable({ cols, rows, empty = 'No records' }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="border-b border-line">
          <tr>{cols.map((c) => <th key={c.label} className="table-head">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} className="py-6 text-center text-sm text-slate-400">{empty}</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              {cols.map((c) => <td key={c.label} className="table-cell">{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompanyDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, loading, reload } = useFetch(`/companies/${id}/overview`);
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(null);
  const [contact, setContact] = useState(null);
  const [logOpen, setLogOpen] = useState(false);

  if (loading && !data) return <Loader />;
  if (!data) return null;
  const c = data.company;

  const saveCompany = async () => {
    try {
      await api.put(`/companies/${id}`, { ...Object.fromEntries(COMPANY_FIELDS.map((f) => [f.name, edit[f.name]])), force: 1 });
      toast.success('Company updated');
      setEdit(null);
      reload();
    } catch (e) {
      showError(e);
    }
  };
  const saveContact = async () => {
    try {
      const body = { ...Object.fromEntries(CONTACT_FIELDS.map((f) => [f.name, contact[f.name]])), company_id: id };
      if (contact.id) await api.put(`/contacts/${contact.id}`, body);
      else await api.post('/contacts', body);
      toast.success('Contact saved');
      setContact(null);
      reload();
    } catch (e) {
      showError(e);
    }
  };

  const outstanding = data.invoices.reduce((a, i) => a + Number(i.total_amount) - Number(i.received_amount), 0);

  return (
    <div>
      <PageHeader
        back="/companies"
        title={c.name}
        subtitle={`${c.company_code} · ${c.industry_name || 'No industry'} · ${c.city || ''}`}
        badge={
          <>
            <Badge>{c.client_type}</Badge>
            {c.bucket && <span className="chip bg-sidebar text-white">Bucket {c.bucket}</span>}
          </>
        }
        actions={
          <>
            {can('activities', 'create') && (
              <button className="btn-outline" onClick={() => setLogOpen(true)}>
                <LuNotebookPen size={15} /> Log Activity
              </button>
            )}
            {can('leads', 'create') && (
              <Link className="btn-outline" to={`/leads?new=1&company_id=${c.id}`}>
                <LuPlus size={15} /> New Lead
              </Link>
            )}
            {can('companies', 'edit') && (
              <button className="btn-primary" onClick={() => setEdit({ ...c })}>
                <LuPencil size={15} /> Edit
              </button>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ['Contacts', data.contacts.length],
          ['Leads', data.leads.length],
          ['Opportunities', data.opportunities.length],
          ['Revenue (projects)', lakhs(c.won_revenue)],
          ['Outstanding', lakhs(outstanding)],
        ].map(([l, v]) => (
          <div key={l} className="card p-4">
            <div className="text-xs text-slate-500">{l}</div>
            <div className="mt-1 text-lg font-semibold text-ink">{v}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="px-3">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'contacts', label: 'Contacts', count: data.contacts.length },
              { key: 'leads', label: 'Leads', count: data.leads.length },
              { key: 'opps', label: 'Opportunities', count: data.opportunities.length },
              { key: 'proposals', label: 'Proposals', count: data.proposals.length },
              { key: 'projects', label: 'Projects', count: data.projects.length },
              { key: 'activities', label: 'Activity History', count: data.activities.length },
              { key: 'invoices', label: 'Collections', count: data.invoices.length, hidden: !can('invoices') },
              { key: 'files', label: 'Files' },
            ]}
          />
        </div>
        <div className="p-5">
          {tab === 'overview' && (
            <DetailGrid
              items={[
                { label: 'Website', value: c.website },
                { label: 'Phone', value: c.phone },
                { label: 'Email', value: c.email },
                { label: 'Company Size', value: c.company_size },
                { label: 'GST No.', value: c.gst_no },
                { label: 'Account Owner', value: c.owner_name },
                { label: 'State', value: c.state },
                { label: 'Locations', value: c.locations },
                { label: 'Status', value: <Badge>{c.status}</Badge> },
                { label: 'Target Departments / Personas', value: c.target_departments, full: true },
                { label: 'Address', value: c.address, full: true },
                { label: 'Notes', value: c.notes, full: true },
              ]}
            />
          )}
          {tab === 'contacts' && (
            <>
              {can('contacts', 'create') && (
                <div className="mb-3 flex justify-end">
                  <button className="btn-primary btn-sm" onClick={() => setContact({ decision_role: 'Other' })}>
                    <LuPlus size={14} /> Add Contact
                  </button>
                </div>
              )}
              <MiniTable
                rows={data.contacts}
                cols={[
                  { label: 'Name', render: (r) => <span className="font-medium">{r.name}{Number(r.is_primary) ? ' ★' : ''}</span> },
                  { label: 'Designation', render: (r) => r.designation || '—' },
                  { label: 'Department', render: (r) => r.department || '—' },
                  { label: 'Phone', render: (r) => r.phone || '—' },
                  { label: 'Email', render: (r) => r.email || '—' },
                  { label: 'Role', render: (r) => <Badge>{r.decision_role}</Badge> },
                  { label: '', render: (r) => can('contacts', 'edit') && <button className="link text-xs" onClick={() => setContact({ ...r })}>Edit</button> },
                ]}
              />
            </>
          )}
          {tab === 'leads' && (
            <MiniTable
              rows={data.leads}
              cols={[
                { label: 'Lead', render: (r) => <Link className="link" to={`/leads/${r.id}`}>{r.lead_code}</Link> },
                { label: 'Created', render: (r) => fmtDate(r.created_at) },
                { label: 'Budget', render: (r) => inr(r.expected_budget) },
                { label: 'Status', render: (r) => <Badge>{r.status_name}</Badge> },
                { label: 'Qualification', render: (r) => <Badge>{r.qualification}</Badge> },
                { label: 'Owner', render: (r) => r.owner_name },
              ]}
            />
          )}
          {tab === 'opps' && (
            <MiniTable
              rows={data.opportunities}
              cols={[
                { label: 'Opportunity', render: (r) => <Link className="link" to={`/opportunities/${r.id}`}>{r.opp_code} · {r.title}</Link> },
                { label: 'Value', render: (r) => inr(r.expected_value) },
                { label: 'Stage', render: (r) => <Badge color={r.stage_color}>{r.stage_name}</Badge> },
                { label: 'Expected Close', render: (r) => fmtDate(r.expected_close_date) },
                { label: 'Owner', render: (r) => r.owner_name },
              ]}
            />
          )}
          {tab === 'proposals' && (
            <MiniTable
              rows={data.proposals}
              cols={[
                { label: 'Proposal', render: (r) => <Link className="link" to={`/proposals/${r.id}`}>{r.proposal_code} v{r.version}</Link> },
                { label: 'Title', render: (r) => r.title },
                { label: 'Total', render: (r) => inr(r.total_amount) },
                { label: 'Sent', render: (r) => fmtDate(r.sent_date) },
                { label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              ]}
            />
          )}
          {tab === 'projects' && (
            <MiniTable
              rows={data.projects}
              cols={[
                { label: 'Project', render: (r) => <Link className="link" to={`/projects/${r.id}`}>{r.project_code} · {r.name}</Link> },
                { label: 'Event Date', render: (r) => fmtDate(r.event_start) },
                { label: 'Confirmed Value', render: (r) => inr(r.confirmed_value) },
                { label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              ]}
            />
          )}
          {tab === 'activities' && <ActivityTimeline items={data.activities} />}
          {tab === 'invoices' && (
            <MiniTable
              rows={data.invoices}
              cols={[
                { label: 'Invoice', render: (r) => r.invoice_no },
                { label: 'Date', render: (r) => fmtDate(r.invoice_date) },
                { label: 'Due', render: (r) => fmtDate(r.due_date) },
                { label: 'Total', render: (r) => inr(r.total_amount) },
                { label: 'Received', render: (r) => inr(r.received_amount) },
                { label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              ]}
            />
          )}
          {tab === 'files' && <Attachments entityType="company" entityId={c.id} docTypes={['Company Profile', 'Agreement', 'Other']} readOnly={!can('companies', 'edit')} />}
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit Company" size="lg" footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={saveCompany}>Save</button></>}>
        {edit && <FormRenderer fields={COMPANY_FIELDS} values={edit} onChange={(n, v) => setEdit((s) => ({ ...s, [n]: v }))} />}
      </Modal>
      <Modal open={!!contact} onClose={() => setContact(null)} title={contact && contact.id ? 'Edit Contact' : 'Add Contact'} footer={<><button className="btn-outline" onClick={() => setContact(null)}>Cancel</button><button className="btn-primary" onClick={saveContact}>Save</button></>}>
        {contact && <FormRenderer fields={CONTACT_FIELDS.filter((f) => f.name !== 'company_id')} values={contact} onChange={(n, v) => setContact((s) => ({ ...s, [n]: v }))} />}
      </Modal>
      <LogActivityModal open={logOpen} onClose={() => setLogOpen(false)} relatedType="company" relatedId={c.id} onSaved={reload} />
    </div>
  );
}
