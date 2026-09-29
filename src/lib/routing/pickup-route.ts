/**
 * FAZ 3.3 — Toplama rotası kurucu (SAF, yan etkisiz → birim testli).
 *
 * "İlk sürüm rota = grupla + sırala" (harita optimizasyonu sonraki faz):
 *  - Aynı şehirdeki tedarikçiler yan yana gelsin (araç ileri-geri gitmesin).
 *  - Şehirler toplam yüke (adet) göre azalan; şehir içinde ilçe, sonra adet azalan.
 *  - Şehri boş olanlar en sona.
 * Deterministik sıralama (localeCompare 'tr') → aynı girdi hep aynı rota.
 */

export interface PickupRouteStopInput {
  vendorId: string;
  vendorName: string;
  city: string | null;
  district: string | null;
  itemCount: number;
  totalQuantity: number;
  lineItemIds: string[];
}

export interface PickupRouteStop extends PickupRouteStopInput {
  /** 1-tabanlı durak sırası. */
  seq: number;
}

export function buildPickupRoute(groups: PickupRouteStopInput[]): PickupRouteStop[] {
  // Şehir bazında toplam yük (adet) — şehir sıralaması için.
  const cityLoad = new Map<string, number>();
  for (const g of groups) {
    const key = g.city ?? '';
    cityLoad.set(key, (cityLoad.get(key) ?? 0) + g.totalQuantity);
  }

  const sorted = [...groups].sort((a, b) => {
    const ca = a.city ?? '';
    const cb = b.city ?? '';

    // Boş şehir en sona.
    if ((ca === '') !== (cb === '')) return ca === '' ? 1 : -1;

    // Şehir yükü azalan (aynı şehir satırları bitişik kalır çünkü yük+ad eşit).
    const loadA = cityLoad.get(ca) ?? 0;
    const loadB = cityLoad.get(cb) ?? 0;
    if (loadA !== loadB) return loadB - loadA;
    if (ca !== cb) return ca.localeCompare(cb, 'tr');

    // Şehir içi: ilçe, sonra adet azalan, sonra ad.
    const da = a.district ?? '';
    const dbb = b.district ?? '';
    if (da !== dbb) return da.localeCompare(dbb, 'tr');
    if (a.totalQuantity !== b.totalQuantity) return b.totalQuantity - a.totalQuantity;
    return a.vendorName.localeCompare(b.vendorName, 'tr');
  });

  return sorted.map((g, i) => ({ ...g, seq: i + 1 }));
}
