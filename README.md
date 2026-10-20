# Price-Monitor

## Pricewise dashboard

This repository includes a Next.js App Router dashboard styled with Tailwind CSS.
The dashboard includes sample offers and uses the tracking/search APIs for live
results.

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To create a production build,
run `npm run build`.

The project can be imported into Vercel as a Next.js application; use the default
build command and output settings.

### Supabase

Browser, server, and session-refresh clients are in `utils/supabase/`, with
`lib/supabase.ts` used by server-side API routes. Set the Supabase URL and
publishable key in the ignored `.env.local` file. Apply `supabase-schema.sql` in
the Supabase SQL Editor to create the stores, products, product_prices, and
price_history tables, their RLS policies, and the store seed data. Product and
price access is restricted to the owning authenticated user; only the store
catalog is publicly readable.

The `/api/test-db` route checks access to the seeded store catalog.
The scrape and search routes require a signed-in Supabase user because tracked
product data is protected by row-level security.

### Product search and tracking API

- `POST /api/scrape` accepts `{ "url": "https://..." }`, scrapes a Star Tech or
  Daraz product, upserts the user's product and current price, and appends a
  price-history record when a price is available.
- `GET /api/search?q=...` searches the signed-in user's tracked products,
  including their store, latest price, and price-history records, sorted from
  lowest to highest price.

Scraping uses server-side HTML/JSON-LD parsing. Store pages can change their
markup or restrict automated requests, so results depend on each store's current
availability and page structure.