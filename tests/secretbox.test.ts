import { beforeAll, describe, expect, it } from 'vitest';
import { _resetKeyCache, decryptSecret, encryptSecret } from '../src/lib/crypto/secretbox';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long!!';
  _resetKeyCache();
});

describe('secretbox (AES-256-GCM)', () => {
  it('şifrele→çöz roundtrip aynı metni verir', () => {
    const plain = JSON.stringify({ apiKey: 'AK-123', secretKey: 'SK-xyz-#/=' });
    const enc = encryptSecret(plain);
    expect(enc).not.toContain('AK-123');
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('aynı girdi farklı IV → farklı ciphertext (rastgele IV)', () => {
    const a = encryptSecret('aynı');
    const b = encryptSecret('aynı');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('aynı');
    expect(decryptSecret(b)).toBe('aynı');
  });

  it('format iv:tag:cipher (3 parça, base64)', () => {
    const parts = encryptSecret('x').split(':');
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(p).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('oynanmış ciphertext GCM auth ile reddedilir (throw)', () => {
    const enc = encryptSecret('gizli');
    const [iv, tag, data] = enc.split(':');
    const tampered = [iv, tag, Buffer.from('BOZUK-VERI').toString('base64')].join(':');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('geçersiz format reddedilir', () => {
    expect(() => decryptSecret('sadece-bir-parca')).toThrow(/geçersiz/i);
  });

  it('unicode/türkçe karakter korunur', () => {
    const plain = 'şifre-çğüöı-İĞ';
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });
});
