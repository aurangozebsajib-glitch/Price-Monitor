import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type SearchResult = {
  _id: string;
  url: string;
  title: string;
  image: string | null;
  store: string;
  currentPrice: number | null;
  originalPrice: number | null;
  isOutOfStock: boolean;
  priceHistory: Array<{ price: number; date: string }>;
};

function toSearchResult(product: {
  id: string;
  url: string;
  title: string;
  image_url: string | null;
  current_price: number | null;
  original_price: number | null;
  is_out_of_stock: boolean;
  price_history: unknown;
  stores: { name: string } | { name: string }[] | null;
}): SearchResult {
  const store = Array.isArray(product.stores)
    ? product.stores[0]
    : product.stores;
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
    image: product.image_url,
    store: store?.name ?? "Unknown store",
    currentPrice:
      product.current_price == null ? null : Number(product.current_price),
    originalPrice:
      product.original_price == null ? null : Number(product.original_price),
    isOutOfStock: product.is_out_of_stock,
    priceHistory: history,
  };
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

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "Sign in to search tracked products." },
      { status: 401 },
    );
  }

  const select = `
    id,
    url,
    title,
    image_url,
    current_price,
    original_price,
    is_out_of_stock,
    price_history,
    stores (name)
  `;
  const isUrl = /^https?:\/\//i.test(normalizedQuery);
  const { data, error } = isUrl
    ? await supabase
        .from("products")
        .select(select)
        .eq("url", normalizedQuery)
        .maybeSingle()
    : await supabase
        .from("products")
        .select(select)
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
  const results = rows.map((product) => toSearchResult(product));
  const noResults = results.length === 0;

  return NextResponse.json({
    success: true,
    results,
    products: results,
    count: results.length,
    query: normalizedQuery,
    ...(noResults
      ? { message: "No products found, try Track by Link" }
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
