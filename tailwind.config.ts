import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        slatepanel: "#f6f7f8",
        line: "#e4e8ec",
        accent: "#e35d4f",
        "accent-dark": "#c8483c",
        mint: "#1e8d7a",
      },
      boxShadow: {
        panel: "0 8px 28px rgba(23, 33, 43, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
