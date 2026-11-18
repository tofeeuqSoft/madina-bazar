import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useCartStore from '../store/cartStore';

export default function Wishlist() {
  const { isAuthenticated } = useAuthStore();
  const addToCart = useCartStore((s) => s.addToCart);
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadWishlist();
  }, [isAuthenticated]);

  const loadWishlist = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/wishlist');
      setProducts(data.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Wishlist load failed');
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (productId) => {
    try {
      await api.delete(`/wishlist/${productId}`);
      setProducts((prev) => prev.filter((p) => p._id !== productId));
      toast.success('Removed from wishlist');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  const handleAddToCart = async (product) => {
    // Variant products need size/color selection on details page
    if (product.sizes?.length || product.colors?.length) {
      toast('Please select size / color', { icon: '👆' });
      navigate(`/product/${product.slug || product._id}`);
      return;
    }
    const result = await addToCart(product, 1);
    if (result?.success) toast.success('কার্টে যোগ হয়েছে');
    else if (result?.message) toast.error(result.message);
  };

  if (loading) {
    return (
      <div className="container-app py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-primary-900 mb-6">Wishlist</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-square bg-primary-50" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-primary-50 rounded" />
                <div className="h-4 bg-primary-50 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="container-app py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-50 flex items-center justify-center">
          <Heart className="w-8 h-8 text-primary-300" />
        </div>
        <h2 className="text-xl font-semibold text-primary-900 mb-2">Wishlist খালি</h2>
        <p className="text-gray-500 mb-6 text-sm">পছন্দের পণ্য সেভ করুন পরের জন্য</p>
        <Link to="/shop" className="btn-primary">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="container-app py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold text-primary-900 mb-4 sm:mb-6">
        Wishlist ({products.length})
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {products.map((product) => {
          const price = product.salePrice || product.regularPrice;
          const image = product.images?.[0]?.url || product.images?.[0];

          return (
            <div key={product._id} className="card overflow-hidden">
              <Link to={`/product/${product.slug || product._id}`}>
                <div className="aspect-square bg-primary-50 relative">
                  {image ? (
                    <img src={image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🛒</div>
                  )}
                </div>
              </Link>
              <div className="p-3 sm:p-4">
                <Link to={`/product/${product.slug || product._id}`}>
                  <h3 className="font-medium text-sm line-clamp-2 hover:text-primary-700 mb-1">
                    {product.name}
                  </h3>
                </Link>
                <p className="text-primary-800 font-bold mb-2.5">৳{price}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock <= 0}
                    className="btn-primary flex-1 text-xs py-2"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(product._id)}
                    className="btn-outline p-2 text-red-500 border-red-200"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
