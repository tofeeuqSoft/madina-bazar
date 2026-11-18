import Category from '../models/Category.js';
import slugify from 'slugify';

// Auto type from tree position: root slug → label, child → root ancestor.
// No manual types anywhere — scope (Nationwide/Grocery) lives on products.
export const typeForCategory = async (categoryId) => {
  let current = await Category.findById(categoryId).select('slug parentCategory').lean();
  let depth = 0;
  while (current?.parentCategory && depth < 10) {
    current = await Category.findById(current.parentCategory).select('slug parentCategory').lean();
    depth++;
  }
  if (!current) return 'GENERAL';
  return current.slug === 'grocery'
    ? 'GROCERY'
    : String(current.slug || 'general').toUpperCase().replace(/-/g, '_');
};

// @desc    Get all categories (flat list)
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const { isActive, parent } = req.query;

    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (parent === 'null' || parent === '') {
      query.parentCategory = null; // only root categories
    } else if (parent) {
      query.parentCategory = parent;
    }

    const categories = await Category.find(query)
      .populate('parentCategory', 'name slug')
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get category tree (nested structure)
// @route   GET /api/categories/tree
// @access  Public
export const getCategoryTree = async (req, res) => {
  try {
    const { isActive } = req.query;

    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const allCategories = await Category.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Build tree
    const map = {};
    const tree = [];

    allCategories.forEach((cat) => {
      map[cat._id] = { ...cat, children: [] };
    });

    allCategories.forEach((cat) => {
      if (cat.parentCategory) {
        const parent = map[cat.parentCategory];
        if (parent) {
          parent.children.push(map[cat._id]);
        }
      } else {
        tree.push(map[cat._id]);
      }
    });

    res.status(200).json({
      success: true,
      count: tree.length,
      data: tree,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single category by ID or slug
// @route   GET /api/categories/:id
// @access  Public
export const getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    let category;
    // Check if it's a valid ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(id).populate('parentCategory', 'name slug');
    } else {
      category = await Category.findOne({ slug: id }).populate('parentCategory', 'name slug');
    }

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Get children
    const children = await Category.find({ parentCategory: category._id })
      .sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        children,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private (CATEGORY_CREATE)
export const createCategory = async (req, res) => {
  try {
    const { name, parentCategory, image, description, displayOrder, isActive, leadTimeDays } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    // Check parent exists if provided
    if (parentCategory) {
      const parent = await Category.findById(parentCategory);
      if (!parent) {
        return res.status(400).json({ success: false, message: 'Parent category not found' });
      }
    }

    // Generate unique slug
    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await Category.findOne({ slug });
    if (slugExists) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    // Type is fully automatic: child inherits root ancestor, root maps by slug.
    // No manual types anywhere.
    const typeName = parentCategory
      ? await typeForCategory(parentCategory)
      : slug === 'grocery'
        ? 'GROCERY'
        : slug.toUpperCase().replace(/-/g, '_');

    const category = await Category.create({
      name,
      slug,
      parentCategory: parentCategory || null,
      image: image || '',
      description: description || '',
      displayOrder: displayOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
      leadTimeDays: leadTimeDays ? Math.min(90, Math.max(1, Number(leadTimeDays))) : null,
      type: typeName,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (CATEGORY_UPDATE)
export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, parentCategory, image, description, displayOrder, isActive, leadTimeDays } = req.body;
    if (parentCategory && parentCategory === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Category cannot be its own parent',
      });
    }

    // Prevent circular reference (simple check)
    if (parentCategory) {
      const parent = await Category.findById(parentCategory);
      if (!parent) {
        return res.status(400).json({ success: false, message: 'Parent category not found' });
      }
    }

    if (name && name !== category.name) {
      category.name = name;
      let slug = slugify(name, { lower: true, strict: true });
      const slugExists = await Category.findOne({ slug, _id: { $ne: category._id } });
      if (slugExists) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }
      category.slug = slug;
    }

    if (parentCategory !== undefined) {
      category.parentCategory = parentCategory || null;
    }
    // Type always re-derived from tree (rename or move updates it)
    category.type = await typeForCategory(category.parentCategory || category._id);
    if (image !== undefined) category.image = image;
    if (description !== undefined) category.description = description;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;
    if (leadTimeDays !== undefined) {
      category.leadTimeDays = leadTimeDays === null || leadTimeDays === '' ? null : Math.min(90, Math.max(1, Number(leadTimeDays)));
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle category active status
// @route   PATCH /api/categories/:id/status
// @access  Private (CATEGORY_UPDATE)
export const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? 'enabled' : 'disabled'} successfully`,
      data: {
        id: category._id,
        name: category.name,
        isActive: category.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (CATEGORY_DELETE)
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Check if has children
    const childrenCount = await Category.countDocuments({ parentCategory: category._id });
    if (childrenCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete. This category has ${childrenCount} subcategory(s). Delete them first.`,
      });
    }

    // Optional: Check if products exist under this category
    // const Product = (await import('../models/Product.js')).default;
    // const productCount = await Product.countDocuments({ category: category._id });
    // if (productCount > 0) { ... }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
