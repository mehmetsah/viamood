/** DB-bağımsız storefront tipleri/yardımcıları — client bileşenleri (cards) buradan import eder. */

export interface SfProduct {
  id: string;
  handle: string;
  title: string;
  image: string | null;
  priceCents: number;
  compareAtCents: number | null; // sadece > price ise dolu (indirim rozeti için)
  vendor: string | null;
}

/** İndirim yüzdesi (compareAt verildiyse). */
export function discountPct(p: SfProduct): number | null {
  if (!p.compareAtCents || p.compareAtCents <= p.priceCents) return null;
  return Math.round(((p.compareAtCents - p.priceCents) / p.compareAtCents) * 100);
}
