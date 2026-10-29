/**
 * /admin/eposta-takip — "E-posta Akışı Takibi" (#995400, Yunus 29 Eki 2026).
 *
 * Yunus (birebir): «Tutulan veriyi ve mail gönderildi ise gönderildi ve zaman
 * bilgisini görebileceğimiz panel yeterlidir. Sıfırdan kurmaya gerek yoktur.»
 * Dört şey gösterilir: forma girilen kayıt (kim · e-posta · zaman) · hangi akış
 * tetiklendi · mail gönderildi mi · gönderim zamanı. Fazlası BİLEREK yok.
 *
 * Veri: #994057 defteri, yalnız okunur (bkz. src/lib/eposta-takip.ts).
 *
 * ⚠ SEPET / CHECKOUT TERKİ BOŞSA bu arıza ekranı değil, ÖLÇÜLMÜŞ durumdur
 * (#995397, 29 Eki): terk tetiği bizim `carts` tablomuzu tarar, vitrin sepeti
 * ise Shopify'da tutulur ⇒ tabloya satır düşmüyor. Ekran bunu boş liste yerine
 * açıkça yazar; uydurma/örnek satır GÖSTERİLMEZ.
 *
 * TASARIM: yeni dil ÜRETİLMEDİ — `admin/mail-gecmisi` (o da `admin/audit-log`)
 * kalıbı birebir: aynı tablo düzeni, aynı Pagination, aynı Tailwind sınıf dili.
 */
import Link from 'next/link';
import { db } from '@/db/client';
import { Pagination, parsePage } from '@/components/ui/Pagination';
import {
  AKIS_ADI, HAL_YAZISI, adimEtiketi, formSatirlari, takipSayilari, terkSatirlari,
  type MailHali, type TakipSatiri,
} from '@/lib/eposta-takip';

const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{ liste?: string; page?: string }>;
}

const HAL_RENK: Record<MailHali, string> = {
  gonderildi: 'text-green-700',
  bekliyor: 'text-amber-700',
  gonderilmedi: 'text-neutral-500',
  hata: 'text-red-700',
};

function zamanYaz(d: Date | null): string {
  return d ? new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '';
}

function MailHucresi({ r }: { r: TakipSatiri }) {
  return (
    <ul className="flex flex-col gap-1">
      {r.mailler.map((m, i) => (
        <li key={m.adim ?? `d${i}`} className="leading-relaxed">
          <span className="text-neutral-600">{adimEtiketi(r.akis, m.adim)}</span>
          <span className={`ml-2 ${HAL_RENK[m.hal]}`}>{HAL_YAZISI[m.hal]}</span>
          {m.zaman ? (
            <span className="ml-2 text-neutral-600 tabular-nums">
              {m.zamanTuru === 'planlanan' ? 'planlanan ' : ''}{zamanYaz(m.zaman)}
            </span>
          ) : null}
          {m.not ? <span className="block text-xs leading-relaxed text-neutral-500">{m.not}</span> : null}
        </li>
      ))}
      {r.mailler.length === 0 && <li className="text-neutral-500 leading-relaxed">Gönderim kaydı yok</li>}
    </ul>
  );
}

export default async function EpostaTakipPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const liste = sp.liste === 'terk' ? 'terk' : 'form';
  const page = parsePage(sp.page);
  const sayfa = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };

  let sayilar = { form: 0, terk: 0 };
  let satirlar: TakipSatiri[] = [];
  let tabloYok = false;
  try {
    sayilar = await takipSayilari(db);
    satirlar = liste === 'terk' ? await terkSatirlari(db, sayfa) : await formSatirlari(db, sayfa);
  } catch {
    // Göçler (0022 / akış tabloları) koşmadıysa sayfa ÇÖKMEZ, sebebini söyler.
    tabloYok = true;
  }
  const total = liste === 'terk' ? sayilar.terk : sayilar.form;

  const sekme = (ad: 'form' | 'terk', yazi: string, n: number) => (
    <Link
      href={ad === 'form' ? '/admin/eposta-takip' : '/admin/eposta-takip?liste=terk'}
      className={`rounded-lg px-4 py-2 text-sm leading-relaxed ${
        liste === ad ? 'bg-neutral-900 text-white' : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      {yazi} <span className="tabular-nums opacity-70">({n})</span>
    </Link>
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold leading-relaxed">E-posta Akışı Takibi</h1>
      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
        Forma kim kayıt oldu, hangi otomatik akış başladı, mail gönderildi mi ve ne zaman.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {sekme('form', 'Form kayıtları', sayilar.form)}
        {sekme('terk', 'Sepet / checkout terki', sayilar.terk)}
      </div>

      {tabloYok ? (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          Akış tabloları henüz kurulmadı (göçler koşmamış). Göç uygulandıktan sonra bu sayfa kayıtları listeler.
        </p>
      ) : liste === 'terk' && sayilar.terk === 0 ? (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          Sepet ve checkout terki için bugüne kadar hiç tetik kaydı yok, bu yüzden bu akışlardan mail
          gitmedi. Bu akışlar kendi sepet tablomuzu tarıyor; vitrindeki sepet Shopify&apos;da tutulduğu
          için o tabloya kayıt düşmüyor. Sepet verisi bize gelmeye başladığında kayıtlar burada görünür.
        </p>
      ) : (
        <>
          <p className="mt-5 text-xs leading-relaxed text-neutral-500">{total} kayıt</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-2 pr-3 font-medium">{liste === 'terk' ? 'Tetik zamanı' : 'Form zamanı'}</th>
                  <th className="py-2 pr-3 font-medium">Kişi</th>
                  <th className="py-2 pr-3 font-medium">Akış</th>
                  <th className="py-2 pr-3 font-medium">Mailler (durum · zaman)</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-neutral-600 tabular-nums">{zamanYaz(r.an)}</td>
                    <td className="py-2 pr-3">
                      {r.ad ? <span className="block leading-relaxed">{r.ad}</span> : null}
                      <span className="block leading-relaxed text-neutral-600">{r.email}</span>
                    </td>
                    <td className="py-2 pr-3 leading-relaxed">
                      {r.akis ? (AKIS_ADI[r.akis] ?? r.akis) : <span className="text-neutral-500">Akış açılmadı</span>}
                      {r.oncekiKayitlaAcildi ? (
                        <span className="block text-xs leading-relaxed text-neutral-500">aynı adresin önceki kaydıyla açılmıştı</span>
                      ) : null}
                      {r.akisDurdu ? <span className="block text-xs leading-relaxed text-neutral-500">{r.akisDurdu}</span> : null}
                    </td>
                    <td className="py-2 pr-3"><MailHucresi r={r} /></td>
                  </tr>
                ))}
                {satirlar.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm leading-relaxed text-neutral-500">
                      Bu sayfada kayıt yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination totalCount={total} pageSize={PAGE_SIZE} currentPage={page} searchParams={sp} />
        </>
      )}
    </div>
  );
}
