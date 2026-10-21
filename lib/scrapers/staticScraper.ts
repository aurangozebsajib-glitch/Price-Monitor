import { isIP } from "node:net";
import { load } from "cheerio";

export type StoreScraperProfile = {
  id: string;
  name: string;
  slug: string;
  type: "ecommerce" | "f-commerce";
  topic: string;
  base_url: string;
  search_url_template: string;
  product_container_selector: string | null;
  product_link_selector: string | null;
  pagination_selector: string | null;
  title_selector: string | null;
  price_selector: string | null;
  image_selector: string | null;
  availability_selector: string | null;
};

export type StaticScrapedProduct = {
  url: string;
  store: string;
  title: string;
  currentPrice: number | null;
  originalPrice: number | null;
  image: string | null;
  isOutOfStock: boolean;
};

type JsonObject = Record<string, unknown>;
type ParsedProduct = Omit<StaticScrapedProduct, "store">;

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_PAGES_PER_STORE = 2;
const MAX_PRODUCTS_PER_STORE = 5;
const STORE_BATCH_SIZE = 5;

export class StaticScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaticScrapeError";
  }
}

function safeBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StaticScrapeError("Store configuration has an invalid base URL.");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    isIP(hostname) ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new StaticScrapeError("Store configuration must use a public HTTPS domain.");
  }
  return url;
}

function assertStoreUrl(input: string, baseUrl: URL): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new StaticScrapeError("Store URL is invalid.");
  }

  const hostname = url.hostname.toLowerCase();
  const baseHostname = baseUrl.hostname.toLowerCase().replace(/^www\./, "");
  const normalizedHostname = hostname.replace(/^www\./, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (normalizedHostname !== baseHostname &&
      !normalizedHostname.endsWith(`.${baseHostname}`))
  ) {
    throw new StaticScrapeError("URL is outside the configured store domain.");
  }
  return url;
}

async function fetchHtml(input: string, profile: StoreScraperProfile) {
  const baseUrl = safeBaseUrl(profile.base_url);
  let url = assertStoreUrl(input, baseUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; PricePulse/1.0; +https://pricepulse.app)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-BD,en;q=0.9",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new StaticScrapeError(
        error instanceof Error && error.name === "TimeoutError"
          ? `Request to ${profile.name} timed out.`
          : `Could not connect to ${profile.name}.`,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        throw new StaticScrapeError(`${profile.name} redirected too many times.`);
      }
      url = assertStoreUrl(new URL(location, url).toString(), baseUrl);
      continue;
    }
    if (!response.ok) {
      throw new StaticScrapeError(
        `${profile.name} returned HTTP ${response.status}.`,
      );
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_HTML_BYTES) {
      throw new StaticScrapeError(`${profile.name} page is too large to process.`);
    }
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      throw new StaticScrapeError(`${profile.name} page is too large to process.`);
    }
    return { html, url: url.toString() };
  }
  throw new StaticScrapeError(`Could not follow ${profile.name} redirect.`);
}

function parsePrice(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const price = Number(match[0].replaceAll(",", ""));
  return Number.isFinite(price) ? price : null;
}

function collectProducts(value: unknown, products: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectProducts(entry, products));
  } else if (value && typeof value === "object") {
    const object = value as JsonObject;
    const rawType = object["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    if (
      types.some(
        (type) =>
          typeof type === "string" &&
          type.split(/[\/#]/).at(-1)?.toLowerCase() === "product",
      )
    ) {
      products.push(object);
    }
    Object.values(object).forEach((entry) => collectProducts(entry, products));
  }
  return products;
}

function readJsonLd($: ReturnType<typeof load>): JsonObject[] {
  const products: JsonObject[] = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      collectProducts(JSON.parse($(script).text()), products);
    } catch {
      // Malformed structured data is skipped so metadata and selectors can be tried.
    }
  });
  return products;
}

