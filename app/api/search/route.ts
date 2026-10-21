import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import {
  ScrapeError,
  searchStoreProducts,
  type ScrapedProduct,
} from "@/lib/scraper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ProductRow = {
  id: string;
  url: string;
  store: string;
  title: string;
  current_price: number | null;
  original_price: number | null;
  image: string | null;
  is_out_of_stock: boolean;
  price_history: unknown;
};

function toSearchResult(product: ProductRow) {
  const history = Array.isArray(product.price_history)
    ? product.price_history
        .filter(
          (entry): entry is { price: number; date: string } =>
            Boolean(entry) &&
            typeof entry === "object" &&
            "price" in entry &&
            typeof entry.price === "number" &&
            "date" in entry &&
            typeof entry.date === "string",
        )
    : [];

  return {
    _id: product.id,
    url: product.url,
    title: product.title,
    image: product.image,
    store: product.store,
    currentPrice:
      product.current_price == null ? null : Number(product.current_price),
    originalPrice:
      product.original_price == null ? null : Number(product.original_price),
    isOutOfStock: product.is_out_of_stock,
    priceHistory: history,
  };
}

function matchesQuery(title: string, query: string): boolean {
  const normalizedTitle = title.toLowerCase();
  const terms = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return terms.length > 0 && terms.every((term) => normalizedTitle.includes(term));
}

function toScrapedResult(product: ScrapedProduct) {
  return {
    _id: product.url,
    url: product.url,
    title: product.title,
    image: product.image,
    store: product.store,
    currentPrice: product.currentPrice,
    originalPrice: product.originalPrice,
    isOutOfStock: product.isOutOfStock,
    priceHistory:
      product.currentPrice === null
        ? []
        : [{ price: product.currentPrice, date: new Date().toISOString() }],
  };
}

async function liveFallback(query: string) {
  const supabase = createClient();
  const scrapedProducts = await searchStoreProducts(query);
  const matches = scrapedProducts
    .filter((product) => matchesQuery(product.title, query))
    .sort(
      (left, right) =>
        (left.currentPrice ?? Number.POSITIVE_INFINITY) -
        (right.currentPrice ?? Number.POSITIVE_INFINITY),
    );

  const savedProducts = await Promise.all(
    matches.map(async (product) => {
      const now = new Date().toISOString();
      const { data: existing, error: lookupError } = await supabase
        .from("products")
        .select("price_history")
        .eq("url", product.url)
        .maybeSingle();

      if (lookupError) {
        console.error(
          `Could not look up live search result ${product.url}:`,
          lookupError.message,
        );
        return null;
      }

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
        .select("*")
        .single();

      if (error || !data) {
        console.error(
          `Could not save live search result ${product.url}:`,
          error?.message ?? "No product row returned.",
        );
        return null;
      }

      return toSearchResult(data as ProductRow);
    }),
  );

  const persisted = savedProducts.filter(
    (product): product is NonNullable<typeof product> => product !== null,
  );
  return persisted.length > 0
    ? persisted
    : matches.map(toScrapedResult);
}

async function search(query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return NextResponse.json(
      { success: false, error: "Provide a search query." },
      { status: 400 },
    );
  }
  if (normalizedQuery.length > 120) {
    return NextResponse.json(
      { success: false, error: "Search queries must be 120 characters or fewer." },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const isUrl = /^https?:\/\//i.test(normalizedQuery);
  const { data, error } = isUrl
    ? await supabase
        .from("products")
        .select("*")
        .eq("url", normalizedQuery)
        .maybeSingle()
    : await supabase
        .from("products")
        .select("*")
        .ilike("title", `%${normalizedQuery.replace(/[\\%_,]/g, "\\$&")}%`)
        .order("current_price", { ascending: true })
        .limit(20);

  if (error) {
    console.error("Supabase product search failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not search tracked products." },
      { status: 500 },
    );
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  let results = rows.map((product) => toSearchResult(product as ProductRow));
  let fallbackError: string | undefined;

  if (results.length === 0 && !isUrl) {
    try {
      results = await liveFallback(normalizedQuery);
    } catch (error) {
      fallbackError =
        error instanceof ScrapeError
          ? error.message
          : "Live store search is temporarily unavailable.";
      console.error("Live product search fallback failed:", error);
    }
  }

  results.sort(
    (left, right) =>
      (left.currentPrice ?? Number.POSITIVE_INFINITY) -
      (right.currentPrice ?? Number.POSITIVE_INFINITY),
  );
  const noResults = results.length === 0;

  return NextResponse.json({
    success: true,
    results,
    products: results,
    count: results.length,
    query: normalizedQuery,
    ...(noResults
      ? {
          message: fallbackError
            ? `No products found. ${fallbackError}`
            : "No products found, try Track by Link",
        }
      : {}),
  });
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  return search(searchParams.get("q") ?? searchParams.get("query") ?? "");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const query =
    body && typeof body === "object" && "query" in body &&
    typeof body.query === "string"
      ? body.query
      : "";
  return search(query);
}
