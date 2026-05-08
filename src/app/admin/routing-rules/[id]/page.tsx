import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { routingRules } from '@/db/schema';
import { updateRoutingRuleAction } from '@/lib/actions/routing';
import { RoutingRuleForm } from '../RoutingRuleForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRoutingRulePage({ params }: PageProps) {
  const { id } = await params;
  const [rule] = await db.select().from(routingRules).where(eq(routingRules.id, id)).limit(1);
  if (!rule) notFound();

  const defaults = {
    ruleId: rule.id,
    name: rule.name,
    description: rule.description ?? '',
    priority: String(rule.priority),
    action: rule.action,
    conditions: JSON.stringify(rule.conditions, null, 2),
    enabled: rule.enabled,
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/routing-rules" className="text-sm text-neutral-600 hover:underline">
        ← Routing Kuralları
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-8">Kuralı Düzenle</h1>
      <RoutingRuleForm action={updateRoutingRuleAction} defaults={defaults} submitLabel="Değişiklikleri kaydet" />
    </div>
  );
}
