import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * Giriş sonrası role'e göre yönlendirme. Sign-in callbackUrl'i (özel hedef yoksa) buraya gelir.
 * Middleware bu path'i authenticated ister (PUBLIC değil).
 */
export default async function PostLoginPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === 'admin' || role === 'super_admin') redirect('/admin');
  if (role === 'vendor' || role === 'vendor_admin') redirect('/dashboard');
  if (role === 'customer') redirect('/hesabim');

  // Oturum yok / bilinmeyen rol
  redirect('/auth/sign-in');
}
