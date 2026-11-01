/**
 * /admin/eposta-akislari — "E-posta Akışları" (#995397, Yunus 31 Eki 2026).
 *
 * Otomatik akışların (hoş geldin · sepet terki · checkout terki) defterini GÖSTERİR: hangi kişiye hangi adım
 * ne zaman planlandı, gitti mi, ne zaman gitti, hangi kupon verildi; akışın ne zaman/niçin başladığı ve
 * erken kapandıysa sebebi. Veri zaten tutuluyordu (eposta_akis_tetikleri · _gonderimleri · eposta_kuponlari),
 * okuyucusu yoktu — bu sayfa YALNIZ OKUR, tek satır yazmaz/güncellemez/silmez; akış koşucusuna dokunmaz.
 *
 * TASARIM: yeni dil ÜRETİLMEDİ — `admin/mail-gecmisi` sayfasının kalıbı birebir (aynı başlık/form/tablo
 * düzeni, aynı Pagination, aynı Tailwind sınıf dili, aynı «tablo yok» ve «boş» hâlleri).
 * BOŞ VERİ BOŞ KALIR (md.52): kayıt yoksa sayı ya da örnek satır basılmaz, boş durum metni yazılır;
 * bilinmeyen zaman/kupon «—».
 */
import { count, desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { epostaAkisGonderimleri as G, epostaAkisTetikleri as T, epostaKuponlari as K } from '@/db/schema/eposta-akis';
import { Pagination, parsePage } from '@/components/ui/Pagination';
import { auth } from '@/lib/auth';
import { tamAdminMi } from '@/lib/yetki';
import {
  AKIS_ETIKET, AKISLAR, DURUM_ETIKET, DURUMLAR, IPTAL_ETIKET, PAGE_SIZE, filtreCoz, gonderimKosulu, tetikKosulu, zamanGoster,
  type AramaParametreleri,
} from '@/lib/eposta-akis-ekran';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<AramaParametreleri>;
}

const DURUM_RENK: Record<string, string> = {
  gonderildi: 'text-green-700',
  hata: 'text-red-700',
};

