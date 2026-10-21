import { isIP } from "node:net";
import { load } from "cheerio";
import { NextResponse } from "next/server";
import {
  createAdminSupabaseClient,
  isFCommerceAdminRequest,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_URLS = 20;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const FACEBOOK_HOSTS = ["facebook.com", "fb.com"];
const RESERVED_HOSTS = [
  "facebook.com",
  "fb.com",
  "meta.com",
  "instagram.com",
  "messenger.com",
  "whatsapp.com",
];
const TOPICS = new Set(["gadgets", "fashion", "electronics"]);

type ExtractedPage = {
  pageUrl: string;
  name: string | null;
  websiteUrl: string | null;
  error?: string;
};

function isHostOrSubdomain(hostname: string, domains: string[]) {
  return domains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function validateFacebookUrl(input: string): URL {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !isHostOrSubdomain(url.hostname.toLowerCase(), FACEBOOK_HOSTS)
  ) {
    throw new Error("Only HTTPS Facebook Page URLs are accepted.");
  }
  return url;
}

function externalWebsite(rawHref: string, pageUrl: string): string | null {
  try {
    let candidate = new URL(rawHref, pageUrl);
    if (
      candidate.hostname.toLowerCase() === "l.facebook.com" &&
      candidate.pathname === "/l.php"
    ) {
      const redirectTarget = candidate.searchParams.get("u");
      if (!redirectTarget) return null;
      candidate = new URL(redirectTarget);
    }

    const hostname = candidate.hostname.toLowerCase();
    if (
      candidate.protocol !== "https:" ||
      candidate.username ||
      candidate.password ||
      candidate.port ||
      isIP(hostname) ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      isHostOrSubdomain(hostname, RESERVED_HOSTS)
    ) {
      return null;
    }

    candidate.hash = "";
    return candidate.toString();
  } catch {
    return null;
  }
}

async function extractPage(pageUrl: string): Promise<ExtractedPage> {
  try {
    let url = validateFacebookUrl(pageUrl);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PricePulse/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(7_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Facebook redirected without a target.");
      url = validateFacebookUrl(new URL(location, url).toString());
      const redirected = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PricePulse/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(7_000),
      });
      if (!redirected.ok) {
        throw new Error(`Facebook returned HTTP ${redirected.status}.`);
      }
      const length = Number(redirected.headers.get("content-length") ?? 0);
      if (length > MAX_HTML_BYTES) throw new Error("Facebook page is too large.");
      const html = await redirected.text();
      if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
        throw new Error("Facebook page is too large.");
      }
      return parsePageHtml(html, pageUrl);
    }

    if (!response.ok) throw new Error(`Facebook returned HTTP ${response.status}.`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_HTML_BYTES) throw new Error("Facebook page is too large.");
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      throw new Error("Facebook page is too large.");
    }
    return parsePageHtml(html, pageUrl);
  } catch (error) {
    return {
      pageUrl,
      name: null,
      websiteUrl: null,
      error: error instanceof Error ? error.message : "Could not read Facebook page.",
    };
  }
}

function parsePageHtml(html: string, pageUrl: string): ExtractedPage {
  const $ = load(html);
  const name =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    null;
  const links = new Set<string>();
  $('a[href]').each((_, element) => {
    const url = externalWebsite($(element).attr("href") ?? "", pageUrl);
    if (url) links.add(url);
  });
  return {
    pageUrl,
    name,
    websiteUrl: [...links][0] ?? null,
    ...(!links.size
      ? { error: "No public external website link was found on the page." }
      : {}),
  };
}

function toStoreName(name: string | null, websiteUrl: string): string {
  if (name) {
    return name
      .replace(/\s*\|\s*Facebook.*$/i, "")
      .replace(/\s*-\s*Facebook.*$/i, "")
      .trim()
      .slice(0, 120);
  }
  return new URL(websiteUrl).hostname.replace(/^www\./, "");
}

function storeSlug(websiteUrl: string): string {
  const hostname = new URL(websiteUrl).hostname
    .toLowerCase()
    .replace(/^www\./, "");
  return hostname
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 45);
}

export async function POST(request: Request) {
  if (!process.env.F_COMMERCE_ADMIN_TOKEN) {
    return NextResponse.json(
      { success: false, error: "F-commerce admin is not configured." },
      { status: 503 },
    );
  }
  if (!isFCommerceAdminRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Request body must be an object." },
      { status: 400 },
    );
  }

  const input = body as { urls?: unknown; topic?: unknown };
  const topic = typeof input.topic === "string" ? input.topic : "";
  const urls = Array.isArray(input.urls)
    ? [...new Set(input.urls.filter((url): url is string => typeof url === "string").map((url) => url.trim()).filter(Boolean))]
    : [];
  if (!TOPICS.has(topic)) {
    return NextResponse.json(
      { success: false, error: "Topic must be gadgets, fashion, or electronics." },
      { status: 400 },
    );
  }
  if (!urls.length || urls.length > MAX_URLS) {
    return NextResponse.json(
      { success: false, error: `Provide between 1 and ${MAX_URLS} Facebook Page URLs.` },
      { status: 400 },
    );
  }
  if (urls.some((url) => url.length > 2048)) {
    return NextResponse.json(
      { success: false, error: "Facebook URLs must be 2,048 characters or fewer." },
      { status: 400 },
    );
  }

  const extracted: ExtractedPage[] = [];
  for (let index = 0; index < urls.length; index += 5) {
    const batch = await Promise.all(urls.slice(index, index + 5).map(extractPage));
    extracted.push(...batch);
  }
  const candidates = extracted.filter(
    (page): page is ExtractedPage & { websiteUrl: string } =>
      page.websiteUrl !== null,
  );

  if (!candidates.length) {
    return NextResponse.json({
      success: true,
      extracted,
      stores: [],
      inserted: 0,
    });
  }

  try {
    const supabase = createAdminSupabaseClient();
    const rowsBySlug = new Map<string, Record<string, unknown>>();
    for (const page of candidates) {
      const baseUrl = new URL(page.websiteUrl).origin;
      const row = {
        name: toStoreName(page.name, page.websiteUrl),
        slug: storeSlug(page.websiteUrl),
        country_code: "BD",
        type: "f-commerce",
        topic,
        base_url: baseUrl,
        website_url: page.websiteUrl,
        search_url_template: "/search?q={query}",
        product_container_selector: null,
        product_link_selector: "a[href]",
        pagination_selector: null,
        title_selector: "h1",
        price_selector: null,
        image_selector: "img",
        availability_selector: null,
        scrape_enabled: true,
        crawl_priority: 50,
      };
      rowsBySlug.set(row.slug, row);
    }
    const rows = [...rowsBySlug.values()];
    const { data, error } = await supabase
      .from("stores")
      .upsert(rows, { onConflict: "slug" })
      .select("name, slug, topic, base_url, scrape_enabled");
    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      extracted,
      stores: data ?? [],
      inserted: data?.length ?? 0,
    });
  } catch (error) {
    console.error("Facebook website registry update failed:", error);
    return NextResponse.json(
      {
        success: false,
        extracted,
        error:
          error instanceof Error
            ? error.message
            : "Could not save extracted stores.",
      },
      { status: 500 },
    );
  }
}
