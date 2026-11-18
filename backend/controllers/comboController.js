import Combo from '../models/Combo.js';
import Product from '../models/Product.js';
import slugify from 'slugify';

// @desc    Get all combos
// @route   GET /api/combos
// @access  Public
export const getCombos = async (req, res) => {
  try {
    const {
      isActive,
      isFeatured,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';

    if (search) {
      const { escapeRegExp } = await import('../utils/safeRegex.js');
      query.name = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const combos = await Combo.find(query)
      .populate('items.product', 'name slug regularPrice salePrice unit images stock')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Combo.countDocuments(query);

    res.status(200).json({
      success: true,
      count: combos.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: combos,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single combo by ID or slug
// @route   GET /api/combos/:id
// @access  Public
export const getCombo = async (req, res) => {
  try {
    const { id } = req.params;

    let combo;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      combo = await Combo.findById(id).populate(
        'items.product',
        'name slug regularPrice salePrice unit images stock isActive'
      );
    } else {
      combo = await Combo.findOne({ slug: id }).populate(
        'items.product',
        'name slug regularPrice salePrice unit images stock isActive'
      );
    }

    if (!combo) {
      return res.status(404).json({ success: false, message: 'Combo not found' });
    }

    res.status(200).json({
      success: true,
      data: combo,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create combo pack
// @route   POST /api/combos
// @access  Private (COMBO_CREATE)
export const createCombo = async (req, res) => {
  try {
    const {
      name,
      items,
      regularPrice,
      salePrice,
      discount,
      images,
      description,
      isActive,
      isFeatured,
    } = req.body;

    if (!name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name and at least one product item are required',
      });
    }

    if (regularPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Regular price is required',
      });
    }

    // Validate all products exist
    for (const item of items) {
      if (!item.product || !item.quantity || item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have product ID and quantity >= 1',
        });
      }

      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
      }
    }

    // Generate unique slug
    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await Combo.findOne({ slug });
    if (slugExists) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const combo = await Combo.create({
      name,
      slug,
      items,
      regularPrice,
      salePrice: salePrice ?? regularPrice,
      discount: discount || 0,
      images: images || [],
      description: description || '',
      isActive: isActive !== undefined ? isActive : true,
      isFeatured: isFeatured || false,
    });

    const populated = await Combo.findById(combo._id).populate(
      'items.product',
      'name slug regularPrice salePrice unit images'
    );

    res.status(201).json({
      success: true,
      message: 'Combo pack created successfully',
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update combo
// @route   PUT /api/combos/:id
// @access  Private (COMBO_UPDATE)
export const updateCombo = async (req, res) => {
  try {
    const combo = await Combo.findById(req.params.id);
    if (!combo) {
      return res.status(404).json({ success: false, message: 'Combo not found' });
    }

    const {
      name,
      items,
      regularPrice,
      salePrice,
      discount,
      images,
      description,
      isActive,
      isFeatured,
    } = req.body;

    if (name && name !== combo.name) {
      combo.name = name;
      let slug = slugify(name, { lower: true, strict: true });
      const slugExists = await Combo.findOne({ slug, _id: { $ne: combo._id } });
      if (slugExists) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }
      combo.slug = slug;
    }

    if (items) {
      // Validate products
      for (const item of items) {
        if (!item.product || !item.quantity || item.quantity < 1) {
          return res.status(400).json({
            success: false,
            message: 'Each item must have product ID and quantity >= 1',
          });
        }
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Product not found: ${item.product}`,
          });
        }
      }
      combo.items = items;
    }

    if (regularPrice !== undefined) combo.regularPrice = regularPrice;
    if (salePrice !== undefined) combo.salePrice = salePrice;
    if (discount !== undefined) combo.discount = discount;
    if (images) combo.images = images;
    if (description !== undefined) combo.description = description;
    if (isActive !== undefined) combo.isActive = isActive;
    if (isFeatured !== undefined) combo.isFeatured = isFeatured;

    await combo.save();

    const updated = await Combo.findById(combo._id).populate(
      'items.product',
      'name slug regularPrice salePrice unit images'
    );

    res.status(200).json({
      success: true,
      message: 'Combo updated successfully',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle combo status
// @route   PATCH /api/combos/:id/status
// @access  Private (COMBO_UPDATE)
export const toggleComboStatus = async (req, res) => {
  try {
    const combo = await Combo.findById(req.params.id);
    if (!combo) {
      return res.status(404).json({ success: false, message: 'Combo not found' });
    }

    combo.isActive = !combo.isActive;
    await combo.save();

    res.status(200).json({
      success: true,
      message: `Combo ${combo.isActive ? 'enabled' : 'disabled'} successfully`,
      data: {
        id: combo._id,
        name: combo.name,
        isActive: combo.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete combo
// @route   DELETE /api/combos/:id
// @access  Private (COMBO_DELETE)
export const deleteCombo = async (req, res) => {
  try {
    const combo = await Combo.findById(req.params.id);
    if (!combo) {
      return res.status(404).json({ success: false, message: 'Combo not found' });
    }

    await combo.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Combo deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
