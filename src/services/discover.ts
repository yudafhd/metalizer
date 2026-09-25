import { invokeCommand, isTauri } from "./tauri";

const DISCOVER_URL = "https://www.mahes.app/api/v1/discover";
const SEEN_KEY = "metalizer-discover-seen-v1";

export interface DiscoverItem {
  id: string;
  type: string;
  title: string;
  description: string;
  imageUrl: string | null;
  link: string | null;
  note: string | null;
  sortOrder: number;
  createdAt: string;
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export async function fetchDiscover(): Promise<DiscoverItem[]> {
  const raw: unknown = isTauri
    ? await invokeCommand("get_discover")
    : await (async () => {
        const response = await fetch(DISCOVER_URL, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Discover mengembalikan HTTP ${response.status}.`);
        return response.json() as Promise<unknown>;
      })();

  if (!raw || typeof raw !== "object" || !("success" in raw) || raw.success !== true || !("data" in raw) || !Array.isArray(raw.data)) {
    throw new Error("Format data Discover tidak sesuai.");
  }

  const seen = new Set<string>();
  const items: DiscoverItem[] = [];
  for (const entry of raw.data) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || typeof entry.title !== "string" || !entry.id.trim()) continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    items.push({
      id: entry.id,
      type: typeof entry.type === "string" ? entry.type : "note",
      title: entry.title,
      description: typeof entry.description === "string" ? entry.description : "",
      imageUrl: safeHttpsUrl(entry.image_url),
      link: safeHttpsUrl(entry.link),
      note: typeof entry.note === "string" ? entry.note : null,
      sortOrder: typeof entry.sort_order === "number" ? entry.sort_order : Number.MAX_SAFE_INTEGER,
      createdAt: typeof entry.created_at === "string" ? entry.created_at : "",
    });
  }
  return items.sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt));
}

export function readSeenDiscoverIds(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeSeenDiscoverIds(ids: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // Discover tetap dapat dibaca saat penyimpanan lokal tidak tersedia.
  }
}
