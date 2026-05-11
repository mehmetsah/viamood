'use client';

import { useActionState } from 'react';
import { registerWebhooksAction } from '@/lib/actions/admin';

interface Props {
  defaultUrl: string;
}

export function WebhooksRegisterClient({ defaultUrl }: Props) {
  const [state, action, pending] = useActionState(registerWebhooksAction, null);

  return (
    <div className="space-y-3">
      <form action={action} className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold mb-1 text-neutral-700">
            App URL (boş = .env'deki)
          </label>
          <input
            name="appUrl"
            type="url"
            placeholder={defaultUrl}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-black text-white rounded-lg font-semibold text-sm disabled:opacity-50"
        >
          {pending ? 'Kaydediyor...' : '🔔 Webhook\'ları kaydet'}
        </button>
      </form>

      {state && (
        <div
          className={`text-sm rounded-lg px-3 py-2 ${
            state.success
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {state.success ? '✓' : '⚠'} {state.message}
          {state.details && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-neutral-600">Detay</summary>
              <pre className="mt-2 bg-white border rounded p-2 overflow-auto">
                {JSON.stringify(state.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
