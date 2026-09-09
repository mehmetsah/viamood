import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { createHandoffUrl, type HandoffTarget } from '@/lib/kargolab/statement';

/**
 * KargoLab'e tek tıkla geçiş.
 *
 * Kullanıcı panelde "detayı KargoLab'de aç" dediğinde buraya gelir; jeton
 * BURADA (sunucu tarafında) üretilir ve kullanıcı KargoLab'e yönlendirilir.
 *
 * Neden ara rota: jetonu sayfa render'ında üretip linke gömmek, jetonun
 * kullanılmasa bile HTML kaynağında durması demekti. Burada jeton yalnız
 * tıklandığı anda üretilir, tek kullanımlıktır ve 5 dakikada söner.
 */

const ALLOWED: HandoffTarget[] = ['statements', 'shipments', 'custody', 'dashboard', 'profile'];

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('target') ?? 'statements';
  const target = (ALLOWED as string[]).includes(raw) ? (raw as HandoffTarget) : 'statements';

  let url: string;
  try {
    url = await createHandoffUrl(target);
  } catch {
    // KargoLab erişilemezse kullanıcıyı panelde tut, hata mesajıyla dön.
    redirect('/admin?kargolab=gecis-basarisiz');
  }

  redirect(url);
}
