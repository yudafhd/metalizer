import type { CsvExportPlatform, CsvExportRow } from "../types";

export function serializeCsv(rows: CsvExportRow[], platform: CsvExportPlatform, includeReleases: boolean): string {
  const header = platform === "adobe"
    ? includeReleases ? ["Filename", "Title", "Keywords", "Category", "Releases"] : ["Filename", "Title", "Keywords", "Category"]
    : platform === "shutterstock" ? ["Filename", "Description", "Keywords", "Categories"]
      : platform === "pond5" ? ["OriginalFilename", "Title", "Keywords"] : ["File name", "Title", "Keywords"];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const values = rows.map((row) => platform === "adobe"
    ? includeReleases ? [row.filename, row.title, row.keywords.join(", "), String(row.category), row.releases ?? ""] : [row.filename, row.title, row.keywords.join(", "), String(row.category)]
    : platform === "shutterstock" ? [row.filename, row.title, row.keywords.join(", "), row.shutterstockCategory ?? ""]
      : platform === "pond5" ? [row.filename, row.title, row.keywords.join(", ")] : [row.filename, row.title, row.keywords.join(",")]);
  const delimiter = platform === "freepik" ? ";" : ",";
  return [...[header, ...values].map((line) => line.map(escape).join(delimiter)), ""].join("\n");
}

export function serializeAdobeCsv(rows: CsvExportRow[], includeReleases: boolean): string {
  return serializeCsv(rows, "adobe", includeReleases);
}
