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

The `/api/test-db` route checks access to the seeded store catalog.
Run `npm run seed:products` to scrape and upsert popular products from Star Tech
and Daraz. The script reads the Supabase URL and publishable key from
`.env.local` and can be safely rerun.

### Product search and tracking API

- `POST /api/scrape` accepts `{ "url": "https://..." }`, scrapes a Star Tech or
  Daraz product, upserts the public product and current price, and appends a
  JSONB price-history record when a price is available.
- `GET /api/search?q=...` searches products sorted from lowest to highest price.
  When there are no database matches, it tries a bounded live search on Star
  Tech and Daraz and saves matching results for later searches.

Scraping uses server-side HTML/JSON-LD parsing. Store pages can change their
markup or restrict automated requests, so results depend on each store's current
availability and page structure.