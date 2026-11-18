import Supplier from '../models/Supplier.js';

export const getSuppliers = async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 20 } = req.query;
    const q = {};
    if (search) {
      const { escapeRegExp } = await import('../utils/safeRegex.js');
      const rx = { $regex: escapeRegExp(search), $options: 'i' };
      q.$or = [{ name: rx }, { company: rx }, { phone: rx }];
    }
    if (isActive !== undefined) q.isActive = isActive === 'true';
    const skip = (Number(page) - 1) * Number(limit);
    const [list, total] = await Promise.all([
      Supplier.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Supplier.countDocuments(q),
    ]);
    res.json({ success: true, data: list, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const createSupplier = async (req, res) => {
  try {
    const doc = await Supplier.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const updateSupplier = async (req, res) => {
  try {
    const doc = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const deleteSupplier = async (req, res) => {
  try {
    const doc = await Supplier.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
