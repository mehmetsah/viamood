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

for (const betik of ['sss-ilk-20-kur.sh', 'aciklama-ic-not-kur.sh', 'sss-dalga2-kur.sh', 'aciklama-ic-baslik-kur.sh', 'sss-dalga3-kur.sh', 'aciklama-baslik-tekrar-kur.sh', 'sss-dalga4-kur.sh', 'aciklama-pazar-blok-kur.sh', 'aciklama-baslik-tekrar-2-kur.sh', 'sss-dalga5-kur.sh']) {
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
  for (const k of ['aciklama-pazar-blok-kur.sh', 'aciklama-baslik-tekrar-2-kur.sh', 'sss-dalga5-kur.sh']) expect(s).toContain(`bash scripts/${k} || echo`);
  // dalga 5 cevapları temizlenmiş gövdeden alıntı: iki temizlik adımı SSS'ten ÖNCE koşar
  expect(s.indexOf('aciklama-pazar-blok-kur.sh')).toBeLessThan(s.indexOf('sss-dalga5-kur.sh'));
  expect(s.indexOf('aciklama-baslik-tekrar-2-kur.sh')).toBeLessThan(s.indexOf('sss-dalga5-kur.sh'));
  expect(s.indexOf('sss-dalga4-kur.sh')).toBeLessThan(s.indexOf('aciklama-pazar-blok-kur.sh'));
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
