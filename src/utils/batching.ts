export function chunkItems<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1 || size > 6) throw new Error("Jumlah per batch harus antara 1 sampai 6");
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

export function panelIds(count: number): string[] {
  if (count < 1 || count > 6) throw new Error("Contact sheet harus berisi 1 sampai 6 panel");
  return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, "0"));
}
