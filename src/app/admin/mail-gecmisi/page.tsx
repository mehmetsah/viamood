/**
 * /admin/mail-gecmisi — "Mail Gönderim Geçmişi" (#991691 md.2, Yunus 27 Eyl 2026).
 *
 * Kime, ne zaman, hangi şablon/konu, sonuç (başarılı/başarısız). Filtre: tarih
 * aralığı · alıcı · mail tipi.
 *
 * ⚠ GERİYE DÖNÜK VERİ YOK — ölçüldü: bu depoda mail gönderimi için daha önce hiç
 * log tutulmuyordu, beslenecek eski bir tablo/kuyruk mevcut değil. `mail_log`
 * 0027 ile kuruldu ve BU COMMIT'TEN SONRAKİ gönderimler görünür. Boş liste
 * "arıza" değil, "henüz gönderim yok" demek — ekranda da böyle yazıyor.
 *
 * TASARIM: yeni dil ÜRETİLMEDİ — `admin/audit-log` sayfasının kalıbı birebir
 * (aynı tablo düzeni, aynı Pagination, aynı Tailwind sınıf dili).
 */
import { and, count, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { mailLog, MAIL_TIPLERI } from '@/db/schema/mail-log';
import { Pagination, parsePage } from '@/components/ui/Pagination';

const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{ alici?: string; tip?: string; bas?: string; son?: string; page?: string }>;
}

const TIP_RENK: Record<string, string> = {
  islemsel: 'bg-blue-100 text-blue-900',
  pazarlama: 'bg-orange-100 text-orange-900',
  duyuru: 'bg-purple-100 text-purple-900',
};

/** `YYYY-MM-DD` → Date. Geçersizse null (filtre yok sayılır, sayfa çökmez). */
function tarih(v: string | undefined, gunSonu = false): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + (gunSonu ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function MailGecmisiPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const tipGecerli = sp.tip && (MAIL_TIPLERI as readonly string[]).includes(sp.tip) ? sp.tip : undefined;

  const kosul = [];
  if (sp.alici) kosul.push(ilike(mailLog.alici, `%${sp.alici}%`));
  if (tipGecerli) kosul.push(eq(mailLog.tip, tipGecerli));
  const bas = tarih(sp.bas);
  const son = tarih(sp.son, true);
  if (bas) kosul.push(gte(mailLog.createdAt, bas));
  if (son) kosul.push(lte(mailLog.createdAt, son));
  const where = kosul.length ? and(...kosul) : undefined;

  let total = 0;
  let satirlar: Array<{
    id: string; alici: string; konu: string; sablon: string; tip: string;
    basarili: boolean; kanal: string | null; hata: string | null; createdAt: Date;
  }> = [];
  let tabloYok = false;

  try {
    const c = await db.select({ total: count() }).from(mailLog).where(where);
    total = c[0]?.total ?? 0;
    satirlar = await db
      .select({
        id: mailLog.id, alici: mailLog.alici, konu: mailLog.konu, sablon: mailLog.sablon,
        tip: mailLog.tip, basarili: mailLog.basarili, kanal: mailLog.kanal,
        hata: mailLog.hata, createdAt: mailLog.createdAt,
      })
      .from(mailLog)
      .where(where)
      .orderBy(desc(mailLog.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);
  } catch {
    // Göç (0027) henüz koşmadıysa sayfa ÇÖKMEZ, sebebini söyler.
    tabloYok = true;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold leading-relaxed">Mail Gönderim Geçmişi</h1>
      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
        Kime, ne zaman, hangi mail gönderildi ve sonucu ne oldu.
      </p>

      <form className="mt-5 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          Alıcı
          <input name="alici" defaultValue={sp.alici ?? ''} placeholder="e-posta parçası"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          Mail tipi
          <select name="tip" defaultValue={tipGecerli ?? ''}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Hepsi</option>
            {MAIL_TIPLERI.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          Başlangıç
          <input type="date" name="bas" defaultValue={sp.bas ?? ''}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs leading-relaxed text-neutral-600">
          Bitiş
          <input type="date" name="son" defaultValue={sp.son ?? ''}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Filtrele
        </button>
      </form>

      {tabloYok ? (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          Kayıt tablosu henüz kurulmadı (<code>drizzle/0027_mail_log.sql</code> koşmamış). Göç
          uygulandıktan sonra bu sayfa gönderimleri listeler.
        </p>
      ) : (
        <>
          <p className="mt-5 text-xs leading-relaxed text-neutral-500">{total} kayıt</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Tarih</th>
                  <th className="py-2 pr-3 font-medium">Alıcı</th>
                  <th className="py-2 pr-3 font-medium">Konu</th>
                  <th className="py-2 pr-3 font-medium">Şablon</th>
                  <th className="py-2 pr-3 font-medium">Tip</th>
                  <th className="py-2 pr-3 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-neutral-600 tabular-nums">
                      {new Date(r.createdAt).toLocaleString('tr-TR')}
                    </td>
                    <td className="py-2 pr-3">{r.alici}</td>
                    <td className="py-2 pr-3 leading-relaxed">{r.konu}</td>
                    <td className="py-2 pr-3 text-neutral-600">{r.sablon}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs leading-relaxed ${TIP_RENK[r.tip] ?? 'bg-neutral-100 text-neutral-800'}`}>
                        {r.tip}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {r.basarili ? (
                        <span className="text-green-700">başarılı{r.kanal ? ` · ${r.kanal}` : ''}</span>
                      ) : (
                        <span className="text-red-700">
                          başarısız{r.kanal ? ` · ${r.kanal}` : ''}
                          {r.hata ? <span className="block text-xs leading-relaxed text-neutral-500">{r.hata}</span> : null}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {satirlar.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm leading-relaxed text-neutral-500">
                      Bu filtreyle gönderim yok. Kayıt tutma 27 Eyl 2026&apos;da başladı; daha eski
                      gönderimlerin logu bulunmuyor.
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
