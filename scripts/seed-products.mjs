import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { searchConfiguredStores } from "../lib/scrapers/staticScraper.ts";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before seeding.",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
const seedQueries = [
  "iPhone 15",
  "Samsung Galaxy S24",
  "Anker Soundcore R50i NC",
];
const { data: storeRows, error: storeError } = await supabase
  .from("stores")
  .select("*")
  .limit(1000);

if (storeError) {
  throw new Error(`Could not load scraper registry: ${storeError.message}`);
}
const storeProfiles = (storeRows ?? [])
  .filter((store) => store.scrape_enabled !== false && store.scrape_enabled !== "false")
  .map((store) => {
    const baseUrl = store.base_url ?? store.website_url;
    if (typeof baseUrl !== "string" || !store.name || !store.slug) return null;
    let normalizedBaseUrl;
    try {
      normalizedBaseUrl = new URL(baseUrl).origin;
    } catch {
      return null;
    }
    return {
      id: store.id ?? store.slug,
      name: store.name,
      slug: store.slug,
      type: store.scraper_type === "f-commerce" || store.type === "f-commerce"
        ? "f-commerce"
        : "ecommerce",
      topic: store.topic ?? "gadgets",
      base_url: normalizedBaseUrl,
      search_url_template:
        store.search_url_template ??
        store.search_url_pattern ??
        store.search_path ??
        "/search?q={query}",
      product_container_selector: store.product_container_selector ?? store.product_selector ?? null,
      product_link_selector: store.product_link_selector ?? store.link_selector ?? null,
      pagination_selector: store.pagination_selector ?? null,
      title_selector: store.title_selector ?? store.name_selector ?? null,
      price_selector: store.price_selector ?? null,
      image_selector: store.image_selector ?? null,
      availability_selector: store.availability_selector ?? null,
      scrape_enabled: true,
      crawl_priority: Number(store.crawl_priority) || 100,
    };
  })
  .filter(Boolean)
  .sort((left, right) => (left.crawl_priority ?? 100) - (right.crawl_priority ?? 100))
  .slice(0, 10);

async function seedQuery(query) {
  const scrapedProducts = await searchConfiguredStores(storeProfiles, query);
  const matchingProducts = scrapedProducts.filter((product) =>
    query
      .toLowerCase()
      .split(/\s+/)
      .every((term) => product.title.toLowerCase().includes(term)),
  );
  let savedCount = 0;

  for (const product of matchingProducts) {
    const { data: existing, error: lookupError } = await supabase
      .from("products")
      .select("current_price, price_history")
      .eq("url", product.url)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Could not check ${product.url}: ${lookupError.message}`);
    }

    const history = Array.isArray(existing?.price_history)
      ? existing.price_history
      : [];
    const samePrice =
      product.currentPrice !== null &&
      Number(existing?.current_price) === product.currentPrice;
    const priceHistory =
      product.currentPrice === null || samePrice
        ? history
        : [
            ...history,
            { price: product.currentPrice, date: new Date().toISOString() },
          ].slice(-100);
    const { error } = await supabase.from("products").upsert(
      {
        url: product.url,
        store: product.store,
        title: product.title,
        current_price: product.currentPrice,
        original_price: product.originalPrice,
        image: product.image,
        is_out_of_stock: product.isOutOfStock,
        price_history: priceHistory,
      },
      { onConflict: "url" },
    );

    if (error) {
      throw new Error(`Could not seed ${product.url}: ${error.message}`);
    }
    savedCount += 1;
  }

  return savedCount;
}

let totalSaved = 0;
let failedQueries = 0;

for (const query of seedQueries) {
  try {
    const savedCount = await seedQuery(query);
    totalSaved += savedCount;
    console.log(`${query}: saved ${savedCount} product(s)`);
  } catch (error) {
    failedQueries += 1;
    console.error(
      `${query}: ${error instanceof Error ? error.message : "Seeding failed."}`,
    );
  }
}

console.log(`Seed complete: ${totalSaved} product(s) saved.`);
if (failedQueries > 0) {
  process.exitCode = 1;
}
