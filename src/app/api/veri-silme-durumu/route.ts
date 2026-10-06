/**
 * Veri silme talebi DURUM SORGULAMA ucu (#990686 madde 4).
 *
 * ANAYASA (Mehmet, 2 Eki 2026): kalıcı kayıt = DB + API. Talep kaydı zaten
 * `veri_silme_talepleri` tablosunda (dosyada değil); bu uç onun OKUMA ayağıdır.
 * `/veri-silme-durumu` sayfası sunucu bileşeni olarak aynı veriyi okuyor —
 * bu uç onun yerine geçmez, YANINA gelir: Meta incelemesi, Yunus ve destek
 * tarafı durumu tarayıcı açmadan (ve ekran tasarımına dokunmadan) sorgulayabilsin.
 *
 * ⚠ SIZINTI KURALI — bu uç KİMLİK DOĞRULAMASI İSTEMEZ (Meta'ya verilen durum
 * URL'i herkese açıktır), bu yüzden kod bilen biri YALNIZ kendi talebinin
 * durumunu görebilmeli ve ötesini görmemeli. Dolayısıyla:
 *   · `kod` ile TAM eşleşme aranır; liste/arama/sayfalama YOKTUR.
 *   · dönen gövdede `provider_user_id`, bizdeki `user_id` ve `detay` YOKTUR —
 *     `detay` operatör notudur ("Facebook bağlantısı bulundu" gibi) ve dışarıya
 *     "bu kişi bizde var mı" bilgisini sızdırır.
 *   · kod yoksa 404 + TEK VE AYNI cümle: "var ama göremezsin" ile "hiç yok"
 *     ayırt edilemesin (desen: src/lib/davet.ts).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { veriSilmeTalepleri } from '@/db/schema/veri-silme';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Dışarıya dönen tek ve aynı cümle — "yok" ile "göremezsin" ayrışmaz. */
const BULUNAMADI = 'Bu koda ait bir silme talebi bulunamadı.';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const kod = (req.nextUrl.searchParams.get('kod') ?? '').trim();
  // Boş kod TÜM tabloyu seçmesin: eq('') bile olsa listeye dönüşmemeli.
  if (!kod) {
    return NextResponse.json({ ok: false, error: 'kod parametresi gerekli' }, { status: 400 });
  }

  const [talep] = await db
    .select({
      kod: veriSilmeTalepleri.kod,
      provider: veriSilmeTalepleri.provider,
      durum: veriSilmeTalepleri.durum,
      createdAt: veriSilmeTalepleri.createdAt,
      completedAt: veriSilmeTalepleri.completedAt,
    })
    .from(veriSilmeTalepleri)
    .where(eq(veriSilmeTalepleri.kod, kod))
    .limit(1);

  if (!talep) {
    return NextResponse.json({ ok: false, error: BULUNAMADI }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    kod: talep.kod,
    provider: talep.provider,
    durum: talep.durum,
    // Silme yapılmadıysa null kalır — "tamamlandı" izlenimi vermez.
    olusturuldu: talep.createdAt,
    tamamlandi: talep.completedAt,
  });
}
