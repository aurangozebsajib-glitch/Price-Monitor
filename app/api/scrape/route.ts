import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ScrapeError, scrapeProductUrl } from "@/lib/scraper";

export const runtime = "nodejs";
export const maxDuration = 30;

type StoreName = "Star Tech" | "Daraz";

const storeDetails: Record<
  StoreName,
  { slug: string; country_code: string; store_type: string; website_url: string }
> = {
  "Star Tech": {
    slug: "star-tech",
    country_code: "BD",
    store_type: "retailer",
    website_url: "https://www.startech.com.bd",
  },
  Daraz: {
    slug: "daraz",
    country_code: "BD",
    store_type: "marketplace",
    website_url: "https://www.daraz.com.bd",
  },
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const url =
    body && typeof body === "object" && "url" in body &&
    typeof body.url === "string"
      ? body.url.trim()
      : "";
  if (!url) {
    return jsonError("Provide a product URL.", 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonError("Sign in to track products.", 401);
  }

  try {
    const scraped = await scrapeProductUrl(url);
    const storeDetailsForProduct = storeDetails[scraped.store];

    const { data: existingStore, error: lookupStoreError } = await supabase
      .from("stores")
      .select("id, name, slug")
      .eq("slug", storeDetailsForProduct.slug)
      .maybeSingle();
    if (lookupStoreError) {
      console.error("Could not look up scraper store:", lookupStoreError.message);
      return jsonError("Could not access the store catalog.", 500);
    }

    let store = existingStore;
    if (!store) {
      const { data: insertedStore, error: insertStoreError } = await supabase
        .from("stores")
        .insert({
          name: scraped.store,
          ...storeDetailsForProduct,
        })
        .select("id, name, slug")
        .single();

      if (insertStoreError || !insertedStore) {
        console.error("Could not insert scraper store:", insertStoreError?.message);
        return jsonError(
          "Could not create the store. Check store-catalog access policies.",
          500,
        );
      }
      store = insertedStore;
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .upsert(
        {
          user_id: user.id,
          store_id: store.id,
          url: scraped.url,
          title: scraped.title,
          image_url: scraped.image,
          current_price: scraped.currentPrice,
          original_price: scraped.originalPrice,
          is_out_of_stock: scraped.isOutOfStock,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,url" },
      )
      .select("id, user_id, store_id, url, title, image_url, current_price, original_price, is_out_of_stock")
      .single();
    if (productError || !product) {
      console.error("Could not save scraped product:", productError?.message);
      return jsonError("Could not save the product. Check the Supabase schema and access policies.", 500);
    }

    if (scraped.currentPrice !== null) {
      const checkedAt = new Date().toISOString();
      const { error: priceError } = await supabase
        .from("product_prices")
        .upsert(
          {
            product_id: product.id,
            user_id: user.id,
            current_price: scraped.currentPrice,
            original_price: scraped.originalPrice,
            currency: "BDT",
            is_out_of_stock: scraped.isOutOfStock,
            checked_at: checkedAt,
          },
          { onConflict: "product_id" },
        );
      if (priceError) {
        console.error("Could not update product price:", priceError.message);
        return jsonError("Product saved, but its current price could not be updated.", 500);
      }

      const { error: historyError } = await supabase.from("price_history").insert({
        product_id: product.id,
        user_id: user.id,
        price: scraped.currentPrice,
        original_price: scraped.originalPrice,
        currency: "BDT",
        recorded_at: checkedAt,
      });
      if (historyError) {
        console.error("Could not append price history:", historyError.message);
        return jsonError("Product price updated, but price history could not be recorded.", 500);
      }
    }

    return NextResponse.json({
      products: [
        {
          _id: product.id,
          url: product.url,
          title: product.title,
          store: store.name,
          storeInfo: store,
          currentPrice: scraped.currentPrice,
          originalPrice: scraped.originalPrice,
          image: product.image_url,
          isOutOfStock: product.is_out_of_stock,
          priceHistory:
            scraped.currentPrice === null
              ? []
              : [{ price: scraped.currentPrice, date: new Date().toISOString() }],
        },
      ],
    });
  } catch (error) {
    if (error instanceof ScrapeError) {
      return jsonError(error.message, 502);
    }
    console.error("Product scrape failed:", error);
    return jsonError("Unable to scrape the product right now.", 500);
  }
}
