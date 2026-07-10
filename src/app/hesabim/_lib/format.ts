/** Portal ortak yardımcıları — para/tarih biçimi, baş harfler, sipariş durumu → çip + koridor. */

export function tl(cents: bigint | number | null | undefined): string {
  return (Number(cents ?? 0) / 100).toLocaleString('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  });
}

export function tarih(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function tarihKisa(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function basHarfler(name: string | null | undefined): string {
  const p = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return 'VM';
  if (p.length === 1) return p[0]!.slice(0, 2).toLocaleUpperCase('tr');
  return (p[0]![0]! + p[p.length - 1]![0]!).toLocaleUpperCase('tr');
}

/** İlk-iki-harf pulu — ürün başlığından. */
export function pul(baslik: string | null | undefined): string {
  const p = (baslik ?? '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '•';
  if (p.length === 1) return p[0]!.slice(0, 2).toLocaleUpperCase('tr');
  return (p[0]![0]! + p[1]![0]!).toLocaleUpperCase('tr');
}

export type Durum = { metin: string; cip: 'yolda' | 'teslim' | 'bekliyor' | 'iptal' };

/** Sipariş durum çipi — financial + fulfillment + iptal + takip'ten türetir. */
export function siparisDurumu(o: {
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: Date | null;
  hasTracking: boolean;
  delivered?: boolean;
}): Durum {
  if (o.cancelledAt) return { metin: 'İptal edildi', cip: 'iptal' };
  if (o.delivered) return { metin: 'Teslim edildi', cip: 'teslim' };
  if (o.fulfillmentStatus === 'fulfilled' || o.hasTracking)
    return { metin: 'Kargoda', cip: 'yolda' };
  const paid = o.financialStatus === 'paid' || o.financialStatus === 'partially_paid';
  if (paid) return { metin: 'Hazırlanıyor', cip: 'yolda' };
  return { metin: 'Ödeme bekleniyor', cip: 'bekliyor' };
}

/** 4-adımlı koridor: onaylandı → hazırlandı → kargoda → teslim. */
export type Adim = { ad: string; alt: string; hal: 'oldu' | 'simdi' | '' };
export function koridor(o: {
  cip: Durum['cip'];
  placedAt: Date;
  fulfilledAt?: Date | null;
  deliveredAt?: Date | null;
}): Adim[] {
  const t = (d?: Date | null) => (d ? tarihKisa(d) : '—');
  if (o.cip === 'iptal') {
    return [
      { ad: 'Onaylandı', alt: t(o.placedAt), hal: 'oldu' },
      { ad: 'İptal edildi', alt: '—', hal: 'simdi' },
    ];
  }
  const paid = o.cip !== 'bekliyor';
  const kargoda = o.cip === 'yolda' || o.cip === 'teslim';
  const teslim = o.cip === 'teslim';
  return [
    { ad: 'Onaylandı', alt: t(o.placedAt), hal: 'oldu' },
    { ad: 'Hazırlandı', alt: paid ? t(o.placedAt) : '—', hal: paid ? 'oldu' : 'simdi' },
    {
      ad: 'Kargoda',
      alt: kargoda ? t(o.fulfilledAt) : '—',
      hal: teslim ? 'oldu' : kargoda ? 'simdi' : '',
    },
    { ad: 'Teslim', alt: t(o.deliveredAt), hal: teslim ? 'oldu' : '' },
  ];
}
