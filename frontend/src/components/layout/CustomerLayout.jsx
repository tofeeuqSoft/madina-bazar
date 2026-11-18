import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import SupportWidget from '../support/SupportWidget';

export default function CustomerLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full pb-4 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
      <SupportWidget />
    </div>
  );
}
