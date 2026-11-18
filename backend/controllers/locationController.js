import * as barikoi from '../utils/barikoi.js';

/**
 * @desc    Address autocomplete (Barikoi proxy)
 * @route   GET /api/location/autocomplete?q=
 * @access  Public (rate-limit recommended in production)
 */
export const autocomplete = async (req, res) => {
  try {
    if (!barikoi.isBarikoiConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Barikoi is not configured. Set BARIKOI_API_KEY in .env',
        configured: false,
      });
    }

    const { q, city, area } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(200).json({ success: true, data: [] });
    }

    const result = await barikoi.autocomplete(q, {
      city: city || 'dhaka',
      area,
      bangla: true,
      sub_area: true,
      thana: true,
    });

    const places = (result.places || []).map((p) => ({
      id: p.id,
      address: p.address,
      addressBn: p.address_bn,
      city: p.city,
      area: p.area,
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
      postCode: p.postCode,
      uCode: p.uCode,
    }));

    res.status(200).json({
      success: true,
      count: places.length,
      data: places,
    });
  } catch (error) {
    console.error('Barikoi autocomplete:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Reverse geocode
 * @route   GET /api/location/reverse?lat=&lng=
 */
export const reverseGeocode = async (req, res) => {
  try {
    if (!barikoi.isBarikoiConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Barikoi is not configured',
        configured: false,
      });
    }

    const { lat, lng, latitude, longitude } = req.query;
    const la = lat || latitude;
    const lo = lng || longitude;

    if (!la || !lo) {
      return res.status(400).json({
        success: false,
        message: 'lat and lng are required',
      });
    }

    const result = await barikoi.reverseGeocode(lo, la);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Check if Barikoi configured
 * @route   GET /api/location/status
 */
export const locationStatus = async (req, res) => {
  res.status(200).json({
    success: true,
    data: { configured: barikoi.isBarikoiConfigured() },
  });
};
