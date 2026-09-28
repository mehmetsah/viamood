'use server';
/**
 * Ürün SSS yönetimi — admin eylemleri (#991833).
 *
 * Doğrulama `lib/urun-sss` içindeki SAF katmandan gelir; burada kopyası YAZILMAZ.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, asc, eq, max } from 'drizzle-orm';
import { db } from '@/db/client';
import { urunSss } from '@/db/schema/urun-sss';
import { handleTemizle, sssDogrula } from '@/lib/urun-sss';
import { sssSenkronla } from '@/lib/urun-sss-shopify';

/**
 * Form eylemleri `Promise<void>` döner (React `action=` sözleşmesi). Hata,
 * `?hata=` sorgusuyla EKRANA taşınır — sessizce yutulmaz. Bu kararı bilinçli
 * verdim: `useActionState` ile durum taşımak her formu istemci bileşenine
 * çevirirdi; bu ekranda 4 ayrı form var ve hiçbirinin istemci mantığına ihtiyacı yok.
 */
function geriDon(handle: string, hata?: string): never {
  const q = new URLSearchParams({ handle });
  if (hata) q.set('hata', hata);
  redirect('/admin/urun-sss?' + q.toString());
}

function yenile(handle: string) {
  revalidatePath('/admin/urun-sss');
  // Native vitrin ürün sayfası da bu veriyi gösteriyor.
  revalidatePath(`/magaza/${handle}`);
}

/**
 * DB yazımından SONRA Shopify metafield'ını tazeler (#991833-C).
 *
 * Kill switch kapalıysa `sssSenkronla` ilk satırda döner, ağ çağrısı olmaz.
 * ⚠ HATA YUTULMAZ: senkron başarısızsa kullanıcı `?hata=` ile sebebi görür.
 * Sessiz geçmek "admin'e girdim ama ürün sayfasında yok" hâlini teşhis edilemez
 * kılardı — bu turun bütün sebebi o.
 * ⚠ AÇIK kayıtların TAMAMI gönderilir (tek kayıt değil): metafield bir LİSTEdir,
 * kısmi yazım listeyi kırpar. Boş küme metafield'ı boşaltır.
 */
async function shopifyTazele(handle: string): Promise<string | null> {
  try {
    const kayitlar = await db
      .select({ soru: urunSss.soru, cevap: urunSss.cevap, sira: urunSss.sira })
      .from(urunSss)
      .where(and(eq(urunSss.urunHandle, handle), eq(urunSss.acik, true)))
      .orderBy(asc(urunSss.sira));
    const r = await sssSenkronla(handle, kayitlar);
    return r.ok ? null : r.hata;
  } catch (e) {
    return 'Shopify tazelenemedi: ' + ((e as Error)?.name ?? 'bilinmeyen');
  }
}

export async function sssEkle(fd: FormData): Promise<void> {
  const handle = handleTemizle(String(fd.get('handle') ?? ''));
  if (!handle) geriDon('', 'ürün handle gerekli');
  const d = sssDogrula({ soru: String(fd.get('soru') ?? ''), cevap: String(fd.get('cevap') ?? '') });
  if ('hata' in d) geriDon(handle, d.hata);
  try {
    // Sıra ELLE İSTENMEZ: son sıranın bir fazlası verilir. Tekil kısıt (handle,sira)
    // olduğu için elle girilen çakışan bir sayı kaydı düşürürdü.
    const [m] = await db.select({ enBuyuk: max(urunSss.sira) }).from(urunSss).where(eq(urunSss.urunHandle, handle));
    const sira = (m?.enBuyuk ?? -1) + 1;
    await db.insert(urunSss).values({ urunHandle: handle, soru: d.kayit.soru, cevap: d.kayit.cevap, sira });
    yenile(handle);
    geriDon(handle, (await shopifyTazele(handle)) ?? undefined);
  } catch (e) {
    geriDon(handle, 'kaydedilemedi: ' + ((e as Error)?.name ?? 'bilinmeyen'));
  }
}

