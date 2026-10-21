import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { searchStoreProducts } from "../lib/scraper.ts";

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

async function seedQuery(query) {
  const scrapedProducts = await searchStoreProducts(query);
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
