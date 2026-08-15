import type { AppTheme } from "../types";

export interface ThemeConfig {
  value: AppTheme;
  label: string;
  detail: string;
  mode: "dark" | "light";
  category: "Fantasy" | "Dark" | "Cool" | "Warm" | "Botanical" | "Neutral";
  gradient?: [string, string, string];
  preview: {
    accent: string;
    surface: string;
    bg: string;
    ink: string;
  };
}

export const APP_THEMES: ThemeConfig[] = [
  // --- ✨ FANTASY & 3-COLOR APPLE GRADIENTS (Featured / Cosmic & Magical) ---
  {
    value: "nebula",
    label: "Cosmic Nebula",
    detail: "Tema Utama · Fantasi bintang magenta, ungu neon & biru astral",
    mode: "dark",
    category: "Fantasy",
    gradient: ["#f43f5e", "#a855f7", "#3b82f6"],
    preview: { accent: "#f43f5e", surface: "#160f20", bg: "#0c0813", ink: "#f2e8f0" },
  },
  {
    value: "prism",
    label: "Apple Spectrum",
    detail: "Gradient 3 warna pelangi gaya Apple Intelligence",
    mode: "light",
    category: "Fantasy",
    gradient: ["#ff3b80", "#8b5cf6", "#00d2ff"],
    preview: { accent: "#ec4899", surface: "#f3f1fa", bg: "#e6e2f2", ink: "#181e30" },
  },
  {
    value: "aurora",
    label: "Aurora Borealis",
    detail: "Fantasi cahaya kutub hijau emerald, cyan & violet",
    mode: "dark",
    category: "Fantasy",
    gradient: ["#10b981", "#06b6d4", "#8b5cf6"],
    preview: { accent: "#10b981", surface: "#0e1820", bg: "#060c11", ink: "#e2f4ee" },
  },
  {
    value: "solstice",
    label: "Apple Solstice",
    detail: "Gradient 3 warna sunset jingga, rose & indigo",
    mode: "dark",
    category: "Fantasy",
    gradient: ["#f97316", "#ec4899", "#6366f1"],
    preview: { accent: "#f97316", surface: "#1a121c", bg: "#0e0811", ink: "#f4eae2" },
  },
  {
    value: "arcane",
    label: "Arcane Magic",
    detail: "Fantasi sihir mistis emas, violet & kristal cyan",
    mode: "dark",
    category: "Fantasy",
    gradient: ["#eab308", "#8b5cf6", "#06b6d4"],
    preview: { accent: "#eab308", surface: "#161224", bg: "#0b0714", ink: "#f4eed6" },
  },

  // --- 🌙 DARK & DIM THEMES (Tidak silau, gelap & fokus) ---
  {
    value: "obsidian",
    label: "Obsidian Dark",
    detail: "Hitam pekat OLED & aksen biru elektrik",
    mode: "dark",
    category: "Dark",
    preview: { accent: "#3b82f6", surface: "#14181e", bg: "#0b0e12", ink: "#e8eef4" },
  },
  {
    value: "midnight",
    label: "Midnight Navy",
    detail: "Biru safir malam redup & nyaman di mata",
    mode: "dark",
    category: "Dark",
    preview: { accent: "#38bdf8", surface: "#121a28", bg: "#090e1a", ink: "#e6ecf4" },
  },
  {
    value: "nord",
    label: "Nordic Slate",
    detail: "Slate dingin & aksen cyan kutub",
    mode: "dark",
    category: "Dark",
    preview: { accent: "#2dd4bf", surface: "#1a2332", bg: "#0d1320", ink: "#ecf0f4" },
  },
  {
    value: "forest",
    label: "Forest Night",
    detail: "Hijau botani gelap & aksen mint segar",
    mode: "dark",
    category: "Dark",
    preview: { accent: "#34d399", surface: "#101e18", bg: "#08120e", ink: "#e2f4ec" },
  },
  {
    value: "espresso",
    label: "Mocha Dark",
    detail: "Cokelat espresso hangat & aksen karamel",
    mode: "dark",
    category: "Dark",
    preview: { accent: "#f59e0b", surface: "#1c1612", bg: "#100c0a", ink: "#f6ead4" },
  },
  {
    value: "cyber",
    label: "Cyber Dusk",
    detail: "Ungu gelap & aksen neon violet",
    mode: "dark",
    category: "Dark",
    preview: { accent: "#a855f7", surface: "#191224", bg: "#0e0a16", ink: "#f0eaf8" },
  },

  // --- ☀️ SOFT & LOW-GLARE LIGHT THEMES ---
  {
    value: "paper",
    label: "Soft Paper",
    detail: "Ivory editorial klasik tanpa silau putih",
    mode: "light",
    category: "Neutral",
    preview: { accent: "#947e5a", surface: "#f4f1e9", bg: "#e8e3d7", ink: "#2c2620" },
  },
  {
    value: "sand",
    label: "Warm Sand",
    detail: "Krem gurun hangat & nyaman dipakai lama",
    mode: "light",
    category: "Warm",
    preview: { accent: "#c67c1c", surface: "#f5f0e6", bg: "#ebe2d2", ink: "#302416" },
  },
  {
    value: "sage",
    label: "Soft Sage",
    detail: "Hijau natural sejuk dan menenangkan",
    mode: "light",
    category: "Botanical",
    preview: { accent: "#2a8a52", surface: "#f2f7f3", bg: "#e4eee6", ink: "#183024" },
  },
  {
    value: "lavender",
    label: "Lavender Mist",
    detail: "Ungu pastel lembut dan anggun",
    mode: "light",
    category: "Cool",
    preview: { accent: "#6d32dc", surface: "#f4f1f9", bg: "#e9e4f4", ink: "#221c36" },
  },
  {
    value: "clay",
    label: "Soft Clay",
    detail: "Terracotta hangat dan natural",
    mode: "light",
    category: "Warm",
    preview: { accent: "#c8462a", surface: "#f6f0ec", bg: "#ece2da", ink: "#301e18" },
  },
  {
    value: "eucalyptus",
    label: "Eucalyptus",
    detail: "Hijau-biru botanical yang adem",
    mode: "light",
    category: "Botanical",
    preview: { accent: "#129991", surface: "#f0f8f6", bg: "#e1efe4", ink: "#142c2a" },
  },
  {
    value: "graphite",
    label: "Quiet Graphite",
    detail: "Abu-abu netral monokrom rapi",
    mode: "light",
    category: "Neutral",
    preview: { accent: "#4c5e76", surface: "#f0f2f5", bg: "#e2e5eb", ink: "#1e232a" },
  },
  {
    value: "ocean",
    label: "Ocean Calm",
    detail: "Biru sejuk dan profesional",
    mode: "light",
    category: "Cool",
    preview: { accent: "#1d4ed8", surface: "#f2f7fc", bg: "#e4ecf5", ink: "#182336" },
  },
  {
    value: "rose",
    label: "Dusty Rose",
    detail: "Rose redup dan halus",
    mode: "light",
    category: "Warm",
    preview: { accent: "#c82a56", surface: "#f7eff2", bg: "#eee1e6", ink: "#301820" },
  },
  {
    value: "sky",
    label: "Cloudy Sky",
    detail: "Biru langit cerah dan lapang",
    mode: "light",
    category: "Cool",
    preview: { accent: "#0e94d6", surface: "#f0f8fb", bg: "#e2eef5", ink: "#142838" },
  },
];
