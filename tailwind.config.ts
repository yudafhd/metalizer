import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        surface: "#eaf1f8",
        "surface-muted": "#dbe5ef",
        slatepanel: "#edf3fa",
        line: "#bfd1e6",
        accent: "#4f46e5",
        "accent-dark": "#3730a3",
        "accent-light": "#6366f1",
        mint: "#059669",
        raspberry: {
          50: "#eaf2ff",
          100: "#d7e7ff",
          200: "#b9d5ff",
          300: "#82b7ff",
          400: "#4f8ff7",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#0b1f4d",
        },
      },
      boxShadow: {
        panel: "0 4px 16px -2px rgba(15, 23, 42, 0.06)",
        glow: "0 0 16px rgba(79, 70, 229, 0.15)",
        raspberry: "0 10px 24px -12px rgba(29, 78, 216, 0.45)",
      },
    },
  },
  plugins: [],
} satisfies Config;
