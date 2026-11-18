import Settings from '../models/Settings.js';

// @desc    Get website settings
// @route   GET /api/settings
// @access  Public
export const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({});
    }

    // Don't expose sensitive keys to public
    const publicSettings = {
      websiteName: settings.websiteName,
      logo: settings.logo,
      favicon: settings.favicon,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      facebook: settings.facebook,
      whatsapp: settings.whatsapp,
      enableCOD: settings.enableCOD,
      enableBkash: settings.enableBkash,
      enableNagad: settings.enableNagad,
      enableSSLCommerz: settings.enableSSLCommerz,
      defaultDeliveryCharge: settings.defaultDeliveryCharge,
      newTileImage: settings.newTileImage || '',
      trendingTileImage: settings.trendingTileImage || '',
      heroSlides: settings.heroSlides || [],
      playStoreUrl: settings.playStoreUrl || '',
      appStoreUrl: settings.appStoreUrl || '',
      appQrImage: settings.appQrImage || '',
    };

    res.status(200).json({
      success: true,
      data: publicSettings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get full settings (Admin)
// @route   GET /api/settings/admin
// @access  Private (SETTINGS_VIEW)
export const getAdminSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private (SETTINGS_UPDATE)
export const updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      const fields = [
        'websiteName', 'logo', 'favicon', 'phone', 'email', 'address',
        'facebook', 'whatsapp', 'enableCOD', 'enableBkash', 'enableNagad',
        'enableSSLCommerz', 'defaultDeliveryCharge', 'barikoiApiKey',
        'newTileImage', 'trendingTileImage',
        'playStoreUrl', 'appStoreUrl', 'appQrImage',
      ];

      // Hero slides replaced as a whole (max 10, image required)
      if (req.body.heroSlides !== undefined) {
        const slides = Array.isArray(req.body.heroSlides) ? req.body.heroSlides : [];
        settings.heroSlides = slides
          .filter((s) => s && s.image)
          .slice(0, 10)
          .map((s) => ({
            image: String(s.image),
            link: String(s.link || ''),
            title: String(s.title || ''),
          }));
      }

      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          settings[field] = req.body[field];
        }
      });

      await settings.save();
    }

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
