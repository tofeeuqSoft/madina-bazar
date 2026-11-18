import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { typeForCategory } from './categoryController.js';
import slugify from 'slugify';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { hasPermission } from '../utils/permissions.js';
import {
  buildProductSearchOr,
  scoreProduct,
  expandSearchTerms,
  normalizeSearch,
} from '../utils/searchQuery.js';
import { buildProductFilter, computeFacets } from '../utils/facets.js';
import { paginateCursor } from '../utils/cursorPagination.js';

// Normalize optional variant inputs (sizes: string[] | comma string,
// colors: [{ name, code }] | string[])
const normalizeSizes = (v) => {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))].slice(0, 20);
};

const normalizeColors = (v) => {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const c of v) {
    const name = String(c?.name ?? c ?? '').trim();
    if (!name) continue;
    const code = String(c?.code ?? '').trim();
    if (!out.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      out.push({ name, code });
    }
    if (out.length >= 20) break;
  }
  return out;
};

// Boolean flag helper (scope selector sends true/false)
const boolFlag = (v) => v === true || v === 'true';

// Optional staff check for public routes: returns staff user if a valid
// staff token is present, otherwise null (never throws — public stays public).
const getOptionalStaff = async (req) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) return null;
    return hasPermission(user, 'PRODUCT_VIEW') ? user : null;
  } catch {
    return null;
  }
};

