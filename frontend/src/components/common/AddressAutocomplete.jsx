import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import api from '../../services/api';

/**
 * Barikoi-powered address autocomplete
 * onSelect({ address, area, city, latitude, longitude, placeId })
 */
export default function AddressAutocomplete({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Search address (e.g. Mirpur 10)...',
  className = '',
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState(true);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    api.get('/location/status').then((res) => {
      setConfigured(res.data?.data?.configured !== false);
    }).catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const search = (q) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/location/autocomplete', {
          params: { q, city: 'dhaka' },
        });
        setSuggestions(data.data || []);
        setOpen(true);
      } catch (err) {
        setSuggestions([]);
        if (err.response?.status === 503) setConfigured(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange?.(v);
    search(v);
  };

  const handleSelect = (place) => {
    const address = place.address || '';
    setQuery(address);
    onChange?.(address);
    setOpen(false);
    setSuggestions([]);
    onSelect?.({
      address,
      area: place.area || '',
      city: place.city || 'Dhaka',
      latitude: place.latitude,
      longitude: place.longitude,
      placeId: place.id || place.uCode,
      uCode: place.uCode || '',
    });
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="input pl-9 pr-9"
          value={query}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={
            configured ? placeholder : 'Address search unavailable — please type your address'
          }
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-[#12241a] border border-[#e5e2da] dark:border-[#2a3b30] rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((place, i) => (
            <li key={place.id || i}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-white/5 border-b border-[#e5e2da] dark:border-[#2a3b30] last:border-0"
                onClick={() => handleSelect(place)}
              >
                <div className="font-medium text-gray-900 dark:text-[#f5f1e8] line-clamp-1">{place.address}</div>
                {(place.area || place.city) && (
                  <div className="text-xs text-gray-500 dark:text-ash">
                    {[place.area, place.city].filter(Boolean).join(', ')}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
