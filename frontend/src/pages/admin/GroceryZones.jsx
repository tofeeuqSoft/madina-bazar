import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, MapPin, Radar } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import AddressAutocomplete from '../../components/common/AddressAutocomplete';

export default function GroceryZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  // Support tester: Barikoi pick → geo check (same engine as checkout)
  const [testAddr, setTestAddr] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    city: 'Dhaka',
    district: 'Dhaka',
    deliveryCharge: 60,
    minimumOrderAmount: 0,
    estimatedDeliveryTime: '2-4 Hours',
    isActive: true,
    status: 'ACTIVE',
    areas: [],
    centerLat: '',
    centerLng: '',
    radiusKm: 4,
    useCircle: false,
  });
  // Barikoi area picker (recommended flow)
  const [areaQuery, setAreaQuery] = useState('');
  const [areaResults, setAreaResults] = useState([]);
  const [areaSearching, setAreaSearching] = useState(false);
  const [pickedAreaId, setPickedAreaId] = useState('');

  const DISTRICTS = ['Dhaka', 'Chattogram', 'Sylhet', 'Khulna', 'Rajshahi', 'Rangpur', 'Barishal', 'Mymensingh', 'Cumilla', 'Narayanganj', 'Gazipur'];

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/grocery-zones');
      setZones(data.data || []);
    } catch (err) {
      toast.error('Failed to load zones');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '', city: 'Dhaka', district: 'Dhaka', deliveryCharge: 60, minimumOrderAmount: 0,
      estimatedDeliveryTime: '2-4 Hours', isActive: true, status: 'ACTIVE',
      areas: [], centerLat: '', centerLng: '', radiusKm: 4, useCircle: false,
    });
    setAreaQuery(''); setAreaResults([]); setPickedAreaId('');
    setShowForm(true);
  };

  const openEdit = (z) => {
    setEditing(z);
    setForm({
      name: z.name || '', city: z.city || 'Dhaka', district: z.district || z.city || 'Dhaka',
      deliveryCharge: z.deliveryCharge ?? 60,
      minimumOrderAmount: z.minimumOrderAmount ?? 0,
      estimatedDeliveryTime: z.estimatedDeliveryTime || '2-4 Hours',
      isActive: z.isActive !== false,
      status: z.status || (z.isActive === false ? 'INACTIVE' : 'ACTIVE'),
      areas: z.areas || [],
      centerLat: z.centerLat ?? '', centerLng: z.centerLng ?? '',
      radiusKm: z.radiusKm ?? 4, useCircle: !!(z.centerLat != null),
    });
    setAreaQuery(''); setAreaResults([]); setPickedAreaId('');
    setShowForm(true);
  };

  // Recommended flow: District → location search → pick → Add Area to Zone
  const searchAreas = async () => {
    if (!areaQuery.trim() || areaQuery.trim().length < 2) {
      toast.error('Search text din (e.g. Mirpur 10)');
      return;
    }
    setAreaSearching(true);
    try {
      const { data } = await api.get('/location/autocomplete', { params: { q: areaQuery.trim(), city: 'dhaka' } });
      const list = data.data || [];
      setAreaResults(list);
      setPickedAreaId(list[0]?.id || list[0]?.uCode || '');
      if (!list.length) toast('Kichu paini — onno nam-e try korun');
    } catch (err) {
      toast.error(err.response?.status === 503 ? 'Location search not configured' : 'Search failed');
    } finally {
      setAreaSearching(false);
    }
  };

  const addPickedArea = () => {
    const found = areaResults.find((p) => (p.id || p.uCode) === pickedAreaId) || areaResults[0];
    if (!found) return;
    const placeId = found.id || found.uCode;
    setForm((f) => {
      if ((f.areas || []).some((a) => a.placeId === placeId)) {
        toast('Ei area already added');
        return f;
      }
      return {
        ...f,
        areas: [...(f.areas || []), {
          placeId,
          uCode: found.uCode || '',
          name: found.area || String(found.address || '').split(',')[0].trim(),
          city: found.city || f.city || 'Dhaka',
          lat: found.latitude ?? null,
          lng: found.longitude ?? null,
        }],
      };
    });
  };

  const removeArea = (placeId) => {
    setForm((f) => ({ ...f, areas: (f.areas || []).filter((a) => a.placeId !== placeId) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Zone name required');
      return;
    }
    if (form.status === 'ACTIVE' && !(form.areas || []).length && !form.useCircle) {
      toast.error('ACTIVE zone-e ontoto 1 ta area ba circle lagbe (nahole COMING_SOON rakhun)');
      return;
    }
    if (form.useCircle && (form.centerLat === '' || form.centerLng === '')) {
      toast.error('Circle center required (athoba circle off korun)');
      return;
    }
    try {
      const payload = {
        ...form,
        district: form.district || form.city,
        centerLat: form.useCircle ? Number(form.centerLat) : undefined,
        centerLng: form.useCircle ? Number(form.centerLng) : undefined,
        radiusKm: Number(form.radiusKm) || 4,
        deliveryCharge: Number(form.deliveryCharge) || 0,
        minimumOrderAmount: Number(form.minimumOrderAmount) || 0,
      };
      if (!form.useCircle) payload.clearCircle = true;
      delete payload.useCircle;
      if (editing) {
        await api.put(`/grocery-zones/${editing._id}`, payload);
        toast.success('Zone updated');
      } else {
        await api.post('/grocery-zones', payload);
        toast.success('Zone created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const toggleStatus = async (z) => {
    try {
      await api.patch(`/grocery-zones/${z._id}/status`);
      toast.success('Status updated');
      load();
    } catch {
      toast.error('Failed');
    }
  };

  const deleteZone = async (z) => {
    if (!confirm(`Delete zone "${z.name}"?`)) return;
    try {
      await api.delete(`/grocery-zones/${z._id}`);
      toast.success('Zone deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const runTester = async (place) => {
    if (place?.latitude == null && !place?.id && !place?.uCode) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/grocery-zones/check', {
        lat: place.latitude, lng: place.longitude,
        placeId: place.id || place.uCode, uCode: place.uCode,
      });
      setTestResult({ ok: !!data.available, zone: data.data || null, method: data.matchMethod, message: data.message });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Grocery Zones</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Geo-fence (circle) — customer coordinates MongoDB geo-check korbe</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">
          <Plus className="w-4 h-4 mr-1" /> Add Zone
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12241a] dark:border dark:border-[#2a3b30] rounded-xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Zone' : 'Add Grocery Zone'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Zone Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dhaka Phase 1" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">District</label>
                <input
                  className="input"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  placeholder="e.g. Dhaka"
                  list="district-list"
                />
                <datalist id="district-list">
                  {DISTRICTS.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>

              {/* Recommended flow: location search → pick → Add Area */}
              <div className="rounded-lg border border-primary-200 dark:border-[#2a3b30] bg-primary-50/60 dark:bg-white/5 p-3 space-y-2.5">
                <label className="block text-sm font-medium">🔍 Search Location</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={areaQuery}
                    onChange={(e) => setAreaQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchAreas())}
                    placeholder="e.g. Mirpur 10"
                  />
                  <button type="button" onClick={searchAreas} disabled={areaSearching} className="btn-outline text-sm whitespace-nowrap">
                    {areaSearching ? '…' : 'Search'}
                  </button>
                </div>
                {areaResults.length > 0 && (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {areaResults.map((p) => {
                      const pid = p.id || p.uCode;
                      return (
                        <label key={pid} className="flex items-start gap-2 p-2 rounded-lg border border-[#e5e2da] dark:border-[#2a3b30] cursor-pointer hover:bg-white dark:hover:bg-white/5 text-sm">
                          <input
                            type="radio"
                            name="area-pick"
                            checked={pickedAreaId === pid}
                            onChange={() => setPickedAreaId(pid)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium truncate">{p.area || p.address}</span>
                            <span className="block text-xs text-gray-500 truncate">{p.address}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <button type="button" onClick={addPickedArea} disabled={!areaResults.length} className="btn-outline text-sm w-full">
                  + Add Area to Zone
                </button>
              </div>

              {/* Selected areas chips */}
              {(form.areas || []).length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Selected Areas ({form.areas.length})</label>
                  <div className="flex flex-wrap gap-1.5">
                    {form.areas.map((a) => (
                      <span key={a.placeId} className="inline-flex items-center gap-1 text-xs bg-success/10 text-success border border-success/30 rounded-full pl-2.5 pr-1 py-1">
                        ✓ {a.name}
                        <button type="button" onClick={() => removeArea(a.placeId)} className="w-4 h-4 rounded-full hover:bg-danger/20 text-danger font-bold leading-none">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional circle fallback */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.useCircle} onChange={(e) => setForm((f) => ({ ...f, useCircle: e.target.checked }))} className="rounded" />
                Circle fallback-o rakho (GPS drift tolerance)
              </label>
              {form.useCircle && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Lat</label>
                    <input type="number" step="any" className="input" value={form.centerLat} onChange={(e) => setForm({ ...form, centerLat: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Lng</label>
                    <input type="number" step="any" className="input" value={form.centerLng} onChange={(e) => setForm({ ...form, centerLng: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Radius km</label>
                    <input type="number" min="0.5" max="50" step="0.5" className="input" value={form.radiusKm} onChange={(e) => setForm({ ...form, radiusKm: e.target.value })} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Charge (৳)</label>
                  <input type="number" min="0" className="input" value={form.deliveryCharge} onChange={(e) => setForm({ ...form, deliveryCharge: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Min Order (৳)</label>
                  <input type="number" min="0" className="input" value={form.minimumOrderAmount} onChange={(e) => setForm({ ...form, minimumOrderAmount: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked, status: e.target.checked ? 'ACTIVE' : form.status === 'ACTIVE' ? 'INACTIVE' : form.status })} className="rounded" />
                Active
              </label>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value, isActive: e.target.value === 'ACTIVE' }))}
                >
                  <option value="ACTIVE">ACTIVE — delivering now</option>
                  <option value="INACTIVE">INACTIVE — hidden</option>
                  <option value="COMING_SOON">COMING_SOON — declared, not yet delivering</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{editing ? 'Update' : 'Create'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Support tester */}
      <div className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] p-4 mb-4">
        <p className="font-semibold text-sm mb-2 flex items-center gap-1.5">
          <Radar className="w-4 h-4" /> Zone Tester — customer address check (support)
        </p>
        <AddressAutocomplete value={testAddr} onChange={setTestAddr} onSelect={(p) => { setTestAddr(p.address); runTester(p); }} placeholder="Search address — e.g. Dhanmondi 27..." />
        {testing && <p className="text-xs text-gray-500 mt-2">Checking…</p>}
        {testResult && !testing && (
          <p className={`text-sm mt-2 font-medium ${testResult.ok ? 'text-success' : 'text-danger'}`}>
            {testResult.ok
              ? `✓ Grocery available — ${testResult.zone?.name} (৳${testResult.zone?.deliveryCharge}) · via ${testResult.method === 'barikoi-id' ? 'verified location' : 'area'}`
              : `❌ Not available — ${testResult.message}`}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-[#12241a] rounded-xl shadow-sm border border-[#e5e2da] dark:border-[#2a3b30] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              <th className="text-left p-4 font-medium">Zone</th>
              <th className="text-left p-4 font-medium">Areas</th>
              <th className="text-left p-4 font-medium">Charge</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500 dark:text-ash">Loading...</td></tr>
            ) : zones.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500 dark:text-ash">No zones. Add Mirpur zone to start.</td></tr>
            ) : (
              zones.map((z) => (
                <tr key={z._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">
                  <td className="p-4">
                    <div className="font-medium flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary-600 dark:text-gold-300" />{z.name}</div>
                    <div className="text-xs text-gray-500 dark:text-ash">{z.district || z.city}{z.centerLat != null ? ` • ⭕ ${z.radiusKm}km` : ''}</div>
                  </td>
                  <td className="p-4">
                    {(z.areas || []).length ? (
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(z.areas || []).slice(0, 4).map((a) => (
                          <span key={a.placeId} className="text-[11px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">✓ {a.name}</span>
                        ))}
                        {(z.areas || []).length > 4 && (
                          <span className="text-[11px] text-gray-500">+{(z.areas || []).length - 4} more</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">circle only</span>
                    )}
                  </td>
                  <td className="p-4">৳{z.deliveryCharge}</td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleStatus(z)}
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        (z.status || (z.isActive === false ? 'INACTIVE' : 'ACTIVE')) === 'ACTIVE'
                          ? 'bg-success/15 text-success'
                          : (z.status || '') === 'COMING_SOON'
                            ? 'bg-gold-400/15 text-gold-700 dark:text-gold-300'
                            : 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash'
                      }`}
                    >
                      {z.status || (z.isActive === false ? 'INACTIVE' : 'ACTIVE')}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(z)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded">
                        <Edit className="w-4 h-4 text-gray-600 dark:text-ash" />
                      </button>
                      <button onClick={() => deleteZone(z)} className="p-1.5 hover:bg-red-50 dark:hover:bg-danger/20 rounded">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
