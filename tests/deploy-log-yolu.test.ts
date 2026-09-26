/**
 * DEPLOY LOG YOLU ÇİVİSİ — "yanlış etiketlenmiş hata" bir daha üç saat yemesin.
 *
 * ÖLÇÜLEN ARIZA (25 Eyl 2026): deploy 13 saniyede "BUILD FAİL" yazıyordu ama
 * `npm run build` HİÇ KOŞMAMIŞTI. Sebep: `> /tmp/viamood-build.log` hedefi root'a
 * aitti (644), deploy'u koşan `ubuntu` yazamıyordu; yönlendirme açılamayınca bash
 * komutu hiç çalıştırmadan hata dalına giriyor ve ekrana ÜÇ SAAT ÖNCEKİ bayat log
 * basılıyordu. Hata gerçek değildi — ETİKETİ yanlıştı.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const KOK = path.resolve(__dirname, '..');
const DEPLOY = readFileSync(path.join(KOK, 'scripts/deploy.sh'), 'utf8');
const AUTO = readFileSync(path.join(KOK, 'scripts/auto-deploy.sh'), 'utf8');

describe('deploy log yolu — sahiplik kilidi tuzağı', () => {
  /** Yorumlar ölçülmez: tuzağı ANLATAN açıklama, tuzağı işlemiş sayılmasın. */
  const kod = (s: string) => s.replace(/^\s*#.*$/gm, '');

  it('log yolları sabit /tmp/viamood-*.log DEĞİL, kullanıcıya ait dizinde', () => {
    for (const [ad, ham] of [['deploy.sh', DEPLOY], ['auto-deploy.sh', AUTO]] as const) {
      const s = kod(ham);
      expect(s, `${ad}: sabit /tmp log yolu geri gelmiş`).not.toMatch(/>\s*\/tmp\/viamood-[a-z]+\.log/);
      expect(s, `${ad}: LOG_DIR yok`).toMatch(/LOG_DIR="\$\{LOG_DIR:-\$HOME\/\.viamood-log\}"/);
      expect(s, `${ad}: mkdir -p yok`).toMatch(/mkdir -p "\$LOG_DIR"/);
    }
  });

  it('yazılabilirlik ÖNCEDEN sınanıyor ve hata AÇIKÇA etiketleniyor', () => {
    expect(DEPLOY).toMatch(/if ! : > "\$_l" 2>\/dev\/null; then/);
    expect(DEPLOY, '"LOG AÇILAMADI" etiketi yok — hata yine "build fail" sanılır').toContain(
      'BUILD LOGU AÇILAMADI',
    );
    // Ayrı çıkış kodu: build hatasından (1) ayırt edilebilmeli.
    const i = DEPLOY.indexOf('BUILD LOGU AÇILAMADI');
    expect(DEPLOY.slice(i, i + 400), 'ayrı çıkış kodu yok').toMatch(/exit 3/);
  });

  it('hata mesajı sahip + koşan kullanıcıyı yazıyor (teşhis tek bakışta)', () => {
    const i = DEPLOY.indexOf('BUILD LOGU AÇILAMADI');
    const blok = DEPLOY.slice(i, i + 400);
    expect(blok).toMatch(/stat -c '%U:%G %a'/);
    expect(blok).toMatch(/id -un/);
  });

  it('kilit dosyası da sessizce düşmüyor (log tuzağının kardeşi)', () => {
    expect(DEPLOY).toContain('KİLİT DOSYASI AÇILAMADI');
    const i = DEPLOY.indexOf('KİLİT DOSYASI AÇILAMADI');
    expect(DEPLOY.slice(i, i + 300)).toMatch(/exit 4/);
  });

  it('kilit yolu PAYLAŞILAN kalıyor (kullanıcıya özel yapılırsa kilit işlevsizleşir)', () => {
    expect(DEPLOY).toMatch(/9>\/tmp\/viamood-autodeploy\.lock/);
  });
});
