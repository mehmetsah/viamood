import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { auth } from '@/lib/auth';
import { upsertCustomerByEmail } from './service';

/**
 * Oturumdaki müşterinin (role=customer) RDS customers satırını getirir.
 * userId ile bulamazsa email ile bağlar (savunmacı). Müşteri değilse / oturum yoksa null.
 */
export async function getSessionCustomer(): Promise<typeof customers.$inferSelect | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || session?.user?.role !== 'customer') return null;

  let [c] = await db.select().from(customers).where(eq(customers.userId, userId)).limit(1);
  if (!c && session.user.email) {
    const id = await upsertCustomerByEmail({
      email: session.user.email,
      userId,
      name: session.user.name ?? null,
    });
    if (id) [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  }
  return c ?? null;
}
