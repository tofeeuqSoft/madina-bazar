import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import orderAdminApi from '../../../services/orderAdmin';
import { can } from '../../../utils/permissions';
import useAuthStore from '../../../store/authStore';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnDanger, btnGhost } from './widgets';

const NEXT = ['PENDING_VERIFICATION', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function OrderDetails() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [o, setO] = useState(null);
  const [notes, setNotes] = useState([]);
  const [timeline, setTimeline] = useState(null);
  const [note, setNote] = useState('');
  const [noteVis, setNoteVis] = useState('INTERNAL');
  const [comm, setComm] = useState({ channel: 'IN_APP', message: '' });
  const [hold, setHold] = useState({ reason: 'CUSTOMER_CONFIRMATION', note: '', holdDays: 3 });
  const [cancel, setCancel] = useState({ reason: 'CUSTOMER_REQUEST', note: '' });
  const [showDanger, setShowDanger] = useState(null);

  const load = async () => {
    const d = await orderAdminApi.detail(id).catch(() => null);
    setO(d);
    setNotes((await orderAdminApi.notes(id).catch(() => [])) || []);
    setTimeline(await orderAdminApi.timeline(id).catch(() => null));
  };
  useEffect(() => { load(); }, [id]);

  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };

  if (!o) return <Empty text="Loading order…" />;
  const snap = o.pricingSnapshot?.snapshottedAt ? o.pricingSnapshot : null;

  const printSlip = () => {
    const rows = (o.orderItems || []).map((it, i) => `<tr><td>${i + 1}</td><td>${it.name}${it.size || it.color ? ` (${[it.size, it.color].filter(Boolean).join('/')})` : ''}</td><td>${it.quantity}</td><td>☐</td></tr>`).join('');
    const html = `<html><head><title>Packing slip ${o.orderNumber}</title><link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet"><style>body{font-family:sans-serif;padding:24px;color:#111}.brand{font-size:15px;font-weight:bold;letter-spacing:2px;color:#0b3d2a}h1{font-size:28px;margin:2px 0 0}.barcode{font-family:'Libre Barcode 39',monospace;font-size:48px;line-height:1;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #999;padding:8px;text-align:left;font-size:14px}.meta{margin-top:12px;font-size:13px;color:#333}</style></head><body><div class="brand">MADINA BAZAR</div><h1>${o.orderNumber}</h1><div class="barcode">*${o.orderNumber}*</div><div class="meta"><b>${o.shippingAddress?.fullName || ''}</b> • ${o.shippingAddress?.phone || ''}<br>${o.shippingAddress?.address || ''}${o.shippingAddress?.area ? `, ${o.shippingAddress.area}` : ''}${o.deliverySlot?.label ? `<br>Slot: ${o.deliverySlot.label}${o.deliverySlot?.date ? ` (${new Date(o.deliverySlot.date).toLocaleDateString()})` : ''}` : ''}<br>Payment: ${o.paymentMethod} (${o.paymentStatus})${o.paymentMethod === 'COD' ? ` • Collect ৳${o.totalAmount}` : ''}</div><table><tr><th>#</th><th>Item</th><th>Qty</th><th>Picked</th></tr>${rows}</table><div class="meta">Packed by: ______ &nbsp; QC: ______</div><script>window.print()</script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return toast.error('Popup blocked — allow popups');
    w.document.write(html);
    w.document.close();
  };

  const confirmBox = (key, title, body, onYes) => showDanger === key && (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#12241a] rounded-xl p-6 max-w-md w-full">
        <h3 className="font-bold mb-2">{title}</h3>
        <div className="text-sm space-y-2">{body}</div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={() => setShowDanger(null)} className={btnGhost}>Back</button>
          <button onClick={() => { setShowDanger(null); onYes(); }} className={btnDanger}>Confirm</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHead title={`Order ${o.orderNumber}`} sub={`${o.customer?.name || ''} • ${new Date(o.createdAt).toLocaleString()}`} right={<Link to="/admin/order-mgmt/orders" className={btnGhost}>Back</Link>} />
      {confirmBox('cancel', 'Cancel order?', <><select className={inputCls} value={cancel.reason} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })}>{['CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DUPLICATE_ORDER', 'PAYMENT_FAILED', 'ADDRESS_ISSUE', 'ADMIN_REASON', 'OTHER'].map((r) => <option key={r}>{r}</option>)}</select><input className={inputCls} placeholder="Note" value={cancel.note} onChange={(e) => setCancel({ ...cancel, note: e.target.value })} /></>, () => act(() => orderAdminApi.cancel(id, cancel), 'Order cancelled'))}
      {confirmBox('hold', 'Hold order?', <><select className={inputCls} value={hold.reason} onChange={(e) => setHold({ ...hold, reason: e.target.value })}>{['PAYMENT_VERIFICATION', 'CUSTOMER_CONFIRMATION', 'STOCK_ISSUE', 'ADDRESS_ISSUE', 'FRAUD_REVIEW', 'DELIVERY_ISSUE', 'OTHER'].map((r) => <option key={r}>{r}</option>)}</select><input className={inputCls} placeholder="Hold note (required)" value={hold.note} onChange={(e) => setHold({ ...hold, note: e.target.value })} /><label className="text-xs text-gray-500 flex items-center gap-2">Auto-release after <input className={inputCls} style={{ width: 70 }} type="number" min={1} max={30} value={hold.holdDays} onChange={(e) => setHold({ ...hold, holdDays: Number(e.target.value) })} /> days</label></>, () => act(() => orderAdminApi.hold(id, hold), 'Order held'))}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex flex-wrap gap-2 items-center mb-3">
              <Badge value={o.orderStatus} /><Badge value={o.priority} /><Badge value={o.paymentStatus} />
              <span className="text-[11px] px-2 py-1 rounded-full bg-black/5">{o.deliveryType} • {o.deliveryStatus}</span>
              {o.riskLevel !== 'LOW' && <span className="text-[11px] px-2 py-1 rounded-full bg-red-100 text-red-700">RISK {o.riskLevel}: {(o.riskFlags || []).join(', ')}</span>}
            </div>
            <h3 className="font-semibold text-sm mb-2">Products</h3>
            {(o.orderItems || []).map((it, i) => (
              <div key={i} className="flex justify-between text-sm py-1.5 border-t border-black/5">
                <span>{it.name} {it.size || it.color ? <span className="text-xs text-gray-400">({it.size} {it.color})</span> : null} × {it.quantity}</span>
                <b>৳{(it.price * it.quantity).toFixed(0)}</b>
              </div>
            ))}
          </Card>

          <Card>
            <h3 className="font-semibold text-sm mb-2">Financial Summary {snap && <span className="text-[10px] font-normal text-gray-400">(immutable snapshot {new Date(snap.snapshottedAt).toLocaleDateString()})</span>}</h3>
            <div className="text-sm space-y-1">
              <p className="flex justify-between"><span>Subtotal</span><b>৳{snap?.subtotal ?? o.subtotal}</b></p>
              <p className="flex justify-between"><span>Coupon discount</span><b>−৳{snap?.couponDiscount ?? o.discount}</b></p>
              <p className="flex justify-between"><span>Delivery charge</span><b>৳{snap?.deliveryCharge ?? o.deliveryCharge}</b></p>
              <p className="flex justify-between"><span>Tax/VAT</span><b>৳{snap?.tax ?? o.taxAmount}</b></p>
              <p className="flex justify-between text-base border-t pt-2"><span>Grand total</span><b>৳{snap?.grandTotal ?? o.totalAmount}</b></p>
              <p className="flex justify-between text-xs text-gray-500"><span>Paid / Due</span><span>৳{o.paidAmount} / ৳{Math.max(0, (snap?.grandTotal ?? o.totalAmount) - (o.paidAmount || 0))}</span></p>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-sm mb-2">Timeline</h3>
            <div className="space-y-2 text-xs max-h-64 overflow-y-auto">
              {(timeline?.statusHistory || o.statusHistory || []).map((h, i) => (
                <p key={i} className="border-l-2 border-primary-300 pl-3"><b>{h.status}</b> — {h.note} <span className="text-gray-400">• {h.changedBy?.name || ''} {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}</span></p>
              ))}
              {(timeline?.audits || []).slice(0, 5).map((a) => (
                <p key={a._id} className="border-l-2 border-amber-300 pl-3 text-gray-500">{a.action} — {a.actorRole} {new Date(a.createdAt).toLocaleString()}</p>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-sm mb-2">Notes (INTERNAL staff-only / CUSTOMER visible)</h3>
            <div className="space-y-1.5 mb-3 text-sm">
              {notes.map((n) => <p key={n._id} className={`p-2 rounded text-xs ${n.visibility === 'INTERNAL' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>[{n.visibility}] {n.content} <span className="text-gray-400">— {n.createdBy?.name}</span></p>)}
              {notes.length === 0 && <p className="text-xs text-gray-500">No notes.</p>}
            </div>
            {can(user, 'order.note.create') && (
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Add note…" value={note} onChange={(e) => setNote(e.target.value)} />
                <select className={inputCls} style={{ width: 130 }} value={noteVis} onChange={(e) => setNoteVis(e.target.value)}><option>INTERNAL</option><option>CUSTOMER</option></select>
                <button onClick={() => act(async () => { await orderAdminApi.addNote(id, { content: note, visibility: noteVis }); setNote(''); }, 'Note added')} className={btnGhost}>Add</button>
              </div>
            )}
          </Card>

          {can(user, 'order.communication.send') && (
            <Card>
              <h3 className="font-semibold text-sm mb-2">Customer Communication (logged • future WhatsApp-ready)</h3>
              <div className="flex gap-2">
                <select className={inputCls} style={{ width: 130 }} value={comm.channel} onChange={(e) => setComm({ ...comm, channel: e.target.value })}>{['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'].map((c) => <option key={c}>{c}</option>)}</select>
                <input className={inputCls} placeholder="Message…" value={comm.message} onChange={(e) => setComm({ ...comm, message: e.target.value })} />
                <button onClick={() => act(async () => { await orderAdminApi.communicate(id, comm); setComm({ channel: 'IN_APP', message: '' }); }, 'Message sent')} className={btnPrimary}>Send</button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-sm mb-2">Customer</h3>
            <p className="text-sm">{o.customer?.name}</p><p className="text-xs text-gray-500">{o.customer?.phone} • {o.customer?.email}</p>
            <h3 className="font-semibold text-sm mt-4 mb-1">Address</h3>
            <p className="text-xs">{o.shippingAddress?.address}, {o.shippingAddress?.area}, {o.shippingAddress?.city}</p>
            <p className="text-[11px] text-gray-400 mt-1">Location ID: {o.shippingAddress?.barikoiLocationId || o.shippingAddress?.placeId || '—'}</p>
          </Card>
          <Card>
            <h3 className="font-semibold text-sm mb-2">Payment</h3>
            <p className="text-xs">{o.paymentMethod} • {o.paymentStatus} • Paid ৳{o.paidAmount}</p>
            <h3 className="font-semibold text-sm mt-4 mb-2">Delivery</h3>
            <p className="text-xs">{o.courier || '—'} • {o.trackingId || 'no tracking'} • {o.deliveryCharge != null ? `৳${o.deliveryCharge}` : ''}</p>
          </Card>
          <Card>
            <h3 className="font-semibold text-sm mb-2">Status & Priority</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {can(user, 'order.status.update', 'ORDER_UPDATE') && NEXT.map((s) => (
                <button key={s} onClick={() => act(() => orderAdminApi.setStatus(id, { status: s }), `Moved to ${s}`)} className={btnGhost}>{s.replace(/_/g, ' ')}</button>
              ))}
            </div>
            {can(user, 'order.priority.update') && (
              <select className={inputCls} value={o.priority} onChange={(e) => act(() => orderAdminApi.setPriority(id, { priority: e.target.value }), 'Priority updated')}>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => <option key={p}>{p}</option>)}
              </select>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={printSlip} className={btnGhost}>🖨 Packing slip</button>
              {can(user, 'order.hold') && <button onClick={() => setShowDanger('hold')} className={btnGhost}>Hold</button>}
              {can(user, 'order.cancel', 'ORDER_CANCEL') && <button onClick={() => setShowDanger('cancel')} className={btnDanger}>Cancel</button>}
              {can(user, 'order.reopen') && <button onClick={() => act(() => orderAdminApi.reopen(id, {}), 'Reopened')} className={btnGhost}>Reopen</button>}
              {can(user, 'order.refund.request') && <button onClick={() => act(() => orderAdminApi.refundRequest(id, { reason: 'Customer request via ORDER_MANAGER' }), 'Refund requested → REFUND_MANAGER')} className={btnGhost}>Request Refund</button>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
