import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Truck, Shield, Clock, Sparkles, TrendingUp, ChevronLeft, ChevronRight, QrCode, Play, Apple } from 'lucide-react';
import SEO from '../components/seo/SEO';
import useT from '../hooks/useT';
import api from '../services/api';
import { getCategories } from '../services/productService';

export default function Home() {
  const t = useT();
  const [parents, setParents] = useState([]);
  const [site, setSite] = useState({ newTileImage: '', trendingTileImage: '', heroSlides: [], playStoreUrl: '', appStoreUrl: '', appQrImage: '' });
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    // GROCERY is a separate part of the site — its categories never show
    // in this strip. Only non-grocery parent categories are listed.
    // (Category type is auto-maintained: GROCERY only under grocery root.)
    getCategories({ parent: 'null' })
      .then((r) => {
        const list = (r.data || []).filter(
          (c) => c.isActive !== false && String(c.type || '').toUpperCase() !== 'GROCERY'
        );
        list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        setParents(list);
      })
      .catch(() => {});
    api.get('/settings')
      .then(({ data }) => setSite({
        newTileImage: data.data?.newTileImage || '',
        trendingTileImage: data.data?.trendingTileImage || '',
        heroSlides: data.data?.heroSlides || [],
        playStoreUrl: data.data?.playStoreUrl || '',
        appStoreUrl: data.data?.appStoreUrl || '',
        appQrImage: data.data?.appQrImage || '',
      }))
      .catch(() => {});
  }, []);

  const slides = site.heroSlides || [];
  const [instant, setInstant] = useState(false);

  // Slide to index — wrap jumps (0 <-> last) are instant, no sweep
  const goSlide = (next) => {
    const n = slides.length;
    if (!n) return;
    const target = ((next % n) + n) % n;
    setInstant((target === 0 && slide === n - 1) || (target === n - 1 && slide === 0));
    setSlide(target);
  };

  useEffect(() => {
    if (!instant) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    return () => cancelAnimationFrame(id);
  }, [instant, slide]);

  // Auto-play rightward (new slide enters from left) every 3s
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setTimeout(() => {
      if (slide <= 0) {
        setInstant(true);
        setSlide(slides.length - 1);
      } else {
        setSlide(slide - 1);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [slide, slides.length]);

  return (
    <div>
      <SEO
        title="Fresh Grocery Delivery Mirpur"
        description="মদিনার বরকত, আপনার ঘরে — তাজা মুদি, রেডি-টু-কুক ও কম্বো প্যাক মিরপুরে দ্রুত ডেলিভারি।"
        path="/"
      />

      <section className="container-app pt-3 sm:pt-4">
        <div className="grid lg:grid-cols-6 gap-3">
          {/* 5/6 — Hero carousel (admin-uploaded images, slides left → right) */}
          <div className="lg:col-span-5 relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 h-[220px] sm:h-[300px] lg:h-[340px]">
            {slides.length > 0 ? (
              <>
                <div
                  className={`flex h-full ${instant ? '' : 'transition-transform duration-700 ease-in-out'}`}
                  style={{ transform: `translateX(-${slide * 100}%)` }}
                >
                  {slides.map((s, i) => {
                    const inner = (
                      <img
                        src={s.image}
                        alt={s.title || `Slide ${i + 1}`}
                        className="w-full h-full object-cover"
                        loading={i === 0 ? 'eager' : 'lazy'}
                        draggable={false}
                      />
                    );
                    return (
                      <div key={i} className="min-w-full h-full">
                        {s.link ? <Link to={s.link} className="block w-full h-full">{inner}</Link> : inner}
                      </div>
                    );
                  })}
                </div>
                {/* Arrows */}
                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => goSlide(slide - 1)}
                      className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur z-10"
                      aria-label="Previous"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => goSlide(slide + 1)}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur z-10"
                      aria-label="Next"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    {/* Dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                      {slides.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => goSlide(i)}
                          aria-label={`Slide ${i + 1}`}
                          className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-6 bg-gold-400' : 'w-1.5 bg-white/60 hover:bg-white'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              /* Fallback promo when admin hasn't uploaded slides */
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-8 right-8 w-32 h-32 rounded-full bg-gold-400 blur-3xl opacity-20 pointer-events-none" />
                <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-primary-400 blur-3xl opacity-20 pointer-events-none" />
                <div className="relative h-full flex flex-col items-start justify-center p-6 sm:p-10 text-white max-w-xl">
                  <img
                    src="/logo.jpeg"
                    alt="Madina Bazar"
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-contain bg-white/5 ring-1 ring-gold-400/30 mb-3"
                  />
                  <p className="text-gold-400 text-xs sm:text-sm font-medium mb-1.5">{t('tagline')}</p>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 leading-tight">
                    {t('heroTitle')}
                    <span className="block text-gold-300">{t('heroTitle2')}</span>
                  </h1>
                  <p className="text-primary-100/90 text-xs sm:text-sm mb-5 max-w-md leading-relaxed">
                    {t('heroDesc')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link to="/shop" className="btn-gold px-5 text-sm">
                      {t('shopNow')}
                    </Link>
                    <Link
                      to="/shop?type=READY_TO_COOK"
                      className="btn border border-white/25 text-white hover:bg-white/10 text-sm"
                    >
                      {t('readyToCook')}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 1/6 — Download App panel */}
          <div className="card p-4 flex lg:flex-col flex-row items-center gap-4 lg:gap-3 lg:text-center overflow-hidden">
            <div className="flex-1 lg:flex-none min-w-0">
              <p className="font-bold text-sm sm:text-base leading-tight">Download the App now!</p>
              <div className="mt-3 space-y-2">
                <a
                  href={site.playStoreUrl || undefined}
                  onClick={(e) => { if (!site.playStoreUrl) e.preventDefault(); }}
                  target={site.playStoreUrl ? '_blank' : undefined}
                  rel="noreferrer"
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-white text-xs font-semibold ${site.playStoreUrl ? 'bg-[#0e4430] hover:bg-[#1b5e3d]' : 'bg-gray-400 cursor-default'} transition`}
                >
                  <Play className="w-5 h-5 fill-current flex-shrink-0" />
                  <span className="leading-tight text-left">GET IT ON<br /><span className="text-sm">Google Play</span></span>
                </a>
                <a
                  href={site.appStoreUrl || undefined}
                  onClick={(e) => { if (!site.appStoreUrl) e.preventDefault(); }}
                  target={site.appStoreUrl ? '_blank' : undefined}
                  rel="noreferrer"
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-white text-xs font-semibold ${site.appStoreUrl ? 'bg-black hover:bg-gray-800' : 'bg-gray-400 cursor-default'} transition`}
                >
                  <Apple className="w-5 h-5 fill-current flex-shrink-0" />
                  <span className="leading-tight text-left">Download on the<br /><span className="text-sm">App Store</span></span>
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg border-2 border-primary-600 dark:border-gold-400 overflow-hidden bg-white flex items-center justify-center">
                {site.appQrImage ? (
                  <img src={site.appQrImage} alt="App QR" className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="w-10 h-10 text-primary-700" />
                )}
              </div>
              <p className="text-[11px] sm:text-xs font-bold leading-tight">Scan the<br />QR CODE<br />NOW</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-app py-6 sm:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            { icon: Truck, title: t('features.delivery'), desc: t('features.deliveryDesc') },
            { icon: Shield, title: t('features.quality'), desc: t('features.qualityDesc') },
            { icon: Clock, title: t('features.easy'), desc: t('features.easyDesc') },
            { icon: ShoppingBag, title: t('features.price'), desc: t('features.priceDesc') },
          ].map((item, i) => (
            <div key={i} className="card p-3 sm:p-4 text-center">
              <div className="w-8 h-8 sm:w-9 sm:h-9 mx-auto mb-1.5 rounded-full bg-primary-50 dark:bg-primary-900/50 flex items-center justify-center">
                <item.icon className="w-4 h-4 text-primary-700 dark:text-primary-300" />
              </div>
              <h3 className="font-semibold text-xs sm:text-sm text-primary-900 dark:text-primary-50">{item.title}</h3>
              <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-app pb-8 sm:pb-10">
        <h2 className="text-base sm:text-lg font-bold text-primary-900 dark:text-primary-50 mb-3">
          {t('shopByCategory')}
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
          {/* 1 — New arrivals (latest uploaded first, all types) */}
          <Link
            to="/shop?sort=-createdAt&scope=all"
            className="card p-3 text-center hover:border-gold-400/60 transition group border-gold-400/30"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gold-400/15 rounded-full mx-auto mb-1.5 flex items-center justify-center overflow-hidden group-hover:scale-105 transition">
              {site.newTileImage ? (
                <img src={site.newTileImage} alt="New" className="w-full h-full object-cover" />
              ) : (
                <Sparkles className="w-5 h-5 text-gold-600 dark:text-gold-300" />
              )}
            </div>
            <h3 className="font-semibold text-[11px] sm:text-xs text-gold-700 dark:text-gold-300">{t('newArrivals')}</h3>
          </Link>
          {/* 2 — Trending (most ordered first, all types) */}
          <Link
            to="/shop?sort=-soldCount&scope=all"
            className="card p-3 text-center hover:border-gold-400/60 transition group border-gold-400/30"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gold-400/15 rounded-full mx-auto mb-1.5 flex items-center justify-center overflow-hidden group-hover:scale-105 transition">
              {site.trendingTileImage ? (
                <img src={site.trendingTileImage} alt="Trending" className="w-full h-full object-cover" />
              ) : (
                <TrendingUp className="w-5 h-5 text-gold-600 dark:text-gold-300" />
              )}
            </div>
            <h3 className="font-semibold text-[11px] sm:text-xs text-gold-700 dark:text-gold-300">{t('trending')}</h3>
          </Link>
          {/* Admin parent categories */}
          {parents.map((cat) => (
            <Link
              key={cat._id}
              to={`/shop?category=${cat._id}`}
              className="card p-3 text-center hover:border-gold-400/50 transition group"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary-50 dark:bg-primary-900/40 rounded-full mx-auto mb-1.5 flex items-center justify-center overflow-hidden group-hover:scale-105 transition">
                {cat.image ? (
                  <img src={cat.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-primary-700 dark:text-primary-200">
                    {cat.name?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <h3 className="font-medium text-[11px] sm:text-xs text-primary-900 dark:text-primary-100 truncate">{cat.name}</h3>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-primary-50 dark:bg-primary-950/50 py-8 sm:py-10">
        <div className="container-app text-center">
          <h2 className="text-base sm:text-lg font-bold text-primary-900 dark:text-primary-50 mb-1">
            {t('readyToOrder')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-4">{t('readyToOrderDesc')}</p>
          <Link to="/shop" className="btn-primary px-6 text-sm">
            {t('startShopping')}
          </Link>
        </div>
      </section>
    </div>
  );
}
