import { Link } from 'react-router-dom';
import useFetch from '../../../hooks/useFetch';
import Loader from '../../../components/common/Loader';
import Badge from '../../../components/common/Badge';
import ReportTable from './ReportTable';
import { fmtDate } from '../../../utils/format';

export default function ProjectStatusReport({ filters }) {
  const { data, loading } = useFetch('/reports/project-status', filters);
  if (loading && !data) return <Loader />;
  if (!data) return null;
  const red = (k) => (r) => <span className={Number(r[k]) > 0 ? 'font-medium text-red-600' : ''}>{r[k]}</span>;
  return (
    <ReportTable
      title="Project Status & Health"
      exportName="project_status"
      filters={filters}
      rows={data.rows}
      columns={[
        { key: 'project_code', label: 'Project', render: (r) => <Link className="link" to={`/projects/${r.id}`}>{r.project_code}</Link> },
        { key: 'name', label: 'Name' },
        { key: 'company', label: 'Client' },
        { key: 'event_start', label: 'Event', render: (r) => fmtDate(r.event_start) },
        { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        { key: 'health', label: 'Health', render: (r) => <Badge>{r.health}</Badge> },
        { key: 'progress', label: 'Progress %' },
        { key: 'overdue_milestones', label: 'Overdue Milestones', render: red('overdue_milestones') },
        { key: 'overdue_tasks', label: 'Overdue Tasks', render: red('overdue_tasks') },
        { key: 'pending_client', label: 'Pending Client' },
        { key: 'pending_vendor', label: 'Pending Vendor' },
        { key: 'open_escalations', label: 'Escalations', render: red('open_escalations') },
        { key: 'manager', label: 'Manager' },
      ]}
    />
  );
}
