import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { load } from "cheerio";

const MAX_PAGES_PER_SEED = 5;
const MAX_RESULTS_PER_SEED = 50;
const MAX_STORES_PER_BATCH = 20;
const REQUEST_DELAY_MS = 1000;
const USER_AGENT = "Mozilla/5.0 (compatible; PricePulse/1.0)";

interface FacebookPage {
  name: string;
  url: string;
  slug: string;
  website?: string;
  whatsapp?: string;
  phone?: string;
  address?: string;
}
ntype DiscoveryDatabase = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          slug: string;
          base_url: string;
          website_url?: string;
          store_type: "ecommerce" | "f-commerce";
          scrape_enabled: boolean;
          crawl_priority?: number;
          topic?: string;
        };
        Insert: {
          name: string;
          slug: string;
          base_url: string;
          website_url?: string;
          store_type: "ecommerce" | "f-commerce";
          scrape_enabled: boolean;
          crawl_priority?: number;
          topic?: string;
        };
      };
    };
  };
};
ntype DiscoverySupabaseClient = SupabaseClient<DiscoveryDatabase>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchFacebookPages(
  query: string,
  page: number,
): Promise<FacebookPage[]> {
  const url = new URL("https://html.duckduckgo.com/html");
  url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];

    const html = await response.text();
    const $ = load(html);
    const pages: FacebookPage[] = [];

    $(".result__a").each((_, element) => {
      const $element = $(element);
      const url = $element.attr("href");
      const name = $element.find(".result__title").text();
      if (!url || !name || !url.includes("facebook.com")) return;

      const slug = generateSlug(name);
      const pageUrl = new URL(url, "https://facebook.com").toString();
      pages.push({ name, url: pageUrl, slug });
    });

    return pages;
  } catch {
    return [];
  }
}

async function upsertStores(supabase: DiscoverySupabaseClient, pages: FacebookPage[]): Promise<number> {
  const stores = pages.map((page) => ({
    name: page.name,
    slug: page.slug,
    base_url: page.url,
    website_url: page.website,
    store_type: "f-commerce" as const,
    scrape_enabled: true,
    crawl_priority: 100,
    topic: "gadgets",
  }));
  const { error } = await supabase.from("stores").upsert(stores, {
    onConflict: "slug",
    ignoreDuplicates: true,
  });
  if (error) {
    console.error("Failed to upsert stores:", error);
    return 0;
  }
  return stores.length;
}

