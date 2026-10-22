import { load } from "cheerio";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extract,
  type StaticScrapedProduct,
  type StoreScraperProfile,
} from "@/lib/scrapers/staticScraper";
import { storeProfileFromRow } from "@/lib/supabase/schema";

const MAX_PRODUCTS_PER_STORE = 20;
const MAX_SITEMAPS_PER_STORE = 5;
const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;
const STORE_BATCH_SIZE = 5;
const PRODUCT_BATCH_SIZE = 5;
const SITEMAP_TIMEOUT_MS = 5_000;

// Pagination discovery constants
const MAX_PAGINATION_PAGES = 3;
const PAGINATION_DELAY_MS = 200;
const MAX_PAGINATION_BYTES = 2 * 1024 * 1024;
const PAGINATION_TIMEOUT_MS = 5_000;

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type CrawlTable<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type CrawlerDatabase = {
  public: {
    Tables: {
      stores: CrawlTable<
        Record<string, unknown>,
        Record<string, unknown>
      >;
      products: CrawlTable<
        {
          id: string;
          url: string;
          store: string;
          title: string;
          current_price: number | null;
          original_price: number | null;
          image: string | null;
          is_out_of_stock: boolean;
          price_history: Json;
        },
        {
          url: string;
          store: string;
          title: string;
          current_price: number | null;
          original_price: number | null;
          image: string | null;
          is_out_of_stock: boolean;
          price_history: Json;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type CrawlerSupabaseClient = SupabaseClient<CrawlerDatabase>;

export type CrawlStoreResult = {
  store: string;
  sitemapUrls: number;
  scraped: number;
  saved: number;
  errors: string[];
};

export type CrawlTopicResult = {
  topic: string;
  storesFound: number;
  storesCrawled: number;
  productsScraped: number;
  productsSaved: number;
  stores: CrawlStoreResult[];
};

function isDaraz(profile: StoreScraperProfile): boolean {
  if (/daraz/i.test(`${profile.name} ${profile.slug}`)) return true;
  try {
    return new URL(profile.base_url).hostname.toLowerCase().includes("daraz.");
  } catch {
    return false;
  }
}

function sitemapCandidate(value: string, baseUrl: URL): URL | null {
  try {
    const url = new URL(value, baseUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hostname.toLowerCase().replace(/^www\./, "") !==
        baseUrl.hostname.toLowerCase().replace(/^www\./, "")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

async function fetchSitemap(url: URL, baseUrl: URL): Promise<string | null> {
  const safeUrl = sitemapCandidate(url.toString(), baseUrl);
  if (!safeUrl) return null;

  try {
    const response = await fetch(safeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PricePulse/1.0)",
        Accept: "application/xml,text/xml,*/*",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      const redirected = sitemapCandidate(new URL(location, safeUrl).toString(), baseUrl);
      if (!redirected) return null;
      const redirectedResponse = await fetch(redirected, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PricePulse/1.0)",
          Accept: "application/xml,text/xml,*/*",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS),
      });
      if (!redirectedResponse.ok) return null;
      const length = Number(redirectedResponse.headers.get("content-length") ?? 0);
      if (length > MAX_SITEMAP_BYTES) return null;
      const xml = await redirectedResponse.text();
      return Buffer.byteLength(xml, "utf8") <= MAX_SITEMAP_BYTES ? xml : null;
    }
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_SITEMAP_BYTES) return null;
    const xml = await response.text();
    return Buffer.byteLength(xml, "utf8") <= MAX_SITEMAP_BYTES ? xml : null;
  } catch {
    return null;
  }
}

function sitemapLocations(xml: string): { products: string[]; nested: string[] } {
  const $ = load(xml, { xmlMode: true });
  const products = new Set<string>();
  const nested = new Set<string>();
  $("urlset > url > loc, url > loc").each((_, element) => {
    const location = $(element).text().trim();
    if (location) products.add(location);
  });
  $("sitemapindex > sitemap > loc, sitemap > loc").each((_, element) => {
    const location = $(element).text().trim();
    if (location) nested.add(location);
  });
  return { products: [...products], nested: [...nested] };
}

async function discoverProductUrls(profile: StoreScraperProfile): Promise<string[]> {
  const baseUrl = new URL(profile.base_url);
  const initial = [
    new URL("/product-sitemap.xml", baseUrl),
    new URL("/product-sitemap1.xml", baseUrl),
    new URL("/sitemap.xml", baseUrl),
  ];
  const queued = new Map<string, URL>();
  initial.forEach((url) => queued.set(url.toString(), url));
  const visited = new Set<string>();
  const productUrls = new Set<string>();

  while (queued.size && visited.size < MAX_SITEMAPS_PER_STORE && productUrls.size < MAX_PRODUCTS_PER_STORE) {
    const batch = [...queued.values()].slice(0, MAX_SITEMAPS_PER_STORE - visited.size);
    batch.forEach((url) => {
      queued.delete(url.toString());
      visited.add(url.toString());
    });
    const documents = await Promise.all(
      batch.map(async (url) => ({ url, xml: await fetchSitemap(url, baseUrl) })),
    );

    for (const { xml } of documents) {
      if (!xml) continue;
      const locations = sitemapLocations(xml);
      for (const location of locations.products) {
        const productUrl = sitemapCandidate(location, baseUrl);
        if (!productUrl) continue;
        if (/\.(?:xml|gz)(?:$|\?)/i.test(productUrl.pathname)) continue;
        productUrls.add(productUrl.toString());
        if (productUrls.size >= MAX_PRODUCTS_PER_STORE) break;
      }
      for (const location of locations.nested) {
        const nestedUrl = sitemapCandidate(location, baseUrl);
        if (nestedUrl && !visited.has(nestedUrl.toString())) {
          queued.set(nestedUrl.toString(), nestedUrl);
        }
      }
    }
  }

  // If sitemaps didn't yield enough products, try pagination discovery
  if (productUrls.size < MAX_PRODUCTS_PER_STORE) {
    return discoverViaPagination(profile, productUrls);
  }

  return [...productUrls].slice(0, MAX_PRODUCTS_PER_STORE);
}

async function fetchPageForPagination(
  url: URL,
  baseUrl: URL,
): Promise<string | null> {
  const safeUrl = sitemapCandidate(url.toString(), baseUrl);
  if (!safeUrl) return null;

  try {
    const response = await fetch(safeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PricePulse/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-BD,en;q=0.9",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(PAGINATION_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      const redirected = sitemapCandidate(
        new URL(location, safeUrl).toString(),
        baseUrl,
      );
      if (!redirected) return null;
      const redirectedResponse = await fetch(redirected, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PricePulse/1.0)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-BD,en;q=0.9",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(PAGINATION_TIMEOUT_MS),
      });
      if (!redirectedResponse.ok) return null;
      const html = await redirectedResponse.text();
      return Buffer.byteLength(html, "utf8") <= MAX_PAGINATION_BYTES
        ? html
        : null;
    }

    if (!response.ok) return null;
    const html = await response.text();
    return Buffer.byteLength(html, "utf8") <= MAX_PAGINATION_BYTES ? html : null;
  } catch {
    return null;
  }
}

