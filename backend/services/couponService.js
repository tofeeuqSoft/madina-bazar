import Coupon from '../models/Coupon.js';

// Single coupon evaluator — validate endpoint AND checkout MUST both call
// this (no local copies). Returns {coupon, discount, eligibleSubtotal} or
// throws with {statusCode, message}.
export const evaluateCoupon = async ({ code, userId = null, items = [], subtotal = 0 }) => {
  if (!code) throw Object.assign(new Error('Coupon code is required'), { statusCode: 400 });
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase(), isActive: true });
  if (!coupon) throw Object.assign(new Error('Invalid coupon code'), { statusCode: 404 });
  const now = new Date();
  if (coupon.startDate && now < coupon.startDate) {
    throw Object.assign(new Error('Coupon is not active yet'), { statusCode: 400 });
  }
  if (coupon.expiryDate && now > coupon.expiryDate) {
    throw Object.assign(new Error('Coupon has expired'), { statusCode: 400 });
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw Object.assign(new Error('Coupon usage limit reached'), { statusCode: 400 });
  }
  if (coupon.maxPerUser && userId) {
    const mine = (coupon.usedBy || []).find((u) => String(u.user) === String(userId));
    if (mine && mine.count >= coupon.maxPerUser) {
      throw Object.assign(new Error(`You have already used this coupon ${mine.count} time(s)`), { statusCode: 400 });
    }
  }
  if (subtotal < (coupon.minimumOrderAmount || 0)) {
    throw Object.assign(new Error(`Minimum order amount for this coupon is ৳${coupon.minimumOrderAmount}`), { statusCode: 400 });
  }

  // Eligible base: whole cart unless products/categories targeted.
  const pSet = new Set((coupon.products || []).map(String));
  const cSet = new Set((coupon.categories || []).map(String));
  let eligible = subtotal;
  if (pSet.size || cSet.size) {
    eligible = 0;
    for (const it of items) {
      const pid = String(it.productId || it.product?._id || it.product || '');
      const cid = String(it.categoryId || it.product?.category?._id || it.product?.category || '');
      if (pSet.has(pid) || (cid && cSet.has(cid))) {
        eligible += (Number(it.price) || 0) * (Number(it.quantity) || 0);
      }
    }
    if (eligible <= 0) {
      throw Object.assign(new Error('Coupon does not apply to items in your cart'), { statusCode: 400 });
    }
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = (eligible * coupon.discountValue) / 100;
    if (coupon.maximumDiscount) discount = Math.min(discount, coupon.maximumDiscount);
  } else {
    discount = Math.min(coupon.discountValue, eligible);
  }
  return { coupon, discount: Math.max(0, Math.round(discount)), eligibleSubtotal: eligible };
};
