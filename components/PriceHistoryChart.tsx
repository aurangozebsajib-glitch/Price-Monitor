"use client";

import { useMemo } from "react";

type PricePoint = { price: number; date: string };

export default function PriceHistoryChart({
  priceHistory,
  compact = false,
}: {
  priceHistory: PricePoint[];
  compact?: boolean;
}) {
  const points = useMemo(() => {
    if (!priceHistory || priceHistory.length === 0) {
      return [
        { price: 0, date: "No data" },
        { price: 0, date: "No data" },
      ];
    }
    return priceHistory;
  }, [priceHistory]);

  const values = points.map((p) => p.price);
  const minPrice = Math.min(...values);
  const maxPrice = Math.max(...values);
  const priceSpread = maxPrice - minPrice || 1;

  // SVG dimensions
  const width = 600;
  const height = compact ? 120 : 220;
  const padding = 30;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1 || 1)) * chartWidth;
    const y = height - padding - ((p.price - minPrice) / priceSpread) * chartHeight;
    return { x, y, ...p };
  });

  const pathD = coords.reduce((acc, curr, i) => `${acc} ${i === 0 ? "M" : "L"} ${curr.x} ${curr.y}`, "");

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Price Trend</h4>
          <p className="text-[11px] text-slate-400">
            Lowest: ৳{minPrice.toLocaleString()} · Highest: ৳{maxPrice.toLocaleString()}
          </p>
        </div>
        <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">
          {points.length} points
        </span>
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible">
          <defs>
            <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio, idx) => {
            const y = padding + chartHeight * ratio;
            return (
              <line
                key={idx}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="1"
              />
            );
          })}

          {/* Area under curve */}
          {coords.length > 1 && (
            <path
              d={`${pathD} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`}
              fill="url(#chart-gradient)"
            />
          )}

          {/* Line */}
          {coords.length > 1 && (
            <path
              d={pathD}
              fill="none"
              stroke="rgb(99, 102, 241)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dots */}
          {coords.map((c, i) => (
            <g key={i} className="group/point">
              <circle
                cx={c.x}
                cy={c.y}
                r="4.5"
                className="fill-white stroke-indigo-600 stroke-[3px] transition hover:scale-125 dark:fill-slate-900"
              />
            </g>
          ))}
        </svg>
      </div>

      {!compact && coords.length > 0 && (
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 dark:border-white/5">
          <span>{coords[0]?.date}</span>
          <span>{coords[coords.length - 1]?.date}</span>
        </div>
      )}
    </div>
  );
}
