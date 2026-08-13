import type { CsvExportRow } from "../types";

export function serializeAdobeCsv(rows: CsvExportRow[], includeReleases: boolean): string {
  const header = includeReleases ? ["Filename", "Title", "Keywords", "Category", "Releases"] : ["Filename", "Title", "Keywords", "Category"];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const values = rows.map((row) => includeReleases ? [row.filename, row.title, row.keywords.join(", "), String(row.category), row.releases ?? ""] : [row.filename, row.title, row.keywords.join(", "), String(row.category)]);
  return [...[header, ...values].map((line) => line.map(escape).join(",")), ""].join("\n");
}
