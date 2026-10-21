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
publishable key in the ignored `.env.local` file. The public search and tracking
APIs use the publishable key, so the active Supabase schema must allow anonymous
reads and product inserts/updates through RLS. The live products table stores
the current price and JSONB `price_history` on each product row.

`supabase-schema.sql` describes a different, authenticated-user schema with
separate `product_prices` and `price_history` tables. Reconcile that schema with
the live public products schema before applying it to the active project.

The `/api/test-db` route checks access to the store catalog. Apply
[`supabase-store-registry.sql`](./supabase-store-registry.sql) to add the
configurable scraper fields and seed ten local tech-store profiles before
enabling live fallback search. Each profile stores its store type/topic, URL
template, product selectors, enablement, and crawl priority. Profiles are
loaded in rotating batches of ten stores, and each search is bounded to two
pages and two products per store. F-commerce storefronts can use the same
registry when they provide a public HTTPS storefront and a searchable URL;
Facebook pages that require sign-in or block scraping are not assumed to be
available.

Run `npm run seed:products` to scrape configured store profiles for the
popular-product seed queries. The script reads the Supabase URL and publishable
key from `.env.local` and can be safely rerun.

### Product search and tracking API

- `POST /api/scrape` accepts `{ "url": "https://..." }`, scrapes a product from
  an enabled store profile, upserts the public product and current price, and appends a
  JSONB price-history record when a price is available.
- `GET /api/search?q=...` searches products sorted from lowest to highest price.
  When there are fewer than ten database matches, it tries a bounded live
  search over a rotating batch of configured stores and saves matching results
  for later searches.

Scraping prefers schema.org Product JSON-LD, then OpenGraph metadata, then the
configured CSS selectors. Store pages can change markup or restrict automated
requests, so selectors/search URL templates should be verified and maintained
in the registry. The live Supabase schema differs from `supabase-schema.sql`;
apply the additive registry migration to the live schema rather than applying
the full authenticated-user schema there.