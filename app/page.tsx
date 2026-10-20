"use client";

import { FormEvent, useMemo, useState } from "react";

type PricePoint = { price: number; date: string };
type Product = {
  id: string;
  title: string;
  store: string;
  currentPrice: number | null;
  originalPrice: number | null;
  image: string | null;
  url?: string;
  isOutOfStock: boolean;
  priceHistory: PricePoint[];
};
type ApiProduct = Omit<Product, "id"> & { _id?: string };
type Country = "BD" | "US" | "Global";
type Range = "7D" | "30D" | "90D";

const demoProducts: Product[] = [
  {
    id: "demo-anker",
    title: "Anker Soundcore R50i NC",
    store: "Star Tech",
    currentPrice: 2190,
    originalPrice: 2790,
    image: null,
    url: "https://www.startech.com.bd/anker-soundcore-r50i-nc",
    isOutOfStock: false,
    priceHistory: [
      { price: 2790, date: "2026-09-24" },
      { price: 2690, date: "2026-09-28" },
      { price: 2490, date: "2026-10-03" },
      { price: 2390, date: "2026-10-08" },
      { price: 2290, date: "2026-10-13" },
      { price: 2190, date: "2026-10-20" },
    ],
  },
  {
    id: "demo-logitech",
    title: "Logitech G102 Lightsync Gaming Mouse",
    store: "Daraz",
    currentPrice: 1699,
    originalPrice: 2250,
    image: null,
    url: "https://www.daraz.com.bd/products/logitech-g102-i123.html",
    isOutOfStock: false,
    priceHistory: [
      { price: 2250, date: "2026-09-24" },
      { price: 2190, date: "2026-09-28" },
      { price: 1990, date: "2026-10-03" },
      { price: 1890, date: "2026-10-08" },
      { price: 1799, date: "2026-10-13" },
      { price: 1699, date: "2026-10-20" },
    ],
  },
  {
    id: "demo-redmi",
    title: "Xiaomi Redmi Buds 6 Play",
    store: "Facebook Pages",
    currentPrice: 1290,
    originalPrice: 1590,
    image: null,
    isOutOfStock: false,
    priceHistory: [
      { price: 1590, date: "2026-09-24" },
      { price: 1590, date: "2026-09-28" },
      { price: 1490, date: "2026-10-03" },
      { price: 1390, date: "2026-10-08" },
      { price: 1390, date: "2026-10-13" },
      { price: 1290, date: "2026-10-20" },
    ],
  },
];

function StoreBadge({ store }: { store: string }) {
  const style =
    store === "Daraz"
      ? "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-400/10 dark:text-orange-300 dark:ring-orange-300/20"
      : store === "Facebook Pages"
        ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-300/20"
        : "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-300/20";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${style}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {store}
    </span>
  );
}

