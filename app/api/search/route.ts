import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function escapeLikeQuery(value: string): string {
  return value.replace(/[\\%_,]/g, "\\$&");
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Provide a search query in the q parameter." },
      { status: 400 },
    );
  }
  if (query.length > 120) {
    return NextResponse.json(
      { error: "Search queries must be 120 characters or fewer." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to search tracked products." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      `
        id,
        url,
        title,
        image_url,
        is_out_of_stock,
        store:stores!inner (id, name, slug, website_url),
        product_prices (current_price, original_price, currency, is_out_of_stock, checked_at),
        price_history (price, original_price, currency, recorded_at)
      `,
    )
    .ilike("title", `%${escapeLikeQuery(query)}%`)
    .limit(50);

  if (error) {
    console.error("Supabase product search failed:", error.message);
    return NextResponse.json(
      {
        error:
          error.code === "PGRST200" || error.code === "PGRST205"
            ? "Product price tables are missing. Run supabase-schema.sql."
            : "Could not search tracked products.",
      },
      { status: error.code === "PGRST200" || error.code === "PGRST205" ? 503 : 500 },
    );
  }

  const products = (data ?? []).map((product) => {
    const store = Array.isArray(product.store)
      ? product.store[0]
      : product.store;
    const prices = Array.isArray(product.product_prices)
      ? product.product_prices
      : product.product_prices
        ? [product.product_prices]
        : [];
    const latestPrice = prices[0] ?? null;
    const history = Array.isArray(product.price_history)
      ? product.price_history
      : [];

    return {
      _id: product.id,
      url: product.url,
      title: product.title,
      image: product.image_url,
      store: store?.name ?? "Unknown store",
      storeInfo: store ?? null,
      currentPrice:
        latestPrice?.current_price == null
          ? null
          : Number(latestPrice.current_price),
      originalPrice:
        latestPrice?.original_price == null
          ? null
          : Number(latestPrice.original_price),
      currency: latestPrice?.currency ?? "BDT",
      isOutOfStock:
        latestPrice?.is_out_of_stock ?? product.is_out_of_stock,
      priceCheckedAt: latestPrice?.checked_at ?? null,
      priceHistory: history.map((entry) => ({
        price: Number(entry.price),
        date: entry.recorded_at,
      })),
    };
  });

  products.sort((left, right) => {
    const leftPrice = left.currentPrice;
    const rightPrice = right.currentPrice;
    if (leftPrice == null) return rightPrice == null ? 0 : 1;
    if (rightPrice == null) return -1;
    return Number(leftPrice) - Number(rightPrice);
  });

  return NextResponse.json({ products });
}
