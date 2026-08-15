/**
 * KargoLab zimmet (custody) özeti.
 *
 * Kaynak uç: POST /shipment-custody-summary  (üye tarafı)
 * Panelin tek veri kaynağı — tek çağrıda tüm sayaçlar gelir.
 *
 * Amaç: "bugün çıkmayan sipariş var mı?" sorusunu tek bakışta yanıtlamak.
 */
import { authFetch, KargoLabError } from './internal';

/* ------------------------------------------------------------------ tipler */

export interface CustodyBuckets {
  not_moved: number;
  handed_over: number;
  in_transit: number;
  delivered: number;
  problem: number;
  returned: number;
  cancelled: number;
  other: number;
}

export interface CustodyCarrier {
  courrier_id: number;
  courrier_name: string;
  display_name: string;
  carrier_family: string;
  count: number;
}

export interface CustodyStatusRow {
  status: number;
  status_text: string;
  bucket: keyof CustodyBuckets;
  count: number;
}

export interface CustodySummary {
  server_time: string;
  range: { date_start: string; date_end: string; is_today: boolean };
  taken: { count: number; last_taken_at: string | null };
  pending: { count: number };
  operation: {
    operation_code: string;
    area_id: number;
    area_name: string;
    scanned_count: number;
    remaining_new_count: number;
    target_count: number;
    started_at: string;
    last_scan_at: string;
  } | null;
  carrier_status: CustodyStatusRow[];
  buckets: CustodyBuckets;
  carriers: CustodyCarrier[];
  stale: { count: number; threshold_hours: number };
}

interface SummaryEnvelope {
  status: number;
  message?: string;
  data?: CustodySummary;
}

export interface CustodySummaryParams {
  /** YYYY-MM-DD — boş bırakılırsa KargoLab bugünü kullanır */
  dateStart?: string;
  dateEnd?: string;
  areaId?: number;
}

/* ------------------------------------------------------------------- çağrı */

export async function fetchCustodySummary(
  params: CustodySummaryParams = {},
): Promise<CustodySummary> {
  const body: Record<string, unknown> = {
    date_start: params.dateStart ?? '',
    date_end: params.dateEnd ?? '',
  };
  if (params.areaId) body.area_id = params.areaId;

  const res = await authFetch<SummaryEnvelope>('/shipment-custody-summary', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  // KargoLab HTTP 200 döner; gerçek durum gövdedeki `status` alanındadır.
  if (res.status !== 200 || !res.data) {
    throw new KargoLabError(res.status ?? 500, res, res.message ?? 'Zimmet özeti alınamadı');
  }

  return res.data;
}

/* --------------------------------------------------- türetilmiş göstergeler */

export type CustodyLevel = 'ok' | 'warning' | 'danger' | 'idle';

export interface CustodyState {
  level: CustodyLevel;
  title: string;
  description: string;
  /** Ekranın ana rakamı: henüz yola çıkmamış sipariş sayısı */
  notDispatched: number;
  /** Bugünkü toplam iş = zimmete alınan + zimmet bekleyen */
  total: number;
  taken: number;
  /** Zimmete alınmış ve taşıyıcı hareketi başlamış */
  dispatched: number;
  /** Zimmete alınmış ama taşıyıcıda hâlâ hareket yok */
  waitingAtBranch: number;
  pending: number;
  takenPct: number;
}

/**
 * Sayaçlardan tek cümlelik durum çıkarır.
 *
 * Kural:
 *  - hiç iş yoksa           → idle  (sipariş yok; bunu "kırmızı" saymak yanıltıcı olur)
 *  - çıkmayan sipariş 0     → ok
 *  - hiçbiri zimmete alınmamış → danger
 *  - aradaki her durum      → warning
 */
export function deriveCustodyState(s: CustodySummary): CustodyState {
  const taken = s.taken.count;
  const pending = s.pending.count;
  const total = taken + pending;

  const waitingAtBranch = s.buckets.not_moved;
  const dispatched = taken - waitingAtBranch;
  const notDispatched = pending + waitingAtBranch;
  const takenPct = total > 0 ? Math.round((taken / total) * 100) : 0;

  const base = { notDispatched, total, taken, dispatched, waitingAtBranch, pending, takenPct };

  if (total === 0) {
    return {
      ...base,
      level: 'idle',
      title: 'Bugün sipariş yok',
      description: 'Zimmete alınacak veya bekleyen sipariş bulunmuyor.',
    };
  }

  if (notDispatched === 0) {
    return {
      ...base,
      level: 'ok',
      title: 'Tüm siparişler çıktı',
      description: `${taken} siparişin tamamı zimmete alındı ve taşıyıcıya teslim edildi. Bekleyen iş yok.`,
    };
  }

  if (taken === 0) {
    return {
      ...base,
      level: 'danger',
      title: 'Hiçbir sipariş çıkmadı',
      description: `${pending} sipariş zimmete alınmayı bekliyor. Henüz hiçbiri işleme alınmamış.`,
    };
  }

  return {
    ...base,
    level: 'warning',
    title: 'Çıkmayı bekleyen sipariş var',
    description:
      `${pending} sipariş henüz zimmete alınmadı` +
      (waitingAtBranch > 0
        ? `, ${waitingAtBranch} sipariş zimmette ama taşıyıcı hareketi başlamadı.`
        : '.'),
  };
}