function PriceHistoryChart({
  product,
  range,
  compact = false,
}: {
  product: Product;
  range: Range;
  compact?: boolean;
}) {
  const points = useMemo(() => {
    const count = range === "7D" ? 4 : range === "30D" ? 6 : product.priceHistory.length;
    return product.priceHistory.slice(-Math.max(2, count));
  }, [product.priceHistory, range]);
  const values = points.map((point) => point.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const coords = values.map((price, index) => ({
    x: (index / Math.max(1, values.length - 1)) * 700,
    y: 176 - ((price - min) / spread) * 136,
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `0,190 ${line} 700,190`;

  return (
    <div className="mt-5">
      {points.length > 1 ? (
        <svg
          aria-label={`Price history for ${product.title}`}
          className={`${compact ? "h-12" : "h-48"} w-full overflow-visible`}
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 700 200"
        >
          {[40, 85, 130, 175].map((y) => (
            <line
              className="stroke-slate-200 dark:stroke-white/10"
              key={y}
              x1="0"
              x2="700"
              y1={y}
              y2={y}
              strokeDasharray="4 7"
            />
          ))}
          <polygon fill="url(#history-gradient)" points={area} />
          <polyline
            fill="none"
            points={line}
            stroke="#6366f1"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
            vectorEffect="non-scaling-stroke"
          />
          {coords.map((point, index) => (
            <circle
              className="fill-indigo-500 stroke-white dark:stroke-slate-900"
              cx={point.x}
              cy={point.y}
              key={`${points[index].date}-${index}`}
              r="5"
              strokeWidth="3"
            >
              <title>{`${points[index].date}: ${points[index].price}`}</title>
            </circle>
          ))}
          <defs>
            <linearGradient id="history-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity=".28" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      ) : (
        <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
          Add price checks to build a history chart.
        </div>
      )}
      {!compact && <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{points[0]?.date ?? "—"}</span>
        <span>{points.at(-1)?.date ?? "Today"}</span>
      </div>}
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState(demoProducts);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"name" | "link">("name");
  const [message, setMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [country, setCountry] = useState<Country>("BD");
  const [darkMode, setDarkMode] = useState(false);
  const [sortOrder, setSortOrder] = useState<"low" | "high">("low");
  const [selectedProductId, setSelectedProductId] = useState(demoProducts[0].id);
  const [chartRange, setChartRange] = useState<Range>("30D");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertSaved, setAlertSaved] = useState(false);
  const [alertProduct, setAlertProduct] = useState<Product | null>(null);
  const [alertTarget, setAlertTarget] = useState("");

  const sortedProducts = useMemo(
    () =>
      [...products].sort((a, b) => {
        if (a.currentPrice === null) return 1;
        if (b.currentPrice === null) return -1;
        return sortOrder === "low"
          ? a.currentPrice - b.currentPrice
          : b.currentPrice - a.currentPrice;
      }),
    [products, sortOrder],
  );
  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? products[0];

  function formatPrice(price: number | null): string {
    if (price === null) return "Price unavailable";
    return `৳${new Intl.NumberFormat("en-BD", {
      maximumFractionDigits: 2,
    }).format(price)}`;
  }

  async function searchProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = query.trim();
    if (!input) {
      setMessage(searchMode === "link" ? "Paste a product link to track." : "Enter a product to search.");
      return;
    }

    setMessage("");
    setIsSearching(true);
    const isLink = searchMode === "link" || /^https?:\/\//i.test(input);
    try {
      const response = isLink
        ? await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: input }),
          })
        : await fetch(`/api/search?q=${encodeURIComponent(input)}`);
      const result = (await response.json()) as { error?: string; products?: ApiProduct[] };
      if (!response.ok) throw new Error(result.error ?? "Could not find products.");

      const found: Product[] = (result.products ?? []).map((item, index) => ({
        id: item._id ?? `${item.store}-${item.url}-${index}`,
        title: item.title,
        store: item.store,
        currentPrice: item.currentPrice,
        originalPrice: item.originalPrice,
        image: item.image,
        url: item.url,
        isOutOfStock: item.isOutOfStock,
        priceHistory: item.priceHistory ?? [],
      }));
      setProducts(found);
      if (found[0]) setSelectedProductId(found[0].id);
      setMessage(found.length ? `Found ${found.length} live result${found.length === 1 ? "" : "s"}.` : "No matching products found.");
      setQuery("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }

  function openAlert(product: Product | null = selectedProduct ?? null) {
    setAlertProduct(product);
    setAlertTarget("");
    setAlertOpen(true);
  }

  function saveAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlertOpen(false);
    setAlertSaved(true);
  }

  return (
    <main className={darkMode ? "dark" : ""}>
      <div className="min-h-screen overflow-hidden bg-[#f5f6ff] text-slate-900 transition-colors dark:bg-[#0c1020] dark:text-slate-100">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-44 h-[30rem] w-[30rem] rounded-full bg-indigo-300/30 blur-[110px] dark:bg-indigo-600/20" />
          <div className="absolute -right-40 top-72 h-[32rem] w-[32rem] rounded-full bg-violet-300/25 blur-[120px] dark:bg-violet-700/15" />
        </div>

        <header className="sticky top-0 z-40 border-b border-white/60 bg-white/65 backdrop-blur-2xl dark:border-white/[.08] dark:bg-slate-950/55">
          <div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-8">
            <a aria-label="PricePulse home" className="flex items-center gap-2.5" href="#">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold text-white shadow-lg shadow-indigo-500/25">P</span>
              <span className="text-lg font-bold tracking-tight">Price<span className="text-indigo-500">Pulse</span></span>
            </a>
            <nav className="hidden items-center gap-7 text-sm font-medium text-slate-500 md:flex dark:text-slate-400">
              <a className="text-indigo-600 dark:text-indigo-300" href="#comparison">Compare prices</a>
              <a className="transition hover:text-indigo-600 dark:hover:text-indigo-300" href="#history">Price history</a>
              <a className="transition hover:text-indigo-600 dark:hover:text-indigo-300" href="#drops">Top drops</a>
            </nav>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="country">Select country</label>
              <select
                className="rounded-xl border border-white/80 bg-white/70 px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm outline-none backdrop-blur transition focus:border-indigo-300 dark:border-white/10 dark:bg-white/[.06] dark:text-slate-200"
                id="country"
                onChange={(event) => setCountry(event.target.value as Country)}
                value={country}
              >
                <option value="BD">🇧🇩 BD</option>
                <option value="US">🇺🇸 US</option>
                <option value="Global">🌐 Global</option>
              </select>
              <button
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/80 bg-white/70 text-lg shadow-sm transition hover:-translate-y-0.5 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[.06] dark:hover:text-indigo-300"
                onClick={() => setDarkMode((value) => !value)}
                type="button"
              >
                {darkMode ? "☀" : "☾"}
              </button>
              <button className="hidden rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 sm:block" onClick={() => openAlert()} type="button">
                + Price alert
              </button>
            </div>
          </div>
        </header>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
          <section className="grid items-center gap-9 pb-12 pt-12 sm:pb-16 sm:pt-16 lg:grid-cols-[1.12fr_.88fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-300/15 dark:bg-indigo-400/10 dark:text-indigo-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                </span>
                Bangladesh’s smarter way to shop
              </div>
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-.05em] sm:text-6xl lg:text-7xl">
                Catch the price.
                <br />
                <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">Not the regret.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-400">
                Compare prices across your favorite stores and know when it’s the right time to buy.
              </p>
              <div className="mt-8 max-w-2xl rounded-[26px] border border-white/80 bg-white/65 p-2.5 shadow-[0_24px_80px_rgba(79,70,229,.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.055]">
                <div aria-label="Search method" className="flex gap-1 p-1" role="tablist">
                  <button
                    aria-selected={searchMode === "name"}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition sm:px-4 ${searchMode === "name" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-500 hover:bg-white/80 dark:text-slate-400 dark:hover:bg-white/[.06]"}`}
                    onClick={() => { setSearchMode("name"); setMessage(""); }}
                    role="tab"
                    type="button"
                  >
                    ⌕ &nbsp;Search by Product Name
                  </button>
                  <button
                    aria-selected={searchMode === "link"}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition sm:px-4 ${searchMode === "link" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-500 hover:bg-white/80 dark:text-slate-400 dark:hover:bg-white/[.06]"}`}
                    onClick={() => { setSearchMode("link"); setMessage(""); }}
                    role="tab"
                    type="button"
                  >
                    ↗ &nbsp;Track by Product Link
                  </button>
                </div>
                <form className="mt-1" onSubmit={searchProducts}>
                  <label className="sr-only" htmlFor="product-search">{searchMode === "name" ? "Search product name" : "Product URL"}</label>
                  <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-2 sm:flex-row sm:items-center dark:border-white/10 dark:bg-slate-950/40">
                    <span aria-hidden="true" className="hidden pl-3 text-xl text-slate-400 sm:block">{searchMode === "name" ? "⌕" : "↗"}</span>
                    <input
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-slate-400 sm:px-1 dark:placeholder:text-slate-500"
                      id="product-search"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={searchMode === "name" ? "Try “iPhone 15” or “wireless earbuds”" : "Paste a Star Tech or Daraz product link"}
                      type="text"
                      value={query}
                    />
                    <button className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60" disabled={isSearching} type="submit">
                      {isSearching ? "Searching…" : searchMode === "name" ? "Find best prices" : "Track this product"}
                      {!isSearching && <span className="ml-2">→</span>}
                    </button>
                  </div>
                  <p aria-live="polite" className={`min-h-5 px-2 pt-2 text-xs ${message.startsWith("Found") ? "text-indigo-600 dark:text-indigo-300" : message ? "text-rose-600 dark:text-rose-400" : "text-transparent"}`}>
                    {message || "Ready to search"}
                  </p>
                </form>
                <div className="flex flex-wrap items-center gap-2 px-2 pb-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="mr-1">Compare on</span><StoreBadge store="Daraz" /><StoreBadge store="Star Tech" /><StoreBadge store="Facebook Pages" />
                </div>
                <p className="px-2 pb-1 pt-2 text-[10px] text-slate-400">Supported store prices are shown in BDT. Region selection is a display preference.</p>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
              <div className="absolute -inset-8 rounded-[45%] bg-gradient-to-br from-indigo-300/30 via-violet-300/20 to-transparent blur-3xl dark:from-indigo-700/20" />
              <div className="relative rounded-[30px] border border-white/80 bg-white/55 p-5 shadow-[0_32px_100px_rgba(79,70,229,.13)] backdrop-blur-2xl sm:p-7 dark:border-white/10 dark:bg-white/[.055]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Your price advantage</p>
                    <p className="mt-2 text-4xl font-bold tracking-tight">{formatPrice(4240)}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saved by smart shoppers this month</p>
                  </div>
                  <span className="rounded-full bg-emerald-100/80 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">↑ 18.6%</span>
                </div>
                <div className="mt-7 flex h-36 items-end gap-2 border-b border-l border-slate-200/80 px-3 dark:border-white/10">
                  {[38, 48, 43, 64, 59, 73, 67, 88, 78, 98, 89, 115].map((height, index) => (
                    <div className="flex h-full flex-1 items-end" key={index}>
                      <div className={`w-full rounded-t-md ${index === 11 ? "bg-indigo-500" : "bg-indigo-200/80 dark:bg-indigo-400/25"}`} style={{ height: `${height}px` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between pl-3 text-[10px] font-medium text-slate-400"><span>Oct 01</span><span>Oct 08</span><span>Oct 15</span><span>Today</span></div>
                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 p-3 dark:border-white/[.07] dark:bg-white/[.04]">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-lg dark:bg-indigo-400/15">🎧</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">Soundcore R50i NC</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Price dropped at Star Tech</p></div>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">−৳600</p>
                </div>
              </div>
              <div className="absolute -right-3 -top-4 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-xl backdrop-blur-xl sm:-right-5 dark:border-white/10 dark:bg-slate-900/80">
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Deal spotted</p><p className="mt-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">Best price today ✦</p>
              </div>
            </div>
          </section>

          <section className="pb-8" id="comparison">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600 dark:text-indigo-300">Across your favorite stores</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Live price comparison</h2></div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="sort-order">
                Sort prices
                <select className="rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-indigo-300 dark:border-white/10 dark:bg-white/[.06] dark:text-slate-200" id="sort-order" onChange={(event) => setSortOrder(event.target.value as "low" | "high")} value={sortOrder}>
                  <option value="low">Low to High</option><option value="high">High to Low</option>
                </select>
              </label>
            </div>
            <div className="overflow-hidden rounded-[26px] border border-white/80 bg-white/65 shadow-[0_18px_60px_rgba(15,23,42,.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[.045]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead className="border-b border-slate-200/70 bg-white/40 text-[11px] uppercase tracking-[.12em] text-slate-500 dark:border-white/[.08] dark:bg-white/[.025] dark:text-slate-400">
                    <tr><th className="px-6 py-4 font-semibold">Product</th><th className="px-5 py-4 font-semibold">Store</th><th className="px-5 py-4 font-semibold">Price</th><th className="px-5 py-4 font-semibold">Price change</th><th className="px-6 py-4 text-right font-semibold">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/[.07]">
                    {sortedProducts.map((product) => {
                      const drop = product.currentPrice !== null && product.originalPrice !== null && product.originalPrice > product.currentPrice
                        ? Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100)
                        : null;
                      return (
                        <tr className={`transition hover:bg-indigo-50/40 dark:hover:bg-indigo-400/[.04] ${selectedProductId === product.id ? "bg-indigo-50/40 dark:bg-indigo-400/[.045]" : ""}`} key={product.id} onClick={() => setSelectedProductId(product.id)}>
                          <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 text-lg dark:from-indigo-400/15 dark:to-violet-400/10">{product.image ? <img alt="" className="h-full w-full object-contain p-1" src={product.image} /> : "◈"}</div><span className="max-w-xs text-sm font-semibold">{product.title}</span></div></td>
                          <td className="px-5 py-4"><StoreBadge store={product.store} /></td>
                          <td className="px-5 py-4"><span className="font-bold">{formatPrice(product.currentPrice)}</span>{product.isOutOfStock && <span className="ml-2 text-[10px] font-semibold text-rose-500">Out of stock</span>}</td>
                          <td className="px-5 py-4">{drop === null ? <span className="text-xs text-slate-400">—</span> : <span className="rounded-full bg-emerald-100/80 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">↓ {drop}%</span>}</td>
                          <td className="px-6 py-4 text-right"><button className="rounded-lg border border-indigo-200 bg-white/70 px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-300/20 dark:bg-white/[.04] dark:text-indigo-300" onClick={(event) => { event.stopPropagation(); openAlert(product); }} type="button">Set alert</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/60 px-6 py-3 text-[11px] text-slate-400 dark:border-white/[.07]"><span>{products.length} offers · prices update when you search</span><span>Click a row to explore history</span></div>
            </div>
          </section>

          {selectedProduct && (
            <section className="grid gap-5 py-8 lg:grid-cols-[1.3fr_.7fr]" id="history">
              <div className="rounded-[26px] border border-white/80 bg-white/65 p-5 shadow-[0_18px_60px_rgba(15,23,42,.06)] backdrop-blur-2xl sm:p-7 dark:border-white/10 dark:bg-white/[.045]">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div><p className="text-xs font-bold uppercase tracking-[.15em] text-indigo-600 dark:text-indigo-300">Interactive price history</p><h2 className="mt-2 text-xl font-bold tracking-tight">{selectedProduct.title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Watch how the price changes over time</p></div>
                  <div className="flex rounded-xl border border-slate-200/70 bg-white/60 p-1 dark:border-white/10 dark:bg-white/[.04]">
                    {(["7D", "30D", "90D"] as Range[]).map((range) => <button className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${chartRange === range ? "bg-indigo-600 text-white shadow" : "text-slate-500 hover:text-indigo-600 dark:text-slate-400"}`} key={range} onClick={() => setChartRange(range)} type="button">{range}</button>)}
                  </div>
                </div>
                <PriceHistoryChart product={selectedProduct} range={chartRange} />
              </div>
              <div className="flex flex-col justify-between rounded-[26px] border border-indigo-300/30 bg-gradient-to-br from-indigo-500 to-violet-600 p-6 text-white shadow-[0_20px_70px_rgba(99,102,241,.24)] sm:p-7">
                <div><span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur">Selected deal</span><h3 className="mt-5 text-lg font-semibold leading-snug">{selectedProduct.title}</h3><div className="mt-6 flex items-end justify-between"><div><p className="text-xs text-white/70">Best available price</p><p className="mt-1 text-3xl font-bold">{formatPrice(selectedProduct.currentPrice)}</p></div>{selectedProduct.originalPrice && selectedProduct.currentPrice !== null && <p className="pb-1 text-right text-xs text-white/70"><span className="line-through">{formatPrice(selectedProduct.originalPrice)}</span><br /><span className="mt-1 inline-block font-bold text-emerald-200">You save {formatPrice(selectedProduct.originalPrice - selectedProduct.currentPrice)}</span></p>}</div></div>
                <button className="mt-8 w-full rounded-xl bg-white py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50" onClick={() => openAlert(selectedProduct)} type="button">♧ &nbsp;Create price alert</button>
              </div>
            </section>
          )}

          <section className="py-9 pb-16" id="drops">
            <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-600 dark:text-indigo-300">Worth a second look</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Top Price Drops</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The biggest savings across tracked stores.</p></div><span className="hidden rounded-full border border-white/80 bg-white/50 px-3 py-1.5 text-[11px] text-slate-500 backdrop-blur sm:inline-flex dark:border-white/10 dark:bg-white/[.04] dark:text-slate-400">Updated just now</span></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedProducts.map((product) => {
                const drop = product.currentPrice !== null && product.originalPrice !== null && product.originalPrice > product.currentPrice
                  ? Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100)
                  : 0;
                return (
                  <article className="group rounded-[24px] border border-white/80 bg-white/65 p-5 shadow-[0_14px_45px_rgba(15,23,42,.055)] backdrop-blur-2xl transition hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(79,70,229,.12)] dark:border-white/10 dark:bg-white/[.045]" key={`drop-${product.id}`}>
                    <div className="flex items-start gap-4">
                      <div className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-2xl dark:from-indigo-400/15 dark:to-violet-400/10">{product.image ? <img alt="" className="h-full w-full object-contain p-1" src={product.image} /> : "◈"}</div>
                      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><StoreBadge store={product.store} />{drop > 0 && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">−{drop}%</span>}</div><h3 className="mt-2 line-clamp-2 text-sm font-bold leading-5">{product.title}</h3></div>
                    </div>
                    <div className="mt-5 rounded-xl bg-indigo-50/70 px-3 pb-1 pt-2 dark:bg-indigo-400/[.06]"><div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400"><span>Price trend</span><span>30 days</span></div>                    <PriceHistoryChart compact product={product} range="30D" /></div>
                    <div className="mt-4 flex items-end justify-between"><div><p className="text-[11px] text-slate-500 dark:text-slate-400">Current price</p><p className="mt-1 text-xl font-bold">{formatPrice(product.currentPrice)}</p></div><button className="rounded-xl border border-indigo-200 bg-white/70 px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-300/20 dark:bg-white/[.04] dark:text-indigo-300" onClick={() => openAlert(product)} type="button">Set alert</button></div>
                  </article>
                );
              })}
            </div>
            {products.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">Search for a product to see current offers.</div>}
            <p className="mt-4 text-center text-[11px] text-slate-400">Demo offers are illustrative. Live results appear after searching a product or tracking its link.</p>
          </section>
        </div>

        <footer className="relative border-t border-white/70 bg-white/35 backdrop-blur-xl dark:border-white/[.07] dark:bg-slate-950/30">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:text-slate-400">
            <a className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200" href="#"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-xs text-white">P</span>PricePulse Bangladesh</a>
            <p>Compare smarter. Buy better. Save more.</p>
            <p>© 2026 PricePulse · Prices may change at the store.</p>
          </div>
        </footer>

        {alertOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md" onClick={(event) => { if (event.target === event.currentTarget) setAlertOpen(false); }}>
            <section aria-labelledby="alert-title" aria-modal="true" className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-8 dark:border-white/10 dark:bg-slate-900/90" role="dialog">
              <div className="flex items-start justify-between"><div><div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-indigo-100 text-xl text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300">♧</div><h2 className="text-xl font-bold tracking-tight" id="alert-title">Create a price alert</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">We’ll help you keep an eye on your target price.</p></div><button aria-label="Close dialog" className="rounded-full px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setAlertOpen(false)} type="button">×</button></div>
              <form className="mt-6 space-y-4" onSubmit={saveAlert}>
                <label className="block text-xs font-semibold" htmlFor="alert-product">Product<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-normal outline-none transition focus:border-indigo-400 dark:border-white/10 dark:bg-white/[.04]" id="alert-product" placeholder="Product name or URL" required type="text" value={alertProduct?.url ?? alertProduct?.title ?? ""} onChange={(event) => { if (alertProduct) setAlertProduct({ ...alertProduct, url: event.target.value }); }} /></label>
                <label className="block text-xs font-semibold" htmlFor="target-price">Target price<span className="mt-2 flex items-center rounded-xl border border-slate-200 bg-white/70 px-4 focus-within:border-indigo-400 dark:border-white/10 dark:bg-white/[.04]"><span className="text-sm text-slate-400">৳</span><input className="w-full bg-transparent py-3 pl-2 text-sm font-normal outline-none" id="target-price" min="1" placeholder="Enter your ideal price" required type="number" value={alertTarget} onChange={(event) => setAlertTarget(event.target.value)} /></span></label>
                <button className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500" type="submit">Save price alert</button>
                <p className="text-center text-[11px] text-slate-400">Alerts are saved locally in this prototype.</p>
              </form>
            </section>
          </div>
        )}

        {alertSaved && <div aria-live="polite" className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-sm font-medium text-white shadow-xl" role="status"><span className="text-emerald-300">✓</span>Price alert saved<button aria-label="Dismiss notification" className="ml-2 text-white/60 hover:text-white" onClick={() => setAlertSaved(false)} type="button">×</button></div>}
      </div>
    </main>
  );
}
