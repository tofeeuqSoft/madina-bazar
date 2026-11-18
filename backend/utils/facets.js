import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { buildProductSearchOr } from './searchQuery.js';

/**
 * Build Mongo filter from query params (shared by list + facets)
 * @param {object} q - req.query
 * @param {object} opts - { exclude: ['brand'|'category'|...] }
 */
export function buildProductFilter(q = {}, opts = {}) {
  const exclude = new Set(opts.exclude || []);
  const query = {};

  if (!exclude.has('category') && q.category) {
    if (q._catIds?.length) {
      // Parent expansion (mirrors product list): category OR subcategory in set
      const ids = q._catIds.map((x) =>
        mongoose.isValidObjectId(x) ? new mongoose.Types.ObjectId(x) : x
      );
      query.$and = query.$and || [];
      query.$and.push({ $or: [{ category: { $in: ids } }, { subcategory: { $in: ids } }] });
    } else {
      query.category = mongoose.isValidObjectId(q.category)
        ? new mongoose.Types.ObjectId(q.category)
        : q.category;
    }
  }
  if (!exclude.has('subcategory') && q.subcategory) {
    query.subcategory = mongoose.isValidObjectId(q.subcategory)
      ? new mongoose.Types.ObjectId(q.subcategory)
      : q.subcategory;
  }
  if (!exclude.has('productType') && q.productType) {
    query.productType = q.productType;
  }
  if (!exclude.has('brand') && q.brand) {
    query.brand = { $regex: String(q.brand).trim(), $options: 'i' };
  }

  // Always respect active unless admin passes isActive=all (staff-verified by caller)
  if (q.isActive === 'all') {
    // no filter — staff sees everything
  } else if (q.isActive !== undefined) query.isActive = q.isActive === 'true';
  else query.isActive = true;

  if (q.isFeatured !== undefined) query.isFeatured = q.isFeatured === 'true';

  if (!exclude.has('inStock')) {
    if (q.inStock === 'true') query.stock = { $gt: 0 };
    if (q.inStock === 'false') query.stock = { $lte: 0 };
  }

  if (!exclude.has('price')) {
    if (q.minPrice || q.maxPrice) {
      query.salePrice = {};
      if (q.minPrice) query.salePrice.$gte = Number(q.minPrice);
      if (q.maxPrice) query.salePrice.$lte = Number(q.maxPrice);
    }
  }

  if (q.search && String(q.search).trim()) {
    const or = buildProductSearchOr(q.search);
    if (or?.length) query.$or = or;
  }

  // Mirror of list rule: grocery items ONLY in grocery section.
  // Shown when explicitly asked (productType / category / subcategory).
  // Staff full view (isActive=all) sees everything.
  if (
    q.isActive !== 'all' &&
    !q.productType &&
    !q.category &&
    !q.subcategory
  ) {
    query.isGrocery = { $ne: true };
  }

  return query;
}

/**
 * Facet aggregations for current search context
 * Each facet ignores its own filter so options stay visible
 */
export async function computeFacets(q = {}) {
  // Resolve parent → [self + children] once so all facets share it
  const qq = { ...q };
  if (q.category && mongoose.isValidObjectId(q.category)) {
    try {
      const kids = await Category.find({ parentCategory: q.category }).select('_id').lean();
      qq._catIds = [q.category, ...kids.map((k) => k._id)];
    } catch (_) {}
  }

  const base = buildProductFilter(qq, { exclude: [] });

  // Grocery categories live ONLY in grocery section (?productType=GROCERY).
  // Everywhere else they are hidden. Category types are auto-maintained.
  const groceryView = String(q.productType || '').toUpperCase() === 'GROCERY';

  const [
    categories,
    brands,
    priceStats,
    stockStats,
  ] = await Promise.all([
    // Categories (exclude category filter)
    Product.aggregate([
      { $match: buildProductFilter(qq, { exclude: ['category', 'subcategory'] }) },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'cat',
        },
      },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          _isGroceryCat: { $eq: ['$cat.type', 'GROCERY'] },
        },
      },
      { $match: groceryView ? { _isGroceryCat: true } : { _isGroceryCat: { $ne: true } } },
      {
        $project: {
          _id: 1,
          count: 1,
          name: '$cat.name',
          slug: '$cat.slug',
        },
      },
    ]),

    // Brands
    Product.aggregate([
      { $match: buildProductFilter(qq, { exclude: ['brand'] }) },
      {
        $match: {
          brand: { $exists: true, $nin: [null, ''] },
        },
      },
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 40 },
      { $project: { _id: 0, name: '$_id', count: 1 } },
    ]),

    // Price range (exclude price filters)
    Product.aggregate([
      { $match: buildProductFilter(qq, { exclude: ['price'] }) },
      {
        $group: {
          _id: null,
          min: { $min: '$salePrice' },
          max: { $max: '$salePrice' },
          avg: { $avg: '$salePrice' },
        },
      },
    ]),

    // Stock buckets
    Product.aggregate([
      { $match: buildProductFilter(qq, { exclude: ['inStock'] }) },
      {
        $group: {
          _id: null,
          inStock: {
            $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] },
          },
          outOfStock: {
            $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  // Price histogram buckets
  const priceMatch = buildProductFilter(qq, { exclude: ['price'] });
  const priceBuckets = await Product.aggregate([
    { $match: priceMatch },
    {
      $bucket: {
        groupBy: '$salePrice',
        boundaries: [0, 100, 200, 500, 1000, 2000, 5000, 100000],
        default: '5000+',
        output: { count: { $sum: 1 } },
      },
    },
  ]);

  const price = priceStats[0] || { min: 0, max: 0, avg: 0 };
  const stock = stockStats[0] || { inStock: 0, outOfStock: 0 };

  return {
    categories: categories
      .filter((c) => c._id)
      .map((c) => ({
        id: c._id,
        name: c.name || 'Unknown',
        slug: c.slug,
        count: c.count,
      })),
    brands: brands.filter((b) => b.name),
    price: {
      min: Math.floor(price.min || 0),
      max: Math.ceil(price.max || 0),
      avg: Math.round(price.avg || 0),
      buckets: priceBuckets.map((b) => ({
        from: b._id,
        to:
          typeof b._id === 'number'
            ? [100, 200, 500, 1000, 2000, 5000, 100000].find((x) => x > b._id) ||
              null
            : null,
        label:
          b._id === '5000+'
            ? '৳5000+'
            : `৳${b._id}–৳${
                [100, 200, 500, 1000, 2000, 5000, 100000].find((x) => x > b._id) ||
                '…'
              }`,
        count: b.count,
      })),
    },
    stock: {
      inStock: stock.inStock || 0,
      outOfStock: stock.outOfStock || 0,
    },
  };
}
