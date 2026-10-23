import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE_DETAILS, IMAGE_KEYS, imageKeyFor, parseDetails, productImagePath } from "../src/productCatalogue.js";

test("matches the picture to the product type", () => {
  assert.equal(imageKeyFor("HW-DELL-LAT-001", "Dell Latitude Business Laptop"), "laptop");
  assert.equal(imageKeyFor("X1", "24 inch Monitor"), "monitor");
  assert.equal(imageKeyFor("X2", "NVMe SSD 1TB"), "ssd");
  assert.equal(imageKeyFor("X3", "Wireless Mouse"), "mouse");
  assert.equal(imageKeyFor("X4", "Unknown thing"), "generic");
});

test("every catalogue SKU has highlights, specs and a valid picture key", () => {
  for (const [sku, d] of Object.entries(CATALOGUE_DETAILS)) {
    assert.ok(d.highlights.length >= 3, `${sku} highlights`);
    assert.ok(d.specs.length >= 4, `${sku} specs`);
    assert.ok((IMAGE_KEYS as readonly string[]).includes(imageKeyFor(sku, "")) || imageKeyFor(sku, "") === "generic", `${sku} image`);
  }
});

test("parses stored product details safely", () => {
  assert.equal(parseDetails("not json"), null);
  assert.equal(parseDetails(null), null);
  const d = parseDetails(JSON.stringify({ highlights: ["a"], specs: [{ label: "L", value: "V" }, { label: "", value: "x" }] }));
  assert.deepEqual(d, { highlights: ["a"], specs: [{ label: "L", value: "V" }] });
});

test("unknown picture keys fall back to the generic picture", () => {
  assert.ok(productImagePath("../../etc/passwd").endsWith("generic.png"));
});
