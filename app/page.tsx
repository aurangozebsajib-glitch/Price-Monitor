"use client";

import { FormEvent, useState } from "react";

type Product = {
  title: string;
  store: "Star Tech" | "Daraz";
  price: string;
  previousPrice: string;
  drop: string;
  color: string;
  icon: string;
  history: string;
  url?: string;
};

const initialProducts: Product[] = [
  {
    title: "Anker Soundcore R50i NC",
    store: "Star Tech",
    price: "৳2,190",
    previousPrice: "৳2,790",
    drop: "21%",
    color: "from-lime-100 to-emerald-50",
    icon: "◉",
    history: "M0 34 C18 31 25 35 39 25 S64 29 76 20 S99 23 112 12 S137 19 151 8 S175 12 190 4",
  },
  {
    title: "Logitech G102 Lightsync",
    store: "Daraz",
    price: "৳1,699",
    previousPrice: "৳2,250",
    drop: "24%",
    color: "from-blue-100 to-indigo-50",
    icon: "⌁",
    history: "M0 12 C17 17 20 7 38 14 S57 10 73 24 S91 16 108 28 S133 16 149 24 S173 8 190 13",
  },
  {
    title: "Redmi Buds 6 Play",
    store: "Star Tech",
    price: "৳1,290",
    previousPrice: "৳1,590",
    drop: "19%",
    color: "from-orange-100 to-rose-50",
    icon: "◌",
    history: "M0 28 C16 23 21 30 37 18 S57 24 72 14 S96 19 111 11 S133 16 149 9 S171 12 190 4",
  },
];

