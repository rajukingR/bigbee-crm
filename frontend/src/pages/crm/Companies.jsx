import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuRefreshCw } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import api, { showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { lakhs } from '../../utils/format';
import { CLIENT_TYPES, BUCKETS, COMPANY_SIZES, toOptions } from '../../utils/constants';

export const COMPANY_FIELDS = [
  { name: 'name', label: 'Company Name', required: true },
  { name: 'industry_id', label: 'Industry / Segment', type: 'select', lookup: 'industries' },
  { name: 'company_size', label: 'Company Size', type: 'select', options: toOptions(COMPANY_SIZES) },
  { name: 'website', label: 'Website' },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State' },
  { name: 'locations', label: 'Other Locations', col: 'full' },
  { name: 'address', label: 'Address', type: 'textarea' },
  { name: 'gst_no', label: 'GST No.' },
  { name: 'target_departments', label: 'Target Departments / Personas', placeholder: 'HR/Admin, Sales & Marketing, Procurement' },
  { name: 'client_type', label: 'Client Type', type: 'select', options: toOptions(CLIENT_TYPES), allowEmpty: false },
  { name: 'bucket', label: 'Client Bucket', type: 'select', options: toOptions(BUCKETS), help: 'A ≥ ₹50L, B ≥ ₹20L, C > 0, D = data only' },
  { name: 'owner_id', label: 'Account Owner', type: 'select', lookup: 'employees', labelKey: 'full_name' },
  { name: 'status', label: 'Status', type: 'select', options: toOptions(['Active', 'Inactive']), allowEmpty: false },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Companies() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [key, setKey] = useState(0);

  const recalc = async () => {
    try {
      await api.post('/companies/recalculate-buckets');
      toast.success('Client types & buckets recalculated');
      setKey((k) => k + 1);
    } catch (e) {
      showError(e);
    }
  };

  return (
    <CrudPage
      title="Companies"
      endpoint="/companies"
      module="companies"
      addLabel="Add Company"
      exportName="companies"
      reloadKey={key}
      modalSize="lg"
      onRowClick={(r) => navigate(`/companies/${r.id}`)}
      filters={[
        { name: 'industry_id', label: 'All Industries', lookup: 'industries' },
        { name: 'client_type', label: 'All Client Types', options: toOptions(CLIENT_TYPES) },
        { name: 'bucket', label: 'All Buckets', options: toOptions(BUCKETS) },
        { name: 'owner_id', label: 'All Owners', lookup: 'employees', labelKey: 'full_name' },
      ]}
      toolbarExtra={() =>
        can('companies', 'edit') && (
          <button className="btn-outline !py-1.5" onClick={recalc} title="Segregate existing clients vs existing data and set revenue buckets">
            <LuRefreshCw size={14} /> Buckets
          </button>
        )
      }
      columns={[
        { key: 'company_code', label: 'Code' },
        { key: 'name', label: 'Company', render: (r) => <span className="font-medium text-ink">{r.name}</span> },
        { key: 'industry_name', label: 'Industry' },
        { key: 'city', label: 'City' },
        { key: 'client_type', label: 'Type', render: (r) => <Badge>{r.client_type}</Badge> },
        { key: 'bucket', label: 'Bucket', render: (r) => (r.bucket ? <span className="chip bg-sidebar text-white">{r.bucket}</span> : '—') },
        { key: 'contact_count', label: 'Contacts' },
        { key: 'lead_count', label: 'Leads' },
        { key: 'won_revenue', label: 'Revenue', render: (r) => lakhs(r.won_revenue) },
        { key: 'owner_name', label: 'Owner' },
      ]}
      defaults={{ client_type: 'Prospect', status: 'Active' }}
      fields={COMPANY_FIELDS}
      toPayload={(v) => Object.fromEntries(COMPANY_FIELDS.map((f) => [f.name, v[f.name]]))}
    />
  );
}