function textFromSelector(
  $: ReturnType<typeof load>,
  selector: string | null,
  attribute?: string,
): string | null {
  if (!selector) return null;
  const element = $(selector).first();
  const value = attribute ? element.attr(attribute) : element.text();
  return value?.replace(/\s+/g, " ").trim() || null;
}

function metaContent(
  $: ReturnType<typeof load>,
  selectors: string[],
): string | null {
  for (const selector of selectors) {
    const value = $(selector).first().attr("content")?.trim();
    if (value) return value;
  }
  return null;
}

function offerValues(product: JsonObject | undefined) {
  const rawOffers = product?.offers;
  const offers = Array.isArray(rawOffers)
    ? rawOffers
    : rawOffers && typeof rawOffers === "object"
      ? [rawOffers]
      : [];
  let currentPrice: number | null = null;
  let originalPrice: number | null = null;
  let isOutOfStock = false;
  for (const value of offers) {
    if (!value || typeof value !== "object") continue;
    const offer = value as JsonObject;
    currentPrice ??= parsePrice(offer.price ?? offer.lowPrice);
    originalPrice ??= parsePrice(offer.highPrice);
    isOutOfStock ||= String(offer.availability ?? "")
      .toLowerCase()
      .includes("outofstock");
  }
  return { currentPrice, originalPrice, isOutOfStock };
}

function imageFromProduct(product: JsonObject | undefined): string | null {
  const image = product?.image;
  if (typeof image === "string") return image;
  if (Array.isArray(image) && typeof image[0] === "string") return image[0];
  if (image && typeof image === "object" && "url" in image) {
    return typeof image.url === "string" ? image.url : null;
  }
  return null;
}

function absoluteHttpsUrl(value: string | null, pageUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, pageUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseProductHtml(
  html: string,
  pageUrl: string,
  profile: StoreScraperProfile,
): ParsedProduct {
  const $ = load(html);
  const product = readJsonLd($)[0];
  const offers = offerValues(product);

  const title =
    (typeof product?.name === "string" ? product.name.trim() : "") ||
    metaContent($, [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ]) ||
    textFromSelector($, profile.title_selector) ||
    $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!title) {
    throw new StaticScrapeError("Could not find a product title.");
  }

  const selectorPrice = parsePrice(
    textFromSelector($, profile.price_selector) ??
      textFromSelector($, profile.price_selector, "content"),
  );
  const currentPrice =
    offers.currentPrice ??
    parsePrice(
      metaContent($, [
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        'meta[itemprop="price"]',
      ]),
    ) ??
    selectorPrice;
  const originalPrice =
    offers.originalPrice ??
    parsePrice(
      metaContent($, [
        'meta[property="product:original_price:amount"]',
        'meta[property="og:price:standard_amount"]',
      ]),
    );
  const image =
    imageFromProduct(product) ??
    metaContent($, [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
    ]) ??
    textFromSelector($, profile.image_selector, "src") ??
    textFromSelector($, profile.image_selector, "data-src");
  const availability =
    `${JSON.stringify(product?.offers ?? "")} ${textFromSelector($, profile.availability_selector) ?? ""} ${$("body").text()}`
      .toLowerCase();

  return {
    url: pageUrl,
    title: title.replace(/\s+/g, " ").trim(),
    currentPrice,
    originalPrice,
    image: absoluteHttpsUrl(image, pageUrl),
    isOutOfStock: offers.isOutOfStock || /out of stock|sold out|stock out/.test(availability),
  };
}

function buildSearchUrl(profile: StoreScraperProfile, query: string, page: number) {
  const encodedQuery = encodeURIComponent(query);
  const rawUrl = profile.search_url_template
    .replaceAll("{query}", encodedQuery)
    .replaceAll("{page}", String(page));
  return assertStoreUrl(new URL(rawUrl, profile.base_url).toString(), safeBaseUrl(profile.base_url));
}

