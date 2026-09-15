import { getEnabledSocialProviders } from '@/lib/auth/social';
import { SignInClient } from './SignInClient';

export const dynamic = 'force-dynamic';

/**
 * Giriş sayfası — sunucu sarmalayıcı.
 *
 * Sosyal düğmeler YALNIZ sağlayıcı yapılandırılmışsa gösterilir. Kimlikler
 * DB'den okunduğu için (env yoksa) bu kontrol istek anında yapılır; panelden
 * kimlik girilince düğme redeploy olmadan görünür.
 *
 * Facebook için yer ayrıldı ama kimlik gelene dek GÖSTERİLMEZ.
 */
export default async function SignInPage() {
  const sosyal = await getEnabledSocialProviders();
  return <SignInClient sosyal={{ google: sosyal.google }} />;
}
