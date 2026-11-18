import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const ROLES = [
  'CUSTOMER',
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'ORDER_MANAGER',
  'INVENTORY_MANAGER',
  'DELIVERY_MANAGER',
  'DELIVERY_RIDER',
  'ACCOUNTANT',
];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (roleFilter) params.role = roleFilter;
      if (search) params.search = search;

      // Try admin users endpoint; fallback message if not exists
      const { data } = await api.get('/users', { params });
      setUsers(data.data || data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      // If /users not fully implemented, show empty with note
      if (err.response?.status === 404 || err.response?.status === 403) {
        setUsers([]);
        toast.error('Users API may need SUPER_ADMIN access');
      } else {
        toast.error('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const toggleActive = async (userId) => {
    try {
      await api.patch(`/users/${userId}/status`);
      toast.success('Status updated');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const updateRole = async (userId, newRole) => {
    try {
      await api.put(`/users/${userId}`, { role: newRole });
      toast.success('Role updated');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users ({total})</h1>
          <p className="text-sm text-gray-500 dark:text-ash">Customers and staff</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-ash" />
            <input
              className="input pl-9 text-sm w-56"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-outline text-sm">Search</button>
        </form>
        <select
          className="input text-sm w-auto"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-[#12241a] rounded-xl shadow-sm border border-[#e5e2da] dark:border-[#2a3b30] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f0] dark:bg-white/5">
            <tr>
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium">Contact</th>
              <th className="text-left p-4 font-medium">Role</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-ash">Loading...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-ash">
                  No users found. Register customers or seed admin first.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u._id} className="border-t border-[#e5e2da]/60 dark:border-[#2a3b30] hover:bg-[#f7f5f0] dark:hover:bg-white/5">
                  <td className="p-4">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-gray-400 dark:text-ash">{u._id?.slice(-6)}</div>
                  </td>
                  <td className="p-4">
                    <div>{u.email}</div>
                    <div className="text-xs text-gray-500 dark:text-ash">{u.phone}</div>
                  </td>
                  <td className="p-4">
                    <select
                      className="text-xs border border-[#e5e2da] dark:border-[#2a3b30] rounded px-2 py-1 max-w-[140px] bg-white dark:bg-[#0a0f0c]"
                      value={u.role}
                      onChange={(e) => updateRole(u._id, e.target.value)}
                      disabled={u.role === 'SUPER_ADMIN'}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleActive(u._id)}
                      disabled={u.role === 'SUPER_ADMIN'}
                      className={`text-xs px-2 py-1 rounded-full ${
                        u.isActive !== false
                          ? 'bg-success/15 text-success'
                          : 'bg-black/5 text-smoke dark:bg-white/10 dark:text-ash'
                      }`}
                    >
                      {u.isActive !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4 text-gray-500 dark:text-ash">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="btn-outline text-sm"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm">Page {page} of {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            className="btn-outline text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