// @desc    Get all products (with filters + pagination)
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
  try {
    const {
      category,
      subcategory,
      productType,
      brand,
      isActive,
      isFeatured,
      search,
      minPrice,
      maxPrice,
      inStock,
      scope,
      sort = '-createdAt',
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    // Parent category tile → include subcategory products too
    if (category) {
      if (mongoose.isValidObjectId(category)) {
        const childIds = await Category.find({ parentCategory: category }).select('_id').lean();
        const ids = [new mongoose.Types.ObjectId(category), ...childIds.map((c) => c._id)];
        query.$and = query.$and || [];
        query.$and.push({ $or: [{ category: { $in: ids } }, { subcategory: { $in: ids } }] });
      } else {
        query.category = category;
      }
    }
    if (subcategory) query.subcategory = subcategory;
    if (productType) query.productType = productType;
    if (brand) {
      const { escapeRegExp } = await import('../utils/safeRegex.js');
      query.brand = { $regex: escapeRegExp(brand), $options: 'i' };
    }
    // Disabled products are hidden from customers by default.
    // Staff (PRODUCT_VIEW) may pass isActive=all|false to see everything.
    let staffView = false;
    if (isActive === 'all' || isActive === 'false') {
      const staff = await getOptionalStaff(req);
      if (!staff) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      staffView = true;
      if (isActive === 'false') query.isActive = false;
      // 'all' → no isActive filter
    } else {
      query.isActive = true;
    }
    // Grocery items live ONLY in the grocery section: shown when explicitly
    // asked (productType / category / subcategory). Never in Shop browse,
    // search or scope views — unless staff full view.
    if (scope === 'all' && !staffView) {
      staffView = !!(await getOptionalStaff(req));
    }
    if (!staffView && !productType && !category && !subcategory) {
      query.isGrocery = { $ne: true };
    }
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (inStock === 'true') query.stock = { $gt: 0 };
    if (inStock === 'false') query.stock = { $lte: 0 };

    if (minPrice || maxPrice) {
      query.salePrice = {};
      if (minPrice) query.salePrice.$gte = Number(minPrice);
      if (maxPrice) query.salePrice.$lte = Number(maxPrice);
    }

    if (search && String(search).trim()) {
      const or = buildProductSearchOr(search);
      if (or?.length) {
        query.$or = or;
      }
      // Optional: also try $text if text index exists
      // (kept regex-based for Bangla + Banglish reliability)
    }

    const limitNum = Math.min(Number(limit) || 20, 50);
    const useCursor = Boolean(req.query.cursor) || req.query.pagination === 'cursor';

    let products;
    let total;
    let cursorMeta = null;

    if (useCursor && !(search && String(search).trim())) {
      // Cursor mode (not combined with text relevance re-rank)
      const result = await paginateCursor(Product, {
        filter: query,
        sort,
        cursor: req.query.cursor,
        limit: limitNum,
        populate: [
          { path: 'category', select: 'name slug' },
          { path: 'subcategory', select: 'name slug' },
        ],
      });
      products = result.items;
      cursorMeta = {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        limit: result.limit,
      };
      // Optional approximate total (can be expensive — only if requested)
      total =
        req.query.includeTotal === 'true'
          ? await Product.countDocuments(query)
          : undefined;
    } else {
      const skip = (Number(page) - 1) * limitNum;
      products = await Product.find(query)
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean();

      if (search && String(search).trim()) {
        products = products
          .map((p) => ({ ...p, _score: scoreProduct(p, search) }))
          .sort((a, b) => b._score - a._score || 0);
      }

      total = await Product.countDocuments(query);
    }

    // Faceted search aggregates (parallel)
    let facets = null;
    if (req.query.facets !== 'false') {
      try {
        facets = await computeFacets({
          category,
          subcategory: req.query.subcategory,
          productType,
          brand: req.query.brand,
          search,
          scope,
          minPrice,
          maxPrice,
          inStock,
          isActive: isActive !== undefined ? isActive : 'true',
        });
      } catch (e) {
        console.warn('facets error:', e.message);
      }
    }

    res.status(200).json({
      success: true,
      count: products.length,
      total: total ?? null,
      page: cursorMeta ? undefined : Number(page),
      pages:
        total != null && !cursorMeta
          ? Math.ceil(total / limitNum)
          : undefined,
      data: products,
      pagination: cursorMeta
        ? {
            type: 'cursor',
            nextCursor: cursorMeta.nextCursor,
            hasMore: cursorMeta.hasMore,
            limit: cursorMeta.limit,
          }
        : {
            type: 'offset',
            page: Number(page),
            limit: limitNum,
            pages: total != null ? Math.ceil(total / limitNum) : undefined,
            total,
          },
      facets,
      searchMeta: search
        ? {
            query: normalizeSearch(search),
            expandedTerms: expandSearchTerms(search).slice(0, 12),
          }
        : undefined,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single product by ID or slug
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    let product;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(id)
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug');
    } else {
      product = await Product.findOne({ slug: id })
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug');
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Disabled products are invisible to customers (even via direct link).
    // Staff can still open them for editing.
    if (!product.isActive) {
      const staff = await getOptionalStaff(req);
      if (!staff) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private (PRODUCT_CREATE)
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      subcategory,
      isGrocery,
      brand,
      sku,
      regularPrice,
      salePrice,
      costPrice,
      sizes,
      colors,
      stock,
      minStock,
      vatExempt,
      unit,
      images,
      description,
      isActive,
      isFeatured,
    } = req.body;

    if (!name || !category || regularPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, category and regularPrice are required',
      });
    }

    // Validate category
    const cat = await Category.findById(category);
    if (!cat) {
      return res.status(400).json({ success: false, message: 'Category not found' });
    }

    if (subcategory) {
      const sub = await Category.findById(subcategory);
      if (!sub) {
        return res.status(400).json({ success: false, message: 'Subcategory not found' });
      }
    }

    // Generate unique slug
    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await Product.findOne({ slug });
    if (slugExists) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    // Auto SKU if not provided
    let finalSku = sku;
    if (!finalSku) {
      finalSku = `MB-${Date.now().toString().slice(-8)}`;
    }

    // Type auto from category tree; grocery scope from upload selector.
    // No manual types anywhere.
    const refCat = subcategory || category;
    const finalType = await typeForCategory(refCat);
    const groceryFlag = isGrocery !== undefined ? boolFlag(isGrocery) : finalType === 'GROCERY';

    const product = await Product.create({
      name,
      slug,
      category,
      subcategory: subcategory || null,
      productType: finalType,
      isGrocery: groceryFlag,
      brand: brand || '',
      sku: finalSku,
      regularPrice,
      salePrice: salePrice ?? regularPrice,
      costPrice: costPrice ?? 0,
      sizes: normalizeSizes(sizes),
      colors: normalizeColors(colors),
      stock: 0, // opening units enter via the ledger below (never silent)
      minStock: minStock ?? 5,
      vatExempt: !!vatExempt,
      unit: unit || 'Piece',
      images: images || [],
      description: description || '',
      isActive: isActive !== undefined ? isActive : true,
      isFeatured: isFeatured || false,
    });

    const { ensureStock, adjustStock } = await import('../services/inventory/stockService.js');
    await ensureStock({ productId: product._id });
    const opening = Math.max(0, Number(stock) || 0);
    if (opening > 0) {
      await adjustStock({ productId: product._id, quantity: opening, bucket: 'onHand', reason: 'Opening stock (main menu)', actor: req.user, performedByType: 'HUMAN', referenceId: `PRODUCT_API:${product._id}` });
    }

    const populated = await Product.findById(product._id)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: populated,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (PRODUCT_UPDATE)
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const {
      name,
      category,
      subcategory,
      isGrocery,
      brand,
      sku,
      regularPrice,
      salePrice,
      costPrice,
      sizes,
      colors,
      stock,
      minStock,
      vatExempt,
      unit,
      images,
      description,
      isActive,
      isFeatured,
    } = req.body;

    if (name && name !== product.name) {
      product.name = name;
      let slug = slugify(name, { lower: true, strict: true });
      const slugExists = await Product.findOne({ slug, _id: { $ne: product._id } });
      if (slugExists) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }
      product.slug = slug;
    }

    if (category) product.category = category;
    if (subcategory !== undefined) product.subcategory = subcategory || null;
    if (category || subcategory !== undefined || isGrocery !== undefined) {
      const refCat = product.subcategory || product.category;
      const finalType = refCat ? await typeForCategory(refCat) : product.productType;
      product.productType = finalType;
      if (isGrocery !== undefined) product.isGrocery = boolFlag(isGrocery);
      else product.isGrocery = finalType === 'GROCERY';
    }
    if (brand !== undefined) product.brand = brand;
    if (sku) product.sku = sku;
    if (regularPrice !== undefined) product.regularPrice = regularPrice;
    if (salePrice !== undefined) product.salePrice = salePrice;
    if (req.body.saleSchedule !== undefined) {
      const sc = req.body.saleSchedule || {};
      if (sc.price == null && sc.startDate == null && sc.endDate == null) {
        product.saleSchedule = { price: null, startDate: null, endDate: null, preSale: null, lastApplied: null };
      } else {
        if (sc.price == null || Number(sc.price) < 0) {
          return res.status(400).json({ success: false, message: 'Schedule price must be 0 or more' });
        }
        if (!sc.startDate || !sc.endDate || new Date(sc.endDate) <= new Date(sc.startDate)) {
          return res.status(400).json({ success: false, message: 'Schedule needs startDate before endDate' });
        }
        product.saleSchedule = { price: Number(sc.price), startDate: new Date(sc.startDate), endDate: new Date(sc.endDate), preSale: product.saleSchedule?.preSale ?? null, lastApplied: product.saleSchedule?.lastApplied ?? null };
      }
    }
    if (costPrice !== undefined) product.costPrice = costPrice;
    if (sizes !== undefined) product.sizes = normalizeSizes(sizes);
    if (colors !== undefined) product.colors = normalizeColors(colors);
    // Stock NEVER assigned directly — delta flows through the movement ledger below.
    let stockDelta = null;
    if (stock !== undefined) {
      if (!Number.isFinite(Number(stock)) || Number(stock) < 0) {
        return res.status(400).json({ success: false, message: 'Valid stock value is required' });
      }
      stockDelta = Number(stock) - (product.stock || 0);
    }
    if (minStock !== undefined) product.minStock = minStock;
    if (vatExempt !== undefined) product.vatExempt = !!vatExempt;
    if (unit) product.unit = unit;
    if (images) product.images = images;
    if (description !== undefined) product.description = description;
    if (isActive !== undefined) product.isActive = isActive;
    if (isFeatured !== undefined) product.isFeatured = isFeatured;

    await product.save();

    if (stockDelta) {
      try {
        const { adjustStock } = await import('../services/inventory/stockService.js');
        await adjustStock({
          productId: product._id, quantity: stockDelta, bucket: 'onHand',
          reason: 'Product edit (main menu)',
          actor: req.user, performedByType: 'HUMAN', referenceId: `PRODUCT_API:${product._id}:${Date.now()}`,
        });
      } catch (e) {
        console.error('[inventory mirror]', e.message);
      }
    }

    const updated = await Product.findById(product._id)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug');

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updated,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Update stock only
// @route   PATCH /api/products/:id/stock
// @access  Private (INVENTORY_UPDATE or PRODUCT_UPDATE)
export const updateStock = async (req, res) => {
  try {
    const { stock, type = 'set' } = req.body; // type: set | increment | decrement

    if (stock === undefined || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid stock value is required',
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const oldStock = product.stock;
    if (type === 'increment') {
      product.stock += Number(stock);
    } else if (type === 'decrement') {
      product.stock = Math.max(0, product.stock - Number(stock));
    } else {
      product.stock = Number(stock);
    }
    const delta = product.stock - oldStock;

    // Mirror into Inventory Service FIRST (default warehouse) so ensureStock
    // backfills from the OLD value, then sync — best-effort, never breaks.
    try {
      const { adjustStock } = await import('../services/inventory/stockService.js');
      if (delta !== 0) {
        await adjustStock({
          productId: product._id, quantity: delta, bucket: 'onHand',
          reason: `Manual stock ${type} via product API`,
          actor: req.user, performedByType: 'HUMAN', referenceId: `PRODUCT_API:${product._id}:${Date.now()}`,
        });
        const fresh = await Product.findById(product._id).select('stock');
        if (fresh) product.stock = fresh.stock;
      }
    } catch (e) {
      console.error('[inventory mirror]', e.message);
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        id: product._id,
        name: product.name,
        stock: product.stock,
        minStock: product.minStock,
        isLowStock: product.stock <= product.minStock,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle product active status
// @route   PATCH /api/products/:id/status
// @access  Private (PRODUCT_STATUS or PRODUCT_UPDATE)
export const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product ${product.isActive ? 'enabled' : 'disabled'} successfully`,
      data: {
        id: product._id,
        name: product.name,
        isActive: product.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get low stock products
// @route   GET /api/products/inventory/low-stock
// @access  Private (INVENTORY_VIEW)
export const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$stock', '$minStock'] },
      isActive: true,
    })
      .populate('category', 'name')
      .sort({ stock: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete product — DISABLED to protect accounts/stock history
// @route   DELETE /api/products/:id
// @access  Private (PRODUCT_DELETE)
// A product can never be deleted once created: orders, purchases, returns,
// COGS and inventory valuation all reference it — deleting would corrupt
// financial reports. Use PATCH /:id/status to deactivate instead.
export const deleteProduct = async (req, res) => {
  return res.status(403).json({
    success: false,
    message:
      'Product cannot be deleted once created — it would corrupt orders, stock and financial reports. Deactivate it instead (Active → Inactive).',
  });
};
