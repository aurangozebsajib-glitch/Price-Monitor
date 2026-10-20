import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoose";
import { saveScrapedProduct, sortProductsByPrice } from "@/lib/products";
import {
  ScrapeError,
  getStoreForUrl,
  scrapeProductUrl,
  searchStoreProducts,
} from "@/lib/scraper";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Provide a product URL or search query." }, { status: 400 });
  }

  const input = body as { url?: unknown; query?: unknown };
  if (typeof input.url === "string" && input.url.trim()) {
    try {
      getStoreForUrl(input.url.trim());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unsupported product URL." },
        { status: 400 },
      );
    }
  }

  try {
    let scrapedProducts;
    if (typeof input.url === "string" && input.url.trim()) {
      scrapedProducts = [await scrapeProductUrl(input.url.trim())];
    } else if (typeof input.query === "string" && input.query.trim()) {
      const query = input.query.trim();
      if (query.length > 120) {
        return NextResponse.json({ error: "Search queries must be 120 characters or fewer." }, { status: 400 });
      }
      scrapedProducts = await searchStoreProducts(query);
    } else {
      return NextResponse.json({ error: "Provide a product URL or search query." }, { status: 400 });
    }

    if (scrapedProducts.length === 0) {
      return NextResponse.json({ products: [], message: "No matching products were found." });
    }

    await connectToDatabase();
    const products = await Promise.all(scrapedProducts.map(saveScrapedProduct));
    return NextResponse.json({ products: sortProductsByPrice(products as Array<{ currentPrice?: number | null }>) });
  } catch (error) {
    if (error instanceof ScrapeError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Product scraping failed:", error);
    return NextResponse.json({ error: "Unable to scrape or save the product right now." }, { status: 500 });
  }
}
