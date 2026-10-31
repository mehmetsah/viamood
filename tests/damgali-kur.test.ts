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

for (const betik of ['sss-ilk-20-kur.sh', 'aciklama-ic-not-kur.sh', 'sss-dalga2-kur.sh']) {
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
    for (const q of x.sss) expect(q.soru + ' ' + q.cevap).not.toMatch(/kargo|teslimat|iade/i);
  }
});
