import Modal from './Modal';

export default function ConfirmDialog({ open, title = 'Are you sure?', message, confirmText = 'Delete', danger = true, onConfirm, onClose, busy }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}
