/**
 * Barikoi Location API
 * Docs: https://docs.barikoi.com
 * Autocomplete: GET https://barikoi.xyz/v2/api/search/autocomplete/place
 */

const AUTOCOMPLETE_URL = 'https://barikoi.xyz/v2/api/search/autocomplete/place';
const REVERSE_URL = 'https://barikoi.xyz/v2/api/search/reverse/geocode';

export const isBarikoiConfigured = () => Boolean(process.env.BARIKOI_API_KEY);

export const autocomplete = async (q, options = {}) => {
  const apiKey = process.env.BARIKOI_API_KEY;
  if (!apiKey) {
    throw new Error('BARIKOI_API_KEY is not configured');
  }
  if (!q || q.trim().length < 2) {
    return { places: [] };
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    q: q.trim(),
    bangla: options.bangla !== false ? 'true' : 'false',
  });

  if (options.city) params.set('city', options.city);
  if (options.area) params.set('area', options.area);
  if (options.sub_area) params.set('sub_area', 'true');
  if (options.thana) params.set('thana', 'true');

  const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Barikoi autocomplete failed: ${err}`);
  }
  return res.json();
};

export const reverseGeocode = async (longitude, latitude) => {
  const apiKey = process.env.BARIKOI_API_KEY;
  if (!apiKey) {
    throw new Error('BARIKOI_API_KEY is not configured');
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    longitude: String(longitude),
    latitude: String(latitude),
    district: 'true',
    post_code: 'true',
    area: 'true',
    bangla: 'true',
    thana: 'true',
  });

  const res = await fetch(`${REVERSE_URL}?${params.toString()}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Barikoi reverse geocode failed: ${err}`);
  }
  return res.json();
};
