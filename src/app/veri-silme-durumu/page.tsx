/**
 * /veri-silme-durumu — Facebook veri silme talebinin durum sayfası.
 * Meta protokolündeki { url } alanı buraya işaret eder; kullanıcı
 * confirmation_code (kod) ile talebinin sonucunu görür. Giriş gerektirmez.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { veriSilmeTalepleri } from '@/db/schema/veri-silme';

export const dynamic = 'force-dynamic';

const VARSAYILAN_METIN = {
  baslik: 'Talep alındı',
  aciklama: 'Talebiniz işleme kuyruğunda. Sorularınız için destek@viamood.com.',
};

const DURUM_METNI: Record<string, { baslik: string; aciklama: string }> = {
  'baglanti-silindi': {
    baslik: 'Silme tamamlandı',
    aciklama:
      'Facebook bağlantınız, erişim anahtarları ve Facebook profil fotoğrafınız silindi. Üyelik, sipariş ve fatura kayıtları yasal saklama süresi boyunca ayrıca korunur; hesabınızın tamamının kapatılması için destek@viamood.com adresine yazabilirsiniz.',
  },
  'kayit-bulunamadi': {
    baslik: 'Silinecek kayıt bulunamadı',
    aciklama: 'Bu Facebook hesabına bağlı bir üyelik bulunamadı — bağlantı daha önce silinmiş olabilir.',
  },
  alindi: {
    baslik: 'Talep alındı, işleniyor',
    aciklama: 'Talebiniz kaydedildi, işlem kısa süre içinde tamamlanacak. Sorularınız için destek@viamood.com.',
  },
};

export default async function VeriSilmeDurumuPage({
  searchParams,
}: {
  searchParams: Promise<{ kod?: string }>;
}) {
  const { kod } = await searchParams;
  const talep = kod
    ? (await db.select().from(veriSilmeTalepleri).where(eq(veriSilmeTalepleri.kod, kod)).limit(1))[0]
    : undefined;

  const metin = talep
    ? DURUM_METNI[talep.durum] ?? VARSAYILAN_METIN
    : {
        baslik: kod ? 'Kayıt bulunamadı' : 'Takip kodu gerekli',
        aciklama: kod
          ? 'Bu koda ait bir silme talebi bulunamadı. Kodu kontrol edin ya da destek@viamood.com adresine yazın.'
          : 'Talebinizin durumunu görmek için adresin sonuna ?kod=TAKIP_KODU ekleyin (kod, silme talebiniz sonrasında size verilir).',
      };

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold">{metin.baslik}</h1>
      <p className="mt-4 text-gray-600">{metin.aciklama}</p>
      {talep && (
        <dl className="mt-8 rounded-xl border p-4 text-sm text-gray-600">
          <div className="flex justify-between py-1">
            <dt>Takip kodu</dt>
            <dd className="font-mono">{talep.kod}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt>Talep tarihi</dt>
            <dd>{talep.createdAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</dd>
          </div>
        </dl>
      )}
    </main>
  );
}
