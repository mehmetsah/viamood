/**
 * Shopify katalog geri doldurma: yazmayı özellikle opt-in yapmak zorunludur.
 * Sayısal eski argüman limiti korunur ama artık hiçbir zaman varsayılan yazmaz.
 */
export function backfillArgumanlari(args: string[]): { apply: boolean; limit: number | null } {
  let apply = false;
  let limit: number | null = null;
  for (const a of args) {
    if (a === '--apply') { apply = true; continue; }
    if (a === '--dry-run') { continue; }
    const deger = a.startsWith('--limit=') ? a.slice(8) : a;
    if (!/^\d+$/.test(deger) || limit !== null) throw new Error('Kullanım: [--dry-run | --apply] [--limit=N]');
    const n = Number(deger);
    if (!Number.isSafeInteger(n) || n <= 0 || n > 100000) throw new Error('limit 1..100000 arası olmalı');
    limit = n;
  }
  return { apply, limit };
}
