'use server';

/**
 * DAVET LİNKİ — UÇ (server action) · #992317
 *
 * `src/lib/actions/auth.ts`'teki `resetPasswordAction` deseninin kardeşidir.
 *
 * ⚠ DOĞRULAMA TAMAMEN SUNUCUDA. İstemci yalnız token metnini taşır; geçerlilik,
 *   süre, tek kullanım ve ROL kararı bu katmanın ARKASINDA (davet-servis.ts →
 *   davet.ts) verilir. İstemciden gelen `role`/`email` alanları OKUNMAZ bile —
 *   okunursa davet linki bir rol yükseltme aracına dönerdi.
 *
 * ⚠ HATA METNİ TEK. Süresi geçmiş · kullanılmış · hiç olmamış token için AYNI
 *   cümle döner; ayrı cümleler token uzayını taramayı kolaylaştırır (davet.ts'teki
 *   tek-hüküm kararının UÇTAKİ karşılığı — burada gevşetilirse orada kapatılmış
 *   sızıntı bu satırdan geri açılır).
 */
import type { ActionResult } from '@/lib/actions/auth';
import { DAVET_GECERSIZ_METNI } from '@/lib/davet';
import { validatePassword } from '@/lib/password';


/**
 * Parola formunu göstermeden önce token'ı doğrular — TÜKETMEZ.
 * Dönen veride yalnız `email` var: rol istemciye SÖYLENMEZ (gerek yok, ve
 * söylenirse istemci onu geri gönderip güvendiğimizi sanabilir).
 */
export async function davetKontrolAction(token: string): Promise<ActionResult<{ email: string }>> {
  const { davetKontrol } = await import('@/lib/davet-servis');
  const kontrol = await davetKontrol(String(token ?? ''));
  if (!kontrol.gecerli) return { success: false, error: DAVET_GECERSIZ_METNI };
  return { success: true, data: { email: kontrol.email } };
}

/** Token'ı tüketip davet edilen kişinin KENDİ parolasını yazar. */
export async function davetParolaBelirleAction(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const { davetTuket } = await import('@/lib/davet-servis');

  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '');

  if (!token) return { success: false, error: DAVET_GECERSIZ_METNI };

  if (password !== passwordConfirm) {
    return {
      success: false,
      error: 'Şifreler eşleşmiyor',
      fieldErrors: { passwordConfirm: 'Şifreler eşleşmiyor' },
    };
  }

  // Parola politikası mevcut tek kaynaktan gelir — davet akışı için ikinci bir
  // politika yazılmaz (yazılsa biri gevşer ve zayıf halka o olur).
  const policy = validatePassword(password);
  if (!policy.ok) return { success: false, error: policy.reason, fieldErrors: { password: policy.reason } };

  const res = await davetTuket({ token, newPassword: password });
  if (!res.ok) return { success: false, error: DAVET_GECERSIZ_METNI };
  return { success: true, data: { email: res.email } };
}
