import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { sosyalAyarlariOku } from '@/lib/actions/social-auth';
import { SosyalGirisForm } from './Form';

export const dynamic = 'force-dynamic';

/**
 * Sosyal giriş ayarları — YALNIZ ADMİN.
 * Yetki hem burada (sayfa) hem server action'da doğrulanır; sayfa kontrolü
 * kullanıcı deneyimi için, asıl kapı action'daki `adminSart()`.
 */
export default async function SosyalGirisAyarPage() {
  const session = await auth();
  const rol = session?.user?.role;
  if (rol !== 'admin' && rol !== 'super_admin') redirect('/admin');

  const ayar = await sosyalAyarlariOku();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Sosyal Giriş</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Google ile giriş kimlikleri. Buraya girilen değerler veritabanında tutulur —
        sunucuya SSH gerekmez, kaydettikten sonra <strong>yeniden deploy gerekmez</strong>.
      </p>

      {ayar.env_ile_geliyor && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Sunucuda <code>AUTH_GOOGLE_ID/SECRET</code> tanımlı. <strong>Env önceliklidir</strong> —
          aşağıdaki değerler kullanılmaz.
        </p>
      )}

      <SosyalGirisForm ayar={ayar} />

      <div className="mt-8 text-sm text-neutral-600 border-t pt-4">
        <p className="font-semibold mb-1">Facebook</p>
        <p>Kimlik bilgisi gelmedi — giriş ekranında gösterilmiyor. Apple sonraya bırakıldı.</p>
      </div>
    </div>
  );
}
