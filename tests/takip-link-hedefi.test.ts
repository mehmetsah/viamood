/**
 * #991987 — Sipariş takip linki GÜNCEL hesap ekranına gitmeli (Yunus, 28 Eyl 12:24).
 *
 * Ölçülen kusur: `trackingPageUrl` müşteriyi `${STOREFRONT_URL}/pages/siparis-takip`
 * adresine gönderiyordu. `/pages/…` Shopify'ın SAYFA yoludur ⇒ mailde verdiğimiz
 * takip linki ESKİ Shopify temasına düşüyordu.
 *
 * İki ayak, her birinin NEGATİF bacağı var:
 *   1. hedef doğru mu — eski URL geri konunca KIRMIZI,
 *   2. sipariş referansı taşınıyor mu — parametre düşünce KIRMIZI.
 *
 * env MOCK'lanır (mevcut desen: tests/davet-ucu.test.ts): APP_URL ile STOREFRONT_URL
 * BİLEREK ayrı alanlar — böylece "vitrine gitmiyor" iddiası gerçekten ölçülür.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { APP_URL: 'https://hesap.ornek.test', STOREFRONT_URL: 'https://vitrin.ornek.test' },
}));

const { trackingPageUrl } = await import('@/lib/brand');

const REF = 'VM1234';
const MAIL = 'musteri@ornek.com';

describe('trackingPageUrl — hedef güncel hesap ekranı', () => {
  it('APP_URL tabanlı /hesabim adresine gider', () => {
    const u = new URL(trackingPageUrl(REF, MAIL));
    expect(u.origin).toBe('https://hesap.ornek.test');
    expect(u.pathname).toBe('/hesabim');
  });

  it('NEGATİF: ESKİ Shopify sayfa yolu /pages/siparis-takip ARTIK ÜRETİLMEZ', () => {
    const url = trackingPageUrl(REF, MAIL);
    expect(url, 'eski Shopify temalı sayfa — Yunus’un şikâyeti tam buydu').not.toContain('/pages/');
    expect(url).not.toContain('siparis-takip');
  });

  it('NEGATİF: VİTRİN alanına gitmez — hesap ekranı ayrı alanda', () => {
    expect(trackingPageUrl(REF, MAIL)).not.toContain('vitrin.ornek.test');
  });
});

describe('Parametre taşıma — sipariş referansı KAYBOLMAZ', () => {
  it('sipariş referansı `siparis` parametresiyle taşınır', () => {
    expect(new URL(trackingPageUrl(REF, MAIL)).searchParams.get('siparis')).toBe(REF);
  });

  it('kaçış yapılır — # ve boşluk taşıyan referans bozulmaz', () => {
    expect(new URL(trackingPageUrl('#VM 99/1', MAIL)).searchParams.get('siparis')).toBe('#VM 99/1');
  });

  it('NEGATİF: e-posta URL’e YAZILMAZ — kimliği oturum belirler, mail iletilirse sızar', () => {
    const url = trackingPageUrl(REF, MAIL);
    expect(url).not.toContain(MAIL);
    expect(url).not.toContain(encodeURIComponent(MAIL));
    expect(url).not.toContain('email=');
  });
});

describe('Giriş zinciri — callbackUrl sorguyu KORUR', () => {
  /** Yorumlar SOYULUR: iddia YÜRÜYEN koda bakar, açıklama metnine değil. */
  const kaynak = readFileSync(new URL('../src/middleware.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('callbackUrl pathname + search ile kurulur', () => {
    expect(kaynak).toMatch(/callbackUrl: `\$\{pathname\}\$\{req\.nextUrl\.search\}`/);
  });

  it('NEGATİF: yalnız `pathname` yazan eski hâl geri gelmez — siparis parametresi düşerdi', () => {
    expect(kaynak, 'callbackUrl: pathname → girişten sonra çıplak /hesabim, hangi sipariş kayıp')
      .not.toMatch(/callbackUrl: pathname\s*[},]/);
  });
});
