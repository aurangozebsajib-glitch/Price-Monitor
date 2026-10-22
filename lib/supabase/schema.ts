import type { StoreScraperProfile } from "@/lib/scrapers/staticScraper";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ALL_COLUMNS = [
  "base_url",
  "website_url",
  "fb_page_url",
  "topic",
  "scraper_type",
  "scrape_enabled",
  "availability_selector",
  "price_selector",
  "title_selector",
  "image_selector",
  "link_selector",
  "product_selector",
  "search_url_pattern",
  "search_path",
  "name_selector",
  "crawl_priority",
  "pagination_selector",
  "last_crawled_at",
  "last_crawl_status",
  "product_count",
  "country_code",
  "logo_url",
  "discovered_from",
  "is_valid",
] as const;

const COLUMN_TYPES: Record<(typeof ALL_COLUMNS)[number], string> = {
  base_url: "TEXT",
  website_url: "TEXT",
  fb_page_url: "TEXT",
  topic: "TEXT",
  scraper_type: "TEXT",
  scrape_enabled: "TEXT",
  availability_selector: "TEXT",
  price_selector: "TEXT",
  title_selector: "TEXT",
  image_selector: "TEXT",
  link_selector: "TEXT",
  product_selector: "TEXT",
  search_url_pattern: "TEXT",
  search_path: "TEXT",
  name_selector: "TEXT",
  crawl_priority: "INTEGER",
  pagination_selector: "TEXT",
  last_crawled_at: "TIMESTAMPTZ",
  last_crawl_status: "TEXT",
  product_count: "INTEGER",
  country_code: "TEXT",
  logo_url: "TEXT",
  discovered_from: "TEXT",
  is_valid: "BOOLEAN",
};

export const STORE_SCHEMA_SQL = `ALTER TABLE public.stores ${ALL_COLUMNS.map(
  (column) => `ADD COLUMN IF NOT EXISTS "${column}" ${COLUMN_TYPES[column]}`,
).join(", ")};`;

export async function migrateStoreSchema(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("exec_sql", { sql: STORE_SCHEMA_SQL });
  if (error) {
    const errorText = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
    if (
      error.code === "PGRST202" ||
      error.code === "42883" ||
      errorText.includes("exec_sql") ||
      errorText.includes("schema cache")
    ) {
      return {
        success: false as const,
        error:
          "The exec_sql RPC is not installed. Supabase REST cannot create SQL functions or alter tables; install the reviewed store-registry migration through a database migration connection first.",
      };
    }
    return {
      success: false as const,
      error: `Could not migrate the stores schema: ${error.message || error.code || "database error"}`,
    };
  }
  const { error: reloadError } = await supabase.rpc("exec_sql", {
    sql: "NOTIFY pgrst, 'reload schema';",
  });
  if (reloadError) {
    console.warn("Could not request a PostgREST schema reload:", reloadError.message);
  }
  return {
    success: true as const,
    migratedColumns: [...ALL_COLUMNS],
    ...(reloadError ? { warning: "Schema changed; PostgREST may need a moment to refresh." } : {}),
  };
}

function optionalString(
  row: Record<string, unknown>,
  ...columns: string[]
): string | null {
  for (const column of columns) {
    const value = row[column];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function optionalBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true" || value === "1") return true;
    if (value.toLowerCase() === "false" || value === "0") return false;
  }
  return null;
}

export function storeProfileFromRow(
  value: unknown,
): StoreScraperProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const name = optionalString(row, "name");
  const slug = optionalString(row, "slug");
  const baseUrl = optionalString(row, "base_url", "website_url");
  if (!name || !slug || !baseUrl) return null;

  let normalizedBaseUrl: string;
  try {
    normalizedBaseUrl = new URL(baseUrl).origin;
  } catch {
    return null;
  }

  const rawType = optionalString(row, "scraper_type", "type") ?? "ecommerce";
  const type =
    rawType === "f-commerce" ? "f-commerce" : "ecommerce";
  const searchTemplate =
    optionalString(row, "search_url_template", "search_url_pattern", "search_path") ??
    "/search?q={query}";
  const priorityValue = Number(row.crawl_priority);

  return {
    id: typeof row.id === "string" ? row.id : slug,
    name,
    slug,
    type,
    topic: optionalString(row, "topic") ?? "gadgets",
    base_url: normalizedBaseUrl,
    search_url_template: searchTemplate,
    product_container_selector: optionalString(row, "product_container_selector", "product_selector"),
    product_link_selector: optionalString(row, "product_link_selector", "link_selector"),
    pagination_selector: optionalString(row, "pagination_selector"),
    title_selector: optionalString(row, "title_selector", "name_selector"),
    price_selector: optionalString(row, "price_selector"),
    image_selector: optionalString(row, "image_selector"),
    availability_selector: optionalString(row, "availability_selector"),
    scrape_enabled: optionalBoolean(row.scrape_enabled) ?? true,
    crawl_priority: Number.isFinite(priorityValue) ? priorityValue : 100,
  };
}
