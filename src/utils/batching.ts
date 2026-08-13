export function chunkItems<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1 || size > 6) throw new Error("Batch size must be between 1 and 6");
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

export function panelIds(count: number): string[] {
  if (count < 1 || count > 6) throw new Error("A contact sheet must contain between 1 and 6 panels");
  return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, "0"));
}
