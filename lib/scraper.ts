import { load } from "cheerio";

export type StoreName = "Star Tech" | "Daraz";

export type ScrapedProduct = {
  url: string;
  store: StoreName;
  title: string;
  currentPrice: number | null;
  originalPrice: number | null;
  image: string | null;
  isOutOfStock: boolean;
};

type JsonObject = Record<string, unknown>;

const USER_AGENT =
  "Mozilla/5.0 (compatible; PricePulse/1.0; +https://pricepulse.app)";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_PRODUCTS_PER_STORE_SEARCH = 2;

const storeRoots: Record<StoreName, string> = {
  "Star Tech": "startech.com.bd",
  Daraz: "daraz.com.bd",
};

export class ScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrapeError";
  }
}

export function getStoreForUrl(input: string): StoreName {
  if (input.length > 2048) {
    throw new ScrapeError("Product URLs must be 2,048 characters or fewer.");
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ScrapeError("Enter a valid product URL.");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new ScrapeError("Only public HTTPS store URLs are supported.");
  }

  const host = url.hostname.toLowerCase();
  for (const [store, root] of Object.entries(storeRoots) as [StoreName, string][]) {
    if (host === root || host.endsWith(`.${root}`)) {
      return store;
    }
  }

  throw new ScrapeError("Only Star Tech and Daraz Bangladesh URLs are supported.");
}

function parsePrice(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const match = String(value).match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const price = Number(match[0].replaceAll(",", ""));
  return Number.isFinite(price) ? price : null;
}

function collectProducts(value: unknown, products: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectProducts(item, products));
  } else if (value && typeof value === "object") {
    const object = value as JsonObject;
    const rawType = object["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    if (types.includes("Product")) {
      products.push(object);
    }
    Object.values(object).forEach((item) => collectProducts(item, products));
  }
  return products;
}

function structuredProducts($: ReturnType<typeof load>): JsonObject[] {
  const products: JsonObject[] = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      collectProducts(JSON.parse($(script).text()), products);
    } catch {
      // Ignore malformed JSON-LD; the HTML selectors below remain available.
    }
  });
  return products;
}

function firstText(
  $: ReturnType<typeof load>,
  selectors: string[],
  attribute?: string,
): string | null {
  for (const selector of selectors) {
    const element = $(selector).first();
    const value = attribute ? element.attr(attribute) : element.text();
    const cleaned = value?.replace(/\s+/g, " ").trim();
    if (cleaned) {
      return cleaned;
    }
  }
  return null;
}

function offerData(product: JsonObject): {
  currentPrice: number | null;
  originalPrice: number | null;
  outOfStock: boolean;
} {
  const rawOffers = product.offers;
  const offers = Array.isArray(rawOffers)
    ? rawOffers
    : rawOffers && typeof rawOffers === "object"
      ? [rawOffers]
      : [];
  let currentPrice: number | null = null;
  let originalPrice: number | null = null;
  let outOfStock = false;

  for (const rawOffer of offers) {
    if (!rawOffer || typeof rawOffer !== "object") {
      continue;
    }
    const offer = rawOffer as JsonObject;
    currentPrice ??= parsePrice(offer.price ?? offer.lowPrice);
    originalPrice ??= parsePrice(offer.highPrice);
    outOfStock ||= String(offer.availability ?? "").toLowerCase().includes("outofstock");
  }

  return { currentPrice, originalPrice, outOfStock };
}

function toAbsoluteUrl(value: string | undefined, pageUrl: string): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value, pageUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchStorePage(input: string): Promise<{ html: string; url: string }> {
  let url = new URL(input);
  getStoreForUrl(url.toString());

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const detail =
        error instanceof Error && error.name === "TimeoutError"
          ? "The store request timed out."
          : "Could not connect to the store.";
      throw new ScrapeError(detail);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        throw new ScrapeError("The store redirected too many times.");
      }
      url = new URL(location, url);
      getStoreForUrl(url.toString());
      continue;
    }

    if (!response.ok) {
      throw new ScrapeError(`The store returned HTTP ${response.status}.`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_HTML_BYTES) {
      throw new ScrapeError("The store page is too large to process.");
    }

    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      throw new ScrapeError("The store page is too large to process.");
    }

    return { html, url: url.toString() };
  }

  throw new ScrapeError("Could not follow the store redirect.");
}

