import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, ArrowLeft, LogOut, Save, Lock, Home, Building2, Plus, Trash2, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { uploadFile } from '../services/uploadService';
import useAuthStore from '../store/authStore';
import AddressAutocomplete from '../components/common/AddressAutocomplete';
import SEO from '../components/seo/SEO';

export default function Profile() {
  const { user, isAuthenticated, setUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // My Addresses (saved — checkout reuses without Barikoi call)
  const [addresses, setAddresses] = useState([]);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState({ label: 'Home', address: '', area: '', latitude: null, longitude: null, placeId: '', uCode: '' });

  useEffect(() => {
    if (isAuthenticated) loadAddresses();
  }, [isAuthenticated]);

  const loadAddresses = async () => {
    try {
      const { data } = await api.get('/addresses');
      setAddresses(data.data || []);
    } catch (_) {}
  };

  const handleAddrSubmit = async (e) => {
    e.preventDefault();
    if (!addrForm.address.trim() || addrForm.latitude == null) {
      toast.error('Search theke address select korun');
      return;
    }
    try {
      await api.post('/addresses', {
        label: addrForm.label,
        fullName: user?.name || 'Customer',
        phone: user?.phone || '',
        address: addrForm.address,
        area: addrForm.area,
        latitude: addrForm.latitude,
        longitude: addrForm.longitude,
        placeId: addrForm.placeId,
        uCode: addrForm.uCode,
      });
      toast.success('Address saved');
      setAddrForm({ label: 'Home', address: '', area: '', latitude: null, longitude: null, placeId: '', uCode: '' });
      setShowAddrForm(false);
      loadAddresses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleAddrDelete = async (id) => {
    if (!confirm('Delete this address?')) return;
    try {
      await api.delete(`/addresses/${id}`);
      toast.success('Deleted');
      loadAddresses();
    } catch {
      toast.error('Failed');
    }
  };

  const handleAddrDefault = async (id) => {
    try {
      await api.put(`/addresses/${id}`, { isDefault: true });
      loadAddresses();
    } catch {
      toast.error('Failed');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setName(user?.name || '');
    setAvatar(user?.avatar || '');
    setPhone(/^(g|f)-/.test(user?.phone || '') ? '' : user?.phone || '');
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  // Social signup without real number → must add phone once
  const needsPhone = /^(g|f)-/.test(user?.phone || '') || !user?.phone;

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    // Instant preview
    const preview = URL.createObjectURL(file);
    setAvatar(preview);
    setUploading(true);
    try {
      const result = await uploadFile(file, 'avatar');
      const url = result.url || result.secure_url;
      if (!url) throw new Error('Upload failed');
      setAvatar(url);
      // Save to profile immediately
      const { data } = await api.put('/auth/profile', { avatar: url });
      if (data.user) setUser(data.user);
      toast.success('Profile photo updated');
    } catch (err) {
      setAvatar(user?.avatar || '');
      toast.error(err.response?.data?.message || 'Photo upload failed');
    } finally {
      URL.revokeObjectURL(preview);
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    if (needsPhone && !/^01\d{9}$/.test(phone.replace(/[\s-]/g, ''))) {
      toast.error('Enter a valid phone number (01XXXXXXXXX)');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim() };
      if (needsPhone) payload.phone = phone.replace(/[\s-]/g, '');
      const { data } = await api.put('/auth/profile', payload);
      if (data.user) setUser(data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    setChangingPw(true);
    try {
      await api.put('/auth/update-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed');
    } finally {
      setChangingPw(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const inp = 'input';

  return (
    <>
      <SEO title="Edit Profile" path="/account/profile" noindex />
      <div className="container-app py-6 sm:py-8 max-w-2xl">
        <Link to="/account" className="inline-flex items-center text-sm text-gray-600 dark:text-ash hover:text-primary-600 dark:hover:text-gold-300 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>

        {/* Photo + basic info */}
        <form onSubmit={handleSave} className="card p-6 space-y-5 mb-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt="" className="w-24 h-24 rounded-full object-cover ring-2 ring-gold-400" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary-700 text-white flex items-center justify-center text-3xl font-bold">
                  {name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <label
                className={`absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gold-400 text-[#0a0f0c] flex items-center justify-center cursor-pointer shadow hover:bg-gold-300 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                title="Upload photo"
              >
                <Camera className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
              </label>
            </div>
            <div>
              <p className="font-semibold">{uploading ? 'Uploading…' : 'Profile Photo'}</p>
              <p className="text-xs text-gray-500 dark:text-ash mt-1">JPG/PNG, max 5MB.<br />Camera icon-e click kore change korun.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone {needsPhone && <span className="text-red-500">*</span>}</label>
              <input
                className={`${inp} ${needsPhone ? '' : 'opacity-60'}`}
                value={needsPhone ? phone : user?.phone || ''}
                disabled={!needsPhone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
              />
              {needsPhone && <p className="text-xs text-gold-600 dark:text-gold-300 mt-1">Order updates পেতে phone number দিন।</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input className={`${inp} opacity-60`} value={user?.email || ''} disabled />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-ash">Phone/Email change korte support-e contact korun.</p>

          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>

        {/* Password */}
        <form onSubmit={handlePassword} className="card p-6 space-y-4 mb-6">
          <h2 className="font-semibold flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <input type="password" className={inp} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Password (min 6)</label>
            <input type="password" className={inp} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={changingPw} className="btn-outline text-sm">
            {changingPw ? 'Changing…' : 'Change Password'}
          </button>
        </form>

        <button onClick={handleLogout} className="btn-outline w-full text-sm text-red-500 border-red-200 dark:border-red-900">
          <LogOut className="w-4 h-4 mr-1" /> Logout
        </button>

        {/* My Addresses */}
        <div className="card p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">My Addresses</h2>
            <button type="button" onClick={() => setShowAddrForm((v) => !v)} className="btn-outline text-xs py-1.5">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </button>
          </div>

          {showAddrForm && (
            <form onSubmit={handleAddrSubmit} className="border border-[#e5e2da] dark:border-[#2a3b30] rounded-lg p-3 mb-4 space-y-3">
              <div className="flex gap-2">
                {['Home', 'Office', 'Other'].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setAddrForm((f) => ({ ...f, label: l }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${addrForm.label === l ? 'bg-primary-700 text-white dark:bg-gold-400 dark:text-[#0a0f0c] border-transparent' : 'border-[#e5e2da] dark:border-[#2a3b30]'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <AddressAutocomplete
                value={addrForm.address}
                onChange={(v) => setAddrForm((f) => ({ ...f, address: v, latitude: null, longitude: null, uCode: '' }))}
                onSelect={(p) => setAddrForm((f) => ({
                  ...f, address: p.address, area: p.area, latitude: p.latitude, longitude: p.longitude, placeId: p.placeId, uCode: p.uCode,
                }))}
                placeholder="Search address — e.g. Mirpur 10..."
              />
              {addrForm.latitude != null && (
                <p className="text-xs text-success">📍 Pinned ({Number(addrForm.latitude).toFixed(4)}, {Number(addrForm.longitude).toFixed(4)})</p>
              )}
              <button type="submit" className="btn-primary text-sm">Save Address</button>
            </form>
          )}

          {addresses.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-ash text-center py-4">No saved addresses yet.</p>
          ) : (
            <div className="space-y-2">
              {addresses.map((a) => (
                <div key={a._id} className="flex items-start gap-3 p-3 rounded-lg border border-[#e5e2da] dark:border-[#2a3b30]">
                  {a.label === 'Office' ? <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <Home className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {a.label || 'Home'}
                      {a.isDefault && <span className="text-[10px] bg-gold-400/20 text-gold-700 dark:text-gold-300 px-1.5 py-0.5 rounded-full">Default</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-ash truncate">{a.address}</p>
                    {a.latitude != null && <p className="text-[11px] text-gray-400">Lat: {Number(a.latitude).toFixed(4)}, Lng: {Number(a.longitude).toFixed(4)}</p>}
                  </div>
                  {!a.isDefault && (
                    <button type="button" title="Set default" onClick={() => handleAddrDefault(a._id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded">
                      <Star className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  <button type="button" onClick={() => handleAddrDelete(a._id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-danger/20 rounded">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
