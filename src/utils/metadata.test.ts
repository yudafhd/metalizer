import { describe, expect, it } from "vitest";

import { chunkItems, panelIds } from "./batching";
import { serializeAdobeCsv } from "./csv";
import { normalizeKeywords, qualityScore, validateMetadata } from "./metadata";

describe("batching", () => {
  it.each([
    [1, [1]],
    [6, [6]],
    [13, [6, 6, 1]],
    [100, [...Array.from({ length: 16 }, () => 6), 4]],
  ])("groups %i assets without exceeding six", (count, expected) => {
    expect(chunkItems(Array.from({ length: count }), 6).map((batch) => batch.length)).toEqual(expected);
  });

  it("creates stable two-digit panel IDs", () => {
    expect(panelIds(6)).toEqual(["01", "02", "03", "04", "05", "06"]);
  });
});

describe("metadata normalization", () => {
  it("preserves priority order while removing duplicates and filenames", () => {
    expect(normalizeKeywords(["Cat", " orange  cat ", "cat", "cat-001.jpg", "pet"], "cat-001.jpg")).toEqual(["Cat", "orange cat", "pet"]);
  });

  it("flags a long title and invalid category", () => {
    const result = validateMetadata("asset.jpg", { title: "A".repeat(71), keywords: ["one"], category: 99 });
    expect(result.valid).toBe(false);
    expect(result.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(["title-too-long", "category-invalid"]));
  });

  it("warns when the title repeats the filename", () => {
    const result = validateMetadata("orange-cat-001.jpg", { title: "Orange cat 001 on sofa", keywords: ["cat", "sofa"], category: 1 });
    expect(result.warnings.map((warning) => warning.code)).toContain("title-filename");
  });

  it("scores complete metadata higher than incomplete metadata", () => {
    const complete = { title: "Orange cat relaxing on a sofa", keywords: Array.from({ length: 35 }, (_, index) => `keyword ${index}`), category: 1 };
    const completeValidation = validateMetadata("cat.jpg", complete);
    expect(qualityScore(complete, completeValidation)).toBeGreaterThan(70);
    expect(qualityScore({ title: "", keywords: [], category: 0 }, validateMetadata("cat.jpg", { title: "", keywords: [], category: 0 }))).toBeLessThan(30);
  });
});

describe("CSV serialization", () => {
  it("quotes commas and quotes while preserving keyword order", () => {
    const csv = serializeAdobeCsv([{ filename: "cat.jpg", title: "Cat, relaxed", keywords: ["cat", "orange cat"], category: 1 }], false);
    expect(csv).toBe('"Filename","Title","Keywords","Category"\n"cat.jpg","Cat, relaxed","cat, orange cat","1"\n');
  });
});

