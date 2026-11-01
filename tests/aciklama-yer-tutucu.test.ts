/**
 * #994831 · AÇIKLAMADAKİ YER TUTUCULAR · ÇİVİ (koordinasyon kararı 1 Kas 2026, md.46/md.52).
 * Girdi: veri/994831-aciklama-yer-tutucu.jsonl (oncekiHtml = Admin dökümü 1 Kas 08:36Z, birebir) · kaynak araması
 * veri/994831-aciklama-yer-tutucu-kaynak.jsonl. Dört kalemin dördünde de kaynak yok → yer tutucu blok DÜŞER, değer UYDURULMAZ.
 * KALICI ONARIM: açıklama yazan HER betiğin `yaz` adımı aciklamaYazKapisi'ndan geçer (statik ölçüm aşağıda).
 * NEGATİF KONTROL: meşru açıklamalarda (repodaki tüm hedef HTML'ler + 10 zor örnek) yanlış alarm 0; enjekte edilen 3 yer tutucu 3/3.
 * MUTASYON: kapı bir betikten sökülürse, desen zayıflatılırsa, kipin kapılarından biri ya da ÖNCESİ-önce kütüğü kalkarsa KIRILIR.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bosBaslikSayisi, butunBlokMu, degistirCalistir, yerTutucuKarar, type KutukSatiri, type YerTutucuGiris } from '../src/lib/aciklama-degistir';
import { duzMetin } from '../src/lib/aciklama-ic-not';
import { aciklamaYazKapisi, aciklamaYerTutucuBul } from '../src/lib/aciklama-yer-tutucu';
import { MESRU } from './yer-tutucu-ornek';

const KOK = path.join(__dirname, '..');
const satir = <T,>(f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as T);
const G = satir<YerTutucuGiris>('994831-aciklama-yer-tutucu.jsonl');
const KAYNAK = satir<{ handle: string; baslik: string; etiketler: string[]; barkod: string[] }>('994831-aciklama-yer-tutucu-kaynak.jsonl');
const MBISON = 'ultra-street-fighter-ii-m-bison-aksiyon-figuru';
const HW = ['hot-wheels-premium-scuderia-ferrari-hp-f1-2025-2li-model-araba', 'hot-wheels-premium-aston-martin-aramco-f1-2025-2li-model-araba-seti', 'hot-wheels-premium-bwt-alpine-f1-2025-2li-model-araba-seti'];
const g = (h: string) => G.find((x) => x.handle === h)!;
const kesin = (k: ReturnType<typeof yerTutucuKarar>) => { if (k.durum !== 'yazilacak') throw new Error(`${k.durum}: ${'sebep' in k ? k.sebep : ''}`); return k; };

describe('veri — dört kalem, kaynak yok, değer uydurulmaz', () => {
  it('tam 4 ürün; her birinde öncesi yer tutucu taşır; her değişim KALDIRMA (yeni boş, kaynak yok) ve gerekçe yazılı', () => {
    expect(G.map((x) => x.handle).sort()).toEqual([MBISON, ...HW].sort());
    for (const x of G) {
      expect(aciklamaYerTutucuBul(x.oncekiHtml).length).toBeGreaterThan(0);
      expect(x.yerTutucu.degisimler).toHaveLength(1);
      expect(x.yerTutucu.degisimler[0]).toMatchObject({ yeni: '', kaynak: null });
      expect(x.yerTutucu.gerekce).toMatch(/kaynak arandı/i);
    }
  });
  it('m-bison: düşen blok yalnız «Model kodu · 34XXX» tablo satırı; barkod (EAN) hiçbir yere değer olarak yazılmıyor', () => {
    const d = g(MBISON).yerTutucu.degisimler[0]!;
    expect(duzMetin(d.eski)).toBe("Model kodu 34XXX (kutudaki EAN'ı gir)");
    expect(d.eski.trim()).toMatch(/^<tr>[\s\S]*<\/tr>$/);
    const k = KAYNAK.find((x) => x.handle === MBISON)!;
    expect(k.barkod).toEqual(['4006333094729']);
    expect(g(MBISON).yeniHtml).not.toContain('4006333094729');
  });
  it('Hot Wheels: düşen blok «Güvenlik Uyarısı» başlığı + yer tutucu paragrafı; kaynakta yaş yok (etiket/başlık)', () => {
    for (const h of HW) {
      expect(duzMetin(g(h).yerTutucu.degisimler[0]!.eski)).toBe('Güvenlik Uyarısı ___ (kutudaki yaş bilgisine göre doldur)');
      const k = KAYNAK.find((x) => x.handle === h)!;
      expect([k.baslik, ...k.etiketler].join(' ')).not.toMatch(/yaş|\d\s?\+/i);
    }
  });
});

describe('karar — yalnız hedef blok değişir', () => {
  it('her ürün yazılacak; yeni HTML = öncesinden YALNIZ hedef blok baytları çıkmış hâli; yer tutucu 0', () => {
    for (const x of G) {
      const r = kesin(yerTutucuKarar(x, x.oncekiHtml));
      expect(r.kip).toBe('yer-tutucu');
      expect(r.html).toBe(x.yeniHtml);
      const e = x.yerTutucu.degisimler[0]!.eski, i = x.oncekiHtml.indexOf(e);
      expect(r.html).toBe(x.oncekiHtml.slice(0, i) + x.oncekiHtml.slice(i + e.length));
      expect(Buffer.byteLength(x.oncekiHtml) - Buffer.byteLength(r.html)).toBe(Buffer.byteLength(e));
      expect(aciklamaYerTutucuBul(r.html)).toEqual([]);
      expect(bosBaslikSayisi(r.html)).toBe(bosBaslikSayisi(x.oncekiHtml));
    }
    expect(duzMetin(g(MBISON).yeniHtml)).toContain('Yaş 13+');
    for (const h of HW) expect(duzMetin(g(h).yeniHtml)).toMatch(/kargolanır\. Ürün Bilgileri Marka: Hot Wheels/);
  });
  it('idempotans: canlı zaten sonrasıysa değişiklik-yok', () => {
    for (const x of G) expect(yerTutucuKarar(x, x.yeniHtml)).toMatchObject({ durum: 'degisiklik-yok' });
  });
});

describe('kipin kapıları (negatif)', () => {
  const m = g(MBISON), h = g(HW[0]!);
  const ile = (x: YerTutucuGiris, degisimler: YerTutucuGiris['yerTutucu']['degisimler']) => {
    let y = x.oncekiHtml; for (const d of degisimler) y = y.replace(d.eski, d.yeni);
    return { ...x, yerTutucu: { ...x.yerTutucu, degisimler }, yeniHtml: y };
  };
  it('canlı öncesinden farklıysa YAZMAZ', () => {
    expect(yerTutucuKarar(m, m.oncekiHtml + ' ')).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('öncesinden farklı') });
  });
  it('yeni HTML değişimlerin birebir uygulanmışı değilse YAZMAZ', () => {
    expect(yerTutucuKarar({ ...m, yeniHtml: m.yeniHtml.replace('13+', '14+') }, m.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('metin kapısı') });
  });
  it('yalnız paragraf düşerse (başlık boş kalır) YAZMAZ', () => {
    const p = '<p>___ (kutudaki yaş bilgisine göre doldur)</p>';
    expect(yerTutucuKarar(ile(h, [{ eski: p, yeni: '', kaynak: null }]), h.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('boş başlık') });
  });
  it('yer tutucu taşımayan blok (Kargo ve Ambalaj) düşürülemez', () => {
    const e = h.oncekiHtml.slice(h.oncekiHtml.indexOf('<h3>Kargo'), h.oncekiHtml.indexOf('<h3>Güvenlik'));
    expect(yerTutucuKarar(ile(h, [...h.yerTutucu.degisimler, { eski: e, yeni: '', kaynak: null }]), h.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('yer tutucu yok') });
  });
  it('yarım blok (kapanmayan etiket) düşürülemez', () => {
    expect(yerTutucuKarar(ile(h, [{ eski: '<h3>Güvenlik Uyarısı</h3>\n<p>___ (kutudaki yaş', yeni: '', kaynak: null }]), h.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('bütün bir HTML bloğu') });
  });
  it('KAYNAKSIZ değer yazılmaz: barkod «model kodu» diye yazılamaz; değer kaynak alıntısında geçmiyorsa yazılmaz', () => {
    const e = m.yerTutucu.degisimler[0]!.eski, barkodlu = e.replace("34XXX (kutudaki EAN'ı gir)", '4006333094729');
    expect(yerTutucuKarar(ile(m, [{ eski: e, yeni: barkodlu, kaynak: null }]), m.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('uydurma') });
    expect(yerTutucuKarar(ile(m, [{ eski: e, yeni: barkodlu, kaynak: { tur: 'baslik', kaynak: 'ürün başlığı', alinti: m.baslik } }]), m.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('alıntısında geçmiyor') });
  });
  it('KAYNAKLI değer yazılır (pozitif): değer ambalaj alıntısında birebir geçiyor', () => {
    const e = m.yerTutucu.degisimler[0]!.eski, yeni = e.replace("34XXX (kutudaki EAN'ı gir)", 'JT-12345');
    const r = kesin(yerTutucuKarar(ile(m, [{ eski: e, yeni, kaynak: { tur: 'ambalaj', kaynak: 'kutu arkası fotoğrafı', alinti: 'Item No. JT-12345' } }]), m.oncekiHtml));
    expect(duzMetin(r.html)).toContain('Model kodu JT-12345');
  });
  it('kaldırma satırında kaynak varsa (değer yazılmalıydı) YAZMAZ; gerekçe boşsa YAZMAZ', () => {
    expect(yerTutucuKarar(ile(m, [{ ...m.yerTutucu.degisimler[0]!, kaynak: { tur: 'ambalaj', kaynak: 'k', alinti: 'a' } }]), m.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('kaldırma satırında kaynak') });
    expect(yerTutucuKarar({ ...m, yerTutucu: { ...m.yerTutucu, gerekce: ' ' } }, m.oncekiHtml)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('gerekçe') });
  });
  it('sonrasında yer tutucu kalıyorsa YAZMAZ', () => {
    const iki = `${h.oncekiHtml}<p>Model kodu 34XXX.</p>`;
    expect(yerTutucuKarar({ ...h, oncekiHtml: iki, yeniHtml: iki.replace(h.yerTutucu.degisimler[0]!.eski, '') }, iki)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('yer tutucu kalıyor') });
  });
  it('bütün blok ölçeri: dengeli blok evet, yarım/çıplak metin hayır', () => {
    expect(butunBlokMu('<tr>\n<td>a</td>\n<td>b</td>\n</tr>\n')).toBe(true);
    expect(butunBlokMu('<h3>a</h3>\n<p>b</p>\n\n')).toBe(true);
    expect(butunBlokMu('<td>a</td>\n<td>b')).toBe(false);
    expect(butunBlokMu('düz metin')).toBe(false);
  });
});

describe('çalıştırıcı — ÖNCESİ kütüğe yazılmadan yazma yok', () => {
  const kur = (o: { kutukAtar?: boolean; okuFark?: boolean } = {}) => {
    const db = new Map<string, string>([...G.map((x) => [x.handle, x.oncekiHtml] as [string, string]), ['baska-urun', '<p>Model kodu 34XXX</p>']]);
    const yazilan: string[] = [], kutuk: KutukSatiri[] = [];
    return {
      db, yazilan, kutuk,
      dep: {
        bul: async (handle: string) => (db.has(handle) ? { id: 'gid://' + handle, handle, html: db.get(handle)! } : null),
        oku: async (id: string) => (o.okuFark ? db.get(id.slice(6))! + ' ' : db.get(id.slice(6))!),
        yaz: async (id: string, html: string) => { yazilan.push(id.slice(6)); db.set(id.slice(6), html); return { ok: true as const }; },
        kutuk: (s: KutukSatiri) => { if (o.kutukAtar && s.durum === 'oncesi-kaydedildi') throw new Error('disk dolu'); kutuk.push(s); },
      },
    };
  };
  it('dry-run varsayılanında yaz HİÇ çağrılmaz', async () => {
    const s = kur();
    expect(await degistirCalistir(G, s.dep, { uygula: false })).toMatchObject({ yazilacak: 4, yazildi: 0 });
    expect(s.yazilan).toEqual([]);
  });
  it('uygula: yalnız 4 ürün; her üründe oncesi-kaydedildi (TAM öncesi HTML) yazmadan ÖNCE; başka ürüne dokunulmaz; ikinci koşu 0', async () => {
    const s = kur();
    expect(await degistirCalistir(G, s.dep, { uygula: true })).toMatchObject({ yazildi: 4, hata: 0 });
    expect(s.yazilan.sort()).toEqual([MBISON, ...HW].sort());
    expect(s.db.get('baska-urun')).toBe('<p>Model kodu 34XXX</p>');
    for (const x of G) {
      const ks = s.kutuk.filter((k) => k.handle === x.handle);
      expect(ks.map((k) => k.durum)).toEqual(['oncesi-kaydedildi', 'yazildi']);
      expect(ks[0]!.onceHtml).toBe(x.oncekiHtml);
      expect(s.db.get(x.handle)).toBe(x.yeniHtml);
    }
    s.yazilan.length = 0;
    expect(await degistirCalistir(G, s.dep, { uygula: true })).toMatchObject({ degisiklikYok: 4, yazildi: 0 });
    expect(s.yazilan).toEqual([]);
  });
  it('ÖNCESİ kütüğü yazılamazsa yaz HİÇ koşmaz; okuma ile yazma arasında değiştiyse yazmaz', async () => {
    const a = kur({ kutukAtar: true });
    expect(await degistirCalistir(G, a.dep, { uygula: true })).toMatchObject({ yazildi: 0, hata: 4 });
    expect(a.yazilan).toEqual([]);
    const b = kur({ okuFark: true });
    expect(await degistirCalistir(G, b.dep, { uygula: true })).toMatchObject({ yazildi: 0, atlandi: 4 });
    expect(b.yazilan).toEqual([]);
  });
});

describe('KALICI ONARIM — açıklama yazma kapısı', () => {
  it('yer tutuculu açıklama REDDEDİLİR (dört öncesi), temizlenmiş hâli geçer (dört sonrası)', () => {
    for (const x of G) {
      expect(aciklamaYazKapisi(x.oncekiHtml)).toMatchObject({ ok: false, hata: expect.stringContaining('yer tutucu') });
      expect(aciklamaYazKapisi(x.yeniHtml)).toEqual({ ok: true });
    }
  });
  it('NEGATİF KONTROL: repodaki tüm hedef açıklamalar + 10 zor meşru örnek → yanlış alarm 0; enjekte edilen 3 yer tutucu → 3/3', () => {
    const hedefler = readdirSync(path.join(KOK, 'veri')).filter((f) => /^994831-aciklama-.*\.jsonl$/.test(f) && !f.includes('yer-tutucu')).flatMap((f) =>
      satir<{ yeniHtml?: string; hedefHtml?: string; taslakHtml?: string }>(f).map((o) => o.yeniHtml ?? o.hedefHtml ?? o.taslakHtml).filter((x): x is string => !!x));
    expect(hedefler.length).toBeGreaterThanOrEqual(18); // 1 Kas: pilot · dalga 2 · değiştir · kalan · jada ölçü hedefleri
    const mesru = [...hedefler, ...MESRU.map((m) => `<p>${m}</p>`)];
    expect(mesru.filter((x) => !aciklamaYazKapisi(x).ok)).toEqual([]);
    const enjekte = [
      hedefler[0]!.replace('</p>', ' Ürün kodu: ??? </p>'),
      hedefler[1]!.replace('</p>', ' (ambalajdaki ölçüyü gir)</p>'),
      hedefler[2]!.replace('</p>', ' Malzeme bilgisi eklenecek.</p>'),
    ];
    expect(enjekte.map((x) => aciklamaYazKapisi(x).ok)).toEqual([false, false, false]);
  });
  it('açıklama yazan HER betik (productUpdate + descriptionHtml) yaz adımında kapıyı productUpdate ÖNCESİNDE çağırır', () => {
    const betikler = readdirSync(path.join(KOK, 'scripts')).filter((f) => /\.mts$/.test(f)).map((f) => [f, readFileSync(path.join(KOK, 'scripts', f), 'utf8')] as const)
      .filter(([, s]) => /productUpdate\(/.test(s) && /descriptionHtml: /.test(s));
    expect(betikler.length).toBeGreaterThanOrEqual(9);
    for (const [f, s] of betikler) {
      const y = s.indexOf('yaz: async');
      expect([f, s.includes("import { aciklamaYazKapisi } from '../src/lib/aciklama-yer-tutucu.ts';")]).toEqual([f, true]);
      expect([f, y >= 0 && s.indexOf('aciklamaYazKapisi(', y) > y && s.indexOf('aciklamaYazKapisi(', y) < s.indexOf('productUpdate(', y)]).toEqual([f, true]);
      expect([f, /if \(!kapi\.ok\) return kapi;/.test(s)]).toEqual([f, true]);
    }
  });
});
