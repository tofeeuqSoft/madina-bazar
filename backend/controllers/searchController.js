import Product from '../models/Product.js';
import {
  buildProductSearchOr,
  expandSearchTerms,
  normalizeSearch,
  scoreProduct,
} from '../utils/searchQuery.js';

/**
 * @desc    Smart search suggestions (typeahead)
 * @route   GET /api/search/suggest?q=
 * @access  Public
 */
export const suggest = async (req, res) => {
  try {
    const q = normalizeSearch(req.query.q || req.query.search || '');
    if (!q || q.length < 1) {
      return res.status(200).json({ success: true, data: [] });
    }

    const or = buildProductSearchOr(q);
    if (!or?.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const products = await Product.find({
      isActive: true,
      $or: or,
    })
      .select('name slug salePrice regularPrice images brand')
      .limit(30)
      .lean();

    const ranked = products
      .map((p) => ({
        _id: p._id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        price: p.salePrice || p.regularPrice,
        image: p.images?.[0]?.url || p.images?.[0] || null,
        _score: scoreProduct(p, q),
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 8);

    res.status(200).json({
      success: true,
      data: ranked,
      expandedTerms: expandSearchTerms(q).slice(0, 8),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
