import { useState, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore from '../../store/cartStore';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import useT from '../../hooks/useT';
import Stars from '../common/Stars';
import { productImage, cldSrcSet } from '../../utils/cloudinary';

function ProductCard({ product, onWishlistChange }) {
  const addToCart = useCartStore((s) => s.addToCart);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const t = useT();
  const [wishLoading, setWishLoading] = useState(false);
  const [liked, setLiked] = useState(false);

  const price = product.salePrice || product.regularPrice;
  const hasDiscount = product.salePrice && product.salePrice < product.regularPrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)
    : 0;
  const imageRaw = product.images?.[0]?.url || product.images?.[0] || null;
  const image = imageRaw ? productImage(product, 'card') : null;
  const srcSet = imageRaw ? cldSrcSet(imageRaw) : undefined;

  const handleAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock <= 0) return;
    // Variant products need size/color selection on details page
    if (product.sizes?.length || product.colors?.length) {
      toast('Please select size / color', { icon: '👆' });
      navigate(`/product/${product.slug || product._id}`);
      return;
    }
    const result = await addToCart(product, 1);
    if (result?.success) toast.success(t('addedToCart'));
    else if (result?.message) toast.error(result.message);
  };

  const handleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error('Wishlist এর জন্য login করুন');
      navigate('/login');
      return;
    }
    setWishLoading(true);
    try {
      if (liked) {
        await api.delete(`/wishlist/${product._id}`);
        setLiked(false);
        toast.success('Wishlist থেকে সরানো হয়েছে');
        onWishlistChange?.(product._id, false);
      } else {
        await api.post('/wishlist', { productId: product._id });
        setLiked(true);
        toast.success('Wishlist এ যোগ হয়েছে');
        onWishlistChange?.(product._id, true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('already')) {
        setLiked(true);
        toast.success('Already in wishlist');
      } else {
        toast.error(msg || 'Wishlist update failed');
      }
    } finally {
      setWishLoading(false);
    }
  };

  return (
    <div className="card product-card group overflow-hidden hover:shadow-md transition-shadow duration-300">
      <Link to={`/product/${product.slug || product._id}`} className="block relative">
        <div className="aspect-square bg-primary-50/50 relative overflow-hidden">
          {image ? (
            <img
              src={image}
              srcSet={srcSet}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-primary-200">
              <span className="text-4xl">🛒</span>
            </div>
          )}
          {hasDiscount && (
            <span className="absolute top-2 left-2 bg-gold-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full">
              -{discountPercent}%
            </span>
          )}
          <button
            type="button"
            disabled={wishLoading}
            onClick={handleWishlist}
            className={`absolute top-2 right-2 p-1.5 sm:p-2 rounded-full shadow-sm transition ${
              liked ? 'bg-red-500 text-white' : 'bg-white/90 text-primary-700 hover:bg-white'
            }`}
            aria-label="Wishlist"
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
          </button>
          {product.stock <= 0 && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">{t('outOfStock')}</span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-3 sm:p-4">
        <Link to={`/product/${product.slug || product._id}`}>
          <h3 className="font-medium text-gray-900 text-sm sm:text-base line-clamp-2 hover:text-primary-700 mb-1 min-h-[2.5rem]">
            {product.name}
          </h3>
        </Link>
        {product.unit && <p className="text-[11px] sm:text-xs text-gray-500 mb-1.5">{product.unit}</p>}
        {(product.ratingCount > 0) && (
          <div className="flex items-center gap-1 mb-1.5">
            <Stars value={product.ratingAvg || 0} size={12} />
            <span className="text-[10px] text-gray-500">({product.ratingCount})</span>
          </div>
        )}
        <div className="flex items-baseline gap-1.5 mb-2.5 flex-wrap">
          <span className="text-base sm:text-lg font-bold text-primary-800">৳{price}</span>
          {hasDiscount && (
            <span className="text-xs text-gray-400 line-through">৳{product.regularPrice}</span>
          )}
        </div>
        <button
          type="button"
          disabled={product.stock <= 0}
          className="btn-primary w-full text-xs sm:text-sm py-2"
          onClick={handleAdd}
        >
          <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {t('addToCart')}
        </button>
      </div>
    </div>
  );
}

export default memo(ProductCard);
