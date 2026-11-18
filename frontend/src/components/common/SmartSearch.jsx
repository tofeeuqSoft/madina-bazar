import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import api from '../../services/api';
import useT from '../../hooks/useT';
import { productImage } from '../../utils/cloudinary';

/**
 * Optimized search: Bangla / English / Banglish + suggestions
 */
export default function SmartSearch({ className = '', onNavigate }) {
  const t = useT();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState([]);
  const wrapRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setSuggestions([]);
      setTerms([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/search/suggest', { params: { q: q.trim() } });
        setSuggestions(data.data || []);
        setTerms(data.expandedTerms || []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer.current);
  }, [q]);

  const goShop = (query) => {
    const s = (query || q).trim();
    if (!s) return;
    setOpen(false);
    onNavigate?.();
    navigate(`/shop?search=${encodeURIComponent(s)}`);
  };

  const goProduct = (slug) => {
    setOpen(false);
    onNavigate?.();
    navigate(`/product/${slug}`);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goShop();
        }}
      >
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder={t('searchPlaceholder')}
            className="input pr-9 py-1.5 text-sm"
            autoComplete="off"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-primary-700 dark:text-primary-300"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>

      {open && (suggestions.length > 0 || terms.length > 0) && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] max-h-80 overflow-y-auto rounded-xl border border-primary-100 dark:border-primary-800 bg-white dark:bg-[#12241a] shadow-lg">
          {terms.length > 0 && (
            <div className="px-3 py-2 border-b border-primary-50 dark:border-primary-900 flex flex-wrap gap-1">
              {terms.slice(0, 6).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => goShop(term)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
          {suggestions.map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => goProduct(item.slug || item._id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-primary-50 dark:hover:bg-primary-900/40 text-sm"
            >
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-primary-50 dark:bg-primary-900/40 flex-shrink-0">
                {item.image ? (
                  <img
                    src={productImage({ images: [item.image] }, 'thumb') || item.image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="flex items-center justify-center h-full text-sm">🛒</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-primary-900 dark:text-primary-50">
                  {item.name}
                </p>
                <p className="text-xs text-primary-700 dark:text-primary-300">৳{item.price}</p>
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => goShop()}
            className="w-full px-3 py-2.5 text-xs font-medium text-center text-primary-700 dark:text-primary-300 border-t border-primary-50 dark:border-primary-900 hover:bg-primary-50 dark:hover:bg-primary-900/40"
          >
            {t('shop')} — “{q}”
          </button>
        </div>
      )}
    </div>
  );
}
