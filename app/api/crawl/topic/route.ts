import { NextResponse } from "next/server";
import {
  searchConfiguredStoresDetailed,
  type StaticScrapedProduct,
} from "@/lib/scrapers/staticScraper";
import {
  createAdminSupabaseClient,
  isFCommerceAdminRequest,
} from "@/lib/supabase/admin";
import { storeProfileFromRow } from "@/lib/supabase/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOPICS = new Set(["gadgets", "fashion", "electronics"]);
const MAX_STORES = 10;
const MAX_RESULTS = 20;

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
    let schemaWarning: string | undefined;
    try {
      const migrationResponse = await fetch(
        new URL("/api/admin/migrate", request.url),
        {
          method: "POST",
          headers: {
            authorization: request.headers.get("authorization") ?? "",
            "x-admin-token": request.headers.get("x-admin-token") ?? "",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        },
      );
      const migrationBody = (await migrationResponse.json()) as {
        success?: boolean;
        error?: string;
      };
      if (!migrationResponse.ok || !migrationBody.success) {
        schemaWarning =
          migrationBody.error ?? `Schema migration returned HTTP ${migrationResponse.status}.`;
      }
    } catch (error) {
      schemaWarning =
        error instanceof Error
          ? `Automatic schema migration could not run: ${error.message}`
          : "Automatic schema migration could not run.";
    }

    const supabase = createAdminSupabaseClient();
    const { data: storeRows, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .limit(1000);
    if (storeError) throw new Error(`Could not load stores: ${storeError.message}`);

    const profiles = (storeRows ?? [])
      .map(storeProfileFromRow)
      .filter(
        (profile): profile is NonNullable<typeof profile> =>
          profile !== null &&
          profile.scrape_enabled === true &&
          profile.topic === topic,
      )
      .sort(
        (left, right) =>
          (left.crawl_priority ?? 100) - (right.crawl_priority ?? 100),
      )
      .slice(0, MAX_STORES);
    if (!profiles.length) {
      return NextResponse.json({
        success: !schemaWarning,
        topic,
        query,
        storesCrawled: 0,
        productsFound: 0,
        productsSaved: 0,
        products: [],
        message:
          schemaWarning ??
          "No crawlable stores are registered for this topic. Store rows need a website_url or base_url.",
      }, { status: schemaWarning ? 503 : 200 });
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
      ...(schemaWarning ? { schemaWarning } : {}),
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
