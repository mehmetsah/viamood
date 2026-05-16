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

/**
 * Yeni cari (müşteri) kaydı.
 * Yunus'a göre: aynı email/telefon ile boş cari de açabiliriz — dedupe yapmıyoruz.
 */
export async function cariKayit(dto: MikroCariDto): Promise<MikroOpResult> {
  try {
    const data = await mikroFetch('/MikroV17/CariKayit', {
      method: 'POST',
      body: dto,
    });
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return {
      ok: false,
      error: msg,
      raw: err && typeof err === 'object' && 'body' in err ? (err as { body: unknown }).body : null,
    };
  }
}

/** Sipariş ve satırlarını ekle. */
export async function siparisEkle(evrak: MikroEvrak): Promise<MikroOpResult> {
  try {
    const data = await mikroFetch('/MikroV17/SiparisEkle', {
      method: 'POST',
      body: evrak,
    });
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return {
      ok: false,
      error: msg,
      raw: err && typeof err === 'object' && 'body' in err ? (err as { body: unknown }).body : null,
    };
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
    const msg = err instanceof Error ? err.message : 'unknown';
    return {
      ok: false,
      error: msg,
      raw: err && typeof err === 'object' && 'body' in err ? (err as { body: unknown }).body : null,
    };
  }
}
