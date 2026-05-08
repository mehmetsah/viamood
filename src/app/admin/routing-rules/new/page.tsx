import Link from 'next/link';
import { createRoutingRuleAction } from '@/lib/actions/routing';
import { RoutingRuleForm } from '../RoutingRuleForm';

export default function NewRoutingRulePage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/routing-rules" className="text-sm text-neutral-600 hover:underline">
        ← Routing Kuralları
      </Link>
      <h1 className="text-3xl font-bold mt-2 mb-8">Yeni Kural</h1>
      <RoutingRuleForm action={createRoutingRuleAction} submitLabel="Kuralı oluştur" />
    </div>
  );
}
