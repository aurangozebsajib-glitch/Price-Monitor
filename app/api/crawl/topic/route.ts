import { NextResponse } from "next/server";
import {
  searchConfiguredStoresDetailed,
  type StaticScrapedProduct,
  type StoreScraperProfile,
} from "@/lib/scrapers/staticScraper";
import {
  createAdminSupabaseClient,
  isFCommerceAdminRequest,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOPICS = new Set(["gadgets", "fashion", "electronics"]);
const MAX_STORES = 10;
const MAX_RESULTS = 20;

function isProfile(value: Record<string, unknown>): value is StoreScraperProfile {
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    (value.type === "ecommerce" || value.type === "f-commerce") &&
    typeof value.topic === "string" &&
    typeof value.base_url === "string" &&
    typeof value.search_url_template === "string"
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.F_COMMERCE_ADMIN_TOKEN) {
    return errorResponse("F-commerce admin is not configured.", 503);
  }
  if (!isFCommerceAdminRequest(request)) {
    return errorResponse("Unauthorized.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }
  if (!body || typeof body !== "object") {
    return errorResponse("Request body must be an object.", 400);
  }

  const input = body as { topic?: unknown; query?: unknown };
  const topic = typeof input.topic === "string" ? input.topic : "";
  const query = typeof input.query === "string" ? input.query.trim() : topic;
  if (!TOPICS.has(topic)) {
    return errorResponse("Topic must be gadgets, fashion, or electronics.", 400);
  }
  if (!query || query.length > 120) {
    return errorResponse("Search query must be between 1 and 120 characters.", 400);
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data: storeRows, error: storeError } = await supabase
      .from("stores")
      .select(
        "id, name, slug, type, topic, base_url, search_url_template, product_container_selector, product_link_selector, pagination_selector, title_selector, price_selector, image_selector, availability_selector",
      )
      .eq("topic", topic)
      .eq("scrape_enabled", true)
      .not("search_url_template", "is", null)
      .order("crawl_priority", { ascending: true })
      .limit(MAX_STORES);
    if (storeError) throw new Error(`Could not load stores: ${storeError.message}`);

    const profiles = (storeRows ?? []).filter(
      (row): row is StoreScraperProfile =>
        Boolean(row) && isProfile(row as Record<string, unknown>),
    );
    if (!profiles.length) {
      return NextResponse.json({
        success: true,
        topic,
        query,
        storesCrawled: 0,
        productsFound: 0,
        productsSaved: 0,
        products: [],
        message: "No enabled stores are registered for this topic.",
      });
    }

    const crawl = await searchConfiguredStoresDetailed(profiles, query);
    const scraped = crawl.products.slice(0, MAX_RESULTS);
    const saved = await Promise.all(
      scraped.map(async (product: StaticScrapedProduct) => {
        const { data: existing, error: lookupError } = await supabase
          .from("products")
          .select("price_history")
          .eq("url", product.url)
          .maybeSingle();
        if (lookupError) {
          return { url: product.url, error: lookupError.message };
        }

        const now = new Date().toISOString();
        const oldHistory = Array.isArray(existing?.price_history)
          ? existing.price_history
          : [];
        const history =
          product.currentPrice === null
            ? oldHistory
            : [...oldHistory, { price: product.currentPrice, date: now }].slice(-100);
        const { data, error } = await supabase
          .from("products")
          .upsert(
            {
              url: product.url,
              store: product.store,
              title: product.title,
              current_price: product.currentPrice,
              original_price: product.originalPrice,
              image: product.image,
              is_out_of_stock: product.isOutOfStock,
              price_history: history,
            },
            { onConflict: "url" },
          )
          .select("id, url, store, title, current_price, image")
          .single();
        if (error || !data) {
          return {
            url: product.url,
            error: error?.message ?? "No saved product returned.",
          };
        }
        return {
          ...data,
          current_price:
            data.current_price == null ? null : Number(data.current_price),
        };
      }),
    );
    const products = saved.filter(
      (value): value is Exclude<typeof value, { error: string }> =>
        !("error" in value),
    );
    const errors = saved.filter(
      (value): value is { url: string; error: string } => "error" in value,
    );
    products.sort(
      (left, right) =>
        (left.current_price ?? Number.POSITIVE_INFINITY) -
        (right.current_price ?? Number.POSITIVE_INFINITY),
    );

    return NextResponse.json({
      success: true,
      topic,
      query,
      storesCrawled: profiles.length,
      productsFound: scraped.length,
      productsSaved: products.length,
      products,
      ...(crawl.errors.length ? { storeErrors: crawl.errors } : {}),
      ...(errors.length ? { errors } : {}),
    });
  } catch (error) {
    console.error("Topic crawl failed:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Topic crawl failed.",
      500,
    );
  }
}
