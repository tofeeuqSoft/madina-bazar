import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, MapPin, Home, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import SEO from '../components/seo/SEO';
import api from '../services/api';
import { getProducts } from '../services/productService';
import AddressAutocomplete from '../components/common/AddressAutocomplete';
import AvailabilityAlert from '../components/cart/AvailabilityAlert';
import useAvailability from '../hooks/useAvailability';

const ADDR_KEY = 'mb-delivery-addr';

export const saveDeliveryAddr = (addr) => {
  try {
    if (addr) localStorage.setItem(ADDR_KEY, JSON.stringify(addr));
    else localStorage.removeItem(ADDR_KEY);
  } catch (_) {}
};
export const loadDeliveryAddr = () => {
  try {
    const raw = localStorage.getItem(ADDR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

export default function Cart() {
  const { items, updateQuantity, removeItem, getSubtotal, clearCart, addToCart } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const subtotal = getSubtotal();

  // Delivery address (Barikoi pick or saved) + shared availability engine
  const [addrOpen, setAddrOpen] = useState(() => !loadDeliveryAddr()?.address);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Shared address form (desktop inline + mobile bottom-sheet, same logic)
  const pickAndClose = (a) => { pickSaved(a); setSheetOpen(false); };
  const selectAndClose = (p) => {
    setAddr((prev) => ({
      ...prev, addrId: undefined, address: p.address, area: p.area,
      latitude: p.latitude, longitude: p.longitude, placeId: p.placeId, uCode: p.uCode,
    }));
    setSheetOpen(false);
  };
  const AddressFields = () => (
    <>
      {isAuthenticated && savedAddresses.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {savedAddresses.map((a) => (
            <button
              key={a._id}
              type="button"
              onClick={() => pickAndClose(a)}
              className={`flex items-center gap-1.5 text-left p-2 rounded-lg border text-xs transition min-h-[44px] ${
                addr.addrId === a._id
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 font-medium'
                  : 'border-[#e5e2da] dark:border-[#2a3b30]'
              }`}
            >
              {a.label === 'Office' ? <Building2 className="w-3.5 h-3.5 flex-shrink-0" /> : <Home className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="truncate">{a.label || 'Home'} — {a.address}</span>
            </button>
          ))}
        </div>
      )}
      <AddressAutocomplete
        value={addr.addrId ? '' : addr.address || ''}
        onChange={(v) => setAddr((p) => ({ ...p, addrId: undefined, address: v, latitude: undefined, longitude: undefined, placeId: undefined, uCode: undefined }))}
        onSelect={selectAndClose}
        placeholder="Search address — e.g. Mirpur 10..."
      />
      {addr.address && (
        <p className="text-xs text-gray-500 mt-1.5 truncate">📍 {addr.address}</p>
      )}
      {addr.latitude != null && (
        <p className={`text-xs mt-1 font-medium ${avail.zone ? 'text-success' : avail.status === 'checking' ? 'text-gray-400' : 'text-danger'}`}>
          {avail.status === 'checking' && 'Checking availability…'}
          {avail.status !== 'checking' && avail.zone && `✓ Grocery delivery available (${avail.zone.name})`}
          {avail.status !== 'checking' && !avail.zone && hasGrocery && '⚠️ Grocery NOT available at this address'}
        </p>
      )}
    </>
  );
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addr, setAddr] = useState(() => loadDeliveryAddr() || {});
  const avail = useAvailability(items, addr.latitude, addr.longitude, addr.placeId);
  const hasGrocery = items.some((i) => (i.product?.isGrocery || i.product?.productType === 'GROCERY'));

  // Free-delivery progress hint
  const [freeRule, setFreeRule] = useState(null);
  useEffect(() => {
    api.get('/delivery/free-delivery').then(({ data }) => {
      if (data.data?.isActive) setFreeRule(data.data);
    }).catch(() => {});
  }, []);

  const freeHint = (() => {
    if (!freeRule?.isActive) return null;
    const applies =
      freeRule.applicableTo === 'ALL' ? true
      : freeRule.applicableTo === 'GROCERY' ? hasGrocery
      : items.length > 0 && !hasGrocery;
    if (!applies) return null;
    const min = freeRule.minimumOrderAmount || 0;
    const remain = Math.max(0, min - subtotal);
    const pct = min > 0 ? Math.min(100, Math.round((subtotal / min) * 100)) : 100;
    if (remain <= 0) return { done: true, pct: 100 };
    return { done: false, remain, pct };
  })();

  // "Complete your cart" suggestions: same category as cart, in-stock, not already added
  const [suggestions, setSuggestions] = useState([]);
  useEffect(() => {
    const inCart = new Set(items.map((i) => String(i.productId || i.product?._id || i._id)));
    const firstCat = items.map((i) => i.product?.category?._id || i.product?.category).find(Boolean);
    const params = { limit: 12, inStock: true };
    if (firstCat) params.category = firstCat;
    getProducts(params)
      .then((r) => {
        const list = (r.data || r.products || []).filter((p) => !inCart.has(String(p._id))).slice(0, 10);
        setSuggestions(list);
      })
      .catch(() => {});
  }, [items.map((i) => String(i.productId || i.product?._id || i._id)).join(',')]);

  const quickAdd = async (p) => {
    // Variant products need a choice → go to product page instead of guessing
    if ((p.sizes || []).length > 0 || (p.colors || []).length > 0) {
      navigate(`/product/${p.slug || p._id}`);
      return;
    }
    const r = await addToCart(p, 1);
    if (r?.success) toast.success(`${p.name} added`);
    else toast.error(r?.message || 'Could not add');
  };

  // Total savings vs regular price (green = gain psychology)
  const totalSavings = items.reduce((s, i) => {
    const mrp = Number(i.product?.regularPrice || 0);
    const price = Number(i.price || i.product?.salePrice || i.product?.regularPrice || 0);
    return s + (mrp > price ? (mrp - price) * (i.quantity || 1) : 0);
  }, 0);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/addresses').then(({ data }) => setSavedAddresses(data.data || [])).catch(() => {});
    }
  }, [isAuthenticated]);

  // Persist for checkout prefill
  useEffect(() => {
    saveDeliveryAddr(addr && (addr.address || addr.latitude != null) ? addr : null);
  }, [addr]);

  // Shared availability engine (single Backend Availability Check)
  const removeUnavailable = async (unavailableLines) => {
    for (const line of unavailableLines || []) {
      const id = line.lineId
        || items.find((i) => (i._id || i.productId || i.product?._id) === line.key)?._id
        || line.key;
      if (id) await removeItem(id);
    }
    toast.success('Unavailable items removed');
  };

  const pickSaved = (a) => {
    setAddr({
      addrId: a._id, label: a.label, address: a.address, area: a.area,
      latitude: a.latitude, longitude: a.longitude, placeId: a.placeId, uCode: a.uCode,
    });
  };

  const goCheckout = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (avail.unavailableCount > 0) {
      toast.error('Some items are not available at your delivery address.', { duration: 5000 });
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <>
        <SEO title="Cart" path="/cart" noindex />
        <div className="container-app py-16 text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6">Add some products to get started</p>
          <Link to="/shop" className="btn-primary">
            Continue Shopping
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Cart" path="/cart" noindex />
      <div className="container-app py-6 sm:py-8 pb-28 lg:pb-8">
        <div className="lg:flex lg:items-baseline lg:gap-3 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-primary-900">
            Shopping Cart ({items.length})
          </h1>
          {totalSavings > 0 && (
            <p className="text-sm font-semibold text-success mt-0.5 lg:mt-0">🎉 You save ৳{totalSavings.toFixed(0)}</p>
          )}
        </div>

        {/* Goal-gradient: free-delivery progress, always visible */}
        {freeHint && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${freeHint.done ? 'bg-success/10 text-success' : 'bg-gold-400/10 text-gold-700 dark:text-gold-300'}`}>
            <div className="flex justify-between items-center gap-2">
              <span>{freeHint.done ? '🎉 FREE delivery unlocked!' : `🛍️ আর ৳${freeHint.remain.toFixed(0)} কিনলে FREE DELIVERY`}</span>
              <span className="text-xs font-bold whitespace-nowrap">{freeHint.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${freeHint.done ? 'bg-success' : 'bg-gold-400'}`}
                style={{ width: `${freeHint.pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            {items.map((item) => {
              const product = item.product || {};
              const id = item._id || item.productId || product._id;
              const name = product.name || item.name || 'Product';
              const image = product.images?.[0]?.url || product.images?.[0];
              const price = item.price || product.salePrice || product.regularPrice || 0;
              const isGrocery = product.isGrocery || product.productType === 'GROCERY';

              const mrp = Number(product.regularPrice || 0);
              const offPct = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
              return (
                <div key={id} className="card px-3 py-2.5 sm:p-4 flex gap-3 items-center">
                  <Link
                    to={`/product/${product.slug || product._id}`}
                    className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary-50 to-gold-400/20"
                  >
                    {image ? (
                      <img src={image} alt={name} loading="lazy" className="w-full h-full object-cover transition-transform hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🛒</div>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/product/${product.slug || product._id}`}
                      className="font-medium text-sm hover:text-primary-700 truncate block"
                    >
                      {name}
                    </Link>
                    <p className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-bold text-[15px] text-gray-900 dark:text-white">৳{price}</span>
                      {offPct > 0 && (
                        <>
                          <span className="text-xs text-gray-400 line-through">৳{mrp}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gold-400/15 text-gold-700 dark:text-gold-300">−{offPct}%</span>
                        </>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{isGrocery ? '🥛 Grocery item' : '✓ Nationwide delivery'}</p>
                    {(item.size || item.color) && (
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                        {item.colorCode && (
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full border border-gray-300 flex-shrink-0"
                            style={{ backgroundColor: item.colorCode }}
                          />
                        )}
                        {[item.size, item.color].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    {/* Per-address delivery status */}
                    {(() => {
                      const line = avail.lines.find((l) => l.key === id);
                      if (addr.latitude == null || !line) return null;
                      return (
                        <p className={`text-[11px] mt-0.5 font-medium truncate ${line.available ? 'text-success' : 'text-danger'}`}>
                          {line.available
                            ? (line.isGrocery ? `✓ Grocery${avail.zone ? ` (${avail.zone.name})` : ''}` : '✓ Nationwide delivery')
                            : `❌ ${line.message || 'Not available'}`}
                        </p>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <p className="font-bold text-sm whitespace-nowrap">৳{(price * item.quantity).toFixed(0)}</p>
                    <div className="flex items-center gap-1">
                      <div className="flex items-center rounded-full border border-[#e5e2da] dark:border-[#2a3b30] overflow-hidden">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => updateQuantity(id, Math.max(1, item.quantity - 1))}
                          className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/10 active:scale-95 transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => updateQuantity(id, item.quantity + 1)}
                          className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/10 active:scale-95 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove item"
                        onClick={() => removeItem(id)}
                        className="w-9 h-9 flex items-center justify-center text-red-400 hover:text-red-600 active:scale-95 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <button type="button" onClick={clearCart} className="text-sm text-red-500 hover:underline">
              Clear Cart
            </button>

            {/* Suggestion mini-grid: 3+ cols, snap-scroll, quick-add */}
            {suggestions.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-semibold mb-2">
                  {freeHint && !freeHint.done
                    ? `🛍️ Add ৳${freeHint.remain.toFixed(0)} more for FREE delivery`
                    : '✨ You may also need'}
                </p>
                <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollSnapType: 'x mandatory' }}>
                  {suggestions.map((p) => {
                    const img = p.images?.[0]?.url || p.images?.[0];
                    const price = p.salePrice || p.regularPrice || 0;
                    const hasVariant = (p.sizes || []).length > 0 || (p.colors || []).length > 0;
                    return (
                      <div key={p._id} className="card p-2 w-28 sm:w-32 flex-shrink-0" style={{ scrollSnapAlign: 'start' }}>
                        <Link to={`/product/${p.slug || p._id}`} className="block w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-primary-50 to-gold-400/20">
                          {img ? (
                            <img src={img} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">🛒</div>
                          )}
                        </Link>
                        <Link to={`/product/${p.slug || p._id}`} className="block text-xs font-medium truncate mt-1.5 hover:text-primary-700">
                          {p.name}
                        </Link>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[13px] font-bold whitespace-nowrap">৳{price}</span>
                          <button
                            type="button"
                            aria-label={hasVariant ? `Choose options for ${p.name}` : `Add ${p.name} to cart`}
                            onClick={() => quickAdd(p)}
                            className="w-9 h-9 rounded-full bg-primary-700 text-white flex items-center justify-center text-lg leading-none hover:bg-primary-800 active:scale-90 transition"
                          >
                            {hasVariant ? '›' : '+'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="card p-5 sm:p-6 h-fit lg:sticky lg:top-24">
            <h3 className="font-semibold text-lg mb-4">Order Summary</h3>

            {/* Delivery address (collapsible — search pick or saved, geo checked via backend) */}
            <div className="mb-4 pb-4 border-b border-[#e5e2da] dark:border-[#2a3b30]">
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 1024) setSheetOpen(true);
                  else setAddrOpen((v) => !v);
                }}
                className="w-full flex items-center gap-1.5 text-sm font-medium mb-2 text-left min-h-[44px]"
              >
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{addr.address ? `📍 ${addr.address}` : 'Delivery Address'}</span>
                <span className={`text-gray-400 transition-transform ${addrOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              <div className="hidden lg:block">
                {addrOpen && <AddressFields />}
              </div>
            </div>

            {/* Diagram-exact alert: unavailable lines + remove action */}
            <div className="mb-4">
              <AvailabilityAlert result={avail} onRemove={removeUnavailable} compact />
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>৳{subtotal.toFixed(0)}</span>
              </div>
              {totalSavings > 0 && (
                <div className="flex justify-between font-medium text-success">
                  <span>Total savings</span>
                  <span>− ৳{totalSavings.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery</span>
                <span className="text-xs text-gray-400">calculated at checkout • no hidden charge</span>
              </div>
            </div>
            <div className="border-t pt-4 mb-4">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary-800">৳{subtotal.toFixed(0)}</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 text-center mb-4">🔒 Secure checkout • 💵 COD available • ↩️ Easy return</p>

            <button
              type="button"
              onClick={goCheckout}
              className="btn-primary w-full py-3"
            >
              Proceed to Checkout
            </button>
            <Link to="/shop" className="block text-center text-sm text-primary-700 mt-3 hover:underline">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile address bottom-sheet (same form, thumb-friendly) */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSheetOpen(false)} />
          <div
            className="absolute bottom-0 inset-x-0 bg-white dark:bg-[#12241a] rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="sticky top-0 bg-white dark:bg-[#12241a] pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20 mx-auto" />
            </div>
            <div className="px-4 pt-1">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-[15px]">Delivery Address</p>
                <button
                  type="button"
                  aria-label="Close address sheet"
                  onClick={() => setSheetOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 text-lg"
                >
                  ×
                </button>
              </div>
              <AddressFields />
            </div>
          </div>
        </div>
      )}

      {/* Sticky mobile checkout bar (safe-area aware) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-[#12241a] border-t border-[#e5e2da] dark:border-[#2a3b30] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3 px-4 pt-2.5" style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))' }}>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 leading-none">Total{totalSavings > 0 && <span className="text-success font-semibold"> • save ৳{totalSavings.toFixed(0)}</span>}</p>
            <p className="font-bold text-lg leading-tight whitespace-nowrap">৳{subtotal.toFixed(0)}</p>
          </div>
          <button
            type="button"
            onClick={goCheckout}
            className="btn-primary flex-1 py-3 text-[15px]"
          >
            Checkout →
          </button>
        </div>
      </div>
    </>
  );
}
