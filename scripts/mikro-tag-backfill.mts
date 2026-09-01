/**
 * GERİYE DÖNÜK ETİKET DOLDURMA — mevcut siparişleri Mikro'yla karşılaştırıp
 * `mikro-ok` / `mikro-hata` etiketlerini BİR KEZ basar.
 *
 * Bu script, `mikro-tag.ts` yamasından ÖNCE oluşmuş siparişler için tek seferliktir.
 * Yeni siparişlerde etiket zaten `syncOrderToMikro` içinde otomatik düşüyor.
 *
 * ⚠️ VARSAYILAN KURU KOŞU. Hiçbir şey yazmaz, ne yapacağını listeler.
 *    Gerçekten yazmak için açıkça `--yaz` verilmeli.
 *
 *   npx tsx scripts/mikro-tag-backfill.mts            # kuru koşu (önizleme)
 *   npx tsx scripts/mikro-tag-backfill.mts --yaz      # etiketleri Shopify'a bas
 *
 * Gerekli env: SHOPIFY_* (etiket yazımı) + MIKRO_API_URL/USERNAME/PASSWORD (evrak sorgusu).
 * Mikro'ya YALNIZCA SELECT atar — evrak/cari oluşturmaz.
 */
import { mikroFetch } from '../src/lib/mikro/client';
import { env } from '../src/lib/env';
import { shopifyRest } from '../src/lib/shopify/client';
import { tagMikroBasarili, tagMikroHatali } from '../src/lib/shopify/mikro-tag';

const YAZ = process.argv.includes('--yaz');
const FIRMA = env.MIKRO_FIRMA_API_URL;

interface ShopifyOrder {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  tags: string;
  cancelled_at: string | null;
  financial_status: string | null;
}

/** Mikro'daki mevcut evrak serilerini TEK sorguda çeker (sipariş başına sorgu atmaz). */
async function evrakSerileri(baseUrl: string | undefined, onek: string): Promise<Set<string>> {
  const res = await mikroFetch<{ Result?: Array<{ sip_evrakno_seri: string }> }>(
    '/MikroV17/sqlverioku',
    {
      method: 'POST',
      body: {
        Query:
          `SELECT DISTINCT sip_evrakno_seri FROM SIPARISLER WITH (NOLOCK) ` +
          `WHERE sip_evrakno_seri LIKE '${onek}%'`,
      },
    },
    baseUrl,
  );
  const out = new Set<string>();
  for (const r of res?.Result ?? []) {
    const n = r.sip_evrakno_seri.slice(onek.length);
    if (/^\d+$/.test(n)) out.add(n);
  }
  return out;
}

async function tumSiparisler(): Promise<ShopifyOrder[]> {
  const out: ShopifyOrder[] = [];
  let path: string | null =
    '/orders.json?status=any&limit=250&fields=id,name,created_at,total_price,tags,cancelled_at,financial_status';
  while (path) {
    const d = await shopifyRest<{ orders: ShopifyOrder[] }>(path);
    out.push(...d.orders);
    // Not: shopifyRest header döndürmediği için sayfalama basitleştirildi —
    // 250'den fazla sipariş olduğunda `since_id` ile ilerlenir.
    if (d.orders.length < 250) break;
    const sonId = d.orders[d.orders.length - 1]!.id;
    path =
      `/orders.json?status=any&limit=250&since_id=${sonId}` +
      `&fields=id,name,created_at,total_price,tags,cancelled_at,financial_status`;
  }
  return out;
}

async function main() {
  console.log(YAZ ? '⚠️  YAZMA MODU — etiketler Shopify\'a basılacak' : 'KURU KOŞU — hiçbir şey yazılmayacak');

  const [ara, firma, siparisler] = await Promise.all([
    evrakSerileri(undefined, `${env.MIKRO_MUSTERI_NO}${env.MIKRO_PAZARYERI}`),
    evrakSerileri(FIRMA, env.MIKRO_PAZARYERI),
    tumSiparisler(),
  ]);
  console.log(`Shopify sipariş: ${siparisler.length} · aradepo evrak: ${ara.size} · firma evrak: ${firma.size}`);

  let ok = 0;
  let hata = 0;
  let atlandi = 0;
  for (const o of siparisler) {
    const no = o.name.replace(/\D/g, '');
    const a = ara.has(no);
    const f = firma.has(no);
    const mevcut = (o.tags ?? '').split(',').map((t) => t.trim());

    // İptal edilmiş siparişin Mikro'da olmaması normal — etiketleme.
    if (o.cancelled_at && !a && !f) {
      atlandi++;
      continue;
    }
    // Zaten doğru etiketlenmişse tekrar yazma (idempotent).
    if ((a && f && mevcut.includes('mikro-ok')) || (!a && !f && mevcut.includes('mikro-hata'))) {
      atlandi++;
      continue;
    }

    if (a && f) {
      console.log(`  ${o.name.padEnd(7)} TAM   → mikro-ok`);
      if (YAZ) await tagMikroBasarili(String(o.id), `${env.MIKRO_MUSTERI_NO}${env.MIKRO_PAZARYERI}${no}`);
      ok++;
    } else {
      const sebep = a
        ? 'yarım aktarım: ana firma bacağı eksik'
        : f
          ? 'yarım aktarım: aradepo bacağı eksik'
          : 'Mikro\'da evrak yok';
      console.log(`  ${o.name.padEnd(7)} ${a || f ? 'YARIM' : 'HİÇ  '} → mikro-hata (${sebep})`);
      if (YAZ) await tagMikroHatali(String(o.id), sebep);
      hata++;
    }
    if (YAZ) await new Promise((r) => setTimeout(r, 550)); // Shopify rate-limit
  }

  console.log(`\nÖzet: mikro-ok ${ok} · mikro-hata ${hata} · atlandı ${atlandi}`);
  if (!YAZ) console.log('Kuru koşuydu — yazmak için: npx tsx scripts/mikro-tag-backfill.mts --yaz');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
