# Marketing Data Gap Analysis — Madina Bazar

> Read-only analytics never fabricates metrics. This doc records what exists,
> what is missing, and what to add (with approval) before CAC/ROAS-style
> marketing intelligence becomes possible.

## 1. Available today ✅

- Orders: revenue, AOV, status history, payment method, district/area, coupon code, timestamps
- Customers: registration date, repeat orders → RFM, cohorts, retention
- Products: margin (cost-aware), category share, slow movers
- Coupons: usage, revenue per ৳1 discount
- Shipments: own-vs-courier split, zone performance
- Carts: abandoned-cart value (items + stale timestamp)

## 2. Missing ❌ (blocks true marketing analytics)

| Gap | Impact | Fix (needs approval) |
|---|---|---|
| No `utm_source/medium/campaign` on orders | Cannot attribute any order to Meta/Google/organic | Add optional attribution fields to Order at checkout (migration-safe defaults) |
| No traffic funnel (views, add-to-cart, checkout-start) | No conversion rates, no CAC denominator | Lightweight event log collection (`analytics_events`) |
| No Meta Ads connection | No spend/impressions/clicks → no ROAS/CPA | Meta Marketing API ETL (Phase 2, Python or Node cron) |
| No campaign entity | Coupons are the only campaign proxy | `Campaign` model linking coupons + dates + budget |
| No customer consent record | SMS remarketing legally risky | Consent flag on User + opt-out |

## 3. Recommended future events (when approved)

`page_view → product_view → add_to_cart → checkout_start → purchase`
with `sessionId, utm_*, landingPage, referrer`. Store in a SEPARATE
`analytics_events` collection (TTL-indexed) — never in operational order flow.

## 4. What Phase 1 delivers without any of the above

Sales trends, AOV, RFM segments + CSV export, geo revenue, coupon ROI,
retention cohorts, abandoned-cart recovery list, best campaign hours,
data-quality gate. These need zero new tracking.
