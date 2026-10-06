/**
 * /admin/davet — davet linki üretme ekranı (#992317, halka #4).
 *
 * TASARIM: yeni dil ÜRETİLMEDİ — `admin/urun-sss` kalıbı (aynı form düzeni,
 * aynı Tailwind sınıf dili). panel.css / tasarim/ dosyalarına dokunulmadı.
 *
 * Link EKRANDA BİR KEZ gösterilir ve hiçbir yere yazılmaz (log yok, DB'de yalnız
 * SHA-256 özeti var). Sayfa yenilenirse link bir daha görünmez — yeni davet üretilir.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { tamAdminMi } from '@/lib/yetki';
import { DAVET_EDILEBILIR_ROLLER } from '@/lib/davet-servis';
import { DAVET_OMRU_SAAT } from '@/lib/davet';
import { DavetOlusturForm } from './Form';

export const dynamic = 'force-dynamic';

export default async function DavetYonetimPage() {
  const session = await auth();
  // İKİNCİ KAPI — middleware atlansa bile sss_editor buraya giremez.
  if (!tamAdminMi(session?.user?.role)) redirect('/admin/urun-sss');

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold leading-relaxed mb-1">Davet linki oluştur</h1>
      <p className="text-sm text-neutral-600 leading-relaxed mb-6">
        Parola gönderilmez. Karşı taraf linke tıklayıp kendi parolasını belirler.
        Link {DAVET_OMRU_SAAT} saat geçerlidir ve bir kez kullanılır.
      </p>
      <DavetOlusturForm roller={[...DAVET_EDILEBILIR_ROLLER]} />
    </div>
  );
}