export async function runFreeDiscovery(supabaseOverride?: DiscoverySupabaseClient): Promise<{ discovered: number; total: number }> {
  const supabase = supabaseOverride ??
    createSupabaseClient<DiscoveryDatabase>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const seeds = [
    "site:facebook.com \"gadget\" \"bd\"",
    "site:facebook.com \"gadget shop\" \"dhaka\"",
    "site:facebook.com \"computer shop\" \"chittagong\"",
    "site:facebook.com \"mobile accessories\" \"bangladesh\"",
    "site:facebook.com \"apple store bd\"",
    "site:facebook.com \"gaming pc bd\"",
    "site:facebook.com \"smartwatch bd\"",
    "site:facebook.com \"tech gadget bd\"",
    "site:facebook.com \"gadget repair bd\"",
    "site:facebook.com \"mobile shop bd\"",
    "site:facebook.com \"laptop accessories bd\"",
    "site:facebook.com \"smartphone accessories bd\"",
    "site:facebook.com \"computer parts bd\"",
    "site:facebook.com \"tech accessories bd\"",
    "site:facebook.com \"gaming gear bd\"",
    "site:facebook.com \"electronics shop bd\"",
    "site:facebook.com \"gadget bd\"",
    "site:facebook.com \"tech gadget bd\"",
    "site:facebook.com \"gadget repair bd\"",
    "site:facebook.com \"mobile shop bd\"",
    "site:facebook.com \"laptop accessories bd\"",
    "site:facebook.com \"smartphone accessories bd\"",
    "site:facebook.com \"computer parts bd\"",
    "site:facebook.com \"tech accessories bd\"",
    "site:facebook.com \"gaming gear bd\"",
    "site:facebook.com \"electronics shop bd\"",
    "site:facebook.com \"gadget bd\"",
    "site:facebook.com \"tech gadget bd\"",
    "site:facebook.com \"gadget repair bd\"",
    "site:facebook.com \"mobile shop bd\"",
    "site:facebook.com \"laptop accessories bd\"",
    "site:facebook.com \"smartphone accessories bd\"",
    "site:facebook.com \"computer parts bd\"",
    "site:facebook.com \"tech accessories bd\"",
    "site:facebook.com \"gaming gear bd\"",
    "site:facebook.com \"electronics shop bd\"",
    "site:facebook.com \"gadget bd\"",
    "site:facebook.com \"tech gadget bd\"",
    "site:facebook.com \"gadget repair bd\"",
    "site:facebook.com \"mobile shop bd\"",
    "site:facebook.com \"laptop accessories bd\"",
    "site:facebook.com \"smartphone accessories bd\"",
    "site:facebook.com \"computer parts bd\"",
    "site:facebook.com \"tech accessories bd\"",
    "site:facebook.com \"gaming gear bd\"",
    "site:facebook.com \"electronics shop bd\"",
    "site:facebook.com \"gadget bd\"",
    "site:facebook.com \"tech gadget bd\"",
    "site:facebook.com \"gadget repair bd\"",
    "site:facebook.com \"mobile shop bd\"",
    "site:facebook.com \"laptop accessories bd\"",
    "site:facebook.com \"smartphone accessories bd\"",
    "site:facebook.com \"computer parts bd\"",
    "site:facebook.com \"tech accessories bd\"",
    "site:facebook.com \"gaming gear bd\"",
    "site:facebook.com \"electronics shop bd\"",
    "site:facebook.com \"gadget bd\"",
    "site:facebook.com \"tech gadget bd\"",
    "site:facebook.com \"gadget repair bd\"",
    "site:facebook.com \"mobile shop bd\"",
    "site:facebook.com \"laptop accessories bd\"",
    "site:facebook.com \"smartphone accessories bd\"",
    "site:facebook.com \"computer parts bd\"",
    "site:facebook.com \"tech accessories bd\"",
    "site:facebook.com \"gaming gear bd\"",
    "site:facebook.com \"electronics shop bd\"",
    "site:facebook.com \"gadget bd\"",
    "site:facebook.com \"tech gadget bd\"",
    "site:facebook.com \"gadget repair bd\"",
    "site:facebook.com \"mobile shop bd\"",
    "site:facebook.com \"laptop accessories bd\"",
    "site:facebook.com \"smartphone accessories bd\"",
    "site:facebook.com \"computer parts bd\"",
    "site:facebook.com \"tech accessories bd\"",
    "site:facebook.com \"gaming gear bd\"",
    "site:facebook.com \"electronics shop bd\"",
  ];
  const allPages: FacebookPage[] = [];
  for (const seed of seeds) {
    for (let page = 1; page <= MAX_PAGES_PER_SEED; page++) {
      const pages = await fetchFacebookPages(seed, page);
      allPages.push(...pages);
      if (pages.length === 0 || allPages.length >= MAX_RESULTS_PER_SEED) break;
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }
  const uniquePages = [...new Map(allPages.map((page) => [page.url, page])).values()];
  let discovered = 0;
  for (let i = 0; i < uniquePages.length; i += MAX_STORES_PER_BATCH) {
    const batch = uniquePages.slice(i, i + MAX_STORES_PER_BATCH);
    discovered += await upsertStores(supabase, batch);
  }
  const { count } = await supabase.from("stores").select("*", { count: "exact", head: true });
  return { discovered, total: count ?? 0 };
}
