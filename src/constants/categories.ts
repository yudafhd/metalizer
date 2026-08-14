export const ADOBE_CATEGORIES = [
  { id: 1, name: "Hewan" },
  { id: 2, name: "Bangunan dan Arsitektur" },
  { id: 3, name: "Bisnis" },
  { id: 4, name: "Minuman" },
  { id: 5, name: "Lingkungan" },
  { id: 6, name: "Kondisi Pikiran" },
  { id: 7, name: "Makanan" },
  { id: 8, name: "Sumber Daya Grafis" },
  { id: 9, name: "Hobi dan Waktu Luang" },
  { id: 10, name: "Industri" },
  { id: 11, name: "Pemandangan" },
  { id: 12, name: "Gaya Hidup" },
  { id: 13, name: "Orang" },
  { id: 14, name: "Tanaman dan Bunga" },
  { id: 15, name: "Budaya dan Agama" },
  { id: 16, name: "Sains" },
  { id: 17, name: "Isu Sosial" },
  { id: 18, name: "Olahraga" },
  { id: 19, name: "Teknologi" },
  { id: 20, name: "Transportasi" },
  { id: 21, name: "Perjalanan" },
] as const;

export function categoryName(id: number): string {
  return ADOBE_CATEGORIES.find((category) => category.id === id)?.name ?? "Kategori tidak dikenal";
}
