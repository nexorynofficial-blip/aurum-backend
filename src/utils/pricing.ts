import { env } from '@/config/env';

export interface CartLine {
  price: number;
  quantity: number;
}

export interface Totals {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Compute order totals from line items, a shipping cost, and the flat tax rate. */
export function computeTotals(lines: CartLine[], shipping = 0): Totals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
  const tax = round2(subtotal * env.TAX_RATE);
  return {
    subtotal,
    tax,
    shipping: round2(shipping),
    total: round2(subtotal + tax + shipping),
  };
}
