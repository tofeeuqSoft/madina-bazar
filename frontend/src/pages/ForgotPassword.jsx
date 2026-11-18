import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, ShieldCheck, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import SEO from '../components/seo/SEO';

const RESEND_AFTER = 60;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState(null); // 'email' | 'sms'
  const [maskedTo, setMaskedTo] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const isEmail = (v) => v.includes('@');
  const payload = () => (isEmail(identifier) ? { email: identifier.trim() } : { phone: identifier.trim() });

  const sendOTP = async (isResend = false) => {
    const id = identifier.trim();
    if (!id) {
      toast.error('Enter your email or phone number');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', payload());
      if (data.channel) {
        setChannel(data.channel);
        setMaskedTo(data.maskedTo || '');
      }
      setStep(2);
      setCooldown(RESEND_AFTER);
      toast.success(data.message || 'OTP sent');
      if (data.devOTP) toast(`Dev OTP: ${data.devOTP}`, { icon: '🔑', duration: 10000 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    if (otp.trim().length < 4) {
      toast.error('Enter the OTP');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { ...payload(), otp: otp.trim() });
      toast.success('OTP verified');
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { ...payload(), otp: otp.trim(), newPassword });
      toast.success('Password reset! Please login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Account', 'Verify OTP', 'New Password'];

  return (
    <>
      <SEO title="Forgot Password" path="/forgot-password" noindex />
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md p-6 sm:p-8">
          <Link to="/login" className="inline-flex items-center text-sm text-gray-600 dark:text-ash hover:text-primary-600 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
          </Link>
          <h1 className="text-2xl font-bold mb-1">Reset Password</h1>
          <p className="text-sm text-gray-500 dark:text-ash mb-5">Email or phone-e OTP jabe.</p>

          {/* Stepper */}
          <div className="flex items-center gap-1 mb-6">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 flex items-center gap-1">
                <div className={`flex-1 text-center text-[11px] font-medium py-1.5 rounded-full ${step > i + 1 || step === i + 1 ? 'bg-primary-700 text-white dark:bg-gold-400 dark:text-[#0a0f0c]' : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-ash'}`}>
                  {i + 1}. {s}
                </div>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email or Phone</label>
                <input
                  className="input"
                  placeholder="you@example.com / 01XXXXXXXXX"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendOTP()}
                />
              </div>
              <button onClick={() => sendOTP()} disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={verifyOTP} className="space-y-4">
              <div className="flex items-center gap-2 text-sm bg-[#f7f5f0] dark:bg-white/5 border border-[#e5e2da] dark:border-[#2a3b30] rounded-lg px-3 py-2.5">
                {channel === 'email' ? <Mail className="w-4 h-4 flex-shrink-0" /> : <Phone className="w-4 h-4 flex-shrink-0" />}
                <span className="truncate">OTP sent to <b>{maskedTo || identifier}</b></span>
                <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs text-primary-600 dark:text-gold-300 hover:underline whitespace-nowrap">Change</button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">6-digit OTP</label>
                <input
                  className="input text-center text-2xl font-bold tracking-[0.5em]"
                  placeholder="••••••"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                <ShieldCheck className="w-4 h-4 mr-1" /> {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
              <p className="text-center text-sm">
                {cooldown > 0 ? (
                  <span className="text-gray-500">Resend in {cooldown}s</span>
                ) : (
                  <button type="button" onClick={() => sendOTP(true)} disabled={loading} className="text-primary-600 dark:text-gold-300 hover:underline">
                    Resend OTP
                  </button>
                )}
              </p>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={resetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirm Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                <KeyRound className="w-4 h-4 mr-1" /> {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
