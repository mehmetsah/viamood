/**
 * Mikro V17 operations — CariKayit, SiparisEkle, SiparisOnayla.
 * Yunus'tan gelen örnek payload'lara ve Swagger schema'sına göre.
 */
import { mikroFetch } from './client';
import type {
  MikroCariDto,
  MikroEvrak,
  MikroSiparisOnayDto,
} from './types';

interface MikroOpOk<T = unknown> {
  ok: true;
  data: T;
}
interface MikroOpErr {
  ok: false;
  error: string;
  raw?: unknown;
}
export type MikroOpResult<T = unknown> = MikroOpOk<T> | MikroOpErr;

/** Mikro genelde {"IsSuccess":false,"ErrorMessage":"..."} formatında error döner. */
function extractMikroError(err: unknown): { msg: string; raw: unknown } {
  const baseMsg = err instanceof Error ? err.message : 'unknown';
  const body =
    err && typeof err === 'object' && 'body' in err ? (err as { body: unknown }).body : null;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const detail =
      (b.ErrorMessage as string | undefined) ||
      (b.errorMessage as string | undefined) ||
      (b.Message as string | undefined) ||
      (b.message as string | undefined);
    if (detail) return { msg: `${baseMsg} — ${detail}`, raw: body };
  }
  return { msg: baseMsg, raw: body };
}

/**
 * Yeni cari (müşteri) kaydı.
 * Yunus'a göre: aynı email/telefon ile boş cari de açabiliriz — dedupe yapmıyoruz.
 */
export async function cariKayit(dto: MikroCariDto, baseUrl?: string): Promise<MikroOpResult> {
  try {
    const data = await mikroFetch('/MikroV17/CariKayit', {
      method: 'POST',
      body: dto,
    }, baseUrl);
    return { ok: true, data };
  } catch (err) {
    const { msg, raw } = extractMikroError(err);
    return { ok: false, error: msg, raw };
  }
}

/** Sipariş ve satırlarını ekle. baseUrl ile ARADEPO (default) / ANA FİRMA DB seçilir. */
export async function siparisEkle(evrak: MikroEvrak, baseUrl?: string): Promise<MikroOpResult> {
  try {
    const data = await mikroFetch('/MikroV17/SiparisEkle', {
      method: 'POST',
      body: evrak,
    }, baseUrl);
    return { ok: true, data };
  } catch (err) {
    const { msg, raw } = extractMikroError(err);
    return { ok: false, error: msg, raw };
  }
}

/** Siparişi onayla → fatura kesimi aşamasına hazır. */
export async function siparisOnayla(dto: MikroSiparisOnayDto): Promise<MikroOpResult> {
  try {
    const data = await mikroFetch('/MikroV17/SiparisOnayla', {
      method: 'POST',
      body: dto,
    });
    return { ok: true, data };
  } catch (err) {
    const { msg, raw } = extractMikroError(err);
    return { ok: false, error: msg, raw };
  }
}
