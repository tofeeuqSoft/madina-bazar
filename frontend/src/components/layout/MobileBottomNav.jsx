import { Link, useLocation } from 'react-router-dom';
import { Home, Store, ShoppingCart, Heart, User } from 'lucide-react';
import useCartStore from '../../store/cartStore';
import useAuthStore from '../../store/authStore';
import useT from '../../hooks/useT';

export default function MobileBottomNav() {
  const location = useLocation();
  const itemCount = useCartStore((s) => s.getItemCount());
  const { isAuthenticated } = useAuthStore();
  const t = useT();

  if (location.pathname.startsWith('/admin')) return null;

  const items = [
    { to: '/', icon: Home, label: t('home') },
    { to: '/shop', icon: Store, label: t('shop') },
    { to: '/cart', icon: ShoppingCart, label: t('cart'), badge: true },
    { to: '/wishlist', icon: Heart, label: t('wishlist') },
    { to: '/orders', icon: User, label: t('account') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-[#12241a] border-t border-primary-100 dark:border-primary-900 pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.15)]">
      <div className="flex items-stretch justify-around h-12">
        {items.map((item) => {
          const to = item.to === '/orders' && !isAuthenticated ? '/login' : item.to;
          const active =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={to}
              className={`relative flex flex-col items-center justify-center flex-1 gap-0 text-[9px] font-medium ${
                active ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <span className="relative">
                <Icon className={`w-4.5 h-4.5 w-[18px] h-[18px] ${active ? 'stroke-[2.5]' : ''}`} />
                {item.badge && itemCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-gold-500 text-white text-[8px] min-w-[12px] h-3 rounded-full flex items-center justify-center px-0.5">
                    {itemCount}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
