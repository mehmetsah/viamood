import type { EmailParams } from '@/lib/email/sender';

/**
 * Worker girdi sözleşmeleri. Kuyruktaki job'un varlığı yetkilendirme/başarı
 * kanıtı DEĞİLDİR: parametreler geçersizse iş başarısız sayılır ve loglanır.
 */
export function siparisIdDogrula(job: unknown): string {
  const id = (job && typeof job === 'object' ? (job as Record<string, unknown>).orderId : null);
  if (typeof id !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id)) {
    throw new Error('order-routing: geçerli orderId (UUID) gerekli');
  }
  return id;
}

export function epostaIsiDogrula(job: unknown): EmailParams {
  if (!job || typeof job !== 'object') throw new Error('email-notify: iş verisi yok');
  const p = job as Record<string, unknown>;
  if (typeof p.to !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.to)) {
    throw new Error('email-notify: tek geçerli alıcı gerekli');
  }
  if (typeof p.subject !== 'string' || !p.subject.trim() || p.subject.length > 400) {
    throw new Error('email-notify: konu geçersiz');
  }
  if (typeof p.html !== 'string' || !p.html.trim() || p.html.length > 250_000) {
    throw new Error('email-notify: HTML içerik geçersiz');
  }
  if (p.tip !== 'islemsel' && p.tip !== 'pazarlama' && p.tip !== 'duyuru') {
    throw new Error('email-notify: mail tipi açıkça tanımlanmalı');
  }
  if (p.tip !== 'islemsel' && p.iysOnayi !== true) {
    throw new Error('email-notify: ticari ileti için doğrulanmış açık izin zorunlu');
  }
  return { to: p.to, subject: p.subject, html: p.html, tip: p.tip,
    text: typeof p.text === 'string' ? p.text : undefined,
    sablon: typeof p.sablon === 'string' ? p.sablon : 'queue' };
}

export function desteklenmeyenIs(adi: string): never {
  throw new Error(adi + ': gerçek işlemci uygulanmadı; sahte başarı dönülmez');
}
