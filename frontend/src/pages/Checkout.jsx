import { useState, useEffect } from 'react';
import SEO from '../components/seo/SEO';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Home, Building2, Plus } from 'lucide-react';
import api from '../services/api';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import AddressAutocomplete from '../components/common/AddressAutocomplete';
import AvailabilityAlert from '../components/cart/AvailabilityAlert';
import useAvailability from '../hooks/useAvailability';

export default function Checkout() {
  const navigate = useNavigate();
  const { items, getSubtotal, clearCart, removeItem } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  // Saved addresses (Layer 2 — reuse, no Barikoi call)
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState('new');
  const [saveAddr, setSaveAddr] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [gateways, setGateways] = useState({
    COD: { enabled: true, configured: true },
    BKASH: { enabled: false, configured: false },
    NAGAD: { enabled: false, configured: false },
    SSLCOMMERZ: { enabled: false, configured: false },
  });

  const [form, setForm] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    address: '',
    city: '',
    deliveryAreaId: '',
    paymentMethod: 'COD',
    notes: '',
    slotId: '',
    slotDate: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })(),
  });
  // Delivery slots (optional promise — capacity-guarded server-side)
  const [slots, setSlots] = useState([]);

  const subtotal = getSubtotal();
  const selectedArea = areas.find((a) => a._id === form.deliveryAreaId);
  // Centralized live breakdown (backend is source of truth at order time)
  const [calc, setCalc] = useState(null);
  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post('/delivery/calculate', {
          placeId: form.placeId,
          lat: form.latitude,
          lng: form.longitude,
          district: form.city,
          items: items.map((i) => ({
            productId: i.productId || i.product?._id,
            comboId: i.combo?._id,
            quantity: i.quantity,
          })),
          eligibleSubtotal: Math.max(0, subtotal - discount),
        });
        setCalc(data.data);
      } catch (_) {}
    }, 500);
    return () => clearTimeout(t);
  }, [items, form.placeId, form.latitude, form.longitude, form.city, subtotal, discount]);
  const deliveryCharge = calc?.deliveryCharge ?? selectedArea?.deliveryCharge ?? 0;
  const taxAmount = calc?.taxAmount ?? 0;
  // INCLUSIVE VAT already lives inside prices — never add it again (backend is source of truth at order time)
  const total = Math.max(0, subtotal + deliveryCharge - discount + (calc?.vatMode === 'INCLUSIVE' ? 0 : taxAmount));
  // Grocery items deliver only to grocery-enabled areas (e.g. Mirpur).
  // Other items deliver to ALL active areas.
  const isGroceryLine = (i) => i.product?.isGrocery || i.product?.productType === 'GROCERY';
  const hasGrocery = items.some(isGroceryLine);
  const groceryAreas = areas.filter((a) => a.groceryDelivery);
  // Shared availability engine (single Backend Availability Check)
  const avail = useAvailability(items, form.latitude, form.longitude, form.placeId);
  useEffect(() => {
    const scope = hasGrocery ? 'GROCERY' : 'NATIONWIDE';
    api.get('/delivery/slots', { params: { for: scope, date: form.slotDate } })
      .then(({ data }) => setSlots(data.data || []))
      .catch(() => setSlots([]));
  }, [form.slotDate, hasGrocery]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (items.length === 0) {
      navigate('/cart');
      return;
    }
    loadAreas();
    loadGateways();
    loadAddresses();
    // Prefill from Cart address pick (localStorage)
    try {
      const raw = localStorage.getItem('mb-delivery-addr');
      if (raw) {
        const picked = JSON.parse(raw);
        if (picked && (picked.address || picked.latitude != null)) {
          setForm((f) => ({
            ...f,
            address: picked.address || f.address,
            areaHint: picked.area || f.areaHint,
            latitude: picked.latitude,
            longitude: picked.longitude,
            placeId: picked.placeId,
            uCode: picked.uCode,
          }));
        }
      }
    } catch (_) {}
  }, []);

  const loadAddresses = async () => {
    try {
      const { data } = await api.get('/addresses');
      const list = data.data || [];
      setSavedAddresses(list);
      const def = list.find((a) => a.isDefault) || list[0];
      if (def) selectAddress(def);
    } catch (_) {}
  };

  const selectAddress = (a) => {
    setSelectedAddrId(a._id);
    setForm((f) => ({
      ...f,
      fullName: a.fullName || f.fullName,
      phone: a.phone || f.phone,
      address: a.address || '',
      areaHint: a.area || '',
      city: a.city || f.city || '',
      latitude: a.latitude ?? undefined,
      longitude: a.longitude ?? undefined,
      placeId: a.placeId || undefined,
      uCode: a.uCode || undefined,
    }));
  };

  // Remove ALL unavailable lines (shared alert action)
  const removeUnavailable = async (unavailableLines) => {
    for (const line of unavailableLines || []) {
      const id = line.lineId
        || items.find((i) => (i._id || i.productId || i.product?._id) === line.key)?._id
        || line.key;
      if (id) await removeItem(id);
    }
    toast.success('Unavailable items removed');
  };

  const loadGateways = async () => {
    try {
      const { data } = await api.get('/payments/gateways');
      if (data.data) setGateways(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAreas = async () => {
    try {
      const { data } = await api.get('/delivery-areas/active');
      const list = data.data || [];
      setAreas(list);
      // Delivery zone auto-resolves from the searched address (backend engine) —
      // no manual area picking. Keep a silent default for the order API.
      if (list.length > 0) {
        setForm((f) => (f.deliveryAreaId ? f : { ...f, deliveryAreaId: list[0]._id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const { data } = await api.post('/coupons/validate', {
        code: couponCode,
        orderAmount: subtotal,
      });
      if (data.valid) {
        setDiscount(data.data.discountAmount || 0);
        setAppliedCoupon(data.data.code);
        toast.success('Coupon applied!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon');
      setDiscount(0);
      setAppliedCoupon(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.address || !form.deliveryAreaId) {
      toast.error('Please fill all required fields');
      return;
    }
    // Client-side gates (backend enforces too)
    if (hasGrocery && selectedArea && !selectedArea.groceryDelivery && form.latitude == null) {
      toast.error(
        `Grocery items deliver only in: ${groceryAreas.map((a) => a.name).join(', ') || 'selected areas'}`,
        { duration: 6000 }
      );
      return;
    }
    // Shared availability result: block on ANY unavailable line
    if (avail.unavailableCount > 0) {
      toast.error('Some items are not available at your delivery address. Remove them or pick another address.', { duration: 6000 });
      return;
    }

    setLoading(true);
    // Fresh key per Place-Order click: double-tap / retry with the SAME key
    // collapses to one order server-side; a new click mints a new key.
    const clientKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      const { data } = await api.post('/orders', {
        clientKey,
        shippingAddress: {
          fullName: form.fullName,
          phone: form.phone,
          address: form.address,
          latitude: form.latitude,
          longitude: form.longitude,
          placeId: form.placeId,
          uCode: form.uCode,
          area: form.areaHint,
        },
        deliveryAreaId: form.deliveryAreaId,
        paymentMethod: form.paymentMethod,
        couponCode: appliedCoupon || undefined,
        notes: form.notes,
        deliverySlot: form.slotId ? { slotId: form.slotId, date: form.slotDate } : undefined,
      }, { headers: { 'Idempotency-Key': clientKey } });

      await clearCart();

      // Save address for next time (fire-and-forget)
      if (saveAddr && form.address) {
        api.post('/addresses', {
          label: addrLabel || 'Home',
          fullName: form.fullName,
          phone: form.phone,
          address: form.address,
          area: form.areaHint || '',
          latitude: form.latitude,
          longitude: form.longitude,
          placeId: form.placeId,
          uCode: form.uCode,
          deliveryArea: form.deliveryAreaId || undefined,
        }).catch(() => {});
      }

      if (['BKASH', 'NAGAD', 'SSLCOMMERZ'].includes(form.paymentMethod)) {
        const payRes = await api.post('/payments/initiate', {
          orderId: data.data._id,
          paymentMethod: form.paymentMethod,
        });
        const redirectUrl = payRes.data?.data?.redirectUrl;
        if (redirectUrl) {
          toast.success('Redirecting to payment...');
          window.location.href = redirectUrl;
          return;
        }
        toast.error('Could not start payment. Order is created — pay from My Orders.');
        navigate('/orders');
        return;
      }

      toast.success('Order placed successfully!');
      navigate('/orders');
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'IDEMPOTENT_IN_PROGRESS') {
        toast('Order is already being placed — please wait…', { icon: '⏳' });
      } else {
        toast.error(err.response?.data?.message || 'Failed to place order');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <SEO title="Checkout" path="/checkout" noindex />

    <div className="container-app py-8">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping */}
          <div className="card p-6">
            <h2 className="font-semibold text-lg mb-4">Shipping Information</h2>

            {/* Address source: saved (no API) or new via search */}
            {savedAddresses.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-2 mb-4">
                {savedAddresses.map((a) => (
                  <button
                    key={a._id}
                    type="button"
                    onClick={() => selectAddress(a)}
                    className={`flex items-start gap-2 text-left p-3 rounded-lg border transition ${
                      selectedAddrId === a._id
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-[#e5e2da] dark:border-[#2a3b30]'
                    }`}
                  >
                    {a.label === 'Office' ? <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <Home className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{a.label || 'Home'}{a.isDefault ? ' • Default' : ''}</span>
                      <span className="block text-xs text-gray-500 truncate">{a.address}</span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedAddrId('new')}
                  className={`flex items-center gap-2 p-3 rounded-lg border border-dashed transition text-sm ${
                    selectedAddrId === 'new'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 font-medium'
                      : 'border-[#e5e2da] dark:border-[#2a3b30]'
                  }`}
                >
                  <Plus className="w-4 h-4" /> New address
                </button>
              </div>
            )}

            {/* Availability status (shared engine) */}
            {form.latitude != null && form.longitude != null && (
              <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${
                avail.zone
                  ? 'bg-success/10 text-success'
                  : avail.status === 'checking'
                    ? 'bg-black/5 dark:bg-white/5 text-gray-500'
                    : 'bg-danger/10 text-danger'
              }`}>
                {avail.status === 'checking' && '📍 Checking availability…'}
                {avail.status !== 'checking' && avail.zone && `✓ Grocery delivery available (${avail.zone.name})`}
                {avail.status !== 'checking' && !avail.zone && hasGrocery && '⚠️ Grocery NOT available at this address'}
              </div>
            )}

            {/* Diagram-exact alert */}
            <div className="mb-4">
              <AvailabilityAlert result={avail} onRemove={removeUnavailable} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone *</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Search Address</label>
                <AddressAutocomplete
                  value={form.address}
                  onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                  onSelect={(place) => {
                    setSelectedAddrId('new');
                    setForm((f) => ({
                      ...f,
                      address: place.address,
                      latitude: place.latitude,
                      longitude: place.longitude,
                      placeId: place.placeId,
                      uCode: place.uCode,
                      areaHint: place.area,
                      city: place.city || f.city || '',
                    }));
                  }}
                  placeholder="Type Mirpur, house, road..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Full Address *</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value, latitude: undefined, longitude: undefined, placeId: undefined, uCode: undefined })}
                  placeholder="House, Road, Area details..."
                  required
                />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={saveAddr}
                  onChange={(e) => setSaveAddr(e.target.checked)}
                  className="rounded"
                />
                Save to My Addresses
                {saveAddr && (
                  <select value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} className="input w-auto py-1 text-xs">
                    <option>Home</option>
                    <option>Office</option>
                    <option>Other</option>
                  </select>
                )}
              </label>
              {hasGrocery && groceryAreas.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500 mt-1.5">
                    Grocery delivery area: {groceryAreas.map((a) => a.name).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery slot (optional promise) */}
          {slots.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-lg mb-1">Delivery Slot</h2>
              <p className="text-xs text-gray-500 mb-3">Optional — pick a time window, we will prioritize it.</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.slotDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setForm({ ...form, slotDate: e.target.value, slotId: '' })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Time window</label>
                  <select
                    className="input"
                    value={form.slotId}
                    onChange={(e) => setForm({ ...form, slotId: e.target.value })}
                  >
                    <option value="">No preference</option>
                    {slots.map((s) => (
                      <option key={s._id} value={s._id} disabled={s.remaining != null && s.remaining <= 0}>
                        {s.label || s.name}{s.remaining != null ? ` (${s.remaining} left)` : ''}{s.remaining != null && s.remaining <= 0 ? ' — FULL' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="card p-6">
            <h2 className="font-semibold text-lg mb-4">Payment Method</h2>
            <div className="space-y-3">
              {[
                { value: 'COD', label: 'Cash on Delivery', disabled: !gateways.COD?.enabled },
                {
                  value: 'BKASH',
                  label: gateways.BKASH?.configured ? 'bKash' : 'bKash (Not configured)',
                  disabled: !gateways.BKASH?.enabled || !gateways.BKASH?.configured,
                },
                {
                  value: 'NAGAD',
                  label: gateways.NAGAD?.configured ? 'Nagad' : 'Nagad (Not configured)',
                  disabled: !gateways.NAGAD?.enabled || !gateways.NAGAD?.configured,
                },
                {
                  value: 'SSLCOMMERZ',
                  label: gateways.SSLCOMMERZ?.configured ? 'Card / Mobile Banking (SSLCommerz)' : 'SSLCommerz (Not configured)',
                  disabled: !gateways.SSLCOMMERZ?.enabled || !gateways.SSLCOMMERZ?.configured,
                },
              ].map((m) => (
                <label
                  key={m.value}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                    form.paymentMethod === m.value ? 'border-primary-600 bg-primary-50' : ''
                  } ${m.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={m.value}
                    checked={form.paymentMethod === m.value}
                    disabled={m.disabled}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <label className="block text-sm font-medium mb-1">Order Notes (optional)</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any special instructions..."
            />
          </div>
        </div>

        {/* Summary */}
        <div className="card p-6 h-fit sticky top-24">
          <h3 className="font-semibold text-lg mb-4">Order Summary</h3>

          <div className="space-y-2 text-sm mb-4 max-h-48 overflow-y-auto">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-gray-600 truncate mr-2">
                  {(item.product?.name || 'Item')} × {item.quantity}
                </span>
                <span>৳{((item.price || 0) * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>

          {/* Coupon */}
          <div className="flex gap-2 mb-4">
            <input
              className="input text-sm"
              placeholder="Coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
            <button type="button" onClick={applyCoupon} className="btn-outline text-sm whitespace-nowrap">
              Apply
            </button>
          </div>

          <div className="space-y-2 text-sm border-t pt-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>৳{subtotal.toFixed(0)}</span>
            </div>
            {calc && (calc.hasGrocery || calc.hasNationwide) ? (
              <div className="text-xs text-gray-500 space-y-1">
                {calc.hasGrocery && <div className="flex justify-between"><span>Grocery delivery{calc.zone ? ` (${calc.zone.name})` : ''}</span><span>৳{calc.groceryCharge}</span></div>}
                {calc.hasNationwide && <div className="flex justify-between"><span>Nationwide{calc.nationwideDistrict ? ` (${calc.nationwideDistrict})` : ''}</span><span>৳{calc.nationwideCharge}</span></div>}
                <div className="flex justify-between font-medium text-gray-700 dark:text-gray-200">
                  <span>Delivery ({calc.freeDelivery ? 'FREE 🎉' : `MAX rule${calc.matchMethod ? ` · ${calc.matchMethod === 'barikoi-id' ? 'Verified' : 'Area'}` : ''}`})</span>
                  <span>৳{deliveryCharge}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>৳{deliveryCharge}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-৳{discount}</span>
              </div>
            )}
            {taxAmount > 0 && (calc?.vatMode || 'EXCLUSIVE') === 'EXCLUSIVE' && (
              <div className="flex justify-between">
                <span>{calc?.vatName || 'VAT'} ({calc?.taxRate}%) +</span>
                <span>৳{taxAmount.toFixed(0)}</span>
              </div>
            )}
            {taxAmount > 0 && calc?.vatMode === 'INCLUSIVE' && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>সহ {calc?.vatName || 'VAT'} ({calc?.taxRate}%) অন্তর্ভুক্ত</span>
                <span>৳{taxAmount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="text-primary-600">৳{total.toFixed(0)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 mt-6"
          >
            {loading ? 'Placing Order...' : 'Place Order'}
          </button>
          <Link to="/cart" className="block text-center text-sm text-gray-500 mt-3 hover:underline">
            Back to Cart
          </Link>
        </div>
      </form>
    </div>
  </>
  );
}
