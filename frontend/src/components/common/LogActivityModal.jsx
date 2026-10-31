import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { showError } from '../../api/axios';
import Modal from './Modal';
import { FormRenderer } from './FormFields';
import { ACTIVITY_TYPES, toOptions } from '../../utils/constants';

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/** Record a call / meeting / email with outcome and next follow-up. */
export default function LogActivityModal({ open, onClose, relatedType, relatedId, onSaved }) {
  const [values, setValues] = useState({ activity_type: 'Call', activity_date: nowLocal() });
  const [saving, setSaving] = useState(false);
  const fields = [
    { name: 'activity_type', label: 'Activity Type', type: 'select', options: toOptions(ACTIVITY_TYPES), required: true, allowEmpty: false },
    { name: 'follow_up_mode_id', label: 'Mode', type: 'select', lookup: 'follow-up-modes' },
    { name: 'subject', label: 'Subject', col: 'full' },
    { name: 'activity_date', label: 'Date & Time', type: 'datetime' },
    { name: 'outcome', label: 'Outcome / Notes', type: 'textarea' },
    { name: 'next_action', label: 'Next Action' },
    { name: 'next_follow_up', label: 'Next Follow-up', type: 'datetime' },
  ];
  const save = async () => {
    setSaving(true);
    try {
      await api.post('/activities', { ...values, related_type: relatedType, related_id: relatedId });
      toast.success('Activity logged');
      setValues({ activity_type: 'Call', activity_date: nowLocal() });
      onClose();
      if (onSaved) onSaved();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log Activity"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Activity'}</button>
        </>
      }
    >
      <FormRenderer fields={fields} values={values} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
    </Modal>
  );
}
