# SEO & Social Marketing — Madina Bazar

## Implemented
- Meta title / description / keywords (Bangla + English)
- Open Graph (Facebook, WhatsApp share)
- Twitter Cards
- JSON-LD: Organization, WebSite, LocalBusiness, Product
- `robots.txt` + `sitemap.xml`
- PWA manifest
- Dynamic per-page SEO component
- Canonical URLs
- noindex on cart/checkout/login

## After go-live
1. Google Search Console → submit `https://www.madinabazar.com/sitemap.xml`
2. Facebook Sharing Debugger → scrape homepage + product URLs
3. Add real Facebook / Instagram URLs in `index.html` `sameAs`
4. Create a **1200×630** OG image (logo + tagline) as `/og-cover.jpg` for better share previews
5. Optional: Google Business Profile for Mirpur store

## Social post tips
- Always share product or homepage URL (OG tags auto-fill)
- Hashtags: #MadinaBazar #মিরপুর #অনলাইনবাজার #GroceryDelivery
- WhatsApp status: use homepage link
- Post daily deals with `/shop` links

## Note on SPA SEO
Crawlers that execute JS will see meta updates. For maximum SEO, consider prerender or SSR later (e.g. Vite SSG).
