import Product from "@/lib/models/Product";
import type { ScrapedProduct } from "@/lib/scraper";

type ProductDocument = {
  _id: unknown;
  url: string;
  store?: string;
  title?: string;
  image?: string;
  currentPrice?: number;
  originalPrice?: number;
  priceHistory: Array<{ price: number; date: Date }>;
  isOutOfStock: boolean;
  save: () => Promise<ProductDocument>;
  toObject: () => Record<string, unknown>;
};

export async function saveScrapedProduct(
  scraped: ScrapedProduct,
): Promise<Record<string, unknown>> {
  const existing = (await Product.findOne({ url: scraped.url }).exec()) as
    | ProductDocument
    | null;
  const lastPrice = existing?.priceHistory.at(-1)?.price;

  const product = existing ?? new Product({ url: scraped.url });
  product.store = scraped.store;
  product.title = scraped.title;
  product.image = scraped.image ?? undefined;
  product.isOutOfStock = scraped.isOutOfStock;

  if (scraped.currentPrice !== null) {
    product.currentPrice = scraped.currentPrice;
    if (lastPrice !== scraped.currentPrice) {
      product.priceHistory.push({
        price: scraped.currentPrice,
        date: new Date(),
      });
    }
  }
  if (scraped.originalPrice !== null) {
    product.originalPrice = scraped.originalPrice;
  }

  await product.save();
  return product.toObject();
}

export function sortProductsByPrice<T extends { currentPrice?: number | null }>(
  products: T[],
): T[] {
  return products.sort((left, right) => {
    const leftPrice = left.currentPrice;
    const rightPrice = right.currentPrice;
    if (leftPrice == null) return rightPrice == null ? 0 : 1;
    if (rightPrice == null) return -1;
    return leftPrice - rightPrice;
  });
}
