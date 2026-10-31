import useFetch from '../../../hooks/useFetch';
import Loader from '../../../components/common/Loader';
import Badge from '../../../components/common/Badge';
import ReportTable from './ReportTable';
import { inr, fmtDate } from '../../../utils/format';

export default function VendorCommitmentsReport({ filters }) {
  const { data, loading } = useFetch('/finance/vendor-commitments', filters);
  if (loading && !data) return <Loader />;
  if (!data) return null;
  return (
    <ReportTable
      title="Vendor Commitments"
      exportName="vendor_commitments"
      filters={filters}
      rows={data}
      columns={[
        { key: 'po_code', label: 'PO' },
        { key: 'vendor_name', label: 'Vendor' },
        { key: 'project_code', label: 'Project' },
        { key: 'total_amount', label: 'Committed', render: (r) => inr(r.total_amount) },
        { key: 'billed', label: 'Billed', render: (r) => inr(r.billed) },
        { key: 'paid', label: 'Paid', render: (r) => inr(r.paid) },
        { key: 'balance_to_bill', label: 'Balance to Bill', render: (r) => inr(r.balance_to_bill) },
        { key: 'payable', label: 'Payable', render: (r) => inr(r.payable) },
        { key: 'delivery_date', label: 'Delivery', render: (r) => fmtDate(r.delivery_date) },
        { key: 'delivery_status', label: 'Delivery Status', render: (r) => <Badge>{r.delivery_status}</Badge> },
      ]}
    />
  );
}
