import type { CsvExportPlatform } from "../types";

export const EXPORT_PLATFORMS: { id: CsvExportPlatform; name: string; filename: string }[] = [
  { id: "adobe", name: "Adobe Stock", filename: "adobe-stock-metadata.csv" },
  { id: "shutterstock", name: "Shutterstock", filename: "shutterstock-metadata.csv" },
  { id: "pond5", name: "Pond5", filename: "pond5-metadata.csv" },
  { id: "freepik", name: "Freepik / Magnific", filename: "freepik-metadata.csv" },
];

export const SHUTTERSTOCK_CATEGORIES = [
  "Abstract", "Animals/Wildlife", "Arts", "Backgrounds/Textures", "Beauty/Fashion",
  "Buildings/Landmarks", "Business/Finance", "Celebrities", "Education", "Food and Drink",
  "Healthcare/Medical", "Holidays", "Industrial", "Interiors", "Miscellaneous", "Nature",
  "Objects", "Parks/Outdoor", "People", "Religion", "Science", "Signs/Symbols",
  "Sports/Recreation", "Technology", "Transportation", "Vintage",
] as const;

const CATEGORY_SUGGESTIONS: Record<number, string> = {
  1: "Animals/Wildlife", 2: "Buildings/Landmarks", 3: "Business/Finance", 4: "Food and Drink",
  5: "Nature", 6: "People", 7: "Food and Drink", 8: "Arts", 9: "Sports/Recreation",
  10: "Industrial", 11: "Nature", 12: "People", 13: "People", 14: "Nature",
  15: "Religion", 16: "Science", 17: "People", 18: "Sports/Recreation",
  19: "Technology", 20: "Transportation", 21: "Nature",
};

export function suggestShutterstockCategory(adobeCategory: number): string {
  return CATEGORY_SUGGESTIONS[adobeCategory] ?? "Objects";
}
