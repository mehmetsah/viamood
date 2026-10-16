/**
 * ÇİVİ — scripts/eposta-akis-kur.sh GERÇEKTEN idempotent mi? (#994057)
 *
 * Betik üretimde deploy borusundan koşacak ve PROD ORTAM DOSYASINA dokunacak.
 * O yüzden "okudum, idempotent görünüyor" yetmez: betik burada KUM HAVUZUNDA
 * koşturulur — sahte .env.production, sahte `crontab`, sahte `curl`.
 *
 * md.47 dersi: çağıran olmadan yargıç yazmak bu deponun en sık arızası; bu
 * betiğin kendisi o çağırandır, bozulursa akış sessizce durur.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BETIK = join(__dirname, '..', 'scripts', 'eposta-akis-kur.sh');

/** Kum havuzu: sahte uygulama dizini + PATH'e sahte crontab/curl. */
function kumHavuzu(envIcerik: string) {
  const kok = mkdtempSync(join(tmpdir(), 'akis-kur-'));
  const uyg = join(kok, 'uygulama');
  const bin = join(kok, 'bin');
  const log = join(kok, 'log');
  mkdirSync(uyg); mkdirSync(bin); mkdirSync(log);
  writeFileSync(join(uyg, '.env.production'), envIcerik);
  // sahte crontab: dosyada tutar (-l okur, '-' yazar)
  const cronDosya = join(kok, 'crontab.txt');
  writeFileSync(cronDosya, '');
  writeFileSync(join(bin, 'crontab'), `#!/bin/bash
if [ "\${1:-}" = "-l" ]; then cat "${cronDosya}"; exit 0; fi
if [ "\${1:-}" = "-" ]; then cat > "${cronDosya}"; exit 0; fi
exit 0
`);
  writeFileSync(join(bin, 'curl'), `#!/bin/bash\necho '{"ok":true,"aktif":true,"prova":true}'\nexit 0\n`);
  chmodSync(join(bin, 'crontab'), 0o755); chmodSync(join(bin, 'curl'), 0o755);
  const kos = () => execFileSync('bash', [BETIK], {
    env: { ...process.env, UYG_DIZIN: uyg, LOG_DIR: log, HOME: kok, PATH: `${bin}:${process.env.PATH}` },
    encoding: 'utf8',
  });
  const env = () => readFileSync(join(uyg, '.env.production'), 'utf8');
  const cron = () => readFileSync(cronDosya, 'utf8');
  const yedekler = () => readdirSync(uyg).filter((f) => f.includes('.yedek-'));
  return { kos, env, cron, yedekler };
}

describe('eposta-akis-kur.sh — idempotans', () => {
  it('bayrak YOKSA ekler, ve İKİNCİ koşuda TEKRAR EKLEMEZ', () => {
    const k = kumHavuzu('DATABASE_URL=x\nINTERNAL_API_KEY=abc\n');
    k.kos();
    expect(k.env()).toContain('EPOSTA_AKIS_AKTIF=1');
    k.kos();
    const kez = (k.env().match(/^\s*EPOSTA_AKIS_AKTIF=/gm) || []).length;
    expect(kez).toBe(1);                       // idempotans
  });

  it('bayrak VARSA değerine DOKUNMAZ — sahibin kapatma kararı ezilmez', () => {
    const k = kumHavuzu('INTERNAL_API_KEY=abc\nEPOSTA_AKIS_AKTIF=0\n');
    k.kos(); k.kos();
    expect(k.env()).toContain('EPOSTA_AKIS_AKTIF=0');
    expect(k.env()).not.toContain('EPOSTA_AKIS_AKTIF=1');
  });

  it('ortam dosyasına dokunmadan ÖNCE yedek alır', () => {
    const k = kumHavuzu('INTERNAL_API_KEY=abc\n');
    k.kos();
    expect(k.yedekler().length).toBe(1);
  });

  it('var olan satırları SİLMEZ/DEĞİŞTİRMEZ', () => {
    const k = kumHavuzu('DATABASE_URL=postgres://x\nINTERNAL_API_KEY=abc\nFOO=bar\n');
    k.kos();
    expect(k.env()).toContain('DATABASE_URL=postgres://x');
    expect(k.env()).toContain('FOO=bar');
  });

  it('cron satırını bir KEZ ekler, ikinci koşuda çoğaltmaz', () => {
    const k = kumHavuzu('INTERNAL_API_KEY=abc\n');
    k.kos(); k.kos(); k.kos();
    const kez = (k.cron().match(/api\/cron\/eposta-akis/g) || []).length;
    expect(kez).toBe(1);
    expect(k.cron()).toContain('*/15 * * * *');
  });

  it('GÜVENLİK: anahtar cron satırına GÖMÜLMEZ — çalışma anında okunur', () => {
    const k = kumHavuzu('INTERNAL_API_KEY=cok-gizli-deger\n');
    k.kos();
    expect(k.cron()).not.toContain('cok-gizli-deger');
    expect(k.cron()).toContain('$INTERNAL_API_KEY');
  });

  it('ortam dosyası YOKSA sessizce çıkar (deploy düşmez)', () => {
    const kok = mkdtempSync(join(tmpdir(), 'akis-bos-'));
    const cikti = execFileSync('bash', [BETIK], {
      env: { ...process.env, UYG_DIZIN: join(kok, 'yok'), LOG_DIR: kok, HOME: kok },
      encoding: 'utf8',
    });
    expect(cikti).toContain('kurulum atlandı');
  });

  it('deploy.sh betiği BEST-EFFORT çağırıyor (deploy’u düşüremez)', () => {
    const d = readFileSync(join(__dirname, '..', 'scripts', 'deploy.sh'), 'utf8');
    expect(d).toContain('bash scripts/eposta-akis-kur.sh ||');
  });
});
