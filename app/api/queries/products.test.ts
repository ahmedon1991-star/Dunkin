import { describe, expect, it } from "vitest";
import { normalizeOptionalImageUrl } from "./products";

describe("normalizeOptionalImageUrl", () => {
  it("converts blank values to null", () => {
    expect(normalizeOptionalImageUrl("")).toBeNull();
    expect(normalizeOptionalImageUrl("   ")).toBeNull();
    expect(normalizeOptionalImageUrl(null)).toBeNull();
    expect(normalizeOptionalImageUrl(undefined)).toBeNull();
  });

  it("keeps valid image URLs unchanged", () => {
    const url = "https://example.com/product.jpg";
    expect(normalizeOptionalImageUrl(url)).toBe(url);
  });
});
