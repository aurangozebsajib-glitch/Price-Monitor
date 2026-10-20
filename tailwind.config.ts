import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        muted: "#64748b",
        canvas: "#f5f6ff",
        brand: "#6366f1",
        "brand-light": "#e0e7ff",
      },
      boxShadow: {
        card: "0 12px 36px rgba(79, 70, 229, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
