/**
 * /admin/urun-sss — ürün bazlı SSS yönetimi (#991833, Yunus 27 Eyl 2026).
 *
 * Ürün handle'ı yazılır, o ürünün soru-cevapları listelenir; ekle / düzenle / gizle /
 * sil / sırala. Sıra ELLE İSTENMEZ — ekleme son sıraya koyar, ok düğmeleri taşır.
 *
 * TASARIM: yeni dil ÜRETİLMEDİ — `admin/mail-gecmisi` ve `admin/audit-log` kalıbı
 * (aynı form/tablo düzeni, aynı Tailwind sınıf dili, ≥1.3 satır yüksekliği).
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { urunSss } from '@/db/schema/urun-sss';
import { handleTemizle, SORU_EN_UZUN, CEVAP_EN_UZUN } from '@/lib/urun-sss';
import { sssEkle, sssGuncelle, sssSil, sssTasi } from '@/lib/actions/urun-sss';

interface PageProps {
  searchParams: Promise<{ handle?: string; hata?: string }>;
}

const girdiCls = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed';

export default async function UrunSssPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const handle = handleTemizle(sp.handle);

  let satirlar: Array<{ id: string; soru: string; cevap: string; sira: number; acik: boolean }> = [];
  let tabloYok = false;
  if (handle) {
    try {
      satirlar = await db
        .select({ id: urunSss.id, soru: urunSss.soru, cevap: urunSss.cevap, sira: urunSss.sira, acik: urunSss.acik })
        .from(urunSss)
        .where(eq(urunSss.urunHandle, handle))
        .orderBy(asc(urunSss.sira));
    } catch {
      // Göç (0028) koşmadıysa ekran çökmez, sebebini söyler.
      tabloYok = true;
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold leading-relaxed">Ürün SSS Yönetimi</h1>
      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
        Her ürünün kendi soru-cevapları. Ürün detay sayfasındaki sekmelerin en sonunda görünür.
      </p>

      <form className="mt-5 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          Ürün handle
          <input name="handle" defaultValue={handle} placeholder="etiketli-18li-antrasit-..."
            className={girdiCls + ' min-w-[22rem]'} />
        </label>
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium leading-relaxed text-white">
          Getir
        </button>
      </form>
      <p className="mt-2 text-xs leading-relaxed text-neutral-500">
        Handle, ürün adresinin son parçasıdır: <code>/products/&lt;handle&gt;</code>. Tam adres yapıştırsanız da olur.
      </p>

      {sp.hata && (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm leading-relaxed text-red-800">
          {sp.hata}
        </p>
      )}

      {!handle && (
        <p className="mt-6 text-sm leading-relaxed text-neutral-500">Başlamak için bir ürün handle&apos;ı girin.</p>
      )}

      {tabloYok && (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          SSS tablosu henüz kurulmadı (<code>drizzle/0028_urun_sss.sql</code> koşmamış). Göç uygulandıktan
          sonra bu ekran çalışır.
        </p>
      )}

      {handle && !tabloYok && (
        <>
          <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-bold leading-relaxed text-neutral-800">Yeni soru ekle</h2>
            <form action={sssEkle} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="handle" value={handle} />
              <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
                Soru
                <input name="soru" required maxLength={SORU_EN_UZUN} className={girdiCls} placeholder="Ürün bulaşık makinesinde yıkanır mı?" />
              </label>
              <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
                Cevap
                <textarea name="cevap" required maxLength={CEVAP_EN_UZUN} rows={3} className={girdiCls}
                  placeholder="Evet, üst rafta yıkanabilir." />
              </label>
              <p className="text-xs leading-relaxed text-neutral-500">
                Düz metin yazın — HTML etiketi kabul edilmiyor. Sıra kendiliğinden en sona eklenir.
              </p>
              <button type="submit" className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium leading-relaxed text-white">
                Ekle
              </button>
            </form>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-neutral-500">{satirlar.length} soru · sıra yukarıdan aşağıya</p>

          {satirlar.length === 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              Bu ürün için henüz soru yok. Yukarıdan ekleyin; eklenmezse ürün sayfasında SSS sekmesi hiç çizilmez.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {satirlar.map((k, i) => (
                <li key={k.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <form action={sssGuncelle} className="flex flex-col gap-3">
                    <input type="hidden" name="id" value={k.id} />
                    <input type="hidden" name="handle" value={handle} />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs leading-relaxed text-neutral-500">#{i + 1}</span>
                      <label className="flex items-center gap-2 text-xs leading-relaxed text-neutral-600">
                        <input type="checkbox" name="acik" defaultChecked={k.acik} className="h-4 w-4" />
                        Görünür
                      </label>
                    </div>
                    <input name="soru" defaultValue={k.soru} maxLength={SORU_EN_UZUN} className={girdiCls} />
                    <textarea name="cevap" defaultValue={k.cevap} maxLength={CEVAP_EN_UZUN} rows={3} className={girdiCls} />
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="submit" className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium leading-relaxed text-white">
                        Kaydet
                      </button>
                    </div>
                  </form>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={sssTasi}>
                      <input type="hidden" name="id" value={k.id} />
                      <input type="hidden" name="handle" value={handle} />
                      <input type="hidden" name="yon" value="yukari" />
                      <button type="submit" disabled={i === 0}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-xs leading-relaxed disabled:opacity-40">
                        Yukarı taşı
                      </button>
                    </form>
                    <form action={sssTasi}>
                      <input type="hidden" name="id" value={k.id} />
                      <input type="hidden" name="handle" value={handle} />
                      <input type="hidden" name="yon" value="asagi" />
                      <button type="submit" disabled={i === satirlar.length - 1}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-xs leading-relaxed disabled:opacity-40">
                        Aşağı taşı
                      </button>
                    </form>
                    <form action={sssSil}>
                      <input type="hidden" name="id" value={k.id} />
                      <input type="hidden" name="handle" value={handle} />
                      <button type="submit" className="rounded-lg border border-red-300 px-3 py-2 text-xs leading-relaxed text-red-700">
                        Sil
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
