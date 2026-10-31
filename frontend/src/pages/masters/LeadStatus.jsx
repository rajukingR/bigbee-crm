import SimpleMaster from '../../components/common/SimpleMaster';

export default function LeadStatus() {
  return (
    <SimpleMaster
      type="lead-statuses"
      label="Lead Status"
      extraColumns={[{ key: 'color', label: 'Colour', render: (r) => <span className="inline-block h-4 w-8 rounded" style={{ background: r.color }} /> }]}
      extraFields={[{ name: 'color', label: 'Badge Colour', type: 'color' }]}
    />
  );
}
