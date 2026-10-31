import SimpleMaster from '../../components/common/SimpleMaster';

export default function SubSource() {
  return (
    <SimpleMaster
      type="sub-sources"
      label="Sub Source"
      filters={[{ name: 'source_id', label: 'All Lead Sources', lookup: 'lead-sources' }]}
      extraColumns={[{ key: 'source_name', label: 'Lead Source' }]}
      extraFields={[{ name: 'source_id', label: 'Lead Source', type: 'select', lookup: 'lead-sources', required: true }]}
    />
  );
}
