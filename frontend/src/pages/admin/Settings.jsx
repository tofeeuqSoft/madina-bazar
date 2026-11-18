import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { uploadImage } from '../../services/uploadService';

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [form, setForm] = useState({
    websiteName: 'Madina Bazar',
    logo: '',
    favicon: '',
    newTileImage: '',
    trendingTileImage: '',
    heroSlides: [],
    playStoreUrl: '',
    appStoreUrl: '',
    appQrImage: '',
    phone: '',
    email: '',
    address: '',
    facebook: '',
    whatsapp: '',
    enableCOD: true,
    enableBkash: false,
    enableNagad: false,
    enableSSLCommerz: false,
    defaultDeliveryCharge: 60,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings/admin');
      const s = data.data || {};
      setForm({
        websiteName: s.websiteName || 'Madina Bazar',
        logo: s.logo || '',
        favicon: s.favicon || '',
        newTileImage: s.newTileImage || '',
        trendingTileImage: s.trendingTileImage || '',
        heroSlides: s.heroSlides || [],
        playStoreUrl: s.playStoreUrl || '',
        appStoreUrl: s.appStoreUrl || '',
        appQrImage: s.appQrImage || '',
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        facebook: s.facebook || '',
        whatsapp: s.whatsapp || '',
        enableCOD: s.enableCOD !== false,
        enableBkash: s.enableBkash || false,
        enableNagad: s.enableNagad || false,
        enableSSLCommerz: s.enableSSLCommerz || false,
        defaultDeliveryCharge: s.defaultDeliveryCharge ?? 60,
      });
    } catch (err) {
      // Use defaults if not found
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', {
        ...form,
        defaultDeliveryCharge: Number(form.defaultDeliveryCharge) || 60,
      });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (field, file) => {
    if (!file) return;
    setUploading(field);
    try {
      const result = await uploadImage(file);
      setForm((f) => ({ ...f, [field]: result.url }));
      toast.success('Image uploaded — Save চাপুন');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading('');
    }
  };

  const imageField = (field, label) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          name={field}
          className="input flex-1"
          value={form[field] || ''}
          onChange={handleChange}
          placeholder="Image URL or upload"
        />
        <label className="btn-outline text-sm cursor-pointer whitespace-nowrap">
          {uploading === field ? '…' : 'Upload'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleImageUpload(field, e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {form[field] && (
        <img src={form[field]} alt="" className="w-20 h-20 object-cover rounded border" />
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 max-w-2xl">
        <div className="h-8 bg-gray-200 dark:bg-white/10 rounded w-1/3" />
        <div className="h-64 bg-gray-200 dark:bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-sm text-gray-500 dark:text-ash mb-6">Website and payment configuration</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General */}
        <div className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-lg">General</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Website Name</label>
            <input
              name="websiteName"
              className="input"
              value={form.websiteName}
              onChange={handleChange}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Logo URL</label>
              <input name="logo" className="input" value={form.logo} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Favicon URL</label>
              <input name="favicon" className="input" value={form.favicon} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Homepage tiles */}
        <div className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-lg">Homepage Tiles</h2>
            <p className="text-xs text-gray-500 dark:text-ash">Home page-er New / Trending category image. Khali rakhle default icon dekhabe.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {imageField('newTileImage', 'New Tile Image')}
            {imageField('trendingTileImage', 'Trending Tile Image')}
          </div>
        </div>

        {/* Hero carousel (5/6 width) */}
        <div className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-lg">Hero Carousel</h2>
            <p className="text-xs text-gray-500 dark:text-ash">Home hero-r boro banner (max 10). Link optional — e.g. /shop?category=ID. Khali thakle default banner dekhabe.</p>
          </div>
          <div className="space-y-3">
            {(form.heroSlides || []).map((slide, i) => (
              <div key={i} className="flex gap-3 items-center border border-[#e5e2da] dark:border-[#2a3b30] rounded-lg p-2">
                <img src={slide.image} alt="" className="w-24 h-14 object-cover rounded flex-shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <input
                    className="input text-sm"
                    placeholder="Title (optional)"
                    value={slide.title || ''}
                    onChange={(e) => {
                      const heroSlides = [...form.heroSlides];
                      heroSlides[i] = { ...heroSlides[i], title: e.target.value };
                      setForm((f) => ({ ...f, heroSlides }));
                    }}
                  />
                  <input
                    className="input text-sm"
                    placeholder="Link (optional) — /shop?..."
                    value={slide.link || ''}
                    onChange={(e) => {
                      const heroSlides = [...form.heroSlides];
                      heroSlides[i] = { ...heroSlides[i], link: e.target.value };
                      setForm((f) => ({ ...f, heroSlides }));
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button type="button" disabled={i === 0} onClick={() => {
                    const heroSlides = [...form.heroSlides];
                    [heroSlides[i - 1], heroSlides[i]] = [heroSlides[i], heroSlides[i - 1]];
                    setForm((f) => ({ ...f, heroSlides }));
                  }} className="btn-outline text-xs px-2 py-1">↑</button>
                  <button type="button" disabled={i === form.heroSlides.length - 1} onClick={() => {
                    const heroSlides = [...form.heroSlides];
                    [heroSlides[i + 1], heroSlides[i]] = [heroSlides[i], heroSlides[i + 1]];
                    setForm((f) => ({ ...f, heroSlides }));
                  }} className="btn-outline text-xs px-2 py-1">↓</button>
                  <button type="button" onClick={() => {
                    setForm((f) => ({ ...f, heroSlides: f.heroSlides.filter((_, j) => j !== i) }));
                  }} className="btn-outline text-xs px-2 py-1 text-red-500">✕</button>
                </div>
              </div>
            ))}
            {(form.heroSlides || []).length < 10 && (
              <label className="btn-outline text-sm cursor-pointer w-fit">
                {uploading === 'heroSlides' ? 'Uploading…' : '+ Add Slide Image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploading('heroSlides');
                    try {
                      const result = await uploadImage(file);
                      setForm((f) => ({ ...f, heroSlides: [...(f.heroSlides || []), { image: result.url, link: '', title: '' }] }));
                      toast.success('Slide added — Save চাপুন');
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Upload failed');
                    } finally {
                      setUploading('');
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {/* App download panel (1/6 width) */}
        <div className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-lg">App Download Panel</h2>
            <p className="text-xs text-gray-500 dark:text-ash">Hero-r pasher choto panel — Play Store / App Store link + QR image.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Google Play URL</label>
              <input name="playStoreUrl" className="input" value={form.playStoreUrl || ''} onChange={handleChange} placeholder="https://play.google.com/..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">App Store URL</label>
              <input name="appStoreUrl" className="input" value={form.appStoreUrl || ''} onChange={handleChange} placeholder="https://apps.apple.com/..." />
            </div>
          </div>
          {imageField('appQrImage', 'QR Code Image')}
        </div>

        {/* Contact */}
        <div className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-lg">Contact</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input name="phone" className="input" value={form.phone} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input name="email" type="email" className="input" value={form.email} onChange={handleChange} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea
              name="address"
              className="input"
              rows={2}
              value={form.address}
              onChange={handleChange}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Facebook URL</label>
              <input name="facebook" className="input" value={form.facebook} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
              <input name="whatsapp" className="input" value={form.whatsapp} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white dark:bg-[#12241a] rounded-xl border border-[#e5e2da] dark:border-[#2a3b30] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-lg">Payment Methods</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="enableCOD"
                checked={form.enableCOD}
                onChange={handleChange}
                className="rounded"
              />
              <span>Cash on Delivery (COD)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="enableBkash"
                checked={form.enableBkash}
                onChange={handleChange}
                className="rounded"
              />
              <span>bKash</span>
              <span className="text-xs text-gray-400 dark:text-ash">(Integration pending)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="enableNagad"
                checked={form.enableNagad}
                onChange={handleChange}
                className="rounded"
              />
              <span>Nagad</span>
              <span className="text-xs text-gray-400 dark:text-ash">(Integration pending)</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="enableSSLCommerz"
                checked={form.enableSSLCommerz}
                onChange={handleChange}
                className="rounded"
              />
              <span>SSLCommerz</span>
              <span className="text-xs text-gray-400 dark:text-ash">(Integration pending)</span>
            </label>
          </div>
          <div className="pt-2">
            <label className="block text-sm font-medium mb-1">Default Delivery Charge (৳)</label>
            <input
              name="defaultDeliveryCharge"
              type="number"
              min="0"
              className="input w-40"
              value={form.defaultDeliveryCharge}
              onChange={handleChange}
            />
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <TwoFactorCard />
    </div>
  );
}

function TwoFactorCard() {
  const [step, setStep] = useState('idle'); // idle | secret | done
  const [secret, setSecret] = useState('');
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [on, setOn] = useState(false);

  const setup = async () => {
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setSecret(data.data.secret);
      setUrl(data.data.otpauthUrl);
      setStep('secret');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Setup failed');
    }
  };
  const enable = async () => {
    try {
      await api.post('/auth/2fa/verify', { token: code });
      toast.success('2FA enabled for your account');
      setOn(true);
      setStep('done');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code');
    }
  };
  const disable = async () => {
    const password = prompt('Confirm with your password (local accounts):') || '';
    const token = prompt('Enter current authenticator code:') || '';
    if (!token) return;
    try {
      await api.post('/auth/2fa/disable', { token, password });
      toast.success('2FA disabled');
      setOn(false);
      setStep('idle');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="card p-6 mt-6">
      <h2 className="font-bold mb-1">Two-Factor Authentication 🔐</h2>
      <p className="text-xs text-gray-500 mb-4">Recommended for Super Admin. Uses any authenticator app (Google/Microsoft Authy).</p>
      {step === 'secret' ? (
        <div className="space-y-3 max-w-md">
          <p className="text-xs">1. Add this key to your authenticator app:</p>
          <code className="block text-xs bg-black/5 dark:bg-white/10 p-3 rounded-lg break-all">{secret}</code>
          <p className="text-xs">2. Enter the 6-digit code:</p>
          <div className="flex gap-2">
            <input className="input" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
            <button onClick={enable} className="btn-primary">Enable</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {!on && <button onClick={setup} className="btn-outline">Set up 2FA</button>}
          <button onClick={disable} className="btn-outline text-red-600">Disable 2FA</button>
        </div>
      )}
    </div>
  );
}
