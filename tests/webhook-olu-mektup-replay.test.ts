/**
 * #994753 — ölü mektup REPLAY çivileri.
 * Sahte depo + sahte işleyici; canlı DB'ye DOKUNULMAZ (`@/db/client` hiç yüklenmez).
 */
import { describe, expect, it } from 'vitest';
import {
  DENEME_TAVANI,
  geriCekilmeMs,
  oluMektupReplay,
  replayEdilebilirMi,
  type OluMektupKaydi,
  type ReplayDeposu,
} from '@/lib/shopify/olu-mektup-replay';

const T0 = new Date('2026-10-20T03:00:00Z');

function kayit(y: Partial<OluMektupKaydi> = {}): OluMektupKaydi {
  return {
    id: y.id ?? 'k1',
    konu: 'orders/create',
    webhookId: y.webhookId !== undefined ? y.webhookId : 'wh-1',
    shopDomain: 'viamood.myshopify.com',
    kalici: false,
    hata: 'DB baglantisi dustu',
    hamGovde: JSON.stringify({ id: 111, line_items: [{ sku: 'A' }] }),
    islendiTs: null,
    denemeSayisi: 0,
    sonDenemeTs: null,
    elleInceleme: false,
    ...y,
  };
}

function sahteDepo(kayitlar: OluMektupKaydi[]) {
  const yamalar: Array<{ id: string; yama: Record<string, unknown> }> = [];
  const depo: ReplayDeposu = {
    acikKayitlar: async (n) => kayitlar.slice(0, n),
    damgala: async (id, yama) => { yamalar.push({ id, yama: yama as Record<string, unknown> }); },
  };
  return { depo, yamalar };
}

describe('replayEdilebilirMi — karar tablosu', () => {
  it('(b) KALICI kayıt ASLA oynatılmaz', () => {
    const k = replayEdilebilirMi(kayit({ kalici: true }), T0);
    expect(k.olur).toBe(false);
    expect(k.sebep).toContain('kalici');
  });
  it('geçici + hiç denenmemiş kayıt beklemeden oynatılır', () => {
    expect(replayEdilebilirMi(kayit(), T0).olur).toBe(true);
  });
  it('işlenmiş kayda dokunulmaz', () => {
    expect(replayEdilebilirMi(kayit({ islendiTs: T0 }), T0).olur).toBe(false);
  });
  it('elle incelemedeki kayıt otomatiğe kapalıdır', () => {
    expect(replayEdilebilirMi(kayit({ elleInceleme: true }), T0).olur).toBe(false);
  });
  it('ham gövdesi olmayan kayıt oynatılamaz', () => {
    expect(replayEdilebilirMi(kayit({ hamGovde: null }), T0).olur).toBe(false);
  });
  it('geri çekilme süresi dolmadan tekrar denenmez (üstel)', () => {
    // 1. denemeden 1 dk sonra: 5 dk dolmadı
    const erken = kayit({ denemeSayisi: 1, sonDenemeTs: new Date(T0.getTime() - 60_000) });
    expect(replayEdilebilirMi(erken, T0).olur).toBe(false);
    // 6 dk sonra: dolmuş
    const gec = kayit({ denemeSayisi: 1, sonDenemeTs: new Date(T0.getTime() - 6 * 60_000) });
    expect(replayEdilebilirMi(gec, T0).olur).toBe(true);
    // üstel: 3. denemeden sonra 20 dk
    expect(geriCekilmeMs(3)).toBe(20 * 60_000);
    expect(geriCekilmeMs(0)).toBe(0);
  });
  it('(d) deneme tavanına ulaşan kayıt oynatılmaz', () => {
    expect(replayEdilebilirMi(kayit({ denemeSayisi: DENEME_TAVANI, sonDenemeTs: new Date(0) }), T0).olur).toBe(false);
  });
});

