/**
 * ÇİVİ — Apple girişi iskeleti.
 *
 * Apple'ın kritik farkı: client_secret sabit bir dize DEĞİL, `.p8` anahtarıyla
 * imzalanmış ES256 JWT'dir. Yanlış üretilirse hata mesajı Apple tarafında
 * "invalid_client" olarak kalır ve bizim log'umuzda hiçbir iz bırakmaz —
 * yani gözle yakalanamaz. Bu yüzden imza burada GERÇEKTEN DOĞRULANIR.
 */
import { createVerify, generateKeyPairSync, createPublicKey } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { appleClientSecret, appleSecretOnbellegiTemizle } from '../src/lib/auth/apple-secret';

/** Apple'ınkiyle aynı eğri: P-256 (prime256v1), PKCS#8 PEM. */
function testAnahtari() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKey, publicKey };
}

const KIMLIK = { clientId: 'com.viamood.giris', teamId: 'ABCDE12345', keyId: 'KEY1234567' };

function coz(jwt: string) {
  const [h, p] = jwt.split('.');
  return {
    baslik: JSON.parse(Buffer.from(h, 'base64url').toString()),
    govde: JSON.parse(Buffer.from(p, 'base64url').toString()),
  };
}

describe('Apple client secret (ES256 JWT)', () => {
  beforeEach(() => appleSecretOnbellegiTemizle());

  it('üç parçalı JWT üretir', () => {
    const { privateKey } = testAnahtari();
    const jwt = appleClientSecret({ ...KIMLIK, privateKey });
    expect(jwt.split('.')).toHaveLength(3);
  });

  it('başlık ES256 + kid taşır (Apple bunları arar)', () => {
    const { privateKey } = testAnahtari();
    const { baslik } = coz(appleClientSecret({ ...KIMLIK, privateKey }));
    expect(baslik.alg).toBe('ES256');
    expect(baslik.kid).toBe(KIMLIK.keyId);
  });

  it('gövde Apple sözleşmesine uyar: iss=Team, sub=Service ID, aud=appleid', () => {
    const { privateKey } = testAnahtari();
    const { govde } = coz(appleClientSecret({ ...KIMLIK, privateKey }));
    expect(govde.iss).toBe(KIMLIK.teamId);
    expect(govde.sub).toBe(KIMLIK.clientId);
    expect(govde.aud).toBe('https://appleid.apple.com');
  });

  it('süre Apple üst sınırı olan 6 AYI AŞMAZ', () => {
    // Apple 6 aydan uzun exp taşıyan secret'ı reddeder; aşarsak giriş HİÇ açılmaz.
    const { privateKey } = testAnahtari();
    const { govde } = coz(appleClientSecret({ ...KIMLIK, privateKey }));
    expect(govde.exp - govde.iat).toBeLessThanOrEqual(15777000);
    expect(govde.exp - govde.iat).toBeGreaterThan(30 * 24 * 3600); // anlamsız kısa da olmasın
  });

  it('İMZA GERÇEKTEN DOĞRULANIR — ham (r‖s) biçimde, DER değil', () => {
    // Node varsayılanı DER üretir; Apple onu reddeder ve hata bize dönmez.
    const { privateKey, publicKey } = testAnahtari();
    const jwt = appleClientSecret({ ...KIMLIK, privateKey });
    const [h, p, s] = jwt.split('.');
    const dogrulayici = createVerify('sha256');
    dogrulayici.update(`${h}.${p}`);
    const gecerli = dogrulayici.verify(
      { key: createPublicKey(publicKey), dsaEncoding: 'ieee-p1363' },
      Buffer.from(s, 'base64url'),
    );
    expect(gecerli).toBe(true);
    // ham ES256 imzası tam 64 bayttır (r 32 + s 32)
    expect(Buffer.from(s, 'base64url')).toHaveLength(64);
  });

  it('env değişkenlerindeki KAÇIŞLI \\n satır sonlarını çözer', () => {
    // .p8 env'e tek satır olarak konur; ham hâliyle verilirse createPrivateKey
    // fırlatır ve giriş sebebi görünmeyen bir 500 ile düşer.
    const { privateKey } = testAnahtari();
    const kacisli = privateKey.replace(/\n/g, '\\n');
    expect(() => appleClientSecret({ ...KIMLIK, privateKey: kacisli })).not.toThrow();
  });

  it('kimlik değişince önbellekten ESKİ secret dönmez', () => {
    const a = testAnahtari();
    const ilk = appleClientSecret({ ...KIMLIK, privateKey: a.privateKey });
    const ikinci = appleClientSecret({
      ...KIMLIK,
      clientId: 'com.viamood.baska',
      privateKey: a.privateKey,
    });
    expect(coz(ikinci).govde.sub).toBe('com.viamood.baska');
    expect(ikinci).not.toBe(ilk);
  });

  it('bozuk anahtar fırlatır — çağıran tarafta yakalanıp Apple kapalı kalır', () => {
    expect(() => appleClientSecret({ ...KIMLIK, privateKey: 'bu bir anahtar degil' })).toThrow();
  });
});
