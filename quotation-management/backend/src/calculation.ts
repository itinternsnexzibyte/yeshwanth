import { Decimal } from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2);

export type CalculationInput = {
  freightAmount?: string | number;
  placeOfSupplySameState?: boolean;
  items: Array<{ quantity: string | number; unitPrice: string | number; discountRate?: string | number; gstRate?: string | number }>;
};

export function calculateQuotation(input: CalculationInput) {
  const items = input.items.map((item) => {
    const quantity = new Decimal(item.quantity);
    const unitPrice = money(item.unitPrice);
    const discountRate = new Decimal(item.discountRate || 0);
    const gstRate = new Decimal(item.gstRate ?? 18);
    if (quantity.lte(0) || unitPrice.lt(0) || discountRate.lt(0) || discountRate.gt(100) || gstRate.lt(0)) throw new Error("Invalid calculation value");
    const gross = money(quantity.mul(unitPrice));
    const discountAmount = money(gross.mul(discountRate).div(100));
    const taxableAmount = money(gross.minus(discountAmount));
    const gstAmount = money(taxableAmount.mul(gstRate).div(100));
    const lineTotal = money(taxableAmount.plus(gstAmount));
    return { quantity, unitPrice, discountRate, gstRate, gross, discountAmount, taxableAmount, gstAmount, lineTotal };
  });
  const subtotal = money(items.reduce((s, i) => s.plus(i.gross), new Decimal(0)));
  const discountAmount = money(items.reduce((s, i) => s.plus(i.discountAmount), new Decimal(0)));
  const taxableAmount = money(subtotal.minus(discountAmount));
  const totalGst = money(items.reduce((s, i) => s.plus(i.gstAmount), new Decimal(0)));
  const freightAmount = money(input.freightAmount || 0);
  const sameState = input.placeOfSupplySameState !== false;
  const cgstAmount = sameState ? money(totalGst.div(2)) : money(0);
  const sgstAmount = sameState ? money(totalGst.minus(cgstAmount)) : money(0);
  const igstAmount = sameState ? money(0) : totalGst;
  const grandTotal = money(taxableAmount.plus(totalGst).plus(freightAmount));
  return { items, subtotal, discountAmount, taxableAmount, cgstAmount, sgstAmount, igstAmount, freightAmount, grandTotal };
}

export const serialiseCalculation = (c: ReturnType<typeof calculateQuotation>) => ({
  ...Object.fromEntries(Object.entries(c).filter(([k]) => k !== "items").map(([k, v]) => [k, (v as Decimal).toFixed(2)])),
  items: c.items.map(i => Object.fromEntries(Object.entries(i).map(([k, v]) => [k, (v as Decimal).toFixed(k === "quantity" ? 3 : 2)])))
});
