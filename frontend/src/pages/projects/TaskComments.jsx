import { useEffect, useState } from 'react';
import api, { showError } from '../../api/axios';
import Modal from '../../components/common/Modal';
import Attachments from '../../components/common/Attachments';
import { fmtDateTime } from '../../utils/format';

/** Comments, change history and files on a task. */
export default function TaskComments({ task, onClose }) {
  const [rows, setRows] = useState([]);
  const [text, setText] = useState('');
  const load = () => task && api.get(`/tasks/${task.id}/comments`).then((r) => setRows(r.data)).catch(showError);
  useEffect(() => {
    setRows([]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);
  const add = async () => {
    if (!text.trim()) return;
    try {
      await api.post(`/tasks/${task.id}/comments`, { comment: text });
      setText('');
      load();
    } catch (e) {
      showError(e);
    }
  };
  return (
    <Modal open={!!task} onClose={onClose} title={task ? task.title : ''} size="lg">
      {task && (
        <div className="space-y-5">
          <div>
            <div className="flex gap-2">
              <input className="input" placeholder="Add a comment, approval note or update…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
              <button className="btn-primary" onClick={add}>Post</button>
            </div>
            <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">
              {rows.length === 0 && <div className="text-sm text-slate-400">No comments yet</div>}
              {rows.map((c) => (
                <div key={c.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">{c.user_name} · {fmtDateTime(c.created_at)}</div>
                  <div className="whitespace-pre-line text-sm text-ink">{c.comment}</div>
                </div>
              ))}
            </div>
          </div>
          <Attachments entityType="task" entityId={task.id} docTypes={['Design / Creative', 'Approval', 'Reference', 'Other']} />
        </div>
      )}
    </Modal>
  );
}
