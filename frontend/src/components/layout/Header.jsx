import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Heart, User, Search, Menu, X, LogOut, Package,
  LayoutDashboard, Sun, Moon, Languages, ChevronDown,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useCartStore from '../../store/cartStore';
import useUIStore from '../../store/uiStore';
import useT from '../../hooks/useT';
import SmartSearch from '../common/SmartSearch';
import api from '../../services/api';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const itemCount = useCartStore((s) => s.getItemCount());
  const { theme, toggleTheme, lang, toggleLang } = useUIStore();
  const t = useT();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    navigate('/');
  };

  const doSearch = (e) => {
    e?.preventDefault();
    if (search.trim()) {
      navigate(`/shop?search=${encodeURIComponent(search.trim())}`);
      setMobileOpen(false);
    }
  };

  const isStaff = ['SUPER_ADMIN', 'SUB_ADMIN', 'ORDER_MANAGER', 'INVENTORY_MANAGER'].includes(user?.role);

  // Grocery sub-categories for the Grocery dropdown (dynamic)
  const [grocerySubs, setGrocerySubs] = useState([]);
  useEffect(() => {
    api.get('/categories/tree')
      .then(({ data }) => {
        const roots = data.data || [];
        const grocery = roots.find((c) => c.slug === 'grocery');
        setGrocerySubs((grocery?.children || []).filter((c) => c.isActive !== false));
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-primary-100/80 bg-white/95 dark:bg-[#12241a]/95 dark:border-primary-900 backdrop-blur">
      <div className="hidden sm:block bg-primary-900 text-primary-100 text-center text-[11px] py-1 tracking-wide">
        {t('tagline')} · {t('freeDelivery')}
      </div>

      <div className="container-app">
        <div className="flex items-center justify-between gap-2 py-2">
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/50 text-primary-800 dark:text-primary-100"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2 min-w-0 shrink-0">
            <img src="/logo.jpeg" alt="Madina Bazar" className="h-9 w-9 sm:h-10 sm:w-10 object-contain rounded-full ring-1 ring-primary-200 dark:ring-primary-700" />
            <div className="min-w-0 hidden xs:block sm:block">
              <h1 className="text-sm sm:text-base font-bold text-primary-800 dark:text-primary-50 leading-tight truncate">
                Madina Bazar
              </h1>
              <p className="hidden sm:block text-[10px] text-gold-600 dark:text-gold-400 font-medium truncate">
                {t('tagline')}
              </p>
            </div>
          </Link>

          <div className="hidden md:block flex-1 max-w-md mx-3">
            <SmartSearch />
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={toggleLang}
              className="p-1.5 rounded-lg text-[11px] font-bold text-primary-800 dark:text-primary-100 hover:bg-primary-50 dark:hover:bg-primary-900/50 min-w-[36px]"
              title={t('language')}
            >
              {lang === 'bn' ? 'EN' : 'বাং'}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-primary-800 dark:text-primary-100 hover:bg-primary-50 dark:hover:bg-primary-900/50"
              title={t('theme')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link to="/wishlist" className="relative p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/50 text-primary-800 dark:text-primary-100">
              <Heart className="w-5 h-5" />
            </Link>
            <Link to="/cart" className="relative p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/50 text-primary-800 dark:text-primary-100">
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute top-0 right-0 bg-gold-500 text-white text-[9px] font-bold min-w-[14px] h-3.5 rounded-full flex items-center justify-center px-0.5">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <div className="relative group hidden sm:block">
                <button type="button" className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/50 text-primary-800 dark:text-primary-100">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span className="text-xs font-medium max-w-[80px] truncate">{user?.name}</span>
                </button>
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#12241a] rounded-lg shadow-lg border border-primary-100 dark:border-primary-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1 text-sm">
                  <Link to="/account" className="flex items-center gap-2 px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/40">
                    <User className="w-3.5 h-3.5" /> My Account
                  </Link>
                  <Link to="/orders" className="flex items-center gap-2 px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/40">
                    <Package className="w-3.5 h-3.5" /> {t('orders')}
                  </Link>
                  {isStaff && (
                    <Link to="/admin" className="flex items-center gap-2 px-3 py-2 text-gold-600 dark:text-gold-400 font-medium hover:bg-primary-50 dark:hover:bg-primary-900/40">
                      <LayoutDashboard className="w-3.5 h-3.5" /> {t('adminPanel')}
                    </Link>
                  )}
                  <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                    <LogOut className="w-3.5 h-3.5" /> {t('logout')}
                  </button>
                </div>
              </div>
            ) : (
              <Link to="/login" className="btn-primary text-xs py-1.5 px-2.5 ml-0.5">
                {t('login')}
              </Link>
            )}
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-0.5 pb-2 border-t border-primary-50 dark:border-primary-900/50 pt-1.5 text-xs font-medium">
          <Link to="/" className="px-2.5 py-1 rounded-md text-primary-800/80 dark:text-primary-200 hover:bg-primary-50 dark:hover:bg-primary-900/40">
            {t('home')}
          </Link>
          <Link to="/shop" className="px-2.5 py-1 rounded-md text-primary-800/80 dark:text-primary-200 hover:bg-primary-50 dark:hover:bg-primary-900/40">
            {t('shop')}
          </Link>
          {/* Grocery with submenu: All Grocery / Ready to Cook / Combos */}
          <div className="relative group">
            <Link
              to="/shop?type=GROCERY"
              className="flex items-center gap-0.5 px-2.5 py-1 rounded-md text-primary-800/80 dark:text-primary-200 hover:bg-primary-50 dark:hover:bg-primary-900/40"
            >
              {t('grocery')}
              <ChevronDown className="w-3 h-3" />
            </Link>
            <div className="absolute left-0 top-full pt-1 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="bg-white dark:bg-[#12241a] rounded-lg shadow-lg border border-primary-100 dark:border-primary-800 py-1 text-sm max-h-80 overflow-y-auto">
                {grocerySubs.map((sub) => (
                  <Link
                    key={sub._id}
                    to={`/shop?category=${sub._id}`}
                    className="block px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/40 text-[13px]"
                  >
                    {sub.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[min(100%,18rem)] bg-white dark:bg-[#12241a] shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-primary-100 dark:border-primary-800">
              <div className="flex items-center gap-2">
                <img src="/logo.jpeg" alt="" className="h-8 w-8 rounded-full" />
                <span className="font-bold text-sm text-primary-800 dark:text-primary-50">Madina Bazar</span>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-primary-100 dark:border-primary-800">
              <SmartSearch onNavigate={() => setMobileOpen(false)} />
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 text-sm">
              {[
                { to: '/', label: t('home') },
                { to: '/shop', label: t('shopAll') },
              ].map((item) => (
                <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/40 font-medium">
                  {item.label}
                </Link>
              ))}
              {/* Grocery group — sub-categories only */}
              <p className="px-3 pt-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('grocery')}</p>
              {grocerySubs.map((s) => (
                <Link key={s._id} to={`/shop?category=${s._id}`} onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 ml-3 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/40 font-medium border-l-2 border-gold-400/60">
                  {s.name}
                </Link>
              ))}
              {[
                { to: '/wishlist', label: t('wishlist') },
                { to: '/cart', label: t('cart') },
                { to: '/account', label: 'My Account' },
                { to: '/orders', label: t('orders') },
              ].map((item) => (
                <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/40 font-medium">
                  {item.label}
                </Link>
              ))}
              {isStaff && (
                <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-gold-600 dark:text-gold-400 bg-gold-50/50 dark:bg-gold-950/20 font-semibold">
                  {t('adminPanel')}
                </Link>
              )}
            </nav>
            <div className="p-3 border-t border-primary-100 dark:border-primary-800 flex gap-2 pb-safe">
              <button type="button" onClick={toggleLang} className="btn-outline flex-1 text-xs py-2">
                {lang === 'bn' ? 'English' : 'বাংলা'}
              </button>
              <button type="button" onClick={toggleTheme} className="btn-outline flex-1 text-xs py-2">
                {theme === 'dark' ? t('light') : t('dark')}
              </button>
            </div>
            <div className="px-3 pb-3">
              {isAuthenticated ? (
                <button type="button" onClick={handleLogout} className="btn-outline w-full text-xs text-red-500 border-red-200 dark:border-red-900">
                  {t('logout')} ({user?.name})
                </button>
              ) : (
                <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-primary w-full text-xs">
                  {t('login')}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
