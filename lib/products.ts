import { createClient } from "@/utils/supabase/server";

export type ProductDocument = {
  id: string;
  user_id: string;
  store_id: string;
  url: string;
  title: string;
  image_url: string | null;
  current_price: number | null;
  original_price: number | null;
  is_out_of_stock: boolean;
  price_history: unknown[];
  created_at: string;
  updated_at: string;
};

type UpsertProduct = Omit<
  ProductDocument,
  "id" | "created_at" | "updated_at"
> &
  Partial<Pick<ProductDocument, "id" | "created_at" | "updated_at">>;

export async function getProducts(): Promise<ProductDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*");

  if (error) {
    throw new Error(`Could not get products: ${error.message}`);
  }

  return data;
}

export async function getProductByUrl(url: string): Promise<ProductDocument> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("url", url)
    .single();

  if (error) {
    throw new Error(`Could not get product by URL: ${error.message}`);
  }

  return data;
}

export async function upsertProduct(
  product: UpsertProduct,
): Promise<ProductDocument> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .upsert(product, { onConflict: "user_id,url" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not upsert product: ${error.message}`);
  }

  return data;
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
