"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PriceHistoryChart from "@/components/PriceHistoryChart";
function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function performSearch() {
      if (!query) { setLoading(false); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.success) {
          setProducts(json.results.map((p: any) => ({
            ...p,
            id: p._id || p.id,
            normalized_title: p.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim(),
          })));
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    performSearch();
  }, [query]);
  const groupedProducts = useMemo(() => {
    const groups: any = {};
    products.forEach((p) => {
      const key = p.normalized_title;
      if (!groups[key]) groups[key] = { title: p.title, image: p.image, variants: [], minPrice: p.currentPrice };
      groups[key].variants.push(p);
      if (p.currentPrice != null && (groups[key].minPrice == null || p.currentPrice < groups[key].minPrice)) groups[key].minPrice = p.currentPrice;
    });
    return Object.values(groups).sort((a: any, b: any) => (a.minPrice || 0) - (b.minPrice || 0));
  }, [products]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10">
        <Link href="/" className="text-sm font-bold text-indigo-600">← Back</Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Results for "{query}"</h1>
      </header>
      {loading ? <div>Loading...</div> : (
        <div className="space-y-8">
          {(groupedProducts as any[]).map((group: any) => (
            <div key={group.title} className="overflow-hidden rounded-3xl border bg-white dark:bg-slate-900">
              <div className="flex flex-col gap-6 p-6 sm:flex-row">
                <div className="h-40 w-40 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden">
                  {group.image && <img src={group.image} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{group.title}</h2>
                  <div className="mt-2 text-indigo-600 font-bold">From ৳{group.minPrice?.toLocaleString()}</div>
                  <div className="mt-6">
                    <table className="w-full text-sm text-left">
                      <thead><tr className="border-b text-slate-500"><th>Store</th><th>Price</th><th className="text-right">Action</th></tr></thead>
                      <tbody>
                        {group.variants.map((v: any) => (
                          <tr key={v.url} className="border-b last:border-0">
                            <td className="py-3">{v.store}</td>
                            <td className="py-3 font-bold">৳{v.currentPrice?.toLocaleString()}</td>
                            <td className="py-3 text-right"><a href={v.url} target="_blank" className="bg-slate-100 dark:bg-white/10 px-3 py-1 rounded-lg">Visit</a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-white/5 border-t">
                <PriceHistoryChart priceHistory={group.variants[0].priceHistory} compact />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default function SearchPage() {
  return <main className="min-h-screen bg-slate-50 dark:bg-slate-950"><Suspense fallback={<div>Loading...</div>}><SearchResults /></Suspense></main>;
}
