import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import deliveryAdminApi from '../../services/deliveryAdmin';
import useAuthStore from '../../store/authStore';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
const inputCls = 'w-full border border-[#e5e2da] rounded-xl px-4 py-3 text-base bg-white outline-none focus:ring-2 focus:ring-primary-500';
const bigBtn = 'w-full py-3.5 rounded-xl text-base font-semibold bg-primary-700 text-white active:scale-[0.98]';

export default function RiderApp() {
  const { user, logout } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [shift, setShift] = useState(null);
  const [otpFor, setOtpFor] = useState({});
  const [failFor, setFailFor] = useState(null);
  const socketRef = useRef(null);

  const load = async () => {
    const r = await deliveryAdminApi.shipments({}).catch(() => ({ data: [] }));
    setOrders((r.data || []).filter((s) => ['ASSIGNED', 'ACCEPTED', 'PENDING_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(s.status)));
  };
  useEffect(() => { load(); }, []);

  // Socket: join + GPS ping every 30s while shift active (no continuous tracking)
  useEffect(() => {
    const s = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = s;
    let timer = null;
    if (shift) {
      timer = setInterval(() => {
        navigator.geolocation?.getCurrentPosition(
          (pos) => s.emit('rider:location', { lng: pos.coords.longitude, lat: pos.coords.latitude }),
          () => {},
          { enableHighAccuracy: false, timeout: 8000 }
        );
      }, 30000);
    }
    return () => { if (timer) clearInterval(timer); s.disconnect(); };
  }, [!!shift]);

  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); load(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const start = async () => {
    const r = await deliveryAdminApi.startShift({}).catch((e) => { toast.error(e.response?.data?.message || e.message); return null; });
    if (r) { setShift(r); toast.success('Shift started — সালাম, good luck!'); }
  };
  const end = async () => {
    await act(() => deliveryAdminApi.endShift({}), 'Shift ended');
    setShift(null);
  };
  const deliver = async (id) => {
    const otp = otpFor[id];
    if (!otp) return toast.error('Enter customer OTP');
    const pos = await new Promise((res) => navigator.geolocation?.getCurrentPosition((p) => res(p), () => res(null), { timeout: 8000 }));
    await act(
      () => deliveryAdminApi.deliverShipment(id, { otp, lng: pos?.coords.longitude, lat: pos?.coords.latitude }),
      'Delivered ✓'
    );
  };

  const today = orders.filter((s) => s.status !== 'DELIVERED');
  const done = orders.filter((s) => s.status === 'DELIVERED').length;
  const cod = today.reduce((s, o) => s + (o.codAmount || 0), 0);

  return (
    <div className="min-h-screen bg-[#f7f5f0] pb-8">
      <header className="bg-[#0b3d2a] text-white p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div><p className="text-xs opacity-70">Madina Bazar Rider</p><h1 className="font-bold">Good day, {user?.name}</h1></div>
          <button onClick={logout} className="text-xs opacity-70 underline">Logout</button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-white/10 rounded-lg p-2"><p className="text-xl font-bold">{today.length}</p><p className="text-[11px] opacity-70">Today&apos;s</p></div>
          <div className="bg-white/10 rounded-lg p-2"><p className="text-xl font-bold">{done}</p><p className="text-[11px] opacity-70">Delivered</p></div>
          <div className="bg-white/10 rounded-lg p-2"><p className="text-xl font-bold">৳{cod}</p><p className="text-[11px] opacity-70">COD</p></div>
        </div>
        {!shift
          ? <button onClick={start} className="mt-3 w-full py-3 rounded-xl bg-gold-400 text-[#0a0f0c] font-bold">▶ Start Shift</button>
          : <button onClick={end} className="mt-3 w-full py-3 rounded-xl bg-white/15 font-bold">■ End Shift</button>}
      </header>

      <main className="p-3 space-y-3">
        {today.length === 0 && <p className="text-center text-sm text-gray-500 py-10">No pending deliveries 🎉</p>}
        {today.map((s) => (
          <div key={s._id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#e5e2da]">
            <div className="flex justify-between items-center mb-1">
              <b>#{s.order?.orderNumber}</b>
              <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">{s.status.replace(/_/g, ' ')}</span>
            </div>
            <p className="text-sm text-gray-500">{s.zoneName} {s.areaName} {s.codAmount > 0 && <b className="text-gray-800">• COD ৳{s.codAmount}</b>}</p>
            {s.status === 'ASSIGNED' && <button onClick={() => act(() => deliveryAdminApi.acceptShipment(s._id), 'Accepted')} className={`${bigBtn} mt-3`}>Accept</button>}
            {s.status === 'ACCEPTED' && <button onClick={() => act(() => deliveryAdminApi.shipmentEvent(s._id, { event: 'pickup' }), 'Picked up')} className={`${bigBtn} mt-3`}>Pickup</button>}
            {s.status === 'PICKED_UP' && <button onClick={() => act(() => deliveryAdminApi.shipmentEvent(s._id, { event: 'out' }), 'On the way')} className={`${bigBtn} mt-3`}>Start Delivery</button>}
            {s.status === 'OUT_FOR_DELIVERY' && (
              <div className="mt-3 space-y-2">
                <input className={inputCls} inputMode="numeric" placeholder="Customer OTP" value={otpFor[s._id] || ''} onChange={(e) => setOtpFor({ ...otpFor, [s._id]: e.target.value })} />
                <button onClick={() => deliver(s._id)} className={bigBtn}>Delivered ✓</button>
                <button onClick={() => setFailFor(failFor === s._id ? null : s._id)} className="w-full py-2.5 rounded-xl text-sm border border-red-200 text-red-600">Failed</button>
                {failFor === s._id && <FailBox id={s._id} onDone={() => { setFailFor(null); load(); }} />}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}

function FailBox({ id, onDone }) {
  const [reason, setReason] = useState('CUSTOMER_UNAVAILABLE');
  const [note, setNote] = useState('');
  const send = async () => {
    try { await deliveryAdminApi.failShipment(id, { reason, note }); toast.success('Marked failed'); onDone(); }
    catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  return (
    <div className="space-y-2 p-3 rounded-xl bg-red-50">
      <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
        {['CUSTOMER_UNAVAILABLE', 'WRONG_ADDRESS', 'PHONE_UNREACHABLE', 'CUSTOMER_REFUSED', 'CUSTOMER_REQUESTED_RESCHEDULE', 'RIDER_ISSUE', 'OTHER'].map((r) => <option key={r}>{r}</option>)}
      </select>
      <input className={inputCls} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button onClick={send} className="w-full py-2.5 rounded-xl text-sm bg-red-600 text-white font-semibold">Confirm Failed</button>
    </div>
  );
}
