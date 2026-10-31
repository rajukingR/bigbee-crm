import useFetch from '../../../hooks/useFetch';
import Loader from '../../../components/common/Loader';
import ReportTable from './ReportTable';

export default function LeadActivityReport({ filters }) {
  const { data, loading } = useFetch('/reports/lead-activity', filters);
  if (loading && !data) return <Loader />;
  if (!data) return null;
  const red = (k) => (r) => <span className={Number(r[k]) > 0 ? 'font-medium text-red-600' : ''}>{r[k]}</span>;
  return (
    <ReportTable
      title="Lead Activity by Owner"
      exportName="lead_activity"
      filters={filters}
      rows={data.rows}
      columns={[
        { key: 'owner', label: 'Owner' },
        { key: 'department', label: 'Department' },
        { key: 'leads_created', label: 'Leads Created' },
        { key: 'open_leads', label: 'Open Leads' },
        { key: 'calls', label: 'Calls' },
        { key: 'meetings', label: 'Meetings' },
        { key: 'emails', label: 'Emails' },
        { key: 'proposals_sent', label: 'Proposals' },
        { key: 'overdue_followups', label: 'Overdue F/U', render: red('overdue_followups') },
        { key: 'no_next_action', label: 'No Next Action', render: red('no_next_action') },
        { key: 'inactive_leads', label: 'Inactive', render: red('inactive_leads') },
      ]}
    />
  );
}