export async function sssGuncelle(fd: FormData): Promise<void> {
  const id = String(fd.get('id') ?? '');
  const handle = handleTemizle(String(fd.get('handle') ?? ''));
  if (!id || !handle) geriDon(handle, 'kayıt bulunamadı');
  const d = sssDogrula({ soru: String(fd.get('soru') ?? ''), cevap: String(fd.get('cevap') ?? '') });
  if ('hata' in d) geriDon(handle, d.hata);
  try {
    await db
      .update(urunSss)
      .set({ soru: d.kayit.soru, cevap: d.kayit.cevap, acik: fd.get('acik') === 'on', updatedAt: new Date() })
      .where(eq(urunSss.id, id));
    yenile(handle);
    geriDon(handle, (await shopifyTazele(handle)) ?? undefined);
  } catch (e) {
    geriDon(handle, 'güncellenemedi: ' + ((e as Error)?.name ?? 'bilinmeyen'));
  }
}

export async function sssSil(fd: FormData): Promise<void> {
  const id = String(fd.get('id') ?? '');
  const handle = handleTemizle(String(fd.get('handle') ?? ''));
  if (!id || !handle) geriDon(handle, 'kayıt bulunamadı');
  try {
    await db.delete(urunSss).where(eq(urunSss.id, id));
    // Silme sonrası sıraları 0,1,2… olarak yeniden dizeriz; yoksa boşluk kalır ve
    // bir sonraki ekleme tekil kısıtla çakışabilir.
    const kalan = await db
      .select({ id: urunSss.id })
      .from(urunSss)
      .where(eq(urunSss.urunHandle, handle))
      .orderBy(asc(urunSss.sira));
    // Geçici negatif sıraya alıp sonra yerleştiriyoruz: tekil kısıt (handle,sira)
    // doğrudan yeniden numaralamada çakışır (0→1 yazarken 1 hâlâ dolu).
    const idler = kalan.map((k) => k.id);
    for (let i = 0; i < idler.length; i++) {
      await db.update(urunSss).set({ sira: -1000 - i }).where(eq(urunSss.id, idler[i]!));
    }
    for (let i = 0; i < idler.length; i++) {
      await db.update(urunSss).set({ sira: i }).where(eq(urunSss.id, idler[i]!));
    }
    yenile(handle);
    geriDon(handle, (await shopifyTazele(handle)) ?? undefined);
  } catch (e) {
    geriDon(handle, 'silinemedi: ' + ((e as Error)?.name ?? 'bilinmeyen'));
  }
}

/** Sırayı bir yukarı/aşağı taşır. Takas geçici negatif sıra ile yapılır (tekil kısıt). */
export async function sssTasi(fd: FormData): Promise<void> {
  const id = String(fd.get('id') ?? '');
  const handle = handleTemizle(String(fd.get('handle') ?? ''));
  const yon = String(fd.get('yon') ?? '') === 'yukari' ? -1 : 1;
  if (!id || !handle) geriDon(handle, 'kayıt bulunamadı');
  try {
    const liste = await db
      .select({ id: urunSss.id, sira: urunSss.sira })
      .from(urunSss)
      .where(eq(urunSss.urunHandle, handle))
      .orderBy(asc(urunSss.sira));
    const i = liste.findIndex((k) => k.id === id);
    const j = i + yon;
    if (i < 0 || j < 0 || j >= liste.length) geriDon(handle); // sınırda: sessizce hiçbir şey
    const a = liste[i]!, b = liste[j]!;
    await db.update(urunSss).set({ sira: -9999 }).where(eq(urunSss.id, a.id));
    await db.update(urunSss).set({ sira: a.sira }).where(eq(urunSss.id, b.id));
    await db.update(urunSss).set({ sira: b.sira }).where(eq(urunSss.id, a.id));
    yenile(handle);
    geriDon(handle, (await shopifyTazele(handle)) ?? undefined);
  } catch (e) {
    geriDon(handle, 'taşınamadı: ' + ((e as Error)?.name ?? 'bilinmeyen'));
  }
}
