import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';

/**
 * Shared availability engine (Cart + Checkout).
 * Calls POST /api/cart/validate — the single "Backend Availability Check".
 * @param lines [{ productId?, comboId?, quantity, lineId? }]
 * @param lat,lng coordinates or null
 * @param placeId Barikoi location ID (exact match first)
 */
export default function useAvailability(lines, lat, lng, placeId) {
  const [state, setState] = useState({
    status: 'idle', // idle | checking | ready
    hasCoords: false,
    zone: null,
    matchMethod: null,
    lines: [],
    unavailableCount: 0,
    groceryBlocked: false,
    canPlaceOrder: true,
    groceryAreas: [],
  });

  const key = useMemo(
    () =>
      JSON.stringify({
        items: (lines || []).map((l) => ({
          p: l.productId || l.product?._id,
          c: l.comboId || l.combo?._id,
          q: l.quantity,
        })),
        lat: lat ?? null,
        lng: lng ?? null,
        pid: placeId || null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify((lines || []).map((l) => [l.productId || l.product?._id, l.comboId || l.combo?._id, l.quantity])), lat, lng, placeId]
  );

  useEffect(() => {
    const parsed = JSON.parse(key);
    if (!parsed.items.length) {
      setState((s) => ({ ...s, status: 'ready', lines: [], unavailableCount: 0, canPlaceOrder: true }));
      return;
    }
    setState((s) => ({ ...s, status: 'checking' }));
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post('/cart/validate', {
          items: parsed.items
            .filter((i) => i.p || i.c)
            .map((i) => ({ productId: i.p, comboId: i.c, quantity: i.q })),
          latitude: parsed.lat,
          longitude: parsed.lng,
          placeId: parsed.pid || undefined,
        });
        setState({
          status: 'ready',
          hasCoords: !!data.data?.hasCoords,
          zone: data.data?.zone || null,
          matchMethod: data.data?.matchMethod || null,
          lines: data.data?.lines || [],
          unavailableCount: data.data?.unavailableCount || 0,
          groceryBlocked: !!data.data?.groceryBlocked,
          canPlaceOrder: data.data?.canPlaceOrder !== false,
          groceryAreas: data.data?.groceryAreas || [],
        });
      } catch (_) {
        setState((s) => ({ ...s, status: 'ready' }));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [key]);

  return state;
}
