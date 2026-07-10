'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { customers } from '@/db/schema';
import { getSessionCustomer } from '@/lib/customers/session';

export interface NotifPrefs {
  campaign?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
}

/** Portal Profil — bildirim tercihlerini kaydeder (customers.preferences). */
export async function saveNotifPrefs(prefs: NotifPrefs): Promise<{ ok: boolean }> {
  const customer = await getSessionCustomer();
  if (!customer) return { ok: false };
  await db
    .update(customers)
    .set({
      preferences: {
        campaign: !!prefs.campaign,
        sms: !!prefs.sms,
        whatsapp: !!prefs.whatsapp,
      },
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customer.id));
  return { ok: true };
}
