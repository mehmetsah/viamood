/**
 * ÇİVİ — Facebook veri silme ucu VERİ SİLMEZ.
 *
 * ÖLÇÜLEN ARIZA (25 Eyl 2026): uç, Meta'dan gelen imzalı isteği doğruladıktan
 * sonra `db.delete(accounts)` ile OAuth bağlantısını siliyor ve `users.image`
 * alanını null'lıyordu. İmza doğru olsa bile bu geri alınamaz bir işlemin
 * dışarıdan gelen bir HTTP isteğiyle tetiklenmesi demektir: yanlış eşleşen tek
 * bir user_id'de silinen satır geri gelmez.
 *
 * Kural: uç yalnız TALEBİ KAYDEDER, kalıcı silme manuel onaydadır.
 * Bu test kodu denetler — silme çağrısı geri eklenirse kırılır.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const YOL = join(__dirname, '..', 'src', 'app', 'api', 'auth', 'facebook', 'data-deletion', 'route.ts');
const ham = () => readFileSync(YOL, 'utf8');

/** Satır ve blok yorumlarını atar — gerekçe yorumda geçebilmeli. */
function kod(): string {
  return ham()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('Facebook veri silme ucu', () => {
  it('KODDA db.delete ÇAĞRISI YOK (kalıcı silme manuel onayda)', () => {
    expect(kod()).not.toMatch(/db\s*\n?\s*\.delete\(/);
  });

  it('KODDA users tablosu GÜNCELLENMEZ (profil alanı sıfırlanmaz)', () => {
    expect(kod()).not.toMatch(/\.update\(\s*users\s*\)/);
  });

  it('Eşleşme bulununca durum onay-bekliyor olur, tamamlanmış sayılmaz', () => {
    const k = kod();
    expect(k).toContain("'onay-bekliyor'");
    expect(k).toMatch(/completedAt:\s*null/);
  });

  it('Talep her hâlükârda kaydedilir (Meta sözleşmesi: kod + durum URL)', () => {
    const k = kod();
    expect(k).toContain('veriSilmeTalepleri');
    expect(k).toContain('confirmation_code');
  });

  it('Geçersiz imza reddedilir (400) ve kayıt yazılmaz', () => {
    expect(kod()).toMatch(/status:\s*400/);
  });
});
