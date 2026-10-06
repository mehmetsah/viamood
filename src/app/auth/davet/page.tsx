import Link from 'next/link';
import { davetKontrolAction } from '@/lib/actions/davet';
import { DAVET_GECERSIZ_METNI, DAVET_OMRU_SAAT } from '@/lib/davet';
import { Logo } from '@/components/ui/Logo';
import { DavetForm } from './Form';

export const dynamic = 'force-dynamic';

/**
 * DAVET (ilk giriş) sayfası — #992317.
 *
 * ÖLÇÜLEN KUSUR: davet altyapısı (şema + servis + action) vardı ama BU YÜZEY yoktu;
 * yani üretilen link tıklanınca 404 dönüyordu. "Mekanizma var, besleyen halka yok"
 * arıza ailesinin bir üyesiydi.
 *
 * Token GÖSTERMEDEN ÖNCE sunucuda doğrulanır — geçersizse form hiç render EDİLMEZ.
 * Token burada TÜKETİLMEZ; tüketim yalnız parola yazılırken olur.
 *
 * ⚠ KARDEŞ SAYFADAN (auth/sifre-sifirla) BİLİNÇLİ FARK: orada "süresi doldu" /
 * "kullanılmış" / "geçersiz" ayrı ayrı yazılır. BURADA YAZILMAZ — davet linki
 * henüz var olmayan bir hesabı açıyor; hangi sebebin gerçekleştiğini söylemek,
 * elinde token olan birine "bu token VARDI" bilgisini sızdırır. Sebep ne olursa
 * olsun TEK ve AYNI cümle döner (`DAVET_GECERSIZ_METNI`, action'da tanımlı).
 */
export default async function DavetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const kontrol = await davetKontrolAction(token ?? '');
  const gecerli = kontrol.success === true && !!kontrol.data;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--color-brand-cream)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4"><Logo width={140} /></Link>
          <h1 className="text-2xl font-bold">Parolanı belirle</h1>
          {gecerli && <p className="text-sm text-neutral-600 mt-1">{kontrol.data!.email}</p>}
        </div>

        {gecerli ? (
          <DavetForm token={token ?? ''} />
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                   className="text-amber-600" aria-hidden="true">
                <path d="M12 8.5v4.5" /><path d="M12 16.2h.01" />
                <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">
              {DAVET_GECERSIZ_METNI} Davet bağlantısı {DAVET_OMRU_SAAT} saat geçerlidir ve bir kez kullanılır.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