export default async function EpostaAkislariPage({ searchParams }: PageProps) {
  const session = await auth();
  // İKİNCİ KAPI — middleware atlansa bile tam admin olmayan (ör. sss_editor) müşteri e-postalarını göremez.
  if (!tamAdminMi(session?.user?.role)) redirect('/admin/urun-sss');

  const sp = await searchParams;
  const page = parsePage(sp.page);
  const tpage = parsePage(sp.tpage);
  const f = filtreCoz(sp);
  const gWhere = gonderimKosulu(f);
  const tWhere = tetikKosulu(f);

  let gTotal = 0;
  let tTotal = 0;
  let gonderimler: Array<{
    id: string; akis: string; email: string; adim: number; planlananAn: Date; gonderimAni: Date | null;
    durum: string; kanal: string; hataMetni: string | null; kupon: string | null; kuponKullanildi: Date | null;
  }> = [];
  let tetikler: Array<{
    id: string; akis: string; email: string; tetikAni: Date; iysOnayi: boolean; iptalSebebi: string | null; iptalAni: Date | null;
  }> = [];
  let tabloYok = false;

  try {
    const gc = await db.select({ total: count() }).from(G).innerJoin(T, eq(G.tetikId, T.id)).where(gWhere);
    gTotal = gc[0]?.total ?? 0;
    gonderimler = await db
      .select({
        id: G.id, akis: T.akis, email: T.email, adim: G.adim, planlananAn: G.planlananAn, gonderimAni: G.gonderimAni,
        durum: G.durum, kanal: G.kanal, hataMetni: G.hataMetni, kupon: K.kod, kuponKullanildi: K.kullanildiAni,
      })
      .from(G)
      .innerJoin(T, eq(G.tetikId, T.id))
      .leftJoin(K, eq(G.kuponId, K.id))
      .where(gWhere)
      .orderBy(desc(G.planlananAn))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);
    const tc = await db.select({ total: count() }).from(T).where(tWhere);
    tTotal = tc[0]?.total ?? 0;
    tetikler = await db
      .select({
        id: T.id, akis: T.akis, email: T.email, tetikAni: T.tetikAni, iysOnayi: T.iysOnayi,
        iptalSebebi: T.iptalSebebi, iptalAni: T.iptalAni,
      })
      .from(T)
      .where(tWhere)
      .orderBy(desc(T.tetikAni))
      .limit(PAGE_SIZE)
      .offset((tpage - 1) * PAGE_SIZE);
  } catch {
    // Göç henüz koşmadıysa sayfa ÇÖKMEZ, sebebini söyler — sahte satır basmaz.
    tabloYok = true;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold leading-relaxed">E-posta Akışları</h1>
      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
        Otomatik akışlarda hangi adım kime ne zaman planlandı, gönderildi mi ve ne zaman gönderildi.
      </p>

      <form className="mt-5 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          E-posta
          <input name="email" defaultValue={sp.email ?? ''} placeholder="e-posta parçası"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          Akış
          <select name="akis" defaultValue={f.akis ?? ''}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Hepsi</option>
            {AKISLAR.map((a) => <option key={a} value={a}>{AKIS_ETIKET[a] ?? a}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          Gönderim durumu
          <select name="durum" defaultValue={f.durum ?? ''}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Hepsi</option>
            {DURUMLAR.map((d) => <option key={d} value={d}>{DURUM_ETIKET[d] ?? d}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          Akış başlangıcı (ilk gün)
          <input type="date" name="bas" defaultValue={sp.bas ?? ''}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          Akış başlangıcı (son gün)
          <input type="date" name="son" defaultValue={sp.son ?? ''}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Filtrele
        </button>
      </form>

      {tabloYok ? (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          Akış tabloları okunamadı (göç koşmamış ya da veritabanına ulaşılamadı). Tablolar hazır olduğunda bu sayfa
          akış kayıtlarını listeler.
        </p>
      ) : (
        <>
          <h2 className="mt-6 text-base font-semibold leading-relaxed">Gönderimler</h2>
          {gTotal > 0 && <p className="mt-1 text-xs leading-relaxed text-neutral-500">{gTotal} kayıt</p>}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Planlanan</th>
                  <th className="py-2 pr-3 font-medium">Gönderilen</th>
                  <th className="py-2 pr-3 font-medium">Kişi</th>
                  <th className="py-2 pr-3 font-medium">Akış</th>
                  <th className="py-2 pr-3 font-medium">Adım</th>
                  <th className="py-2 pr-3 font-medium">Durum</th>
                  <th className="py-2 pr-3 font-medium">Kupon</th>
                </tr>
              </thead>
              <tbody>
                {gonderimler.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-neutral-600 tabular-nums">{zamanGoster(r.planlananAn)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-neutral-600 tabular-nums">{zamanGoster(r.gonderimAni)}</td>
                    <td className="py-2 pr-3">{r.email}</td>
                    <td className="py-2 pr-3 text-neutral-600">{AKIS_ETIKET[r.akis] ?? r.akis}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.adim}</td>
                    <td className="py-2 pr-3">
                      <span className={DURUM_RENK[r.durum] ?? 'text-neutral-800'}>
                        {DURUM_ETIKET[r.durum] ?? r.durum}{r.kanal ? ` · ${r.kanal}` : ''}
                        {r.hataMetni ? <span className="block text-xs leading-relaxed text-neutral-500">{r.hataMetni}</span> : null}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {r.kupon ?? '—'}
                      {r.kupon && r.kuponKullanildi ? (
                        <span className="block text-xs leading-relaxed text-neutral-500">kullanıldı · {zamanGoster(r.kuponKullanildi)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {gonderimler.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm leading-relaxed text-neutral-500">
                      Bu filtreyle gönderim kaydı yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination totalCount={gTotal} pageSize={PAGE_SIZE} currentPage={page} searchParams={sp} />

          <h2 className="mt-8 text-base font-semibold leading-relaxed">Akış başlangıçları</h2>
          {tTotal > 0 && <p className="mt-1 text-xs leading-relaxed text-neutral-500">{tTotal} kayıt</p>}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Başlangıç</th>
                  <th className="py-2 pr-3 font-medium">Kişi</th>
                  <th className="py-2 pr-3 font-medium">Akış</th>
                  <th className="py-2 pr-3 font-medium">İYS onayı</th>
                  <th className="py-2 pr-3 font-medium">Erken kapanış</th>
                </tr>
              </thead>
              <tbody>
                {tetikler.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-neutral-600 tabular-nums">{zamanGoster(r.tetikAni)}</td>
                    <td className="py-2 pr-3">{r.email}</td>
                    <td className="py-2 pr-3 text-neutral-600">{AKIS_ETIKET[r.akis] ?? r.akis}</td>
                    <td className="py-2 pr-3">{r.iysOnayi ? 'var' : 'yok'}</td>
                    <td className="py-2 pr-3">
                      {r.iptalSebebi ? (IPTAL_ETIKET[r.iptalSebebi] ?? r.iptalSebebi) : '—'}
                      {r.iptalSebebi && r.iptalAni ? (
                        <span className="block text-xs leading-relaxed text-neutral-500">{zamanGoster(r.iptalAni)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {tetikler.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm leading-relaxed text-neutral-500">
                      Bu filtreyle akış başlangıcı yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination totalCount={tTotal} pageSize={PAGE_SIZE} currentPage={tpage} searchParams={sp} paramName="tpage" />
        </>
      )}
    </div>
  );
}
