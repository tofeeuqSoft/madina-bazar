import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Globe2, ShoppingBasket, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import AddressAutocomplete from '../../components/common/AddressAutocomplete';

export default function AdminDeliveryAreas({ initialTab = 'all' }) {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState(initialTab); // 'all' | 'grocery'

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [form, setForm] = useState({
    name: '',
    city: 'Dhaka',
    parentArea: '',
    deliveryCharge: 60,
    minimumOrderAmount: 0,
    estimatedDeliveryTime: '2-4 Hours',
    isActive: true,
    groceryDelivery: false,
    deliveryNote: '',
    barikoiAreaId: '',
  });

  useEffect(() => {
    loadAreas();
  }, []);

  const loadAreas = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery-areas');
      setAreas(data.data || []);
    } catch (err) {
      toast.error('Failed to load delivery areas');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      city: 'Dhaka',
      parentArea: '',
      deliveryCharge: 60,
      minimumOrderAmount: 0,
      estimatedDeliveryTime: '2-4 Hours',
      isActive: true,
      // Grocery tab theke khulle grocery on thakbe
      groceryDelivery: tab === 'grocery',
      deliveryNote: '',
      barikoiAreaId: '',
    });
    setShowForm(true);
  };

  const openEdit = (area) => {
    setEditing(area);
    setForm({
      name: area.name || '',
      city: area.city || 'Dhaka',
      parentArea: area.parentArea?._id || area.parentArea || '',
      deliveryCharge: area.deliveryCharge ?? 60,
      minimumOrderAmount: area.minimumOrderAmount ?? 0,
      estimatedDeliveryTime: area.estimatedDeliveryTime || '2-4 Hours',
      isActive: area.isActive !== false,
      groceryDelivery: area.groceryDelivery === true,
      deliveryNote: area.deliveryNote || '',
      barikoiAreaId: area.barikoiAreaId || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Area name is required');
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        city: form.city,
        parentArea: form.parentArea || null,
        deliveryCharge: Number(form.deliveryCharge),
        minimumOrderAmount: Number(form.minimumOrderAmount),
        estimatedDeliveryTime: form.estimatedDeliveryTime,
        isActive: form.isActive,
        groceryDelivery: form.groceryDelivery === true,
        deliveryNote: form.deliveryNote || '',
        barikoiAreaId: form.barikoiAreaId || '',
      };

      if (editing) {
        await api.put(`/delivery-areas/${editing._id}`, payload);
        toast.success('Area updated');
      } else {
        await api.post('/delivery-areas', payload);
        toast.success('Area created');
      }
      setShowForm(false);
      loadAreas();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/delivery-areas/${id}/status`);
      toast.success('Status updated');
      loadAreas();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const toggleGrocery = async (area) => {    try {
      await api.put(`/delivery-areas/${area._id}`, { groceryDelivery: !area.groceryDelivery });
      toast.success(`Grocery delivery ${!area.groceryDelivery ? 'enabled' : 'disabled'} for ${area.name}`);
      loadAreas();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  // Location search theke form auto-fill
  const handleBarikoiSelect = (place) => {
    setForm((f) => ({
      ...f,
      name: f.name || place.area || String(place.address || '').split(',')[0].trim(),
      city: place.city || f.city || 'Dhaka',
      barikoiAreaId: place.placeId || '',
    }));
    toast.success('Location bosano holo — check kore Save din');
  };

  const groceryList = areas.filter((a) => a.groceryDelivery);
  const shown = tab === 'grocery' ? groceryList : areas;

  const deleteArea = async (id, name) => {
    if (!confirm(`Delete area "${name}"?`)) return;
    try {
      await api.delete(`/delivery-areas/${id}`);
      toast.success('Area deleted');
      loadAreas();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Delivery Areas</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Manage where you deliver</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Area
        </button>
      </div>

      {/* Sub tabs: All (Bangladesh) vs Grocery control */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition ${
            tab === 'all'
              ? 'bg-[#0e4430] text-white dark:bg-gold-400 dark:text-[#0a0f0c] border-transparent'
              : 'bg-white dark:bg-[#12241a] border-[#e5e2da] dark:border-[#2a3b30]'
          }`}
        >
          <Globe2 className="w-4 h-4" /> All Areas ({areas.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('grocery')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition ${
            tab === 'grocery'
              ? 'bg-[#0e4430] text-white dark:bg-gold-400 dark:text-[#0a0f0c] border-transparent'
              : 'bg-white dark:bg-[#12241a] border-[#e5e2da] dark:border-[#2a3b30]'
          }`}
        >
          <ShoppingBasket className="w-4 h-4" /> Grocery Areas ({groceryList.length})
        </button>
      </div>
      {tab === 'grocery' && (
        <p className="text-xs text-gray-500 dark:text-ash mb-3 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> Grocery sudhu ei area gulote delivery hobe. Ekhon: {groceryList.map((a) => a.name).join(', ') || '—'}
        </p>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12241a] dark:border dark:border-[#2a3b30] rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Area' : 'Add Delivery Area'}
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Location search */}
              <div className="rounded-lg border border-primary-200 dark:border-[#2a3b30] bg-primary-50/60 dark:bg-white/5 p-3">
                <label className="block text-sm font-medium mb-1.5">🔍 Location diye khujun (optional)</label>
                <AddressAutocomplete
                  value=""
                  onSelect={handleBarikoiSelect}
                  placeholder="e.g. Uttara Sector 11, Dhanmondi 27..."
                />
                <p className="text-[11px] text-gray-500 dark:text-ash mt-1">Select korle Area Name, City auto-fill hobe.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Area Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Mirpur"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parent Area</label>
                <select
                  className="input"
                  value={form.parentArea}
                  onChange={(e) => setForm({ ...form, parentArea: e.target.value })}
                >
                  <option value="">None</option>
                  {areas
                    .filter((a) => !editing || a._id !== editing._id)
                    .map((a) => (
                      <option key={a._id} value={a._id}>{a.name}</option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Delivery Charge (৳)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.deliveryCharge}
                    onChange={(e) => setForm({ ...form, deliveryCharge: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Min Order (৳)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.minimumOrderAmount}
                    onChange={(e) => setForm({ ...form, minimumOrderAmount: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estimated Time</label>
                <input
                  className="input"
                  value={form.estimatedDeliveryTime}
                  onChange={(e) => setForm({ ...form, estimatedDeliveryTime: e.target.value })}
                  placeholder="2-4 Hours"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Delivery Note (shown on Grocery pages)</label>
                <input
                  className="input"
                  value={form.deliveryNote}
                  onChange={(e) => setForm({ ...form, deliveryNote: e.target.value })}
                  placeholder="e.g. Grocery delivery available only in Mirpur"
                  maxLength={300}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded"
                />
                Active (customers can select this area)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.groceryDelivery}
                  onChange={(e) => setForm({ ...form, groceryDelivery: e.target.checked })}
                  className="rounded accent-green-700"
                />
                <span>Grocery delivery <span className="text-xs text-gray-500">(non-grocery delivers everywhere anyway)</span></span>
              </label>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editing ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#12241a] rounded-xl shadow-sm border border-[#e5e2da] dark:border-[#2a3b30] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              <th className="text-left p-4 font-medium">Area</th>
              <th className="text-left p-4 font-medium">City</th>
              <th className="text-left p-4 font-medium">Charge</th>
              <th className="text-left p-4 font-medium">Min Order</th>
              <th className="text-left p-4 font-medium">Time</th>
              <th className="text-left p-4 font-medium">Grocery</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-ash">Loading...</td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-ash">
                  {tab === 'grocery'
                    ? 'No grocery areas yet. Add Area theke grocery on kore area যোগ korun.'
                    : 'No delivery areas. Add Mirpur to start.'}
                </td>
              </tr>
            ) : (
              shown.map((area) => (
                <tr key={area._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">
                  <td className="p-4 font-medium">{area.name}</td>
                  <td className="p-4 text-gray-600 dark:text-ash">{area.city}</td>
                  <td className="p-4">৳{area.deliveryCharge}</td>
                  <td className="p-4">৳{area.minimumOrderAmount}</td>
                  <td className="p-4 text-gray-600 dark:text-ash">{area.estimatedDeliveryTime}</td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleGrocery(area)}
                      title="Toggle grocery delivery for this area"
                      className={`text-xs px-2 py-1 rounded-full ${
                        area.groceryDelivery
                          ? 'bg-success/15 text-success'
                          : 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash'
                      }`}
                    >
                      {area.groceryDelivery ? 'Grocery ✓' : 'No grocery'}
                    </button>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleStatus(area._id)}
                      className={`text-xs px-2 py-1 rounded-full ${
                        area.isActive
                          ? 'bg-success/15 text-success'
                          : 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash'
                      }`}
                    >
                      {area.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(area)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded">
                        <Edit className="w-4 h-4 text-gray-600 dark:text-ash" />
                      </button>
                      <button
                        onClick={() => deleteArea(area._id, area.name)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-danger/20 rounded"
                      >
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