describe('oluMektupReplay — akış', () => {
  it('(a) geçici kayıt yeniden oynanır ve başarılıysa KAPANIR (silinmez, damgalanır)', async () => {
    const { depo, yamalar } = sahteDepo([kayit()]);
    const ozet = await oluMektupReplay(depo, async () => ({ ok: true }), { simdi: T0 });
    expect(ozet.oynatilan).toBe(1);
    expect(ozet.basarili).toBe(1);
    expect(yamalar).toHaveLength(1);
    expect(yamalar[0].yama.islendiTs).toEqual(T0);
    expect(yamalar[0].yama.denemeSayisi).toBe(1);
    // SİLME YOK: damgalama dışında bir işlem çağrılmadı
    expect(Object.keys(yamalar[0].yama)).not.toContain('silindi');
  });

  it('(b) kalıcı kayıt işleyiciye HİÇ gitmez', async () => {
    const { depo, yamalar } = sahteDepo([kayit({ kalici: true })]);
    let cagrildi = 0;
    const ozet = await oluMektupReplay(depo, async () => { cagrildi++; return { ok: true }; }, { simdi: T0 });
    expect(cagrildi).toBe(0);
    expect(ozet.oynatilan).toBe(0);
    expect(ozet.atlanan).toBe(1);
    expect(yamalar).toHaveLength(0);
  });

  it('(c) aynı webhookId iki kez İŞLENMEZ (idempotans)', async () => {
    const { depo } = sahteDepo([kayit({ id: 'a' }), kayit({ id: 'b' })]); // ikisi de wh-1
    let cagrildi = 0;
    const ozet = await oluMektupReplay(depo, async () => { cagrildi++; return { ok: true }; }, { simdi: T0 });
    expect(cagrildi).toBe(1);
    expect(ozet.tekrarAtlanan).toBe(1);
  });

  it('webhookId yoksa kayıt kendi id’siyle tekilleşir (ikisi de işlenir)', async () => {
    const { depo } = sahteDepo([kayit({ id: 'a', webhookId: null }), kayit({ id: 'b', webhookId: null })]);
    let cagrildi = 0;
    await oluMektupReplay(depo, async () => { cagrildi++; return { ok: true }; }, { simdi: T0 });
    expect(cagrildi).toBe(2);
  });

  it('(d) deneme TAVANI aşılınca ELLE İNCELEMEYE geçer, silinmez', async () => {
    const son = kayit({ denemeSayisi: DENEME_TAVANI - 1, sonDenemeTs: new Date(0) });
    const { depo, yamalar } = sahteDepo([son]);
    const ozet = await oluMektupReplay(depo, async () => ({ ok: false, hata: 'yine dustu', retryable: true }), { simdi: T0 });
    expect(ozet.basarisiz).toBe(1);
    expect(ozet.elleIncelemeyeGecen).toBe(1);
    expect(yamalar[0].yama.elleInceleme).toBe(true);
    expect(yamalar[0].yama.denemeSayisi).toBe(DENEME_TAVANI);
    expect(yamalar[0].yama.islendiTs).toBeUndefined(); // kapatılmadı
  });

  it('işleyici KALICI hata derse tavan beklenmeden elle incelemeye geçer', async () => {
    const { depo, yamalar } = sahteDepo([kayit()]);
    await oluMektupReplay(depo, async () => ({ ok: false, hata: 'sema bozuk', retryable: false }), { simdi: T0 });
    expect(yamalar[0].yama.elleInceleme).toBe(true);
  });

  it('işleyici FIRLATIRSA replay çökmez, geçici hata sayar', async () => {
    const { depo, yamalar } = sahteDepo([kayit()]);
    const ozet = await oluMektupReplay(depo, async () => { throw new Error('ag koptu'); }, { simdi: T0 });
    expect(ozet.basarisiz).toBe(1);
    expect(String(yamalar[0].yama.hata)).toContain('ag koptu');
    expect(yamalar[0].yama.elleInceleme).toBe(false);
  });

  it('bozuk ham gövde elle incelemeye düşer, işleyici çağrılmaz', async () => {
    const { depo, yamalar } = sahteDepo([kayit({ hamGovde: '{bozuk json' })]);
    let cagrildi = 0;
    const ozet = await oluMektupReplay(depo, async () => { cagrildi++; return { ok: true }; }, { simdi: T0 });
    expect(cagrildi).toBe(0);
    expect(ozet.elleIncelemeyeGecen).toBe(1);
    expect(yamalar[0].yama.elleInceleme).toBe(true);
  });

  it('(e) NEGATİF — kutu BOŞKEN hiçbir şey yazmaz, patlamaz', async () => {
    const { depo, yamalar } = sahteDepo([]);
    let cagrildi = 0;
    const ozet = await oluMektupReplay(depo, async () => { cagrildi++; return { ok: true }; }, { simdi: T0 });
    expect(ozet).toMatchObject({ bakilan: 0, oynatilan: 0, basarili: 0, basarisiz: 0, atlanan: 0 });
    expect(cagrildi).toBe(0);
    expect(yamalar).toHaveLength(0);
  });
});
