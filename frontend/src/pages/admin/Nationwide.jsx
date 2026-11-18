import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function NationwideCharges() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [district, setDistrict] = useState('');
  const [charge, setCharge] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery/nationwide');
      setRows(data.data || []);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!district.trim() || charge === '') {
      toast.error('District + charge din');
      return;
    }
    try {
      await api.post('/delivery/nationwide', { district: district.trim(), charge: Number(charge) });
      toast.success('Saved ✓');
      setDistrict('');
      setCharge('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const toggle = async (row) => {
    try {
      await api.post('/delivery/nationwide', { district: row.district, charge: row.charge, isActive: !row.isActive });
      load();
    } catch {
      toast.error('Failed');
    }
  };

  const remove = async (row) => {
    if (row.district === 'Other') {
      toast.error('Other row delete kora jabe na (fallback)');
      return;
    }
    if (!confirm(`Delete ${row.district}?`)) return;
    try {
      await api.delete(`/delivery/nationwide/${row._id}`);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Nationwide Delivery Charges</h1>
      <p className="text-sm text-gray-500 dark:text-ash mb-4">Non-grocery jekono district-e jabe — fixed charge. Ochena district → Other.</p>

      <form onSubmit={save} className="card p-4 mb-4 flex flex-col sm:flex-row gap-2">
        <input className="input flex-1" placeholder="District (e.g. Barishal)" value={district} onChange={(e) => setDistrict(e.target.value)} />
        <input type="number" min="0" className="input w-full sm:w-32" placeholder="৳" value={charge} onChange={(e) => setCharge(e.target.value)} />
        <button type="submit" className="btn-primary text-sm whitespace-nowrap"><Plus className="w-4 h-4 mr-1" /> Save</button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              <th className="text-left p-4 font-medium">District</th>
              <th className="text-left p-4 font-medium">Charge</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : rows.map((r) => (
              <tr key={r._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30]">
                <td className="p-4 font-medium">{r.district}</td>
                <td className="p-4">৳{r.charge}</td>
                <td className="p-4">
                  <button onClick={() => toggle(r)} className={`text-xs px-2 py-1 rounded-full ${r.isActive ? 'bg-success/15 text-success' : 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash'}`}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="p-4">
                  <button onClick={() => remove(r)} className="p-1.5 hover:bg-red-50 dark:hover:bg-danger/20 rounded">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
