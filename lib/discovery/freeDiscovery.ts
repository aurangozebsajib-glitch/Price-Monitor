/**
 * Free discovery methods for finding Bangladeshi e-commerce stores.
 * No paid APIs, no proxies - 100% free.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 50;

export type DiscoveredStore = {
  name: string;
  url: string;
  source: "footer" | "duckduckgo" | "facebook";
  confidence: number;
};

/**
 * Method 1: Footer link chain discovery
 */
export async function discoverFromFooter(
  storeUrl: string,
): Promise<DiscoveredStore[]> {
  const discovered: DiscoveredStore[] = [];
  const seen = new Set<string>();

  try {
    const response = await fetch(storeUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const linkRegex = /href=["']([^"']+)["']/gi;
    const domainRegex =
      /^https?:\/\/(?:www\.)?([a-z0-9-]+\.com\.bd)(?:\/|$)/i;

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const domainMatch = domainRegex.exec(href);
      if (domainMatch) {
        const domain = domainMatch[1].toLowerCase();
        if (seen.has(domain)) continue;
        seen.add(domain);

        const name = domain
          .replace(/\.com\.bd$/, "")
          .replace(/-/g, " ")
          .replace(/\w/g, (c) => c.toUpperCase());

        discovered.push({
          name,
          url: `https://${domain}`,
          source: "footer",
          confidence: 0.7,
        });
      }
    }
  } catch {
    // Silently fail
  }

  return discovered.slice(0, MAX_RESULTS);
}


/**
 * Method 2: DuckDuckGo HTML scraping
 * Searches DuckDuckGo for Bangladeshi e-commerce stores
 */
export async function discoverFromDuckDuckGo(
  query: string,
): Promise<DiscoveredStore[]> {
  const discovered: DiscoveredStore[] = [];
  const seen = new Set<string>();

  try {
    const searchUrl =
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return [];

    const html = await response.text();

    const linkRegex = /href="([^"]+)"/gi;
    const domainRegex =
      /^https?:\/\/(?:www\.)?([a-z0-9-]+\.com\.bd)(?:\/|$)/i;

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let href = match[1];

      // DuckDuckGo wraps URLs in redirect links
      if (href.includes("duckduckgo.com/l/")) {
        const urlParam = new URL(
          href,
          "https://html.duckduckgo.com",
        ).searchParams.get("uddg");
        if (urlParam) href = urlParam;
      }

      const domainMatch = domainRegex.exec(href);
      if (domainMatch) {
        const domain = domainMatch[1].toLowerCase();
        if (seen.has(domain)) continue;
        seen.add(domain);

        const name = domain
          .replace(/\.com\.bd$/, "")
          .replace(/-/g, " ")
          .replace(/\w/g, (c) => c.toUpperCase());

        discovered.push({
          name,
          url: `https://${domain}`,
          source: "duckduckgo",
          confidence: 0.6,
        });
      }
    }
  } catch {
    // Silently fail
  }

  return discovered.slice(0, MAX_RESULTS);
}


/**
 * Method 3: Facebook Pages "about website" extraction
 * Extracts website URLs from Facebook page "About" sections
 */
export async function discoverFromFacebookAbout(
  pageId: string,
): Promise<DiscoveredStore[]> {
  const discovered: DiscoveredStore[] = [];

  try {
    const url =
      `https://www.facebook.com/plugins/page.php?href=https://www.facebook.com/${pageId}&show_posts=c&show_faces=c&header=c&small_header=c&adapt_container_width=c`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return [];

    const html = await response.text();

    const websiteRegex =
      /https?:\/\/(?:www\.)?([a-z0-9-]+\.com\.bd)(?:\/|$)/gi;

    let match;
    const foundDomains = new Set<string>();
    while ((match = websiteRegex.exec(html)) !== null) {
      const domain = match[1].toLowerCase();
      if (foundDomains.has(domain)) continue;
      foundDomains.add(domain);

      const name = domain
        .replace(/\.com\.bd$/, "")
        .replace(/-/g, " ")
        .replace(/\w/g, (c) => c.toUpperCase());

      discovered.push({
        name,
        url: `https://${domain}`,
        source: "facebook",
        confidence: 0.8,
      });
    }
  } catch {
    // Silently fail
  }

  return discovered.slice(0, MAX_RESULTS);
}

/**
 * Run all free discovery methods and deduplicate results
 */
export async function runFreeDiscovery(options: {
  seedStores?: string[];
  queries?: string[];
  facebookPageIds?: string[];
} = {}): Promise<DiscoveredStore[]> {
  const allResults: DiscoveredStore[] = [];
  const seen = new Set<string>();

  const addResults = (results: DiscoveredStore[]) => {
    for (const r of results) {
      const key = r.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      allResults.push(r);
    }
  };

  // Method 1: Footer link chain from seed stores
  if (options.seedStores) {
    for (const storeUrl of options.seedStores) {
      const results = await discoverFromFooter(storeUrl);
      addResults(results);
    }
  }

  // Method 2: DuckDuckGo HTML scraping
  if (options.queries) {
    for (const query of options.queries) {
      const results = await discoverFromDuckDuckGo(query);
      addResults(results);
    }
  }

  // Method 3: Facebook about website extraction
  if (options.facebookPageIds) {
    for (const pageId of options.facebookPageIds) {
      const results = await discoverFromFacebookAbout(pageId);
      addResults(results);
    }
  }

  return allResults;
}
