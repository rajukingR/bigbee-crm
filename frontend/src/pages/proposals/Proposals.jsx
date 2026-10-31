import { Link, useNavigate } from 'react-router-dom';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import { inr, fmtDate, pct } from '../../utils/format';
import { toOptions } from '../../utils/constants';

const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Sent', 'Revised', 'Accepted', 'Lost'];

export default function Proposals() {
  const navigate = useNavigate();
  return (
    <CrudPage
      title="Proposals & Quotations"
      endpoint="/proposals"
      module="proposals"
      addLabel="Create Proposal"
      exportName="proposals"
      initialFilters={{ is_latest: 1 }}
      onAddClick={() => navigate('/proposals/new')}
      onEditClick={(r) => navigate(`/proposals/${r.id}/edit`)}
      onRowClick={(r) => navigate(`/proposals/${r.id}`)}
      canEditRow={(r) => ['Draft', 'Rejected', 'Pending Approval', 'Approved'].includes(r.status)}
      canDeleteRow={(r) => ['Draft', 'Rejected'].includes(r.status)}
      filters={[
        { name: 'status', label: 'All Status', options: toOptions(STATUSES) },
        { name: 'owner_id', label: 'All Owners', lookup: 'employees', labelKey: 'full_name' },
        { name: 'is_latest', label: 'All versions', options: [{ value: 1, label: 'Latest versions only' }] },
      ]}
      columns={[
        { key: 'proposal_code', label: 'Proposal', render: (r) => <Link className="link font-medium" to={`/proposals/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.proposal_code} v{r.version}</Link>, exportValue: (r) => `${r.proposal_code} v${r.version}` },
        { key: 'title', label: 'Title', render: (r) => <div><div className="font-medium text-ink">{r.title}</div><div className="text-xs text-slate-500">{r.company_name}</div></div> },
        { key: 'opp_code', label: 'Opportunity' },
        { key: 'total_amount', label: 'Total (incl. tax)', render: (r) => inr(r.total_amount) },
        { key: 'margin_pct', label: 'Margin', render: (r) => <span className={Number(r.margin_pct) < 20 ? 'text-red-600' : 'text-green-700'}>{pct(r.margin_pct)}</span> },
        { key: 'sent_date', label: 'Sent', render: (r) => fmtDate(r.sent_date) },
        { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        { key: 'owner_name', label: 'Owner' },
      ]}
    />
  );
}