function extractProductLinksFromPage(
  html: string,
  pageUrl: string,
  profile: StoreScraperProfile,
): string[] {
  const $ = load(html);
  const links = new Set<string>();
  let baseUrl: URL;
  try {
    baseUrl = new URL(profile.base_url);
  } catch {
    return [];
  }

  const containerSelector = profile.product_container_selector;
  const linkSelector = profile.product_link_selector || "a[href]";

  const collect = (
    selector: string,
    within?: ReturnType<typeof $>,
  ) => {
    const scope = within ? within.find(selector) : $(selector);
    scope.each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const url = new URL(href, pageUrl);
        if (
          url.protocol === "https:" &&
          url.hostname.replace(/^www\./, "") ===
            baseUrl.hostname.replace(/^www\./, "") &&
          !url.username &&
          !url.password &&
          !url.port
        ) {
          links.add(url.toString());
        }
      } catch {
        // Skip invalid URLs
      }
    });
  };

  if (containerSelector) {
    $(containerSelector).each((_, container) => {
      const $container = $(container);
      collect(linkSelector, $container);
    });
  } else {
    collect(linkSelector);
  }

  return [...links];
}

async function discoverViaPagination(
  profile: StoreScraperProfile,
  existingUrls: Set<string>,
): Promise<string[]> {
  const baseUrl = new URL(profile.base_url);
  const productUrls = new Set<string>(existingUrls);

  if (productUrls.size >= MAX_PRODUCTS_PER_STORE) {
    return [...productUrls].slice(0, MAX_PRODUCTS_PER_STORE);
  }

  const paginationPatterns = [
    "/?page={page}",
    "/products/?page={page}",
    "/category/?page={page}",
    "/catalog/?page={page}",
    "/shop/?page={page}",
    "/search/?page={page}",
    "/page/{page}",
    "/products/page/{page}",
    "/category/page/{page}",
    "/catalog/page/{page}",
    "/shop/page/{page}",
    "/search/page/{page}",
  ];

  for (const pattern of paginationPatterns) {
    if (productUrls.size >= MAX_PRODUCTS_PER_STORE) break;

    for (let page = 1; page <= MAX_PAGINATION_PAGES; page++) {
      if (productUrls.size >= MAX_PRODUCTS_PER_STORE) break;

      const path = pattern.replace("{page}", String(page));
      const pageUrl = new URL(path, baseUrl);

      try {
        const html = await fetchPageForPagination(pageUrl, baseUrl);
        if (!html) continue;

        const links = extractProductLinksFromPage(html, pageUrl.toString(), profile);
        for (const link of links) {
          productUrls.add(link);
          if (productUrls.size >= MAX_PRODUCTS_PER_STORE) break;
        }
      } catch {
        // Continue to next pattern/page
      }

      // 1s delay between pages
      await new Promise((resolve) => setTimeout(resolve, PAGINATION_DELAY_MS));
    }
  }

  return [...productUrls].slice(0, MAX_PRODUCTS_PER_STORE);
}