export async function scrapeProductUrl(input: string): Promise<ScrapedProduct> {
  const store = getStoreForUrl(input);
  const { html, url } = await fetchStorePage(input);
  const $ = load(html);
  const products = structuredProducts($);
  const product = products[0];
  const nameFromJson = product?.name;
  const title =
    firstText($, ["h1.product-name", "h1.pdp-mod-product-badge-title", "h1"]) ??
    firstText(
      $,
      ['meta[property="og:title"]', 'meta[name="twitter:title"]'],
      "content",
    ) ??
    (typeof nameFromJson === "string" ? nameFromJson.trim() : "");

  if (!title) {
    throw new ScrapeError("Could not find a product title on the store page.");
  }

  const offer = product ? offerData(product) : null;
  const currentPrice =
    parsePrice(
      firstText(
        $,
        [
          ".price-new",
          ".pdp-price",
          ".product-price",
          "td.product-price",
          '[itemprop="price"]',
          'meta[property="product:price:amount"]',
        ],
        "content",
      ) ?? firstText($, [".price-new", ".pdp-price", ".product-price", "td.product-price", ".price"]),
    ) ?? offer?.currentPrice ?? null;
  const originalPrice =
    parsePrice(firstText($, [".price-old", ".pdp-price_type_deleted", "del", "s"])) ??
    offer?.originalPrice ??
    null;
  const imageUrl =
    firstText($, ['meta[property="og:image"]', 'meta[name="twitter:image"]'], "content") ??
    (typeof product?.image === "string"
      ? product.image
      : Array.isArray(product?.image) && typeof product.image[0] === "string"
        ? product.image[0]
        : null) ??
    firstText(
      $,
      [".product-image img", ".pdp-mod-common-image", "img"],
      "data-src",
    ) ??
    firstText($, [".product-image img", ".pdp-mod-common-image", "img"], "src") ??
    undefined;
  const availability = `${$("body").text()} ${String(product?.offers ?? "")}`.toLowerCase();
  const isOutOfStock =
    Boolean(offer?.outOfStock) ||
    /out of stock|out-of-stock|sold out|stock out/.test(availability);

  return {
    url,
    store,
    title,
    currentPrice,
    originalPrice,
    image: toAbsoluteUrl(imageUrl, url),
    isOutOfStock,
  };
}

function searchUrl(store: StoreName, query: string): string {
  if (store === "Star Tech") {
    const url = new URL("https://www.startech.com.bd/");
    url.searchParams.set("route", "product/search");
    url.searchParams.set("search", query);
    return url.toString();
  }
  const url = new URL("https://www.daraz.com.bd/catalog/");
  url.searchParams.set("q", query);
  return url.toString();
}

function isLikelyProductLink(store: StoreName, href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  try {
    if (getStoreForUrl(url.toString()) !== store) {
      return false;
    }
  } catch {
    return false;
  }

  const path = url.pathname.toLowerCase();
  if (store === "Daraz") {
    return /\.html$/.test(path) && /-i\d+/.test(path);
  }

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0 || segments.length > 2) {
    return false;
  }
  const nonProductPaths = new Set([
    "about-us",
    "account",
    "blog",
    "cart",
    "checkout",
    "component",
    "contact",
    "desktop-pc",
    "laptop-notebook",
    "login",
    "monitor",
    "my-account",
    "network",
    "offers",
    "printer",
    "search",
    "tool",
  ]);
  return !nonProductPaths.has(segments[0]);
}

async function searchOneStore(
  store: StoreName,
  query: string,
): Promise<ScrapedProduct[]> {
  const { html, url: pageUrl } = await fetchStorePage(searchUrl(store, query));
  const $ = load(html);
  const candidates = new Set<string>();

  const selectors = [
    ".product-thumb a[href]",
    ".p-item a[href]",
    ".product-item a[href]",
    '[data-qa-locator="product-item"] a[href]',
    "a[href]",
  ];
  for (const selector of selectors) {
    $(selector).each((_, anchor) => {
      const href = toAbsoluteUrl($(anchor).attr("href"), pageUrl);
      if (href && isLikelyProductLink(store, href)) {
        candidates.add(href);
      }
    });
    if (candidates.size >= MAX_PRODUCTS_PER_STORE_SEARCH) {
      break;
    }
  }

  return Promise.all(
    [...candidates]
      .slice(0, MAX_PRODUCTS_PER_STORE_SEARCH)
      .map((productUrl) => scrapeProductUrl(productUrl)),
  );
}

export async function searchStoreProducts(query: string): Promise<ScrapedProduct[]> {
  const stores: StoreName[] = ["Star Tech", "Daraz"];
  const results = await Promise.allSettled(
    stores.map((store) => searchOneStore(store, query)),
  );
  const successfulResults = results.filter(
    (result): result is PromiseFulfilledResult<ScrapedProduct[]> =>
      result.status === "fulfilled",
  );

  if (successfulResults.length === 0) {
    throw new ScrapeError("Both Star Tech and Daraz searches failed.");
  }

  return successfulResults.flatMap((result) => result.value);
}
