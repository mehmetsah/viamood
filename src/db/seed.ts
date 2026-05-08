/**
 * Dev seed — admin kullanıcısı oluşturur.
 * Run: npm run db:seed
 */
import { eq } from 'drizzle-orm';
import { db } from './client';
import { users } from './schema';
import { hashPassword } from '../lib/password';

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@viamood.local';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin1234';

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (existing.length > 0 && existing[0]) {
    // Promote to admin if exists
    await db.update(users).set({ role: 'super_admin' }).where(eq(users.id, existing[0].id));
    console.log(`✓ Existing user promoted to super_admin: ${email}`);
  } else {
    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        name: 'Via Mood Admin',
        email,
        passwordHash,
        role: 'super_admin',
      })
      .returning({ id: users.id, email: users.email });

    console.log(`✓ Admin user created: ${created?.email}`);
    console.log(`  Password: ${password}`);
  }

  console.log('\n📝 Sign in at: http://localhost:3000/auth/sign-in');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
