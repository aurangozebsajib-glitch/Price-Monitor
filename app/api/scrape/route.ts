import { NextResponse } from "next/server";
import { ScrapeError, scrapeProductUrl } from "@/lib/scraper";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Store = {
  id: string;
  name: string;
  slug: string;
  website_url: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function isStoreHost(hostname: string, websiteUrl: string | null): boolean {
  if (!websiteUrl) return false;
  try {
    const storeHost = new URL(websiteUrl).hostname.toLowerCase();
    const host = hostname.toLowerCase();
    return host === storeHost || host.endsWith(`.${storeHost}`);
  } catch {
    return false;
  }
}

async function scrape(urlInput: string, requestedStoreSlug?: string) {
  let url: URL;
  try {
    url = new URL(urlInput);
  } catch {
    return jsonError("Enter a valid product URL.", 400);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    urlInput.length > 2048
  ) {
    return jsonError("Only public HTTPS store URLs are supported.", 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonError("Sign in to track products.", 401);
  }

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id, name, slug, website_url");
  if (storesError) {
    console.error("Could not load supported stores:", storesError.message);
    return jsonError("Could not validate the store catalog.", 500);
  }

  const store = (stores as Store[]).find(
    (candidate) =>
      isStoreHost(url.hostname, candidate.website_url) &&
      (!requestedStoreSlug || candidate.slug === requestedStoreSlug),
  );
  if (!store) {
    return jsonError(
      requestedStoreSlug
        ? "The URL does not match the requested supported store."
        : "This store is not supported.",
      400,
    );
  }

  try {
    const scraped = await scrapeProductUrl(url.toString());
    const now = new Date().toISOString();
    const { data: existing, error: lookupError } = await supabase
      .from("products")
      .select("id, price_history")
      .eq("url", scraped.url)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error("Could not look up existing product:", lookupError.message);
      return jsonError("Could not check for an existing product.", 500);
    }

    const oldHistory = Array.isArray(existing?.price_history)
      ? existing.price_history
      : [];
    const priceHistory =
      scraped.currentPrice === null
        ? oldHistory
        : [
            ...oldHistory,
            { price: scraped.currentPrice, date: now },
          ].slice(-100);
    const productValues = {
      user_id: user.id,
      store_id: store.id,
      url: scraped.url,
      title: scraped.title,
      image_url: scraped.image,
      current_price: scraped.currentPrice,
      original_price: scraped.originalPrice,
      is_out_of_stock: scraped.isOutOfStock,
      price_history: priceHistory,
      updated_at: now,
    };
    const isNew = !existing;
    const { data: product, error: saveError } = existing
      ? await supabase
          .from("products")
          .update(productValues)
          .eq("id", existing.id)
          .eq("user_id", user.id)
          .select("*, stores (id, name, slug, website_url)")
          .single()
      : await supabase
          .from("products")
          .insert(productValues)
          .select("*, stores (id, name, slug, website_url)")
          .single();

    if (saveError || !product) {
      console.error("Could not save scraped product:", saveError?.message);
      return jsonError("Could not save the product.", 500);
    }

    const responseProduct = {
      ...product,
      _id: product.id,
      store: store.name,
      image: product.image_url,
      currentPrice:
        product.current_price == null ? null : Number(product.current_price),
      originalPrice:
        product.original_price == null ? null : Number(product.original_price),
      isOutOfStock: product.is_out_of_stock,
      priceHistory: priceHistory.map((entry) => entry),
    };

    return NextResponse.json({
      success: true,
      product: responseProduct,
      products: [responseProduct],
      isNew,
    });
  } catch (error) {
    if (error instanceof ScrapeError) {
      return jsonError(error.message, 502);
    }
    console.error("Product scrape failed:", error);
    return jsonError("Unable to scrape the product right now.", 500);
  }
}

function isRequestBody(value: unknown): value is { url?: unknown; storeSlug?: unknown } {
  return value !== null && typeof value === "object";
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  return scrape(
    searchParams.get("url") ?? "",
    searchParams.get("storeSlug") ?? undefined,
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  if (!isRequestBody(body)) {
    return jsonError("Request body must be an object.", 400);
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const storeSlug =
    typeof body.storeSlug === "string" ? body.storeSlug.trim() : undefined;
  if (body.storeSlug !== undefined && !storeSlug) {
    return jsonError("storeSlug must be a non-empty string.", 400);
  }

  return scrape(url, storeSlug);
}
