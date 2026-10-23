import test from "node:test";
import assert from "node:assert/strict";
import { calculateQuotation, serialiseCalculation } from "../src/calculation.js";

test("calculates discount, GST, freight and grand total using Decimal arithmetic", () => {
  const result=serialiseCalculation(calculateQuotation({freightAmount:500,placeOfSupplySameState:true,items:[{quantity:10,unitPrice:1000,discountRate:10,gstRate:18}]}));
  assert.equal(result.subtotal,"10000.00");
  assert.equal(result.discountAmount,"1000.00");
  assert.equal(result.taxableAmount,"9000.00");
  assert.equal(result.cgstAmount,"810.00");
  assert.equal(result.sgstAmount,"810.00");
  assert.equal(result.igstAmount,"0.00");
  assert.equal(result.grandTotal,"11120.00");
});

test("uses IGST for interstate supply", () => {
  const result=serialiseCalculation(calculateQuotation({placeOfSupplySameState:false,items:[{quantity:2,unitPrice:1250,discountRate:0,gstRate:18}]}));
  assert.equal(result.igstAmount,"450.00");
  assert.equal(result.cgstAmount,"0.00");
  assert.equal(result.sgstAmount,"0.00");
  assert.equal(result.grandTotal,"2950.00");
});

test("rejects invalid discount values", () => {
  assert.throws(()=>calculateQuotation({items:[{quantity:1,unitPrice:100,discountRate:101,gstRate:18}]}),/Invalid calculation value/);
});
