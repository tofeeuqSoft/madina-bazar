import Address from '../models/Address.js';

// @desc    My saved addresses (no Barikoi call — reuse)
// @route   GET /api/addresses
// @access  Private
export const getAddresses = async (req, res) => {
  try {
    const list = await Address.find({ user: req.user.id }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save address (from Barikoi pick or manual)
// @route   POST /api/addresses
// @access  Private
export const createAddress = async (req, res) => {
  try {
    const {
      label, fullName, phone, address, area, city,
      postcode, latitude, longitude, placeId, uCode, deliveryArea, isDefault,
    } = req.body;

    if (!fullName || !phone || !address) {
      return res.status(400).json({ success: false, message: 'Name, phone and address are required' });
    }

    if (isDefault) {
      await Address.updateMany({ user: req.user.id }, { isDefault: false });
    }

    const doc = await Address.create({
      user: req.user.id,
      label: label || 'Home',
      fullName,
      phone,
      address,
      area: area || '',
      city: city || 'Dhaka',
      postcode: postcode || '',
      latitude: latitude != null ? Number(latitude) : undefined,
      longitude: longitude != null ? Number(longitude) : undefined,
      placeId: placeId || '',
      uCode: uCode || '',
      deliveryArea: deliveryArea || undefined,
      isDefault: isDefault === true,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update own address
// @route   PUT /api/addresses/:id
// @access  Private
export const updateAddress = async (req, res) => {
  try {
    const doc = await Address.findOne({ _id: req.params.id, user: req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: 'Address not found' });

    const fields = [
      'label', 'fullName', 'phone', 'address', 'area', 'city',
      'postcode', 'latitude', 'longitude', 'placeId', 'uCode', 'deliveryArea',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) doc[f] = req.body[f];
    });

    if (req.body.isDefault === true) {
      await Address.updateMany({ user: req.user.id, _id: { $ne: doc._id } }, { isDefault: false });
      doc.isDefault = true;
    } else if (req.body.isDefault === false) {
      doc.isDefault = false;
    }

    await doc.save();
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete own address
// @route   DELETE /api/addresses/:id
// @access  Private
export const deleteAddress = async (req, res) => {
  try {
    const doc = await Address.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: 'Address not found' });
    res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
