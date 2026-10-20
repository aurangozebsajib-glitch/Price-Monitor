import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoose";
import Product from "@/lib/models/Product";
import { saveScrapedProduct, sortProductsByPrice } from "@/lib/products";
import { ScrapeError, searchStoreProducts } from "@/lib/scraper";

export const runtime = "nodejs";
export const maxDuration = 60;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Provide a search query in the q parameter." }, { status: 400 });
  }
  if (query.length > 120) {
    return NextResponse.json({ error: "Search queries must be 120 characters or fewer." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const search = new RegExp(escapeRegExp(query), "i");
    const existing = (await Product.find({
      $or: [{ title: search }, { store: search }],
    })
      .limit(30)
      .lean()
      .exec()) as Array<{ currentPrice?: number | null }>;

    if (existing.length > 0) {
      return NextResponse.json({ products: sortProductsByPrice(existing) });
    }

    const scrapedProducts = await searchStoreProducts(query);
    const products = await Promise.all(scrapedProducts.map(saveScrapedProduct));
    return NextResponse.json({ products: sortProductsByPrice(products as Array<{ currentPrice?: number | null }>) });
  } catch (error) {
    if (error instanceof ScrapeError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Product search failed:", error);
    return NextResponse.json({ error: "Unable to search products right now." }, { status: 500 });
  }
}
