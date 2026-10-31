import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuPencil, LuSend, LuCopy, LuShieldCheck, LuMessageSquare, LuPrinter, LuTrash2 } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import DetailGrid from '../../components/common/DetailGrid';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Attachments from '../../components/common/Attachments';
import { FormRenderer } from '../../components/common/FormFields';
import { inr, fmtDate, fmtDateTime, pct } from '../../utils/format';

export default function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: p, loading, reload } = useFetch(`/proposals/${id}`);
  const [send, setSend] = useState(null);
  const [resp, setResp] = useState(null);
  const [del, setDel] = useState(false);

  if (loading && !p) return <Loader />;
  if (!p) return null;
  const editable = ['Draft', 'Rejected', 'Pending Approval', 'Approved'].includes(p.status);

  const act = async (fn, msg, after) => {
    try {
      const res = await fn();
      toast.success(msg);
      if (after) after(res);
      else reload();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div>
      <PageHeader
        back="/proposals"
        title={`${p.proposal_code} v${p.version} · ${p.title}`}
        subtitle={`${p.company_name || '—'}${p.opp_code ? ` · ${p.opp_code}` : ''} · Owner: ${p.owner_name || '—'}`}
        badge={
          <>
            <Badge>{p.status}</Badge>
            {!Number(p.is_latest) && <Badge>Superseded</Badge>}
          </>
        }
        actions={
          <>
            <button className="btn-outline" onClick={() => window.print()}>
              <LuPrinter size={15} /> Print
            </button>
            {can('proposals', 'edit') && editable && (
              <Link className="btn-outline" to={`/proposals/${p.id}/edit`}>
                <LuPencil size={15} /> Edit
              </Link>
            )}
            {can('proposals', 'edit') && ['Draft', 'Rejected'].includes(p.status) && (
              <button className="btn-primary" onClick={() => act(() => api.post(`/proposals/${id}/submit`), 'Submitted')}>
                <LuShieldCheck size={15} /> Submit for Approval
              </button>
            )}
            {can('proposals', 'edit') && ['Approved', 'Sent'].includes(p.status) && (
              <button className="btn-primary" onClick={() => setSend({ sent_date: new Date().toISOString().slice(0, 10) })}>
                <LuSend size={15} /> {p.status === 'Sent' ? 'Re-send' : 'Mark as Sent'}
              </button>
            )}
            {can('proposals', 'edit') && ['Sent', 'Accepted', 'Lost'].includes(p.status) && (
              <button className="btn-outline" onClick={() => setResp({ status: p.status === 'Sent' ? '' : p.status, client_feedback: p.client_feedback, negotiation_notes: p.negotiation_notes })}>
                <LuMessageSquare size={15} /> Client Response
              </button>
            )}
            {can('proposals', 'create') && !!Number(p.is_latest) && p.status !== 'Draft' && (
              <button className="btn-outline" onClick={() => act(() => api.post(`/proposals/${id}/revise`), 'New revision created', (r) => navigate(`/proposals/${r.data.id}/edit`))}>
                <LuCopy size={15} /> Create Revision
              </button>
            )}
            {can('proposals', 'delete') && ['Draft', 'Rejected'].includes(p.status) && (
              <button className="btn-outline !text-red-600" onClick={() => setDel(true)}>
                <LuTrash2 size={15} />
              </button>
            )}
          </>
        }
      />

      {p.approval_required && p.status === 'Pending Approval' ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">Awaiting approval: {p.approval_reason}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <div className="card p-5">
            <DetailGrid
              items={[
                { label: 'Opportunity', value: p.opportunity_id ? <Link className="link" to={`/opportunities/${p.opportunity_id}`}>{p.opp_code} – {p.opportunity_title}</Link> : '—' },
                { label: 'Client Contact', value: p.contact_name },
                { label: 'Event Type', value: p.event_type_name },
                { label: 'Event Date', value: fmtDate(p.event_date) },
                { label: 'Venue', value: p.venue },
                { label: 'Pax', value: p.pax },
                { label: 'Sent Date', value: fmtDate(p.sent_date) },
                { label: 'Next Follow-up', value: fmtDateTime(p.next_follow_up) },
                { label: 'Approved By', value: p.approved_by_name ? `${p.approved_by_name} · ${fmtDateTime(p.approved_at)}` : '—' },
                { label: 'Payment Terms', value: p.payment_terms, full: true },
                { label: 'Assumptions / Scope', value: p.assumptions, full: true },
                { label: 'Exclusions', value: p.exclusions, full: true },
                { label: 'Client Feedback', value: p.client_feedback, full: true, hidden: !p.client_feedback },
                { label: 'Negotiation Notes', value: p.negotiation_notes, full: true, hidden: !p.negotiation_notes },
              ]}
            />
          </div>

          <div className="card">
            <div className="px-5 pt-5"><h3 className="card-title">Line Items</h3></div>
            <div className="overflow-x-auto p-3">
              <table className="min-w-full">
                <thead className="border-b border-line">
                  <tr>
                    {['#', 'Section', 'Description', 'Qty', 'Rate', 'Amount', ...(can('project_financials') || can('proposals', 'approve') ? ['Cost'] : [])].map((h) => (
                      <th key={h} className="table-head">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((it, i) => (
                    <tr key={it.id} className="border-b border-line">
                      <td className="table-cell">{i + 1}</td>
                      <td className="table-cell">{it.section || '—'}</td>
                      <td className="table-cell">{it.description}</td>
                      <td className="table-cell">{Number(it.quantity)} {it.unit}</td>
                      <td className="table-cell">{inr(it.unit_rate)}</td>
                      <td className="table-cell">{inr(it.amount)}</td>
                      {(can('project_financials') || can('proposals', 'approve')) && <td className="table-cell text-slate-500">{inr(it.cost_amount)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <Attachments entityType="proposal" entityId={p.id} docTypes={['Proposal Deck (PDF)', 'Costing Sheet (PDF)', 'Scope of Work', 'Client Brief', 'Design / Render', 'Other']} readOnly={!can('proposals', 'edit')} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="card space-y-1.5 p-5 text-sm">
            <h3 className="card-title mb-2">Commercials</h3>
            {[
              ['Subtotal', p.subtotal],
              [`Discount (${Number(p.discount_pct)}%)`, -p.discount_amount],
              [`Agency Fee (${Number(p.agency_fee_pct)}%)`, p.agency_fee_amount],
              ['Taxable Value', p.taxable_amount],
              [`GST (${Number(p.tax_pct)}%)`, p.tax_amount],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between"><span className="text-slate-600">{l}</span><span>{inr(v, 2)}</span></div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Total</span><span>{inr(p.total_amount, 2)}</span></div>
            {(can('project_financials') || can('proposals', 'approve')) && (
              <>
                <div className="flex justify-between pt-2 text-slate-600"><span>Estimated Cost</span><span>{inr(p.estimated_cost, 2)}</span></div>
                <div className="flex justify-between font-medium text-green-700"><span>Est. Margin</span><span>{inr(p.margin_amount, 2)} ({pct(p.margin_pct)})</span></div>
              </>
            )}
          </div>

          <div className="card p-5">
            <h3 className="card-title mb-3">Versions</h3>
            <div className="space-y-2">
              {p.versions.map((v) => (
                <Link key={v.id} to={`/proposals/${v.id}`} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${v.id === p.id ? 'border-brand bg-brand-50' : 'border-line hover:border-brand/40'}`}>
                  <span>v{v.version} · {fmtDate(v.sent_date || v.created_at)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs">{inr(v.total_amount)}</span>
                    <Badge>{v.status}</Badge>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="card-title mb-3">Approval History</h3>
            {p.approvals.length === 0 ? (
              <div className="text-sm text-slate-400">No approval requests</div>
            ) : (
              p.approvals.map((a) => (
                <div key={a.id} className="mb-3 border-b border-line pb-3 text-sm last:border-0">
                  <div className="flex items-center justify-between"><span>{a.request_type}</span><Badge>{a.status}</Badge></div>
                  <div className="text-xs text-slate-500">{a.reason}</div>
                  <div className="text-xs text-slate-400">
                    Requested by {a.requested_by_name} · {fmtDateTime(a.created_at)}
                    {a.decided_by_name ? ` · ${a.status} by ${a.decided_by_name}` : ''}
                  </div>
                  {a.remarks && <div className="mt-1 text-xs italic text-slate-600">“{a.remarks}”</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal open={!!send} onClose={() => setSend(null)} title="Mark proposal as sent" size="sm" footer={<><button className="btn-outline" onClick={() => setSend(null)}>Cancel</button><button className="btn-primary" onClick={() => act(() => api.post(`/proposals/${id}/send`, send), 'Marked as sent', () => { setSend(null); reload(); })}>Save</button></>}>
        {send && (
          <FormRenderer
            values={send}
            onChange={(n, v) => setSend((s) => ({ ...s, [n]: v }))}
            fields={[
              { name: 'sent_date', label: 'Date Sent', type: 'date', col: 'full' },
              { name: 'next_follow_up', label: 'Next Follow-up', type: 'datetime', col: 'full' },
            ]}
          />
        )}
      </Modal>

      <Modal open={!!resp} onClose={() => setResp(null)} title="Client Response" footer={<><button className="btn-outline" onClick={() => setResp(null)}>Cancel</button><button className="btn-primary" onClick={() => act(() => api.post(`/proposals/${id}/response`, resp), 'Saved', () => { setResp(null); reload(); })}>Save</button></>}>
        {resp && (
          <FormRenderer
            values={resp}
            onChange={(n, v) => setResp((s) => ({ ...s, [n]: v }))}
            fields={[
              { name: 'status', label: 'Outcome', type: 'select', options: [{ value: 'Sent', label: 'Still under discussion' }, { value: 'Accepted', label: 'Accepted by client' }, { value: 'Lost', label: 'Lost / Rejected by client' }] },
              { name: 'next_follow_up', label: 'Next Follow-up', type: 'datetime' },
              { name: 'client_feedback', label: 'Client Feedback', type: 'textarea' },
              { name: 'negotiation_notes', label: 'Negotiation Notes', type: 'textarea' },
            ]}
          />
        )}
        <p className="mt-3 text-xs text-slate-500">Note: “Accepted” here does not mark the deal Won. Use “Mark as Won” on the opportunity with confirmation evidence.</p>
      </Modal>

      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={() => act(() => api.delete(`/proposals/${id}`), 'Deleted', () => navigate('/proposals'))} message="Delete this proposal version?" />
    </div>
  );
}
