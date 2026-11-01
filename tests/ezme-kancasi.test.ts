/**
 * #995653 · EZME KAPISI pre-push KANCASINDA · ÇİVİ — gerçek git, gerçek push, geçici çıplak «origin».
 * Ölçülen şey çıkış kodu DEĞİL, UZAK REF'İN SHA'sı (Asistan bin/ezme-kapisi-push.test.sh dersi): boru push'un çıkış kodunu
 * gizleyebilir ama ref'i itemez.
 * Ezme betiği: kancanın kendi mantığını ölçmek için davranışı taklit eden SAPLAMA (origin/main hedefin atası değilse çıkış 1);
 * betiğin gerçeği bu makinede varsa ayrıca GERÇEK betikle de ölçülür (CI'da yok → o test atlanır, raporda yazılı).
 * MUTASYON: pipefail sökülünce · red kodu yutulunca · `exit 1` düşünce · kanca bağı kopunca · yedek/silme istisnaları bozulunca KIRILIR.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const KOK = path.join(__dirname, '..');
const KANCA = path.join(KOK, '.githooks', 'pre-push');
const GERCEK = path.join(process.env.HOME ?? '', 'asistan-veri', 'mehmet', 'araclar', 'ezme-kontrol.sh');
const SAPLAMA = `#!/bin/bash
cd "$1" || exit 2
git fetch -q origin main 2>/dev/null
echo "SAPLAMA EZME $2"
if git merge-base --is-ancestor origin/main "$2"; then echo "SONUÇ: ✅ GÜVENLİ"; exit 0; fi
echo "SONUÇ: ⛔ EZME RİSKİ"; exit 1
`;
const silinecek: string[] = [];
afterAll(() => { for (const d of silinecek) rmSync(d, { recursive: true, force: true }); });

function tezgah(o: { betik?: 'saplama' | 'gercek' | 'yok'; kanca?: boolean } = {}) {
  const kok = mkdtempSync(path.join(tmpdir(), 'ezme-kanca-')); silinecek.push(kok);
  const home = path.join(kok, 'home'), araclar = path.join(home, 'asistan-veri', 'mehmet', 'araclar');
  mkdirSync(araclar, { recursive: true });
  if ((o.betik ?? 'saplama') === 'saplama') writeFileSync(path.join(araclar, 'ezme-kontrol.sh'), SAPLAMA);
  if (o.betik === 'gercek') copyFileSync(GERCEK, path.join(araclar, 'ezme-kontrol.sh'));
  const env = { ...process.env, HOME: home, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_TERMINAL_PROMPT: '0' };
  const git = (cwd: string, ...a: string[]) => execFileSync('git', a, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const origin = path.join(kok, 'origin.git'), a = path.join(kok, 'a'), b = path.join(kok, 'b');
  git(kok, 'init', '-q', '--bare', '-b', 'main', origin);
  git(kok, 'clone', '-q', origin, a);
  writeFileSync(path.join(a, 'x.txt'), '1\n'); git(a, 'add', '.'); git(a, 'commit', '-qm', 'A'); git(a, 'push', '-q', 'origin', 'main');
  git(kok, 'clone', '-q', origin, b);
  if (o.kanca ?? true) {
    mkdirSync(path.join(a, '.githooks')); copyFileSync(KANCA, path.join(a, '.githooks', 'pre-push')); chmodSync(path.join(a, '.githooks', 'pre-push'), 0o755);
    git(a, 'config', 'core.hooksPath', '.githooks');
  }
  // a: özellik dalı (main'in A'sından) · b: main'i ileri iter → özellik dalı main'i İÇERMEZ = ezme riski
  git(a, 'checkout', '-qb', 'kod/ozellik'); writeFileSync(path.join(a, 'y.txt'), '2\n'); git(a, 'add', 'y.txt'); git(a, 'commit', '-qm', 'B');
  writeFileSync(path.join(b, 'z.txt'), '3\n'); git(b, 'add', '.'); git(b, 'commit', '-qm', 'C'); git(b, 'push', '-q', 'origin', 'main');
  const uzak = (ref: string) => git(a, 'ls-remote', 'origin', ref).split(/\s+/)[0] ?? '';
  const kabuk = (komut: string) => spawnSync('bash', ['-c', komut], { cwd: a, env, encoding: 'utf8' });
  return { kok, home, a, git, uzak, kabuk, log: () => readFileSync(path.join(a, '.git', 'ezme-kapisi.log'), 'utf8') };
}

describe('ezme kapısı kancada — çağrılmayı beklemez', () => {
  it('POZİTİF: ezme riski varken `git push … | tail` BORUDAN geçse bile uzak ref OLUŞMAZ (çıkış kodu yutulsa da)', () => {
    const t = tezgah();
    const r = t.kabuk('git push origin kod/ozellik 2>&1 | tail -3');
    expect(r.status).toBe(0); // boru çıkış kodunu yuttu — olay tam olarak buydu
    expect(t.uzak('refs/heads/kod/ozellik')).toBe('');
    const r2 = t.kabuk('git push origin kod/ozellik');
    expect(r2.status).not.toBe(0);
    expect(r2.stderr).toContain('EZME KAPISI — PUSH ENGELLENDİ');
    expect(t.log()).toContain('SONUÇ: ⛔ EZME RİSKİ');
  });
  it('`;` ve `|| true` kalıpları da ref\'i itemez', () => {
    const t = tezgah();
    t.kabuk('git push origin kod/ozellik || true; true');
    expect(t.uzak('refs/heads/kod/ozellik')).toBe('');
  });
  it('doğru hamle: `git merge origin/main` sonrası push GEÇER ve uzak ref = yerel tepe', () => {
    const t = tezgah();
    t.git(t.a, 'fetch', '-q', 'origin'); t.git(t.a, 'merge', '-q', '--no-edit', 'origin/main');
    const r = t.kabuk('git push origin kod/ozellik');
    expect(r.status).toBe(0);
    expect(t.uzak('refs/heads/kod/ozellik')).toBe(t.git(t.a, 'rev-parse', 'HEAD'));
  });
  it('NEGATİF KONTROL: kanca BAĞLI DEĞİLKEN aynı riskli push GEÇER — yani durduran şey kancadır', () => {
    const t = tezgah({ kanca: false });
    expect(t.kabuk('git push origin kod/ozellik').status).toBe(0);
    expect(t.uzak('refs/heads/kod/ozellik')).toBe(t.git(t.a, 'rev-parse', 'HEAD'));
  });
  it('yedek/* push\'u ezme riskinde de GEÇER (yedeksiz commit kaybını kapı üretmesin)', () => {
    const t = tezgah();
    expect(t.kabuk('git push origin HEAD:refs/heads/yedek/ozellik-20261101').status).toBe(0);
    expect(t.uzak('refs/heads/yedek/ozellik-20261101')).toBe(t.git(t.a, 'rev-parse', 'HEAD'));
  });
  it('başka dalı silmek GEÇER; main\'i silmek ENGELLENİR', () => {
    const t = tezgah();
    t.kabuk('git push origin HEAD:refs/heads/yedek/x'); // silinecek bir dal
    expect(t.kabuk('git push origin --delete yedek/x').status).toBe(0);
    expect(t.uzak('refs/heads/yedek/x')).toBe('');
    // Sunucunun kendi freni (receive.denyDeleteCurrent) kapatılır: durduran YALNIZ kanca olmalı (ilk mutasyon koşusu bunu ölçtü).
    t.git(path.join(t.kok, 'origin.git'), 'config', 'receive.denyDeleteCurrent', 'ignore');
    const once = t.uzak('refs/heads/main');
    const r = t.kabuk('git push origin --delete main');
    expect(r.stderr).toContain('main ref\'ini SİLEN push');
    expect(r.status).not.toBe(0);
    expect(t.uzak('refs/heads/main')).toBe(once);
  });
  it('ezme betiği yoksa push ENGELLENMEZ ama uyarı basılır (Asistan kancasıyla aynı karar: CI/taze klon kilitlenmesin)', () => {
    const t = tezgah({ betik: 'yok' });
    const r = t.kabuk('git push origin kod/ozellik');
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('EZME KAPISI ÖLÇEMEDİ');
  });
  it.skipIf(!existsSync(GERCEK))('GERÇEK ezme-kontrol.sh ile: main ilerlemişken dal push\'u durur, merge sonrası geçer', () => {
    const t = tezgah({ betik: 'gercek' });
    t.kabuk('git push origin kod/ozellik 2>&1 | tail -1');
    expect(t.uzak('refs/heads/kod/ozellik')).toBe('');
    expect(t.log()).toContain('EZME RİSKİ');
    t.git(t.a, 'fetch', '-q', 'origin'); t.git(t.a, 'merge', '-q', '--no-edit', 'origin/main');
    expect(t.kabuk('git push origin kod/ozellik').status).toBe(0);
    expect(t.uzak('refs/heads/kod/ozellik')).toBe(t.git(t.a, 'rev-parse', 'HEAD'));
  });
});

describe('kanca bağı ve içerik', () => {
  it('scripts/kancalari-kur.sh core.hooksPath\'i `.githooks` yapar (gerçek bir depoda ölçülür)', () => {
    const kok = mkdtempSync(path.join(tmpdir(), 'kanca-kur-')); silinecek.push(kok);
    execFileSync('git', ['init', '-q', kok]);
    mkdirSync(path.join(kok, 'scripts')); mkdirSync(path.join(kok, '.githooks'));
    copyFileSync(path.join(KOK, 'scripts', 'kancalari-kur.sh'), path.join(kok, 'scripts', 'kancalari-kur.sh'));
    copyFileSync(KANCA, path.join(kok, '.githooks', 'pre-push'));
    execFileSync('git', ['-C', kok, 'config', 'core.hooksPath', '/baska/genel/dizin']);
    execFileSync('bash', [path.join(kok, 'scripts', 'kancalari-kur.sh')]);
    expect(execFileSync('git', ['-C', kok, 'config', 'core.hooksPath'], { encoding: 'utf8' }).trim()).toBe('.githooks');
  });
  const k = readFileSync(KANCA, 'utf8');
  it('sıra: ezme kapısı → tip kapısı → Okan kaydı; Okan kaydı asla durdurmaz; tip kapısı korunmuş', () => {
    const e = k.indexOf('EZME KAPISI: ÇAĞRILMAYI BEKLEMEZ'), t = k.indexOf('npx tsc --noEmit -p tsconfig.deploy.json'), o = k.indexOf('githooks-genel/pre-push');
    expect(e).toBeGreaterThan(0); expect(t).toBeGreaterThan(e); expect(o).toBeGreaterThan(t);
    expect(k).toContain('bash "$_genel" "$@" <<< "$_girdi" || true');
  });
  it('kapatma bayrağı YOK', () => {
    expect(k).not.toMatch(/EZME[_A-Z]*(KAPALI|ATLA|ZORLA)|SKIP/);
  });
});