function profileFromRow(row: unknown): StoreScraperProfile | null {
  const profile = storeProfileFromRow(row);
  if (!profile || isDaraz(profile)) return null;
  const record = row as Record<string, unknown>;
  const country = typeof record.country_code === "string"
    ? record.country_code.toUpperCase()
    : "BD";
  if (country !== "BD") return null;
  if (
    profile.type !== "ecommerce" &&
    profile.type !== "f-commerce"
  ) return null;
  return profile;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true" || value === "1") return true;
    if (value.toLowerCase() === "false" || value === "0") return false;
  }
  return null;
}

async function saveProduct(
  supabase: CrawlerSupabaseClient,
  product: StaticScrapedProduct,
): Promise<void> {
  const { data: existingRow, error: lookupError } = await supabase
    .from("products")
    .select("current_price, price_history")
    .eq("url", product.url)
    .maybeSingle();
  if (lookupError) {
    throw new Error(`Could not look up ${product.url}: ${lookupError.message}`);
  }
  const existing = existingRow as {
    current_price?: unknown;
    price_history?: unknown;
  } | null;

  const now = new Date().toISOString();
  const oldHistory = Array.isArray(existing?.price_history)
    ? existing.price_history
    : [];
  const samePrice =
    product.currentPrice !== null &&
    Number(existing?.current_price) === product.currentPrice;
  const history =
    product.currentPrice === null || samePrice
      ? oldHistory
      : [...oldHistory, { price: product.currentPrice, date: now }].slice(-100);
  const { error } = await supabase.from("products").upsert(
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
  );
  if (error) throw new Error(`Could not save ${product.url}: ${error.message}`);
}

async function crawlStore(
  supabase: CrawlerSupabaseClient,
  profile: StoreScraperProfile,
): Promise<CrawlStoreResult> {
  const errors: string[] = [];
  const urls = await discoverProductUrls(profile);
  let scraped = 0;
  let saved = 0;

  for (let index = 0; index < urls.length; index += PRODUCT_BATCH_SIZE) {
    const batch = urls.slice(index, index + PRODUCT_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((url) => extract(url, profile)),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(result.reason instanceof Error ? result.reason.message : "Product scrape failed.");
        continue;
      }
      scraped += 1;
      try {
        await saveProduct(supabase, result.value);
        saved += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Product save failed.");
      }
    }
  }

  return {
    store: profile.name,
    sitemapUrls: urls.length,
    scraped,
    saved,
    errors,
  };
}

export async function crawlTopic(
  topic: string,
  supabaseOverride?: CrawlerSupabaseClient,
): Promise<CrawlTopicResult> {
  const normalizedTopic = topic.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,40}$/.test(normalizedTopic)) {
    throw new Error("Topic must be 1-40 lowercase letters, digits, or hyphens.");
  }

  let supabase = supabaseOverride;
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for crawling.",
      );
    }
    supabase = createSupabaseClient<CrawlerDatabase>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const { data: storeRows, error } = await supabase
    .from("stores")
    .select("*")
    .limit(1000);
  if (error) {
    throw new Error(`Could not load store registry: ${error.message}`);
  }

  const profiles = (storeRows ?? [])
    .filter((row) => {
      const rowTopic =
        typeof row.topic === "string" ? row.topic.toLowerCase() : "gadgets";
      return (
        rowTopic === normalizedTopic &&
        readBoolean(row.scrape_enabled) === true
      );
    })
    .map(profileFromRow)
    .filter((profile): profile is StoreScraperProfile => profile !== null);

  const stores: CrawlStoreResult[] = [];
  for (let index = 0; index < profiles.length; index += STORE_BATCH_SIZE) {
    const batch = profiles.slice(index, index + STORE_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (profile) => {
        try {
          return await crawlStore(supabase, profile);
        } catch (error) {
          return {
            store: profile.name,
            sitemapUrls: 0,
            scraped: 0,
            saved: 0,
            errors: [error instanceof Error ? error.message : "Store crawl failed."],
          };
        }
      }),
    );
    stores.push(...results);
  }

  return {
    topic: normalizedTopic,
    storesFound: profiles.length,
    storesCrawled: stores.length,
    productsScraped: stores.reduce((total, store) => total + store.scraped, 0),
    productsSaved: stores.reduce((total, store) => total + store.saved, 0),
    stores,
  };
}
