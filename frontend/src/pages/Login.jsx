import { useState } from 'react';
import SEO from '../components/seo/SEO';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import SocialAuth from '../components/auth/SocialAuth';
import api from '../services/api';

export default function Login() {
  const [form, setForm] = useState({ email: '', phone: '', password: '' });
  const [usePhone, setUsePhone] = useState(false);
  const [need2fa, setNeed2fa] = useState(null); // tempToken when 2FA required
  const [otp, setOtp] = useState('');
  const { login, setUser, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSocialDone = ({ needsPhone }) => {
    if (needsPhone) {
      toast('Please add your phone number', { icon: '📱' });
      navigate('/account/profile');
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = usePhone
        ? { phone: form.phone, password: form.password }
        : { email: form.email, password: form.password };
      const data = await login(payload);
      if (data?.requires2fa) {
        setNeed2fa(data.tempToken);
        toast('Enter your authenticator code', { icon: '🔐' });
        return;
      }
      toast.success('Login successful!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    }
  };

  const handle2fa = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/2fa/login', { tempToken: need2fa, token: otp });
      setUser(data.user);
      toast.success('Login successful!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code');
    }
  };

  return (
    <>
    <SEO title="Login" path="/login" noindex />

    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Login to Madina Bazar</h1>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setUsePhone(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${!usePhone ? 'bg-primary-600 text-white' : 'bg-gray-100'}`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setUsePhone(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${usePhone ? 'bg-primary-600 text-white' : 'bg-gray-100'}`}
          >
            Phone
          </button>
        </div>

        {need2fa ? (
          <form onSubmit={handle2fa} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Authenticator code</label>
              <input
                type="text"
                inputMode="numeric"
                className="input text-center text-xl tracking-[0.3em]"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full">Verify & Login</button>
            <button type="button" onClick={() => setNeed2fa(null)} className="w-full text-sm text-gray-500 hover:underline">Back</button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {usePhone ? (
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                className="input"
                placeholder="01XXXXXXXXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full">
            {isLoading ? 'Logging in...' : 'Login'}
          </button>

          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-primary-600 dark:text-gold-300 hover:underline">
              Forgot password?
            </Link>
          </div>
        </form>
        )}

        <SocialAuth onDone={handleSocialDone} />

        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  </>
  );
}
