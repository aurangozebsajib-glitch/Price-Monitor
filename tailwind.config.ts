import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17231d",
        muted: "#748078",
        canvas: "#f5f7f4",
        brand: "#1b7550",
        "brand-light": "#e5f2eb",
      },
      boxShadow: {
        card: "0 8px 30px rgba(29, 48, 37, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
