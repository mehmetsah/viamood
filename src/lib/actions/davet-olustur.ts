'use server';

/**
 * /admin/davet server action — davet linki ÜRETİR (#992317, halka #4).
 *
 * ÜÇÜNCÜ KAPI. Yetki üç katmanda zorlanır ve bu dosya sonuncusudur:
 *   1) middleware  — `adminYoluAcikMi`: sss_editor /admin/urun-sss dışına çıkamaz
 *   2) admin/layout — ikinci kapı
 *   3) BURASI      — action doğrudan çağrılabilir (form POST'u taklit edilebilir),
 *                    o yüzden oturum burada YENİDEN sorulur. 1 ve 2 atlanabilir
 *                    varsayılır; bu kapı atlanamaz.
 *
 * ⚠ Üretilen ham link LOG'LANMAZ. `console.log(link)` yazmak, linki sunucu
 *   kütüğüne düşürür ve kütüğü okuyan herkes o hesabın parolasını kurabilir.
 */
import { auth } from '@/lib/auth';
import { DAVET_OMRU_SAAT } from '@/lib/davet';
import { sendEmail } from '@/lib/email/sender';
import { daveteEmail } from '@/lib/email/templates';
import { davetKaydiOlustur, DAVET_EDILEBILIR_ROLLER } from '@/lib/davet-servis';
import { tamAdminMi } from '@/lib/yetki';

export type DavetOlusturDurum =
  | { ok: true; link: string; expiresAt: string; mail: 'gonderildi' | 'gonderilmedi' | 'basarisiz'; mailNot?: string }
  | { ok: false; hata: string };

export async function davetOlusturAction(
  _prev: DavetOlusturDurum | null,
  formData: FormData,
): Promise<DavetOlusturDurum> {
  const session = await auth();
  // YALNIZ tam admin. sss_editor kendi davetini ya da başkasınınkini üretemez.
  if (!tamAdminMi(session?.user?.role)) {
    return { ok: false, hata: 'Bu işlem için yetkin yok.' };
  }

  const email = String(formData.get('email') ?? '').trim();
  const role = String(formData.get('role') ?? '');

  // İkinci kapı: istemciden gelen rol beyaz listeye vurulur. `admin` /
  // `super_admin` listede YOK — davetle tam yönetici devredilemez.
  if (!(DAVET_EDILEBILIR_ROLLER as readonly string[]).includes(role)) {
    return { ok: false, hata: 'Bu rol davet linkiyle verilemez.' };
  }

  const sonuc = await davetKaydiOlustur({
    email,
    role,
    invitedBy: session?.user?.id ?? null,
  });

  if (!sonuc.ok) {
    return {
      ok: false,
      hata: sonuc.sebep === 'eposta_gecersiz' ? 'E-posta geçersiz.' : 'Bu rol davet linkiyle verilemez.',
    };
  }
  // ── MAİL GÖNDERİMİ ────────────────────────────────────────────────────────
  // Varsayılan AÇIK ama kapatılabilir: #992334'te ölçüldü ki gönderim hattı
  // (SPF/DMARC hizalaması) bugün şüpheli — mail sessizce junk'a düşebiliyor.
  // O yüzden link HER HÂLDE ekranda gösterilir; mail EK bir yoldur, tek yol değil.
  // Gönderim düşse bile davet kaydı GEÇERLİ kalır — linki elden iletmek mümkün.
  const mailIstendi = String(formData.get('mailGonder') ?? '') === 'on';
  let mail: 'gonderildi' | 'gonderilmedi' | 'basarisiz' = 'gonderilmedi';
  let mailNot: string | undefined;

  if (mailIstendi) {
    const icerik = daveteEmail({ davetUrl: sonuc.link, saat: DAVET_OMRU_SAAT });
    try {
      const r = await sendEmail({
        to: email,
        subject: icerik.subject,
        html: icerik.html,
        text: icerik.text,
        tip: 'islemsel',
        sablon: 'davet',
      });
      mail = r.ok ? 'gonderildi' : 'basarisiz';
      // ⚠ Hata metni gösterilir ama LİNK asla log'a/hataya konmaz.
      if (!r.ok) mailNot = r.error;
    } catch (e) {
      mail = 'basarisiz';
      mailNot = e instanceof Error ? e.message : 'bilinmeyen hata';
    }
  }

  return { ok: true, link: sonuc.link, expiresAt: sonuc.expiresAt.toISOString(), mail, mailNot };
}
