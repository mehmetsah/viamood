/**
 * #995400 — E-posta akışı takip paneli çivisi.
 *
 * Neyi çiviler:
 *  1. Defterdeki durum → ekrandaki hal eşlemesi (gitti mi · ne zaman). "planlandi"
 *     satırı GÖNDERİLDİ görünmez; sözlük dışı değer sessizce "bekliyor" görünmez.
 *  2. Akış öncesi form kaydı kendi `email_status`unu gösterir; 'skipped' = gitmedi.
 *     Aynı adresin akıştan ÖNCEKİ kaydı akışın maillerini sahiplenmez.
 *  3. Adım etiketi akış tanımından (ADIMLAR) türer — panelde ikinci katalog yok.
 *  4. Panel YALNIZ OKUR: sayfa ve veri katmanında yazma çağrısı yok.
 *  5. Yol yalnız tam admin'e açık (sss_editor göremez).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adimEtiketi, adimHali, akisMailleri, dogrudanMail, formSatiriKur, terkSatiriKur,
} from '@/lib/eposta-takip';
import { adminYoluAcikMi } from '@/lib/yetki';

const t0 = new Date('2026-10-24T10:00:00Z');
const t1 = new Date('2026-10-24T10:00:05Z');
const t2 = new Date('2026-10-26T10:00:00Z');

const form = (o: Partial<Parameters<typeof formSatiriKur>[0]> = {}) => ({
  id: 'f1', name: 'Ad', email: 'kisi@ornek.test', createdAt: t0,
  emailStatus: 'skipped', emailSentAt: null, emailError: '#994057 akışı devraldı (eposta_akis_tetikleri)',
  ...o,
});
const tetik = (o: Partial<Parameters<typeof terkSatiriKur>[0]> = {}) => ({
  id: 'k1', akis: 'hos_geldin', email: 'kisi@ornek.test', tetikAni: t0, iptalSebebi: null, ...o,
});

describe('#995400 durum → hal', () => {
  it('gonderildi / planlandi / isleniyor / atlandi / iptal / hata', () => {
    expect(adimHali('gonderildi')).toBe('gonderildi');
    expect(adimHali('planlandi')).toBe('bekliyor');
    expect(adimHali('isleniyor')).toBe('bekliyor');
    expect(adimHali('atlandi')).toBe('gonderilmedi');
    expect(adimHali('iptal')).toBe('gonderilmedi');
    expect(adimHali('hata')).toBe('hata');
  });
  it('NEGATİF: sözlük dışı değer "bekliyor" ya da "gönderildi" görünmez', () => {
    expect(adimHali('bilinmeyen')).toBe('hata');
  });
});

describe('#995400 akış mailleri', () => {
  it('adım sırasıyla; gönderilen gönderim anını, bekleyen planlanan anı taşır', () => {
    const m = akisMailleri([
      { tetikId: 'k1', adim: 2, durum: 'planlandi', planlananAn: t2, gonderimAni: null, hataMetni: null },
      { tetikId: 'k1', adim: 1, durum: 'gonderildi', planlananAn: t0, gonderimAni: t1, hataMetni: null },
    ]);
    expect(m.map((x) => x.adim)).toEqual([1, 2]);
    expect(m[0]).toMatchObject({ hal: 'gonderildi', zaman: t1, zamanTuru: 'gonderim' });
    expect(m[1]).toMatchObject({ hal: 'bekliyor', zaman: t2, zamanTuru: 'planlanan' });
  });
  it('NEGATİF: planlanan an GÖNDERİM zamanı diye etiketlenmez', () => {
    const [m] = akisMailleri([{ tetikId: 'k1', adim: 2, durum: 'planlandi', planlananAn: t2, gonderimAni: null, hataMetni: null }]);
    expect(m?.zamanTuru).not.toBe('gonderim');
  });
  it('atlanan adım sebebini taşır, zamanı uydurulmaz', () => {
    const [m] = akisMailleri([{ tetikId: 'k1', adim: 2, durum: 'atlandi', planlananAn: t2, gonderimAni: null, hataMetni: 'kod kullanıldı — hatırlatma gereksiz' }]);
    expect(m).toMatchObject({ hal: 'gonderilmedi', zaman: null, zamanTuru: null, not: 'kod kullanıldı — hatırlatma gereksiz' });
  });
});

describe('#995400 form satırı', () => {
  it('akışı olan kayıt: akış adı + yalnız KENDİ tetiğinin mailleri', () => {
    const r = formSatiriKur(form(), tetik(), [
      { tetikId: 'k1', adim: 1, durum: 'gonderildi', planlananAn: t0, gonderimAni: t1, hataMetni: null },
      { tetikId: 'baska', adim: 1, durum: 'gonderildi', planlananAn: t0, gonderimAni: t1, hataMetni: null },
    ]);
    expect(r.akis).toBe('hos_geldin');
    expect(r.mailler).toHaveLength(1);
    expect(r.oncekiKayitlaAcildi).toBe(false);
  });
  it('akış öncesi kayıt: doğrudan gönderim sonucu (sent → gönderildi + zaman)', () => {
    const r = formSatiriKur(form({ emailStatus: 'sent', emailSentAt: t1, emailError: null }), undefined, []);
    expect(r.akis).toBeNull();
    expect(r.mailler).toEqual([{ adim: null, hal: 'gonderildi', zaman: t1, zamanTuru: 'gonderim', not: null }]);
  });
  it('NEGATİF: skipped kayıt "gönderildi" görünmez, sebebi görünür', () => {
    const m = dogrudanMail({ emailStatus: 'skipped', emailSentAt: null, emailError: 'WELCOME_DISCOUNT_CODE tanımsız' });
    expect(m.hal).toBe('gonderilmedi');
    expect(m.not).toBe('WELCOME_DISCOUNT_CODE tanımsız');
  });
  it('aynı adresin ikinci form kaydı "önceki kayıtla açılmıştı" diye işaretlenir', () => {
    const r = formSatiriKur(form({ createdAt: t2 }), tetik(), []);
    expect(r.oncekiKayitlaAcildi).toBe(true);
  });
  it('NEGATİF: aynı adresin AKIŞTAN ÖNCEKİ kaydı akışın maillerini kendi maili gibi göstermez', () => {
    const eylul = new Date('2026-09-22T09:00:00Z');
    const r = formSatiriKur(form({ createdAt: eylul, emailStatus: 'sent', emailSentAt: eylul, emailError: null }), tetik(), [
      { tetikId: 'k1', adim: 1, durum: 'gonderildi', planlananAn: t0, gonderimAni: t1, hataMetni: null },
    ]);
    expect(r.akis).toBeNull();
    expect(r.mailler).toEqual([{ adim: null, hal: 'gonderildi', zaman: eylul, zamanTuru: 'gonderim', not: null }]);
  });
  it('durmuş akış sebebi okunur yazılır', () => {
    const r = terkSatiriKur(tetik({ akis: 'sepet_terki', iptalSebebi: 'donusum' }), []);
    expect(r.akisDurdu).toBe('sipariş verdi, akış durdu');
    expect(r.ad).toBeNull();
  });
});

describe('#995400 adım etiketi akış tanımından türer', () => {
  it('hoş geldin + sepet terki', () => {
    expect(adimEtiketi('hos_geldin', 1)).toBe('1. mail · anında · kuponlu');
    expect(adimEtiketi('hos_geldin', 2)).toBe('2. mail · +2 gün');
    expect(adimEtiketi('sepet_terki', 1)).toBe('1. mail · +1 sa');
    expect(adimEtiketi('sepet_terki', 2)).toBe('2. mail · +1 gün · kuponlu');
    expect(adimEtiketi('checkout_terki', 2)).toBe('2. mail · +1 gün · kuponlu');
  });
});

describe('#995400 panel yalnız okur ve yalnız admin görür', () => {
  const kok = path.resolve(__dirname, '..');
  const dosyalar = ['src/lib/eposta-takip.ts', 'src/app/admin/eposta-takip/page.tsx'];
  it.each(dosyalar)('%s içinde yazma çağrısı yok', (d) => {
    const s = readFileSync(path.join(kok, d), 'utf8');
    expect(s).not.toMatch(/\.(insert|update|delete)\s*\(/);
    expect(s).not.toMatch(/\bsql\.raw\b|\.execute\s*\(/);
  });
  it('menüde bağlantı var', () => {
    const s = readFileSync(path.join(kok, 'src/app/admin/layout.tsx'), 'utf8');
    expect(s).toContain('href="/admin/eposta-takip"');
  });
  it('tam admin girer; NEGATİF: sss_editor ve müşteri giremez', () => {
    expect(adminYoluAcikMi('admin', '/admin/eposta-takip')).toBe(true);
    expect(adminYoluAcikMi('sss_editor', '/admin/eposta-takip')).toBe(false);
    expect(adminYoluAcikMi('customer', '/admin/eposta-takip')).toBe(false);
  });
});
