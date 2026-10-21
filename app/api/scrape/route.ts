import { NextResponse } from "next/server";
import {
  getStoreForUrl,
  ScrapeError,
  scrapeProductUrl,
  type StoreName,
} from "@/lib/scraper";
import { createClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

type Store = {
  id: string;
  name: string;
  slug: string;
};

const storeSlugs: Record<StoreName, string> = {
  "Star Tech": "star-tech",
  Daraz: "daraz",
  Ryans: "ryans",
  Pickaboo: "pickaboo",
  UCC: "ucc-bd",
  "Gadget & Gear": "gadget-gear",
  Amazon: "amazon",
  BestBuy: "bestbuy",
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function scrape(urlInput: string, requestedStoreSlug?: string) {
  let url: URL;
  let storeName: StoreName;
  try {
    url = new URL(urlInput);
    storeName = getStoreForUrl(url.toString());
  } catch (error) {
    return jsonError(
      error instanceof ScrapeError ? error.message : "Enter a valid product URL.",
      400,
    );
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

  const expectedSlug = storeSlugs[storeName];
  if (requestedStoreSlug && requestedStoreSlug !== expectedSlug) {
    return jsonError(
      "The URL does not match the requested supported store.",
      400,
    );
  }

  const supabase = createClient();
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name, slug")
    .eq("slug", expectedSlug)
    .maybeSingle();
  if (storeError) {
    console.error("Could not validate product store:", storeError.message);
    return jsonError("Could not validate the store catalog.", 500);
  }
  if (!store) {
    return jsonError("This store is not available in the store catalog.", 400);
  }

  try {
    const scraped = await scrapeProductUrl(url.toString());
    const { data: existing, error: lookupError } = await supabase
      .from("products")
      .select("*")
      .eq("url", scraped.url)
      .maybeSingle();

    if (lookupError) {
      console.error("Could not look up existing product:", lookupError.message);
      return jsonError("Could not check for an existing product.", 500);
    }

    const now = new Date().toISOString();
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
      url: scraped.url,
      store: store.name,
      title: scraped.title,
      current_price: scraped.currentPrice,
      original_price: scraped.originalPrice,
      image: scraped.image,
      is_out_of_stock: scraped.isOutOfStock,
      price_history: priceHistory,
    };
    const isNew = !existing;
    const { data: product, error: saveError } = existing
      ? await supabase
          .from("products")
          .update(productValues)
          .eq("url", scraped.url)
          .select("*")
          .single()
      : await supabase
          .from("products")
          .insert(productValues)
          .select("*")
          .single();

    if (saveError || !product) {
      console.error("Could not save scraped product:", saveError?.message);
      return jsonError("Could not save the product.", 500);
    }

    const responseProduct = {
      ...product,
      _id: product.id,
      currentPrice:
        product.current_price == null ? null : Number(product.current_price),
      originalPrice:
        product.original_price == null ? null : Number(product.original_price),
      isOutOfStock: product.is_out_of_stock,
      priceHistory,
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

function isRequestBody(
  value: unknown,
): value is { url?: unknown; storeSlug?: unknown } {
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
