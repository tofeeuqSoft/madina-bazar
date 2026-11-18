import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-primary-900 text-primary-100 mt-auto">
      <div className="container-app py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <img src="/logo.jpeg" alt="Madina Bazar" className="h-12 w-12 rounded-full object-contain bg-white" />
              <div>
                <h3 className="text-white font-bold text-lg">Madina Bazar</h3>
                <p className="text-gold-400 text-xs">মদিনার বরকত, আপনার ঘরে</p>
              </div>
            </div>
            <p className="text-sm text-primary-200/90 leading-relaxed">
              Fresh grocery & ready-to-cook items delivered to your doorstep in Mirpur, Dhaka.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/shop" className="hover:text-gold-300">All Products</Link></li>
              <li><Link to="/shop?type=GROCERY" className="hover:text-gold-300">Grocery</Link></li>
              <li><Link to="/shop?type=READY_TO_COOK" className="hover:text-gold-300">Ready to Cook</Link></li>
              <li><Link to="/combos" className="hover:text-gold-300">Combo Packs</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Account</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/orders" className="hover:text-gold-300">My Orders</Link></li>
              <li><Link to="/wishlist" className="hover:text-gold-300">Wishlist</Link></li>
              <li><Link to="/cart" className="hover:text-gold-300">Cart</Link></li>
              <li><Link to="/login" className="hover:text-gold-300">Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Contact</h4>
            <ul className="space-y-2 text-sm text-primary-200">
              <li>Mirpur, Dhaka</li>
              <li>www.madinabazar.com</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-primary-700/50 mt-8 pt-6 text-center text-xs text-primary-300">
          <p>&copy; {new Date().getFullYear()} Madina Bazar. All rights reserved.</p>
        </div>
      </div>
      {/* Space for mobile bottom nav */}
      <div className="h-16 md:hidden" />
    </footer>
  );
}
