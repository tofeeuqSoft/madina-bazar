import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const FB_ID = import.meta.env.VITE_FACEBOOK_APP_ID || '';

const loadScript = (src, id) =>
  new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.id = id;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load auth SDK'));
    document.head.appendChild(s);
  });

const notConfigured = (name, key) =>
  toast.error(`${name} login not configured yet. Add ${key} in .env`, { duration: 5000 });

/**
 * Google + Facebook one-tap signup/login (CUSTOMER).
 * Buttons ALWAYS visible — without keys, click shows setup hint.
 * onDone({ needsPhone }) — parent navigates afterwards.
 */
export default function SocialAuth({ onDone }) {
  const setSocialSession = useAuthStore((s) => s.setSocialSession);
  const [busy, setBusy] = useState(false);
  const googleReady = useRef(false);

  const finish = async (provider, token) => {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/social', { provider, token });
      setSocialSession(data);
      toast.success(provider === 'google' ? 'Google login successful!' : 'Facebook login successful!');
      onDone?.({ needsPhone: !!data.needsPhone, user: data.user });
    } catch (err) {
      toast.error(err.response?.data?.message || `${provider} login failed`);
    } finally {
      setBusy(false);
    }
  };

  // Preload Google Identity Services when configured
  useEffect(() => {
    if (!GOOGLE_ID) return;
    let cancelled = false;
    loadScript('https://accounts.google.com/gsi/client', 'google-gsi')
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_ID,
          callback: (resp) => resp.credential && finish('google', resp.credential),
        });
        googleReady.current = true;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoogle = () => {
    if (!GOOGLE_ID) {
      notConfigured('Google', 'VITE_GOOGLE_CLIENT_ID');
      return;
    }
    if (!googleReady.current || !window.google?.accounts?.id) {
      toast.error('Google SDK loading… try again in a moment');
      return;
    }
    // Official One Tap / auto prompt returns ID token via callback
    try {
      window.google.accounts.id.prompt();
    } catch {
      toast.error('Google prompt blocked — check popup settings');
    }
  };

  const handleFacebook = async () => {
    if (!FB_ID) {
      notConfigured('Facebook', 'VITE_FACEBOOK_APP_ID');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await loadScript('https://connect.facebook.net/en_US/sdk.js', 'facebook-jssdk');
      if (!window.FB) throw new Error('Facebook SDK failed');
      window.FB.init({ appId: FB_ID, cookie: false, xfbml: false, version: 'v21.0' });
      const resp = await new Promise((resolve) =>
        window.FB.login(resolve, { scope: 'public_profile,email' })
      );
      const token = resp?.authResponse?.accessToken;
      if (!token) {
        if (resp?.status !== 'connected') toast('Facebook login cancelled');
        setBusy(false);
        return;
      }
      await finish('facebook', token);
    } catch (err) {
      toast.error(err.message || 'Facebook login failed');
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 my-4">
        <span className="flex-1 h-px bg-[#e5e2da] dark:bg-[#2a3b30]" />
        <span className="text-xs text-gray-500 dark:text-ash">or continue with</span>
        <span className="flex-1 h-px bg-[#e5e2da] dark:bg-[#2a3b30]" />
      </div>
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="btn w-full bg-white dark:bg-white text-gray-700 border border-gray-300 dark:border-gray-600 font-semibold hover:bg-gray-50 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5.2 3.8-8.9z" />
            <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.7 2.9v.1C3.4 21.4 7.4 24 12 24z" />
            <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.6 0 10.2 0 12s.5 3.4 1.4 4.9l3.8-2.5z" />
            <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.7l3.8 2.9c1-2.9 3.7-5 6.8-5z" />
          </svg>
          {busy ? 'Please wait…' : 'Continue with Google'}
        </button>
        <button
          type="button"
          onClick={handleFacebook}
          disabled={busy}
          className="btn w-full bg-[#1877f2] hover:bg-[#1466d6] text-white font-semibold disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
            <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3V11H9v3h2.3v7h2.2z" />
          </svg>
          {busy ? 'Please wait…' : 'Continue with Facebook'}
        </button>
        {!GOOGLE_ID && !FB_ID && (
          <p className="text-[11px] text-center text-gray-400 dark:text-ash">
            Setup pending — keys add korle login live hobe
          </p>
        )}
      </div>
    </div>
  );
}
