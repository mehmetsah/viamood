import { redirect } from 'next/navigation';
import { and, count, eq, isNull, or, sql } from 'drizzle-orm';
import './hesabim.css';
import { db } from '@/db/client';
import { customerAddresses, orders, returns } from '@/db/schema';
import { auth } from '@/lib/auth';
import { getSessionCustomer } from '@/lib/customers/session';
import { AccountHeader } from './_components/AccountHeader';
import { basHarfler } from './_lib/format';

export const dynamic = 'force-dynamic';

// İlk boyamadan önce kayıtlı temayı uygula (yanıp sönmeyi engeller). Sistem teması CSS'te varsayılan.
const TEMA_SCRIPT = `(function(){try{var t=localStorage.getItem('vm_tema');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default async function HesabimLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user) redirect('/auth/sign-in?callbackUrl=/hesabim');
  // Müşteri + admin (admin müşteri deneyimini test edebilsin) izinli; vendor kendi paneline.
  if (role !== 'customer' && role !== 'admin' && role !== 'super_admin') redirect('/post-login');

  const customer = await getSessionCustomer();

  let siparis = 0;
  let iade = 0;
  let adres = 0;
  if (customer) {
    const emailCond = or(
      eq(sql`lower(${orders.customerEmail})`, customer.email.toLowerCase()),
      customer.shopifyCustomerId ? eq(orders.customerId, customer.shopifyCustomerId) : sql`false`,
    );
    const [[o], [a]] = await Promise.all([
      db.select({ n: count() }).from(orders).where(and(emailCond, isNull(orders.cancelledAt))),
      db
        .select({ n: count() })
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, customer.id)),
    ]);
    siparis = o?.n ?? 0;
    adres = a?.n ?? 0;
    // returns tablosu migration inince dolacak — yoksa 0 (deploy geçiş güvenliği)
    try {
      const [r] = await db
        .select({ n: count() })
        .from(returns)
        .where(eq(returns.customerId, customer.id));
      iade = r?.n ?? 0;
    } catch {
      iade = 0;
    }
  }

  const name = customer?.name || session.user.name || session.user.email || 'Hesabım';
  const memberSince = customer?.createdAt
    ? new Date(customer.createdAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    : undefined;

  return (
    <div className="vh-portal">
      <script dangerouslySetInnerHTML={{ __html: TEMA_SCRIPT }} />
      <AccountHeader
        initials={basHarfler(name)}
        name={name}
        memberSince={memberSince}
        counts={{ siparis, iade, adres }}
      />
      <main className="vh-sayfa">{children}</main>
    </div>
  );
}
