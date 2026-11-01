/**
 * #994831 / #994995 · DAMGALI KANCA ÇİVİSİ — scripts/sss-ilk-20-kur.sh ve aciklama-ic-not-kur.sh
 * gerçek bash ile, sahte komutlarla koşturulur (ağ/DB yok).
 * MUTASYON: scripts/_damgali-kur.sh'tan damga kontrolü kaldırılırsa "damga varken dokunmaz",
 * KURU çıkış kodu kontrolü kaldırılırsa "kuru hatalıysa uygulaya geçmez" KIRILIR.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { duzMetin } from '../src/lib/aciklama-ic-not';
import { tekrarSoy } from '../src/lib/aciklama-baslik-tekrar';
import { kuyrukSoy } from '../src/lib/aciklama-pazar-blok';
import { basSoy } from '../src/lib/aciklama-bas-blok';
import { cevapUygunMu, UYGULANMAYAN } from '../src/lib/sss-eksen';

const KOK = path.join(__dirname, '..');
function kos(betik: string, o: { damgaVar?: boolean; kuruCikis?: number; uygulaCikis?: number }) {
  const d = mkdtempSync(path.join(tmpdir(), 'damga-'));
  const damga = path.join(d, 'is.damga'), log = path.join(d, 'is.log'), iz = path.join(d, 'iz');
  if (o.damgaVar) writeFileSync(damga, 'eski');
  const env = { ...process.env, DAMGA: damga, LOG: log,
    KURU_KOMUT: `echo kuru >> ${iz}; exit ${o.kuruCikis ?? 0}`,
    UYGULA_KOMUT: `echo uygula >> ${iz}; exit ${o.uygulaCikis ?? 0}` };
  const cikis = (() => { try { execFileSync('bash', [path.join(KOK, 'scripts', betik)], { env, stdio: 'pipe' }); return 0; } catch (e: any) { return e.status as number; } })();
  const izler = existsSync(iz) ? readFileSync(iz, 'utf8').trim().split('\n') : [];
  return { cikis, izler, damgaVar: existsSync(damga), damga: existsSync(damga) ? readFileSync(damga, 'utf8') : '', log: existsSync(log) ? readFileSync(log, 'utf8') : '' };
}

for (const betik of ['sss-ilk-20-kur.sh', 'aciklama-ic-not-kur.sh', 'sss-dalga2-kur.sh', 'aciklama-ic-baslik-kur.sh', 'sss-dalga3-kur.sh', 'aciklama-baslik-tekrar-kur.sh', 'sss-dalga4-kur.sh', 'aciklama-pazar-blok-kur.sh', 'aciklama-baslik-tekrar-2-kur.sh', 'sss-dalga5-kur.sh', 'aciklama-pazar-blok-2-kur.sh', 'aciklama-bas-blok-kur.sh', 'sss-dalga7-kur.sh', 'aciklama-duzeltme-kur.sh', 'aciklama-pilot-kur.sh', 'aciklama-dalga2-kur.sh', 'aciklama-degistir-kur.sh', 'aciklama-kalan-kur.sh', 'aciklama-jada-olcu-kur.sh', 'sss-dalga8-kur.sh', 'sss-jada-boyut-kur.sh', 'sss-iade-dusur-kur.sh', 'sss-dalga9-kur.sh', 'sss-yer-tutucu-dusur-kur.sh', 'aciklama-yer-tutucu-kur.sh', 'gorsel-bag-coz-kur.sh', 'gorsel-bag-coz-sanrio-kur.sh']) {
  describe(betik, () => {
    it('damga VARKEN hiçbir komut koşmaz, damgaya dokunulmaz', () => {
      const r = kos(betik, { damgaVar: true });
      expect(r.izler).toEqual([]);
      expect(r.damga).toBe('eski');
      expect(r.log).toContain('damga var');
    });
    it('kuru temiz → uygula koşar → damga yazılır', () => {
      const r = kos(betik, {});
      expect(r.izler).toEqual(['kuru', 'uygula']);
      expect(r.damgaVar).toBe(true);
    });
    it('KURU hatalıysa UYGULA\'ya GEÇMEZ, damga yazılmaz', () => {
      const r = kos(betik, { kuruCikis: 1 });
      expect(r.izler).toEqual(['kuru']);
      expect(r.damgaVar).toBe(false);
      expect(r.log).toContain('UYGULA YAPILMADI');
    });
    it('UYGULA hatalıysa damga yazılmaz (sonraki deploy yeniden dener)', () => {
      const r = kos(betik, { uygulaCikis: 1 });
      expect(r.izler).toEqual(['kuru', 'uygula']);
      expect(r.damgaVar).toBe(false);
    });
    it('her durumda 0 ile çıkar (deploy\'u düşürmez)', () => {
      expect(kos(betik, { kuruCikis: 3 }).cikis).toBe(0);
      expect(kos(betik, { uygulaCikis: 3 }).cikis).toBe(0);
    });
  });
}

it('deploy.sh iki kancayı eposta-akis kalıbıyla (best-effort) çağırır', () => {
  const s = readFileSync(path.join(KOK, 'scripts', 'deploy.sh'), 'utf8');
  expect(s).toContain('bash scripts/sss-ilk-20-kur.sh || echo');
  expect(s).toContain('bash scripts/aciklama-ic-not-kur.sh || echo');
  expect(s).toContain('bash scripts/sss-dalga2-kur.sh || echo');
  expect(s).toContain('bash scripts/aciklama-ic-baslik-kur.sh || echo');
  expect(s).toContain('bash scripts/sss-dalga3-kur.sh || echo');
  expect(s.indexOf('aciklama-ic-baslik-kur.sh')).toBeLessThan(s.indexOf('sss-dalga3-kur.sh'));
  expect(s).toContain('bash scripts/aciklama-baslik-tekrar-kur.sh || echo');
  expect(s).toContain('bash scripts/sss-dalga4-kur.sh || echo');
  expect(s.indexOf('aciklama-baslik-tekrar-kur.sh')).toBeLessThan(s.indexOf('sss-dalga4-kur.sh')); // A2 önce
  for (const k of ['aciklama-pazar-blok-kur.sh', 'aciklama-baslik-tekrar-2-kur.sh', 'sss-dalga5-kur.sh', 'aciklama-pazar-blok-2-kur.sh', 'aciklama-bas-blok-kur.sh', 'sss-dalga7-kur.sh', 'aciklama-duzeltme-kur.sh', 'aciklama-pilot-kur.sh', 'aciklama-dalga2-kur.sh']) expect(s).toContain(`bash scripts/${k} || echo`);
  // dalga 5 cevapları temizlenmiş gövdeden alıntı: iki temizlik adımı SSS'ten ÖNCE koşar
  expect(s.indexOf('aciklama-pazar-blok-kur.sh')).toBeLessThan(s.indexOf('sss-dalga5-kur.sh'));
  expect(s.indexOf('aciklama-baslik-tekrar-2-kur.sh')).toBeLessThan(s.indexOf('sss-dalga5-kur.sh'));
  expect(s.indexOf('sss-dalga4-kur.sh')).toBeLessThan(s.indexOf('aciklama-pazar-blok-kur.sh'));
  expect(s).toContain('bash scripts/aciklama-pazar-blok-2-kur.sh || echo');
  expect(s.indexOf('sss-dalga5-kur.sh')).toBeLessThan(s.indexOf('aciklama-pazar-blok-2-kur.sh')); // dalga 6 en sonda
  for (const k of ['aciklama-bas-blok-kur.sh', 'sss-dalga7-kur.sh', 'aciklama-duzeltme-kur.sh', 'aciklama-pilot-kur.sh', 'aciklama-dalga2-kur.sh']) expect(s).toContain(`bash scripts/${k} || echo`);
  expect(s.indexOf('aciklama-pazar-blok-2-kur.sh')).toBeLessThan(s.indexOf('aciklama-bas-blok-kur.sh'));
  expect(s.indexOf('aciklama-bas-blok-kur.sh')).toBeLessThan(s.indexOf('sss-dalga7-kur.sh')); // ADIM 1 → dalga 7
  for (const k of ['aciklama-duzeltme-kur.sh', 'aciklama-pilot-kur.sh', 'aciklama-dalga2-kur.sh']) expect(s).toContain(`bash scripts/${k} || echo`);
  expect(s.indexOf('sss-dalga7-kur.sh')).toBeLessThan(s.indexOf('aciklama-duzeltme-kur.sh'));
  expect(s.indexOf('aciklama-duzeltme-kur.sh')).toBeLessThan(s.indexOf('aciklama-pilot-kur.sh'));
  expect(s.indexOf('aciklama-pilot-kur.sh')).toBeLessThan(s.indexOf('aciklama-dalga2-kur.sh'));
  expect(s).toContain('bash scripts/aciklama-degistir-kur.sh || echo');
  expect(s.indexOf('aciklama-dalga2-kur.sh')).toBeLessThan(s.indexOf('aciklama-degistir-kur.sh'));
  expect(s).toContain('bash scripts/aciklama-kalan-kur.sh || echo');
  expect(s.indexOf('aciklama-degistir-kur.sh')).toBeLessThan(s.indexOf('aciklama-kalan-kur.sh'));
  expect(s).toContain('bash scripts/aciklama-jada-olcu-kur.sh || echo');
  expect(s.indexOf('aciklama-kalan-kur.sh')).toBeLessThan(s.indexOf('aciklama-jada-olcu-kur.sh'));
  expect(s).toContain('bash scripts/sss-dalga8-kur.sh || echo');
  expect(s.indexOf('aciklama-jada-olcu-kur.sh')).toBeLessThan(s.indexOf('sss-dalga8-kur.sh')); // metin düzeltmeleri → dalga 8
  expect(s).toContain('bash scripts/sss-jada-boyut-kur.sh || echo');
  expect(s.indexOf('aciklama-jada-olcu-kur.sh')).toBeLessThan(s.indexOf('sss-jada-boyut-kur.sh')); // açıklama ölçüsü → SSS ölçüsü
  expect(s).toContain('bash scripts/sss-iade-dusur-kur.sh || echo');
  expect(s.indexOf('sss-jada-boyut-kur.sh')).toBeLessThan(s.indexOf('sss-iade-dusur-kur.sh'));
  expect(s).toContain('bash scripts/sss-dalga9-kur.sh || echo');
  expect(s.indexOf('sss-iade-dusur-kur.sh')).toBeLessThan(s.indexOf('sss-dalga9-kur.sh'));
  expect(s).toContain('bash scripts/sss-yer-tutucu-dusur-kur.sh || echo');
  expect(s.indexOf('sss-dalga9-kur.sh')).toBeLessThan(s.indexOf('sss-yer-tutucu-dusur-kur.sh'));
  expect(s).toContain('bash scripts/aciklama-yer-tutucu-kur.sh || echo');
  expect(s.indexOf('sss-yer-tutucu-dusur-kur.sh')).toBeLessThan(s.indexOf('aciklama-yer-tutucu-kur.sh'));
  expect(s).toContain('bash scripts/gorsel-bag-coz-kur.sh || echo');
  expect(s.indexOf('aciklama-yer-tutucu-kur.sh')).toBeLessThan(s.indexOf('gorsel-bag-coz-kur.sh'));
  expect(s).toContain('bash scripts/gorsel-bag-coz-sanrio-kur.sh || echo');
  expect(s.indexOf('gorsel-bag-coz-kur.sh')).toBeLessThan(s.indexOf('gorsel-bag-coz-sanrio-kur.sh'));
});

it('dalga 2 girdisi: 50 ürün, ürün başına 3–4 soru, kargo/iade sorusu yok, handle biçimi geçerli, ilk 20 ile çakışma yok', () => {
  const satir = (f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { handle: string; sss: Array<{ soru: string; cevap: string }> });
  const d2 = satir('994831-sss-dalga2.jsonl'), ilk = new Set(satir('994831-sss-ilk-20.jsonl').map((x) => x.handle));
  expect(d2).toHaveLength(50);
  expect(new Set(d2.map((x) => x.handle)).size).toBe(50);
  for (const x of d2) {
    expect(x.handle).toMatch(/^[a-z0-9-]+$/);
    expect(ilk.has(x.handle)).toBe(false);
    expect(x.sss.length).toBeGreaterThanOrEqual(3);
    expect(x.sss.length).toBeLessThanOrEqual(4);
    for (const q of x.sss) expect((q.soru + ' ' + q.cevap).toLocaleLowerCase('tr')).not.toMatch(/kargo|teslimat|iade/); // 'İade' de yakalanır
  }
});

it('dalga 3 girdisi: 100 ürün, 2–4 soru, kargo/iade yok, handle geçerli, ilk 20 ve dalga 2 ile çakışma yok', () => {
  const satir = (f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { handle: string; sss: Array<{ soru: string; cevap: string }> });
  const d3 = satir('994831-sss-dalga3.jsonl');
  const once = new Set([...satir('994831-sss-ilk-20.jsonl'), ...satir('994831-sss-dalga2.jsonl')].map((x) => x.handle));
  expect(d3).toHaveLength(100);
  expect(new Set(d3.map((x) => x.handle)).size).toBe(100);
  for (const x of d3) {
    expect(x.handle).toMatch(/^[a-z0-9-]+$/);
    expect(once.has(x.handle)).toBe(false);
    expect(x.sss.length).toBeGreaterThanOrEqual(2);
    expect(x.sss.length).toBeLessThanOrEqual(4);
    for (const q of x.sss) expect((q.soru + ' ' + q.cevap).toLocaleLowerCase('tr')).not.toMatch(/kargo|teslimat|iade|doğrula|teyit/); // 'İade' de yakalanır
  }
});

it('dalga 4 girdisi: 30 ürün (hedef 100 zorlanmadı), 2–4 soru, kargo/iade/doğrula yok, cevapta "?" yok, önceki 3 dalgayla çakışma 0', () => {
  const satir = (f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { handle: string; sss: Array<{ soru: string; cevap: string }> });
  const d4 = satir('994831-sss-dalga4.jsonl');
  const once = new Set([...satir('994831-sss-ilk-20.jsonl'), ...satir('994831-sss-dalga2.jsonl'), ...satir('994831-sss-dalga3.jsonl')].map((x) => x.handle));
  expect(once.size).toBe(170);
  expect(d4).toHaveLength(30);
  expect(new Set(d4.map((x) => x.handle)).size).toBe(30);
  expect(d4.filter((x) => once.has(x.handle))).toHaveLength(0);
  for (const x of d4) {
    expect(x.handle).toMatch(/^[a-z0-9-]+$/);
    expect(x.sss.length).toBeGreaterThanOrEqual(2);
    expect(x.sss.length).toBeLessThanOrEqual(4);
    for (const q of x.sss) {
      expect((q.soru + ' ' + q.cevap).toLocaleLowerCase('tr')).not.toMatch(/kargo|teslimat|iade|doğrula|teyit/); // 'İade' de yakalanır
      expect(q.cevap).not.toContain('?');
    }
  }
});

it('dalga 5 girdisi: 48 ürün (pilot 50 zorlanmadı), 2–4 soru, CEVAP AÇIKLAMADAN BİREBİR ALINTI, kargo/iade yok, önceki 4 dalgayla çakışma 0', () => {
  const satir = <T,>(f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as T);
  type S = { handle: string; sss: Array<{ soru: string; cevap: string }> };
  const d5 = satir<S>('994831-sss-dalga5.jsonl');
  const kaynak = new Map(satir<{ handle: string; baslik: string; html: string }>('994831-sss-dalga5-kaynak.jsonl').map((x) => [x.handle, x]));
  const once = new Set(['994831-sss-ilk-20.jsonl', '994831-sss-dalga2.jsonl', '994831-sss-dalga3.jsonl', '994831-sss-dalga4.jsonl'].flatMap((f) => satir<S>(f)).map((x) => x.handle));
  expect(once.size).toBe(200);
  expect(d5).toHaveLength(48);
  expect(new Set(d5.map((x) => x.handle)).size).toBe(48);
  expect(d5.filter((x) => once.has(x.handle))).toHaveLength(0);
  for (const x of d5) {
    expect(x.handle).toMatch(/^[a-z0-9-]+$/);
    expect(x.sss.length).toBeGreaterThanOrEqual(2);
    expect(x.sss.length).toBeLessThanOrEqual(4);
    const k = kaynak.get(x.handle);
    expect(k, x.handle).toBeDefined();
    // md.52: cevap, ürün açıklamasının düz metninde ALT DİZGE olarak bulunur — temizlik adımlarından (iç blok · ad tekrarı) SONRA da
    const temiz = x.handle.startsWith('pola-') ? tekrarSoy(kuyrukSoy(k!.html, k!.baslik), k!.baslik) : kuyrukSoy(k!.html, k!.baslik);
    for (const q of x.sss) {
      expect(duzMetin(k!.html), `${x.handle} · ${q.soru}`).toContain(q.cevap);
      expect(duzMetin(temiz), `${x.handle} · ${q.soru} (temizlik sonrası)`).toContain(q.cevap);
      expect((q.soru + ' ' + q.cevap).toLocaleLowerCase('tr')).not.toMatch(/kargo|teslimat|iade|doğrula|teyit/); // 'İade' de yakalanır
      expect(q.cevap).not.toContain('?');
    }
    expect(new Set(x.sss.map((q) => q.soru)).size).toBe(x.sss.length);
  }
});

it('dalga 7 girdisi: 69 ürün (tahmin ~85 zorlanmadı), 2–4 soru, CEVAP AÇIKLAMADAN BİREBİR (temizlik sonrası da), her çift eksen kapısından geçer, önceki 5 dalgayla çakışma 0', () => {
  const satir = <T,>(f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as T);
  type S = { handle: string; sss: Array<{ soru: string; cevap: string }> };
  const d7 = satir<S>('994831-sss-dalga7.jsonl');
  const kaynak = new Map(satir<{ handle: string; baslik: string; html: string }>('994831-sss-dalga7-kaynak.jsonl').map((x) => [x.handle, x]));
  const once = new Set(['994831-sss-ilk-20.jsonl', '994831-sss-dalga2.jsonl', '994831-sss-dalga3.jsonl', '994831-sss-dalga4.jsonl', '994831-sss-dalga5.jsonl'].flatMap((f) => satir<S>(f)).map((x) => x.handle));
  expect(once.size).toBe(248);
  expect(d7).toHaveLength(69);
  expect(new Set(d7.map((x) => x.handle)).size).toBe(69);
  expect(d7.filter((x) => once.has(x.handle))).toHaveLength(0);
  for (const x of d7) {
    expect(x.handle).toMatch(/^[a-z0-9-]+$/);
    expect(x.sss.length).toBeGreaterThanOrEqual(2);
    expect(x.sss.length).toBeLessThanOrEqual(4);
    expect(new Set(x.sss.map((q) => q.soru)).size).toBe(x.sss.length);
    const k = kaynak.get(x.handle)!;
    expect(k, x.handle).toBeDefined();
    const temiz = basSoy(kuyrukSoy(x.handle.startsWith('pola-') ? tekrarSoy(k.html, k.baslik) : k.html, k.baslik), k.baslik);
    for (const q of x.sss) {
      expect(duzMetin(k.html), `${x.handle} · ${q.soru}`).toContain(q.cevap);
      expect(duzMetin(temiz), `${x.handle} · ${q.soru} (temizlik sonrası)`).toContain(q.cevap);
      expect(cevapUygunMu(q.soru, q.cevap), `${x.handle} · ${q.soru} → ${q.cevap}`).toEqual({ ok: true });
      expect(UYGULANMAYAN).not.toContain(q.soru);
      expect((q.soru + ' ' + q.cevap).toLocaleLowerCase('tr')).not.toMatch(/kargo|teslimat|iade|doğrula|teyit|sipariş/);
    }
  }
});

it('dalga 8 girdisi: 9 ürün (havuz 17, hedef zorlanmadı), 2–4 soru, CEVAP GÜNCEL AÇIKLAMADAN BİREBİR, eksen kapısı, asorti/karakter sorusu yok, önceki 318 SSS\'li ürünle çakışma 0', () => {
  const satir = <T,>(f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as T);
  type S = { handle: string; sss: Array<{ soru: string; cevap: string }> };
  const d8 = satir<S>('994831-sss-dalga8.jsonl');
  const kaynak = new Map(satir<{ handle: string; baslik: string; html: string }>('994831-sss-dalga8-kaynak.jsonl').map((x) => [x.handle, x]));
  const onceki = new Set((JSON.parse(readFileSync(path.join(KOK, 'veri', '994831-sss-dalga8-onceki.json'), 'utf8')) as { handles: string[] }).handles);
  const dosyadan = ['994831-sss-ilk-20.jsonl', '994831-sss-dalga2.jsonl', '994831-sss-dalga3.jsonl', '994831-sss-dalga4.jsonl', '994831-sss-dalga5.jsonl', '994831-sss-dalga7.jsonl'].flatMap((f) => satir<S>(f)).map((x) => x.handle);
  expect(onceki.size).toBe(318);
  for (const h of dosyadan) expect(onceki.has(h), h).toBe(true);
  expect(d8).toHaveLength(9);
  expect(new Set(d8.map((x) => x.handle)).size).toBe(9);
  expect(d8.filter((x) => onceki.has(x.handle))).toHaveLength(0);
  for (const x of d8) {
    expect(x.handle).toMatch(/^[a-z0-9-]+$/);
    expect(x.sss.length).toBeGreaterThanOrEqual(2);
    expect(x.sss.length).toBeLessThanOrEqual(4);
    expect(new Set(x.sss.map((q) => q.soru)).size).toBe(x.sss.length);
    const k = kaynak.get(x.handle)!;
    expect(k, x.handle).toBeDefined();
    const asortiUrun = /değiş|rastgele|asorti|stok durum/.test(duzMetin(k.html).toLocaleLowerCase('tr'));
    for (const q of x.sss) {
      expect(duzMetin(k.html), `${x.handle} · ${q.soru}`).toContain(q.cevap);
      expect(cevapUygunMu(q.soru, q.cevap), `${x.handle} · ${q.soru} → ${q.cevap}`).toEqual({ ok: true });
      expect(UYGULANMAYAN).not.toContain(q.soru);
      expect((q.soru + ' ' + q.cevap).toLocaleLowerCase('tr')).not.toMatch(/kargo|teslimat|iade|doğrula|teyit|sipariş|değiş|rastgele|asorti|hangi (figür|karakter)/);
      if (asortiUrun) expect(q.soru).not.toBe('Pakette neler var?');
    }
  }
});

it('dalga 9 girdisi: 16 ürün (SSS\'siz 178 aktif üründen, hedef zorlanmadı), 2–4 soru, CEVAP GÜNCEL AÇIKLAMADAN BİREBİR ya da TABLO SATIRININ KENDİSİ, eksen kapısı, kargo/iade/cayma/asorti yok, önceki 327 SSS\'li ürünle çakışma 0', () => {
  const satir = <T,>(f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as T);
  type S = { handle: string; sss: Array<{ soru: string; cevap: string }> };
  const d9 = satir<S>('994831-sss-dalga9.jsonl');
  const kaynak = new Map(satir<{ handle: string; baslik: string; html: string }>('994831-sss-dalga9-kaynak.jsonl').map((x) => [x.handle, x]));
  const onceki = new Set((JSON.parse(readFileSync(path.join(KOK, 'veri', '994831-sss-dalga9-onceki.json'), 'utf8')) as { handles: string[] }).handles);
  const dosyadan = ['994831-sss-ilk-20.jsonl', '994831-sss-dalga2.jsonl', '994831-sss-dalga3.jsonl', '994831-sss-dalga4.jsonl', '994831-sss-dalga5.jsonl', '994831-sss-dalga7.jsonl', '994831-sss-dalga8.jsonl'].flatMap((f) => satir<S>(f)).map((x) => x.handle);
  const tablo = (html: string) => [...html.matchAll(/<tr[^>]*>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<\/tr>/g)].map((m) => `${duzMetin(m[1]!)}: ${duzMetin(m[2]!)}`);
  expect(onceki.size).toBe(327);
  for (const h of dosyadan) expect(onceki.has(h), h).toBe(true);
  expect(d9).toHaveLength(16);
  expect(new Set(d9.map((x) => x.handle)).size).toBe(16);
  expect(d9.filter((x) => onceki.has(x.handle))).toHaveLength(0);
  for (const x of d9) {
    expect(x.handle).toMatch(/^[a-z0-9-]+$/);
    expect(x.sss.length).toBeGreaterThanOrEqual(2);
    expect(x.sss.length).toBeLessThanOrEqual(4);
    expect(new Set(x.sss.map((q) => q.soru)).size).toBe(x.sss.length);
    const k = kaynak.get(x.handle)!;
    expect(k, x.handle).toBeDefined();
    const D = duzMetin(k.html), T = tablo(k.html);
    const asortiUrun = /değiş|rastgele|asorti|stok durum/.test(D.toLocaleLowerCase('tr'));
    for (const q of x.sss) {
      expect(D.includes(q.cevap) || T.includes(q.cevap), `${x.handle} · ${q.soru} → ${q.cevap}`).toBe(true);
      expect(cevapUygunMu(q.soru, q.cevap), `${x.handle} · ${q.soru} → ${q.cevap}`).toEqual({ ok: true });
      expect(UYGULANMAYAN).not.toContain(q.soru);
      expect((q.soru + ' ' + q.cevap).toLocaleLowerCase('tr')).not.toMatch(/kargo|teslimat|iade|cayma|doğrula|teyit|sipariş|değiş|rastgele|asorti|hangi (figür|karakter)/);
      expect(q.cevap).not.toMatch(/[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF]|[\u{1F000}-\u{1FAFF}]/u);
      if (asortiUrun) expect(q.soru).not.toBe('Pakette neler var?');
    }
  }
});
