import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const results = rows.map((product) => toSearchResult(product as ProductRow));
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
