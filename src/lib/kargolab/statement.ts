/**
 * KargoLab cari özeti + panel devri (handoff).
 *
 * Uçlar:
 *   POST /statement-summary      → bakiye, dönem hareketi, bekleyen COD, son hareketler
 *   POST /panel-handoff-token    → tek kullanımlık, 5 dk ömürlü geçiş jetonu
 *
 * Karma model (C7/D2): özet burada, detay KargoLab'de. Kullanıcı "detay" dediğinde
 * ikinci kez giriş yapmaz — handoff jetonu oturumu karşı tarafta açar.
 */
import { authFetch, KargoLabError } from './internal';

/* ------------------------------------------------------------------ tipler */

export type BalanceStatus = 'debtor' | 'creditor' | 'settled';

export interface StatementSummary {
  balance: {
    amount: number;
    currency: string;
    status: BalanceStatus;
    label: string;
  };
  period: {
    date_start: string;
    date_end: string;
    /** giriş (alacak) toplamı — daima pozitif */
    in: number;
    /** çıkış (borç) toplamı — daima POZİTİF gelir */
    out: number;
    /** bakiye değişimi = in - out */
    net: number;
    count: number;
  };
  cod_pending: {
    /** tahmini net hakediş; komisyon oranı yoksa brüt ile aynı olabilir */
    net_amount: number;
    gross_amount: number;
    count: number;
    estimate_scope: string;
  };
  recent: Array<{
    id: number;
    date: string;
    direction: 'in' | 'out';
    category: string;
    /** daima POZİTİF — yön `direction` alanındadır */
    amount: number;
    balance: number;
    description: string;
  }>;
}

interface SummaryEnvelope {
  status: number;
  message?: string;
  data?: StatementSummary;
}

export interface StatementSummaryParams {
  dateStart?: string;
  dateEnd?: string;
  recentLimit?: number;
}

/* ------------------------------------------------------------------- çağrı */

export async function fetchStatementSummary(
  params: StatementSummaryParams = {},
): Promise<StatementSummary> {
  const body: Record<string, unknown> = {};
  if (params.dateStart) body.date_start = params.dateStart;
  if (params.dateEnd) body.date_end = params.dateEnd;
  body.recent_limit = params.recentLimit ?? 5;

  const res = await authFetch<SummaryEnvelope>('/statement-summary', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  // KargoLab HTTP 200 döner; gerçek durum gövdedeki `status` alanındadır.
  if (res.status !== 200 || !res.data) {
    throw new KargoLabError(res.status ?? 500, res, res.message ?? 'Cari özeti alınamadı');
  }
  return res.data;
}

/* ------------------------------------------------------- panel devri (C8) */

/** KargoLab panelinde açılabilecek ekranlar (uç beyaz listesiyle aynı). */
export type HandoffTarget = 'statements' | 'shipments' | 'custody' | 'dashboard' | 'profile';

interface HandoffEnvelope {
  status: number;
  message?: string;
  data?: { token: string; url: string; target: string; expires_in: number };
}

/**
 * Tek kullanımlık geçiş bağlantısı üretir.
 *
 * ⚠️ SUNUCU TARAFINDA çağrılmalı — jeton tarayıcıya önceden sızmamalı.
 *    Kullanıcı "detay" dediği anda üretilip yönlendirme yapılır; jeton 5 dk
 *    ömürlüdür ve ilk kullanımda yanar.
 */
export async function createHandoffUrl(target: HandoffTarget = 'statements'): Promise<string> {
  const res = await authFetch<HandoffEnvelope>('/panel-handoff-token', {
    method: 'POST',
    body: JSON.stringify({ target }),
  });

  if (res.status !== 200 || !res.data?.url) {
    throw new KargoLabError(res.status ?? 500, res, res.message ?? 'Geçiş bağlantısı alınamadı');
  }
  return res.data.url;
}

/* ---------------------------------------------------------------- yardımcı */

export function formatTRY(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);
}
