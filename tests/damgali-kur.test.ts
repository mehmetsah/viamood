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

for (const betik of ['sss-ilk-20-kur.sh', 'aciklama-ic-not-kur.sh']) {
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
});
