import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { LuUpload, LuFileText, LuImage, LuTrash2, LuDownload, LuEye } from 'react-icons/lu';
import api, { fileUrl, showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { fmtDateTime } from '../../utils/format';
import Modal from './Modal';

/** Upload / list / preview / delete images and PDF files for any record. */
export default function Attachments({ entityType, entityId, docTypes = [], readOnly = false, title = 'Files & Documents' }) {
  const { data, loading, reload } = useFetch('/attachments', { entity_type: entityType, entity_id: entityId }, { enabled: !!entityId });
  const [docType, setDocType] = useState(docTypes[0] || '');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const input = useRef(null);
  const files = data || [];

  const upload = async (list) => {
    if (!list || !list.length) return;
    const fd = new FormData();
    [...list].forEach((f) => fd.append('files', f));
    fd.append('entity_type', entityType);
    fd.append('entity_id', entityId);
    if (docType) fd.append('doc_type', docType);
    setBusy(true);
    try {
      await api.post('/attachments', fd);
      toast.success('Uploaded');
      reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async (f) => {
    if (!window.confirm(`Delete ${f.original_name}?`)) return;
    try {
      await api.delete(`/attachments/${f.id}`);
      reload();
    } catch (e) {
      showError(e);
    }
  };

  const isImage = (f) => (f.mime_type || '').startsWith('image/');

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {docTypes.length > 0 && (
              <select className="input !w-auto !py-1.5 text-xs" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {docTypes.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            )}
            <input ref={input} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files)} />
            <button className="btn-outline btn-sm" onClick={() => input.current && input.current.click()} disabled={busy}>
              <LuUpload size={14} /> {busy ? 'Uploading…' : 'Upload image / PDF'}
            </button>
          </div>
        )}
      </div>
      {!readOnly && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
          className="mb-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500"
        >
          Drag & drop images or PDF files here (max 10 MB each)
        </div>
      )}
      {loading ? (
        <div className="py-4 text-sm text-slate-500">Loading…</div>
      ) : files.length === 0 ? (
        <div className="py-4 text-sm text-slate-400">No files uploaded yet</div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-md border border-line p-2.5">
              {isImage(f) ? (
                <img src={fileUrl(f.file_path)} alt="" className="h-11 w-11 shrink-0 cursor-pointer rounded object-cover" onClick={() => setPreview(f)} />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-red-50 text-red-600">
                  {f.mime_type === 'application/pdf' ? <LuFileText size={20} /> : <LuImage size={20} />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink" title={f.original_name}>
                  {f.original_name}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {f.doc_type ? `${f.doc_type} · ` : ''}
                  {(f.file_size / 1024).toFixed(0)} KB · {f.uploaded_by_name || ''} · {fmtDateTime(f.created_at)}
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <button className="rounded p-1 text-slate-500 hover:text-brand" title="Preview" onClick={() => (isImage(f) ? setPreview(f) : window.open(fileUrl(f.file_path), '_blank'))}>
                  <LuEye size={15} />
                </button>
                <a className="rounded p-1 text-slate-500 hover:text-brand" title="Download" href={fileUrl(f.file_path)} download={f.original_name} target="_blank" rel="noreferrer">
                  <LuDownload size={15} />
                </a>
                {!readOnly && (
                  <button className="rounded p-1 text-slate-500 hover:text-red-600" title="Delete" onClick={() => remove(f)}>
                    <LuTrash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? preview.original_name : ''} size="lg">
        {preview && <img src={fileUrl(preview.file_path)} alt="" className="mx-auto max-h-[70vh] rounded" />}
      </Modal>
    </div>
  );
}
