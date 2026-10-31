import SimpleMaster from '../../components/common/SimpleMaster';
import Badge from '../../components/common/Badge';

export default function FunnelStatus() {
  return (
    <SimpleMaster
      type="funnel-statuses"
      label="Funnel Status"
      extraColumns={[
        { key: 'probability', label: 'Probability %', render: (r) => `${Number(r.probability)}%` },
        { key: 'stage_type', label: 'Stage Type', render: (r) => <Badge color={r.color}>{r.stage_type}</Badge> },
      ]}
      extraFields={[
        { name: 'probability', label: 'Default Probability %', type: 'number', min: 0, max: 100, help: 'Weighted pipeline = value × probability' },
        {
          name: 'stage_type',
          label: 'Stage Type',
          type: 'select',
          allowEmpty: false,
          options: [
            { value: 'open', label: 'Open (in pipeline)' },
            { value: 'won', label: 'Won' },
            { value: 'lost', label: 'Lost' },
            { value: 'hold', label: 'On Hold' },
          ],
        },
        { name: 'color', label: 'Colour', type: 'color' },
      ]}
    />
  );
}