function PriceChart({ path }: { path: string }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl bg-[#f7faf7] px-3 pb-2 pt-3">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        <span>Price history</span>
        <span>Last 30 days</span>
      </div>
      <svg
        aria-label="Mock price history graph"
        className="h-12 w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 190 42"
      >
        <path d="M0 38 H190" fill="none" stroke="#e4ebe5" strokeDasharray="3 4" />
        <path d={`${path} L190 42 L0 42 Z`} fill="url(#chart-fill)" opacity=".65" />
        <path
          d={path}
          fill="none"
          stroke="#31966a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8ed1a9" stopOpacity=".38" />
            <stop offset="100%" stopColor="#8ed1a9" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState(initialProducts);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertSaved, setAlertSaved] = useState(false);

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      setMessage("Paste a valid Star Tech or Daraz product link.");
      return;
    }

    const host = parsedUrl.hostname.toLowerCase();
    const store = host.endsWith("startech.com.bd")
      ? "Star Tech"
      : host.endsWith("daraz.com.bd")
        ? "Daraz"
        : null;
    if (!store || parsedUrl.protocol !== "https:") {
      setMessage("Only HTTPS product links from Star Tech or Daraz are supported.");
      return;
    }

    const titleFromUrl = decodeURIComponent(parsedUrl.pathname.split("/").filter(Boolean).pop() ?? "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    setProducts((current) => [
      {
        title: titleFromUrl || "New tracked product",
        store,
        price: "Price pending",
        previousPrice: "—",
        drop: "New",
        color: store === "Daraz" ? "from-orange-100 to-rose-50" : "from-lime-100 to-emerald-50",
        icon: store === "Daraz" ? "D" : "S",
        history: "M0 28 C24 28 30 24 48 25 S74 18 91 20 S119 12 139 15 S170 7 190 5",
        url: parsedUrl.toString(),
      },
      ...current,
    ]);
    setUrl("");
    setMessage("Product added to your watchlist.");
  }

  function saveAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlertOpen(false);
    setAlertSaved(true);
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-[#e8ede8] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a aria-label="Pricewise home" className="flex items-center gap-2.5" href="#">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-bold text-white">
              ↗
            </span>
            <span className="text-lg font-bold tracking-tight">pricewise</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted sm:flex">
            <a className="text-ink" href="#dashboard">Dashboard</a>
            <a className="transition hover:text-ink" href="#price-drops">Price drops</a>
            <a className="transition hover:text-ink" href="#how-it-works">How it works</a>
          </nav>
          <button
            className="rounded-full border border-[#e1e8e2] px-4 py-2 text-sm font-semibold text-ink transition hover:bg-canvas"
            onClick={() => setAlertOpen(true)}
            type="button"
          >
            <span className="mr-1.5 text-brand">＋</span> Price alert
          </button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-brand-light/70 blur-3xl" />
        <div className="mx-auto max-w-7xl px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
          <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dcebe0] bg-[#f7fbf8] px-3 py-1.5 text-xs font-semibold text-brand">
                <span className="h-1.5 w-1.5 rounded-full bg-[#39a56b]" />
                Smart shopping starts here
              </div>
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.12] tracking-[-0.045em] text-ink sm:text-6xl">
                The right price.
                <br />
                <span className="text-brand">Right on time.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
                Keep an eye on the products you love. We’ll help you spot a good deal before it’s gone.
              </p>
              <form className="mt-8 max-w-2xl" onSubmit={addProduct}>
                <label className="sr-only" htmlFor="product-url">Product URL</label>
                <div className="flex flex-col gap-2 rounded-2xl border border-[#e4eae5] bg-white p-2 shadow-card sm:flex-row sm:items-center">
                  <span aria-hidden="true" className="hidden pl-3 text-xl text-muted sm:block">⌕</span>
                  <input
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-ink outline-none placeholder:text-[#9aa49c] sm:px-1"
                    id="product-url"
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="Paste a Star Tech or Daraz product link"
                    type="url"
                    value={url}
                  />
                  <button
                    className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#155f40]"
                    type="submit"
                  >
                    Track price <span aria-hidden="true" className="ml-1">→</span>
                  </button>
                </div>
                <p aria-live="polite" className={`mt-2 min-h-5 text-xs ${message.includes("added") ? "text-brand" : "text-rose-600"}`}>
                  {message}
                </p>
              </form>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                <span>Works with</span>
                <span className="rounded-md border border-[#e5eae5] bg-white px-2 py-1 font-semibold text-ink">STAR TECH</span>
                <span className="rounded-md border border-[#e5eae5] bg-white px-2 py-1 font-semibold text-[#f06432]">Daraz</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:ml-auto">
              <div className="absolute -left-7 top-10 h-28 w-28 rounded-full bg-[#e3f1e8] blur-2xl" />
              <div className="relative rounded-[28px] border border-[#e9eee9] bg-white p-5 shadow-[0_24px_80px_rgba(29,48,37,0.10)] sm:p-7">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-muted">Your savings this month</p>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-ink">৳4,240</p>
                  </div>
                  <span className="rounded-full bg-brand-light px-3 py-1.5 text-xs font-bold text-brand">↑ 18.6%</span>
                </div>
                <div className="mt-7 flex h-36 items-end gap-2 border-b border-l border-[#e9eee9] px-3 pb-0">
                  {[36, 48, 39, 68, 55, 79, 64, 93, 74, 100, 86, 114].map((height, index) => (
                    <div className="flex h-full flex-1 items-end" key={index}>
                      <div
                        className={`w-full rounded-t-md ${index === 11 ? "bg-brand" : "bg-[#cce8d6]"}`}
                        style={{ height: `${height}px` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between pl-3 text-[10px] font-medium text-muted">
                  <span>May 01</span><span>May 08</span><span>May 15</span><span>May 30</span>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#f7faf7] p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl">🎧</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">Soundcore R50i NC</p>
                    <p className="mt-1 text-[11px] text-muted">Price just dropped</p>
                  </div>
                  <p className="text-sm font-bold text-brand">-৳600</p>
                </div>
              </div>
              <div className="absolute -right-5 -top-4 hidden rounded-2xl border border-[#e9eee9] bg-white px-4 py-3 shadow-card sm:block">
                <p className="text-[10px] font-medium text-muted">Best time to buy</p>
                <p className="mt-1 text-xs font-bold text-brand">You found it ✓</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16" id="dashboard">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-[#39a56b]" />
              Your market watch
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-ink">Top Price Drops</h2>
            <p className="mt-2 text-sm text-muted">Products worth a second look, picked just for you.</p>
          </div>
          <a className="text-sm font-semibold text-brand transition hover:text-[#155f40]" href="#price-drops">
            View all deals <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" id="price-drops">
          {products.map((product, index) => (
            <article className="rounded-2xl border border-[#e9eee9] bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lg" key={`${product.title}-${index}`}>
              <div className="flex items-start gap-4">
                <div className={`grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${product.color} text-3xl font-bold text-ink/70`}>
                  {product.icon}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{product.store}</span>
                    <span className="rounded-full bg-[#e9f6ee] px-2.5 py-1 text-[10px] font-bold text-brand">
                      {product.drop === "New" ? "Just added" : `↓ ${product.drop}`}
                    </span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-ink">{product.title}</h3>
                  {product.url && <a className="mt-1 block truncate text-xs text-brand underline" href={product.url} rel="noreferrer" target="_blank">Open product</a>}
                </div>
              </div>
              <PriceChart path={product.history} />
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted">Current price</p>
                  <p className="mt-1 text-xl font-bold tracking-tight text-ink">{product.price}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-muted">Was {product.previousPrice}</p>
                  <p className="mt-1 text-xs font-semibold text-brand">
                    {product.drop === "New" ? "Tracking started" : `Save ${product.drop}`}
                  </p>
                </div>
              </div>
              <button
                className="mt-5 w-full rounded-xl border border-[#dfe8e1] py-2.5 text-xs font-semibold text-ink transition hover:border-brand hover:bg-brand-light hover:text-brand"
                onClick={() => setAlertOpen(true)}
                type="button"
              >
                ♧ &nbsp; Set a price alert
              </button>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[#e5ece6] bg-white px-5 py-6 sm:flex sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-light text-lg text-brand">✦</div>
            <div>
              <p className="text-sm font-bold text-ink">Never miss a price drop</p>
              <p className="mt-1 text-xs text-muted">Set a target price and we’ll keep watch for you.</p>
            </div>
          </div>
          <button
            className="mt-4 w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#293a30] sm:mt-0 sm:w-auto"
            onClick={() => setAlertOpen(true)}
            type="button"
          >
            Create price alert <span className="ml-2">→</span>
          </button>
        </div>
      </section>

      <footer className="border-t border-[#e8ede8] bg-white" id="how-it-works">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p><span className="font-bold text-ink">pricewise</span> — shop smarter, not harder.</p>
          <p>Price examples are for demonstration purposes.</p>
        </div>
      </footer>

      {alertOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAlertOpen(false);
          }}
        >
          <section
            aria-labelledby="alert-title"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-brand-light text-xl text-brand">♧</div>
                <h2 className="text-xl font-bold tracking-tight text-ink" id="alert-title">Create a price alert</h2>
                <p className="mt-2 text-sm leading-6 text-muted">We’ll let you know when a product reaches your target price.</p>
              </div>
              <button aria-label="Close dialog" className="rounded-full px-2 py-1 text-xl text-muted hover:bg-canvas" onClick={() => setAlertOpen(false)} type="button">×</button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={saveAlert}>
              <label className="block text-xs font-semibold text-ink" htmlFor="alert-product">
                Product URL
                <input
                  className="mt-2 w-full rounded-xl border border-[#e2e9e3] px-4 py-3 text-sm font-normal outline-none transition placeholder:text-[#9aa49c] focus:border-brand"
                  id="alert-product"
                  placeholder="Paste a Star Tech or Daraz link"
                  required
                  type="url"
                />
              </label>
              <label className="block text-xs font-semibold text-ink" htmlFor="target-price">
                Target price
                <span className="mt-2 flex items-center rounded-xl border border-[#e2e9e3] px-4 focus-within:border-brand">
                  <span className="text-sm text-muted">৳</span>
                  <input
                    className="w-full bg-transparent py-3 pl-2 text-sm font-normal outline-none placeholder:text-[#9aa49c]"
                    id="target-price"
                    min="1"
                    placeholder="Enter your ideal price"
                    required
                    type="number"
                  />
                </span>
              </label>
              <button className="w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-white transition hover:bg-[#155f40]" type="submit">
                Save price alert
              </button>
            </form>
          </section>
        </div>
      )}

      {alertSaved && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-sm font-medium text-white shadow-xl"
          role="status"
        >
          <span className="text-[#8ad1a5]">✓</span>
          Price alert saved
          <button aria-label="Dismiss notification" className="ml-2 text-white/60 hover:text-white" onClick={() => setAlertSaved(false)} type="button">×</button>
        </div>
      )}
    </main>
  );
}
