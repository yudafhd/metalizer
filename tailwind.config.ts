import type { Config } from "tailwindcss";

const accentScale = {
  50: "rgb(var(--accent-50) / <alpha-value>)",
  100: "rgb(var(--accent-100) / <alpha-value>)",
  200: "rgb(var(--accent-200) / <alpha-value>)",
  300: "rgb(var(--accent-300) / <alpha-value>)",
  400: "rgb(var(--accent-400) / <alpha-value>)",
  500: "rgb(var(--accent-500) / <alpha-value>)",
  600: "rgb(var(--accent-600) / <alpha-value>)",
  700: "rgb(var(--accent-700) / <alpha-value>)",
  800: "rgb(var(--accent-800) / <alpha-value>)",
  900: "rgb(var(--accent-900) / <alpha-value>)",
};

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          secondary: "rgb(var(--ink-secondary) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
          sunken: "rgb(var(--surface-sunken) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--line) / <alpha-value>)",
          subtle: "rgb(var(--line-subtle) / <alpha-value>)",
        },
        accent: accentScale,
        primary: accentScale,
        raspberry: accentScale,
        slatepanel: "rgb(var(--surface-sunken) / <alpha-value>)",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        glow: "var(--shadow-glow)",
        accent: "var(--shadow-accent)",
        modal: "var(--shadow-modal)",
        raspberry: "var(--shadow-accent)",
      },
      borderRadius: {
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
      },
    },
  },
  plugins: [],
} satisfies Config;
