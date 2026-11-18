import { useEffect } from 'react';

const SITE = 'https://www.madinabazar.com';
const DEFAULT_IMAGE = `${SITE}/logo.jpeg`;
const SITE_NAME = 'Madina Bazar';

function upsertMeta(attr, key, content) {
  if (content == null || content === '') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * Dynamic SEO for SPA pages — ideal for social share (FB, WhatsApp, Twitter)
 */
export default function SEO({
  title,
  description,
  path = '/',
  image,
  type = 'website',
  noindex = false,
  jsonLd,
}) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} | Madina Bazar`
      : 'Madina Bazar | মদিনার বরকত, আপনার ঘরে';
    const desc =
      description ||
      'মিরপুরে তাজা মুদি ও রেডি-টু-কুক পণ্য — দ্রুত ডেলিভারি। Madina Bazar online grocery.';
    const url = `${SITE}${path.startsWith('/') ? path : `/${path}`}`;
    const img = image
      ? image.startsWith('http')
        ? image
        : `${SITE}${image.startsWith('/') ? image : `/${image}`}`
      : DEFAULT_IMAGE;

    document.title = fullTitle;

    upsertMeta('name', 'description', desc);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', img);
    upsertMeta('property', 'og:image:alt', fullTitle);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', desc);
    upsertMeta('name', 'twitter:image', img);

    upsertLink('canonical', url);

    if (jsonLd) {
      upsertJsonLd('seo-jsonld-page', jsonLd);
    }

    return () => {
      const pageLd = document.getElementById('seo-jsonld-page');
      if (pageLd) pageLd.remove();
    };
  }, [title, description, path, image, type, noindex, jsonLd]);

  return null;
}

export { SITE, DEFAULT_IMAGE };
