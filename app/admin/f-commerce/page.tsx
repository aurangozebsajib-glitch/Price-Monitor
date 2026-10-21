"use client";

import { useState } from "react";

type Topic = "gadgets" | "fashion" | "electronics";
type ExtractResponse = {
  extracted?: Array<{
    pageUrl: string;
    name: string | null;
    websiteUrl: string | null;
    error?: string;
  }>;
  stores?: Array<{ name: string; slug: string; base_url: string }>;
  inserted?: number;
  error?: string;
};
type CrawlResponse = {
  storesCrawled?: number;
  productsFound?: number;
  productsSaved?: number;
  message?: string;
  error?: string;
};

const topics: Topic[] = ["gadgets", "fashion", "electronics"];

export default function FCommerceAdminPage() {
  const [urls, setUrls] = useState("");
  const [topic, setTopic] = useState<Topic>("gadgets");
  const [query, setQuery] = useState("");
  const [token, setToken] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [extracted, setExtracted] = useState<ExtractResponse["extracted"]>([]);
  const [crawlResult, setCrawlResult] = useState<CrawlResponse | null>(null);

  async function callAdminApi<T>(path: string, body: object): Promise<T> {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new Error(result.error ?? `Request failed (${response.status}).`);
    }
    return result;
  }

  async function registerFacebookPages() {
    const pageUrls = [...new Set(urls.split(/[\n,]+/).map((url) => url.trim()).filter(Boolean))];
    if (!token.trim()) {
      setNotice("Enter the admin token to continue.");
      return;
    }
    if (!pageUrls.length) {
      setNotice("Paste at least one Facebook Page URL.");
      return;
    }

    setWorking(true);
    setNotice("");
    setCrawlResult(null);
    try {
      const result = await callAdminApi<ExtractResponse>(
        "/api/extract/fb-websites",
        { urls: pageUrls, topic },
      );
      setExtracted(result.extracted ?? []);
      setNotice(
        `${result.inserted ?? 0} store profile(s) registered for ${topic}.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not register pages.");
    } finally {
      setWorking(false);
    }
  }

  async function crawlTopic() {
    if (!token.trim()) {
      setNotice("Enter the admin token to continue.");
      return;
    }
    setWorking(true);
    setNotice("");
    setCrawlResult(null);
    try {
      const result = await callAdminApi<CrawlResponse>("/api/crawl/topic", {
        topic,
        ...(query.trim() ? { query: query.trim() } : {}),
      });
      setCrawlResult(result);
      setNotice(
        result.message ??
          `Crawled ${result.storesCrawled ?? 0} store(s); saved ${result.productsSaved ?? 0} product(s).`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Topic crawl failed.");
    } finally {
      setWorking(false);
    }
  }

  const fieldClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-950 dark:text-white";
  const labelClass = "text-sm font-semibold text-slate-800 dark:text-slate-100";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
            PricePulse admin
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            F-Commerce Static Spider
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Extract public storefront links from Facebook Pages, register them
            under a topic, and run a bounded product crawl across enabled stores.
          </p>
        </header>

        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              Topic
              <select
                className={fieldClass}
                onChange={(event) => setTopic(event.target.value as Topic)}
                value={topic}
              >
                {topics.map((value) => (
                  <option key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Admin token
              <input
                autoComplete="current-password"
                className={fieldClass}
                onChange={(event) => setToken(event.target.value)}
                placeholder="F_COMMERCE_ADMIN_TOKEN"
                type="password"
                value={token}
              />
            </label>
          </div>

          <label className={labelClass}>
            Facebook Page URLs
            <textarea
              className={`${fieldClass} min-h-36 resize-y`}
              onChange={(event) => setUrls(event.target.value)}
              placeholder={"https://www.facebook.com/example-shop\nhttps://www.facebook.com/another-shop"}
              value={urls}
            />
            <span className="mt-2 block text-xs font-normal leading-5 text-slate-500 dark:text-slate-400">
              One URL per line, up to 20 Pages per request. Pages must expose a
              public external website link for automatic registration.
            </span>
          </label>

          <button
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
            disabled={working}
            onClick={registerFacebookPages}
            type="button"
          >
            {working ? "Working..." : "Extract websites & register"}
          </button>

          <div className="border-t border-slate-200 pt-6 dark:border-white/10">
            <label className={labelClass}>
              Optional crawl search phrase
              <input
                className={fieldClass}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Leave blank to search for "${topic}"`}
                value={query}
              />
            </label>
            <button
              className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200 dark:hover:bg-indigo-400/20"
              disabled={working}
              onClick={crawlTopic}
              type="button"
            >
              {working ? "Crawling..." : `Crawl ${topic}`}
            </button>
          </div>

          {notice && (
            <p
              aria-live="polite"
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm dark:bg-white/5"
            >
              {notice}
            </p>
          )}

          {!!extracted?.length && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold">Facebook link extraction</h2>
              {extracted.map((page) => (
                <div
                  className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10"
                  key={page.pageUrl}
                >
                  <p className="font-medium">{page.name ?? page.pageUrl}</p>
                  {page.websiteUrl ? (
                    <a
                      className="mt-1 block break-all text-indigo-600 underline dark:text-indigo-300"
                      href={page.websiteUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {page.websiteUrl}
                    </a>
                  ) : (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      {page.error ?? "No external website found."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {crawlResult && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {crawlResult.storesCrawled ?? 0} stores checked ·{" "}
              {crawlResult.productsFound ?? 0} products found ·{" "}
              {crawlResult.productsSaved ?? 0} products saved
            </p>
          )}
        </section>

        <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Configure server-only <code>F_COMMERCE_ADMIN_TOKEN</code> and{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>. The token is sent only to the
          admin API over HTTPS and is not saved in the browser.
        </p>
      </div>
    </main>
  );
}
