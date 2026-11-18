import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, Minus, Plus, ArrowLeft, Share2, Link2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProduct, getProductReviews, submitReview, deleteReview } from '../services/productService';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import SEO, { SITE } from '../components/seo/SEO';
import Stars from '../components/common/Stars';
import ZoomImage from '../components/common/ZoomImage';
import { cldUrl, cldSrcSet } from '../utils/cloudinary';
import OptimizedVideo from '../components/common/OptimizedVideo';

export default function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [summary, setSummary] = useState({ avg: 0, count: 0, distribution: [] });
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [myReviewId, setMyReviewId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const addToCart = useCartStore((s) => s.addToCart);
  const { isAuthenticated } = useAuthStore();
  const [liked, setLiked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProduct();
  }, [id]);

  const checkWish = async (pid) => {
    if (!isAuthenticated || !pid) return;
    try {
      const { data } = await api.get(`/wishlist/check/${pid}`);
      setLiked(!!data.isInWishlist);
    } catch (_) {}
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) {
      toast.error('Login required for wishlist');
      navigate('/login');
      return;
    }
    try {
      if (liked) {
        await api.delete(`/wishlist/${product._id}`);
        setLiked(false);
        toast.success('Removed from wishlist');
      } else {
        await api.post('/wishlist', { productId: product._id });
        setLiked(true);
        toast.success('Added to wishlist');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const loadProduct = async () => {
    setLoading(true);
    try {
      const res = await getProduct(id);
      setProduct(res.data);
      setQuantity(1);
      setSelectedSize('');
      setSelectedColor('');
      setSelectedImage(0);
      checkWish(res.data?._id);
      loadReviews(res.data?._id);
    } catch (err) {
      toast.error('Product not found');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async (pid, lim = 3) => {
    if (!pid) return;
    try {
      const res = await getProductReviews(pid, { limit: lim });
      setSummary(res.data?.summary || { avg: 0, count: 0, distribution: [] });
      setReviews(res.data?.list || []);
      setReviewsTotal(res.meta?.total ?? res.data?.list?.length ?? 0);
      setReviewsExpanded(lim > 3);
      if (res.data?.mine) {
        setMyRating(res.data.mine.rating || 0);
        setMyComment(res.data.mine.comment || '');
        setMyReviewId(res.data.mine._id);
      } else {
        setMyRating(0);
        setMyComment('');
        setMyReviewId(null);
      }
    } catch (_) {}
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to write a review');
      navigate('/login');
      return;
    }
    if (!myRating) {
      toast.error('Please select stars');
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({ productId: product._id, rating: myRating, comment: myComment.trim() });
      toast.success('Review submitted!');
      setMyComment('');
      loadReviews(product._id, reviewsExpanded ? 100 : 3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewDelete = async (rid) => {
    if (!confirm('Delete your review?')) return;
    try {
      await deleteReview(rid);
      toast.success('Review deleted');
      setMyRating(0);
      setMyComment('');
      setMyReviewId(null);
      loadReviews(product._id, reviewsExpanded ? 100 : 3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleAddToCart = async () => {
    if (!product || product.stock <= 0) return;
    if (product.sizes?.length && !selectedSize) {
      toast.error('Please select a size');
      return;
    }
    if (product.colors?.length && !selectedColor) {
      toast.error('Please select a color');
      return;
    }
    const colorObj = (product.colors || []).find((c) => (c.name || c) === selectedColor);
    const result = await addToCart(product, quantity, {
      size: selectedSize,
      color: selectedColor,
      colorCode: colorObj?.code || '',
    });
    if (result.success) toast.success(result.message || 'Added to cart');
    else if (result.message) toast.error(result.message);
  };

  if (loading) {
    return (
      <div className="container-app py-8">
        <div className="animate-pulse grid md:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-200 rounded-xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/4" />
            <div className="h-24 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container-app py-16 text-center">
        <h2 className="text-xl font-semibold mb-4">Product not found</h2>
        <Link to="/shop" className="btn-primary">Back to Shop</Link>
      </div>
    );
  }

  const price = product.salePrice || product.regularPrice;
  const hasDiscount = product.salePrice && product.salePrice < product.regularPrice;
  const images = product.images?.length
    ? product.images.map((img) => (typeof img === 'string' ? img : img.url)).filter(Boolean)
    : [];

  const img = product.images?.[0]?.url || product.images?.[0];
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || product.name,
    image: img ? (img.startsWith('http') ? img : `${SITE}${img}`) : undefined,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BDT',
      price: product.salePrice || product.regularPrice,
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${SITE}/product/${product.slug || product._id}`,
    },
  };

  return (
    <>
    <SEO
      title={product.name}
      description={(product.description || product.name).slice(0, 160)}
      path={`/product/${product.slug || product._id}`}
      image={img}
      type="product"
      jsonLd={productLd}
    />
    <div className="container-app py-8">
      <Link to="/shop" className="inline-flex items-center text-sm text-gray-600 hover:text-primary-600 mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Shop
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <div>
          <div className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden mb-4">
            {images[selectedImage] ? (
              <ZoomImage
                src={cldUrl(images[selectedImage], 'detail')}
                srcSet={cldSrcSet(images[selectedImage])}
                sizes="(max-width: 768px) 100vw, 50vw"
                alt={product.name}
                zoom={2.2}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">🛒</div>
            )}
            {/* Share — top-right of image */}
            <div className="absolute top-3 right-3 z-10">
              <button
                type="button"
                aria-label="Share product"
                onClick={async () => {
                  const url = window.location.href;
                  if (navigator.share) {
                    try { await navigator.share({ title: product.name, text: product.name, url }); return; }
                    catch (e) { if (e?.name === 'AbortError') return; }
                  }
                  setShareOpen((v) => !v);
                }}
                className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition"
              >
                <Share2 className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              </button>
              {shareOpen && (
                <ShareMenu
                  url={typeof window !== 'undefined' ? window.location.href : ''}
                  title={product.name}
                  onClose={() => setShareOpen(false)}
                />
              )}
            </div>
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                    selectedImage === i ? 'border-primary-600' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.category && (
            <p className="text-sm text-primary-600 mb-2">
              {typeof product.category === 'object' ? product.category.name : product.category}
            </p>
          )}
          <h1 className="text-2xl md:text-3xl font-bold mb-3">{product.name}</h1>

          <a href="#reviews" className="inline-flex items-center gap-2 mb-3">
            <Stars value={summary.avg || product.ratingAvg || 0} size={16} />
            <span className="text-sm text-gray-500">
              {(summary.avg || product.ratingAvg || 0).toFixed(1)} ({summary.count || product.ratingCount || 0} reviews)
            </span>
          </a>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-bold text-primary-600">৳{price}</span>
            {hasDiscount && (
              <>
                <span className="text-lg text-gray-400 line-through">৳{product.regularPrice}</span>
                <span className="bg-red-100 text-red-600 text-sm font-medium px-2 py-0.5 rounded">
                  {Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)}% OFF
                </span>
              </>
            )}
          </div>

          {product.unit && (
            <p className="text-sm text-gray-500 mb-2">Unit: {product.unit}</p>
          )}

          <p className={`text-sm mb-1 ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {product.stock > 0 ? `In Stock (${product.stock} available)` : 'Out of Stock'}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {(product.isGrocery || product.productType === 'GROCERY')
              ? '🛵 Grocery — Mirpur delivery only'
              : '🌍 Home delivery all over Bangladesh'}
          </p>

          {/* Size selector (optional — only if product has sizes) */}
          {product.sizes?.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Size: {selectedSize && <span className="text-gray-500">({selectedSize})</span>}</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSize(s)}
                    className={`px-4 py-2 text-sm rounded-lg border transition ${
                      selectedSize === s
                        ? 'border-primary-700 bg-primary-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-[#0a0f0c] font-semibold'
                        : 'border-gray-300 dark:border-[#2a3b30] hover:border-primary-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color selector (optional — only if product has colors) */}
          {product.colors?.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Color: {selectedColor && <span className="text-gray-500">({selectedColor})</span>}</p>
              <div className="flex flex-wrap gap-3">
                {product.colors.map((c) => {
                  const name = c.name || c;
                  const code = c.code || '';
                  const active = selectedColor === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => setSelectedColor(name)}
                      className="flex flex-col items-center gap-1 w-12"
                    >
                      <span
                        className={`w-9 h-9 rounded-full border-2 transition flex items-center justify-center ${
                          active
                            ? 'border-primary-700 dark:border-gold-400 scale-110 shadow'
                            : 'border-gray-300 dark:border-[#2a3b30]'
                        }`}
                        style={code ? { backgroundColor: code } : undefined}
                      >
                        {!code && <span className="text-[10px] px-1 truncate">{name}</span>}
                      </span>
                      <span className={`text-[11px] leading-tight text-center break-words max-w-full ${active ? 'font-semibold' : 'text-gray-500'}`}>
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {product.description && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Quantity + Add */}
          {product.stock > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center border rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 hover:bg-gray-50"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="p-3 hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button onClick={handleAddToCart} className="btn-primary flex-1 py-3">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </button>
              <button type="button" onClick={handleWishlist} className={`btn-outline p-3 ${liked ? 'text-red-500 border-red-200' : ''}`}>
                <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
              </button>
            </div>
          )}

          {product.videos?.length > 0 && (
            <div className="space-y-2 mb-4">
              {product.videos.map((v, i) => (
                <OptimizedVideo
                  key={i}
                  src={typeof v === 'string' ? v : (v.url || v.mp4)}
                  publicId={typeof v === 'object' ? v.publicId : undefined}
                  hls={typeof v === 'object' ? (v.hls || v.variants?.hls) : undefined}
                  poster={typeof v === 'object' ? (v.poster || v.variants?.poster) : undefined}
                  preferHls
                  hlsConfig="detail"
                  preset="detail"
                  className="w-full rounded-xl bg-black max-h-56"
                />
              ))}
            </div>
          )}

          {product.sku && (
            <p className="text-xs text-gray-400">SKU: {product.sku}</p>
          )}
        </div>
      </div>

      {/* Ratings & Reviews — separate full-width section below */}
      <div id="reviews" className="card p-5 sm:p-6 mt-8 scroll-mt-24">
        <h2 className="font-semibold text-lg mb-4">Ratings & Reviews</h2>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Summary + write */}
          <div>
            <div className="flex items-center gap-4 mb-5">
              <div className="text-center">
                <p className="text-4xl font-bold">{(summary.avg || 0).toFixed(1)}</p>
                <Stars value={summary.avg || 0} size={16} />
                <p className="text-xs text-gray-500 mt-1">{summary.count || 0} reviews</p>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((s) => {
                  const c = summary.distribution?.find((d) => d._id === s)?.count || 0;
                  const pct = summary.count ? Math.round((c / summary.count) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-gray-500">{s}</span>
                      <div className="flex-1 h-2 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div className="h-full bg-gold-400 rounded" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-gray-500">{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleReviewSubmit} className="border-t border-[#e5e2da] dark:border-[#2a3b30] pt-4">
              <p className="text-sm font-medium mb-2">{myReviewId ? 'Update your review' : 'Write a review'}</p>
              <Stars value={myRating} onRate={setMyRating} size={26} className="mb-2" />
              <textarea
                className="input mb-2"
                rows={2}
                placeholder="Kemon laglo product ta? (optional)"
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
              />
              <div className="flex gap-2 items-center">
                <button type="submit" disabled={submitting} className="btn-primary text-sm">
                  {submitting ? 'Submitting…' : myReviewId ? 'Update Review' : 'Submit Review'}
                </button>
                {myReviewId && (
                  <button type="button" onClick={() => handleReviewDelete(myReviewId)} className="text-xs text-red-500 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List — top rated first, max 3 */}
          <div className="lg:col-span-2 space-y-4">
            {reviews.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No reviews yet — be the first!</p>
            )}
            {reviews.map((r) => (
              <div key={r._id} className="flex gap-3 p-4 rounded-xl border border-[#e5e2da] dark:border-[#2a3b30]">
                {r.user?.avatar ? (
                  <img src={r.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-700 text-white flex items-center justify-center font-bold flex-shrink-0">
                    {r.user?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{r.user?.name || 'Customer'}</span>
                    {r.verifiedPurchase && (
                      <span className="text-[10px] bg-green-100 dark:bg-success/15 text-green-700 dark:text-success px-1.5 py-0.5 rounded-full font-medium">
                        Verified Purchase
                      </span>
                    )}
                    <Stars value={r.rating} size={13} />
                    <span className="text-[11px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{r.comment}</p>}
                </div>
              </div>
            ))}
            {!reviewsExpanded && reviewsTotal > 3 && (
              <button
                type="button"
                onClick={() => loadReviews(product._id, 100)}
                className="btn-outline w-full text-sm"
              >
                Show More Reviews ({reviewsTotal - reviews.length} more)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </>
  );
}

// Lightweight inline brand icons (no icon-font weight, latest 𝕏 logo)
const BrandIcon = ({ d, className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d={d} />
  </svg>
);
const FB_PATH = 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z';
const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';
const X_PATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const MSG_PATH = 'M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.559 6.963z';

function ShareMenu({ url, title, onClose }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title || 'Check this out');
  const fbAppId = import.meta.env.VITE_FACEBOOK_APP_ID || '';
  const xRecipient = import.meta.env.VITE_X_RECIPIENT_ID || '';

  const copy = async (msg) => {
    try { await navigator.clipboard.writeText(url); toast.success(msg || 'Link copied!'); }
    catch { toast.error('Copy failed'); }
  };

  // Messenger chat needs a Facebook App ID (free, developers.facebook.com).
  // Without it: copy the link so the user can paste it in any chat.
  const onMessenger = (e) => {
    if (!fbAppId) {
      e.preventDefault();
      copy('Link copied — paste it in Messenger chat');
    }
    onClose();
  };
  const messengerHref = fbAppId
    ? `https://www.facebook.com/dialog/send?app_id=${fbAppId}&link=${u}&redirect_uri=${u}`
    : url;

  // X chat (DM) needs the brand numeric user ID; otherwise fall back to post intent.
  const xHref = xRecipient
    ? `https://x.com/messages/compose?recipient_id=${xRecipient}&text=${t}%20${u}`
    : `https://x.com/intent/tweet?url=${u}&text=${t}`;

  const chats = [
    { label: 'Messenger', href: messengerHref, onClick: onMessenger, bg: 'bg-gradient-to-br from-[#00B2FF] to-[#006AFF]', d: MSG_PATH },
    { label: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}`, onClick: onClose, bg: 'bg-[#25D366]', d: WA_PATH },
    { label: 'X Chat', href: xHref, onClick: onClose, bg: 'bg-black dark:bg-white', fg: 'text-white dark:text-black', d: X_PATH },
  ];
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute right-0 top-12 z-30 bg-white dark:bg-[#12241a] rounded-2xl shadow-xl border border-[#e5e2da] dark:border-[#2a3b30] p-3 w-48">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-xs font-semibold text-gray-500">Share in chat</p>
          <button type="button" aria-label="Close share" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-between px-1">
          {chats.map(({ label, href, onClick, bg, fg, d }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label === 'Messenger' && !fbAppId ? 'App ID বসালে direct chat — এখন copy হবে' : `Send via ${label}`}
              onClick={onClick}
              className="flex flex-col items-center gap-1"
            >
              <span className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center hover:scale-105 active:scale-95 transition shadow`}>
                <BrandIcon d={d} className={`w-5 h-5 ${fg || 'text-white'}`} />
              </span>
              <span className="text-[10px] text-gray-500">{label}</span>
            </a>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { copy(); onClose(); }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 transition"
        >
          <Link2 className="w-3.5 h-3.5" /> Copy link
        </button>
      </div>
    </>
  );
}
