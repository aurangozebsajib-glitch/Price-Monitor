# Price-Monitor

## Pricewise dashboard

This repository includes a Next.js App Router dashboard styled with Tailwind CSS.
The dashboard is currently a UI prototype: its price-drop cards use sample data,
and adding a product URL creates a local preview rather than fetching live prices.

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To create a production build,
run `npm run build`.

The project can be imported into Vercel as a Next.js application; use the default
build command and output settings.

### MongoDB Atlas

The Mongoose product model and connection helper are in `lib/models/Product.js`
and `lib/mongoose.js`. Set `MONGODB_URI` to your MongoDB Atlas connection string
in the local environment and in the Vercel project environment settings before
calling the connection helper. Do not commit the connection string.

### Product search and tracking API

- `POST /api/scrape` accepts `{ "url": "https://..." }` to scrape and save a
  Star Tech or Daraz product, or `{ "query": "..." }` to search both stores.
- `GET /api/search?q=...` searches stored product titles first and scrapes both
  stores when no stored products match.

The API uses server-side HTML/JSON-LD parsing and stores price changes in the
product's history. Store pages can change their markup or restrict automated
requests, so scraping results depend on each store's current availability and
page structure.