function productLinks(
  html: string,
  pageUrl: string,
  profile: StoreScraperProfile,
): string[] {
  const $ = load(html);
  const selector = profile.product_link_selector || "a[href]";
  const baseUrl = safeBaseUrl(profile.base_url);
  const links = new Set<string>();
  const containers = profile.product_container_selector
    ? $(profile.product_container_selector)
    : null;
  const candidates = containers
    ? containers.filter(selector).add(containers.find(selector))
    : $(selector);
  candidates.each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    try {
      const url = assertStoreUrl(new URL(href, pageUrl).toString(), baseUrl);
      if (url.pathname !== "/" && !/\/(cart|account|login|search)(\/|$)/i.test(url.pathname)) {
        links.add(url.toString());
      }
    } catch {
      return;
    }
  });
  return [...links];
}

function paginationUrl(html: string, pageUrl: string, profile: StoreScraperProfile) {
  if (!profile.pagination_selector) return null;
  const $ = load(html);
  const href = $(profile.pagination_selector).first().attr("href");
  if (!href) return null;
  try {
    return assertStoreUrl(
      new URL(href, pageUrl).toString(),
      safeBaseUrl(profile.base_url),
    ).toString();
  } catch {
    return null;
  }
}

async function mapInBatches<T, R>(
  values: T[],
  batchSize: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < values.length; index += batchSize) {
    const batch = values.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(mapper))));
  }
  return results;
}

async function searchOneStore(
  profile: StoreScraperProfile,
  query: string,
): Promise<StaticScrapedProduct[]> {
  const candidates = new Set<string>();
  let pageUrl: string | null = buildSearchUrl(profile, query, 1).toString();

  for (let page = 1; page <= MAX_PAGES_PER_STORE && pageUrl; page += 1) {
    const fetched = await fetchHtml(pageUrl, profile);
    productLinks(fetched.html, fetched.url, profile)
      .slice(0, MAX_PRODUCTS_PER_STORE)
      .forEach((url) => candidates.add(url));
    if (candidates.size >= MAX_PRODUCTS_PER_STORE) break;

    pageUrl =
      paginationUrl(fetched.html, fetched.url, profile) ??
      (profile.search_url_template.includes("{page}")
        ? buildSearchUrl(profile, query, page + 1).toString()
        : null);
  }

  const products = await mapInBatches(
    [...candidates].slice(0, MAX_PRODUCTS_PER_STORE),
    STORE_BATCH_SIZE,
    async (url): Promise<StaticScrapedProduct> => {
      const fetched = await fetchHtml(url, profile);
      return {
        ...parseProductHtml(fetched.html, fetched.url, profile),
        store: profile.name,
      };
    },
  );
  return products;
}

export async function searchConfiguredStoresDetailed(
  profiles: StoreScraperProfile[],
  query: string,
): Promise<{
  products: StaticScrapedProduct[];
  errors: Array<{ store: string; error: string }>;
}> {
  const results: StaticScrapedProduct[] = [];
  const errors: Array<{ store: string; error: string }> = [];
  for (let index = 0; index < profiles.length; index += STORE_BATCH_SIZE) {
    const batch = profiles.slice(index, index + STORE_BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((profile) => searchOneStore(profile, query)),
    );
    for (const [resultIndex, result] of settled.entries()) {
      if (result.status === "fulfilled") {
        results.push(...result.value);
      } else {
        const reason =
          result.reason instanceof Error ? result.reason.message : "Store search failed.";
        errors.push({ store: batch[resultIndex].name, error: reason });
      }
    }
  }
  return { products: results, errors };
}

export async function searchConfiguredStores(
  profiles: StoreScraperProfile[],
  query: string,
): Promise<StaticScrapedProduct[]> {
  const { products } = await searchConfiguredStoresDetailed(profiles, query);
  return products;
}

export async function scrapeConfiguredProduct(
  profile: StoreScraperProfile,
  input: string,
): Promise<StaticScrapedProduct> {
  const safeUrl = assertStoreUrl(input, safeBaseUrl(profile.base_url));
  const fetched = await fetchHtml(safeUrl.toString(), profile);
  return {
    ...parseProductHtml(fetched.html, fetched.url, profile),
    store: profile.name,
  };
}
