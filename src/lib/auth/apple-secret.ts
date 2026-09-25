/**
 * APPLE CLIENT SECRET — üretilir, yapıştırılmaz.
 *
 * Apple, Google/Facebook'tan YAPISAL OLARAK farklıdır: "client secret" diye
 * sabit bir dize vermez. Secret, Apple'ın verdiği `.p8` özel anahtarıyla
 * İMZALANMIŞ bir JWT'dir ve **en fazla 6 ay** geçerlidir.
 *
 * Bunu elle üretip panele yapıştırmak, 6 ay sonra "giriş bir sabah çalışmayı
 * bıraktı" arızasını garanti eder — kimse süreyi takvime yazmaz. Bu yüzden
 * anahtarı saklayıp secret'ı HER SEFERİNDE BİZ üretiyoruz.
 *
 * ⚠ Bu modül NODE runtime'a aittir (node:crypto). Edge'den çağırma.
 */
import { createPrivateKey, sign as imzala } from 'node:crypto';

/** Apple'ın üst sınırı 6 ay (15777000 sn). Yenileme payı için 150 gün veriyoruz. */
const OMUR_SN = 150 * 24 * 60 * 60;
/** Süre dolmadan bu kadar önce yeniden üret (saat cinsinden sapmalara pay). */
const YENILE_PAYI_SN = 24 * 60 * 60;

export type AppleAnahtar = {
  /** Service ID — Apple'da "Identifier" (ör. com.viamood.giris). App ID DEĞİL. */
  clientId: string;
  /** Apple Developer hesabının Team ID'si (10 karakter). */
  teamId: string;
  /** .p8 anahtarının Key ID'si (10 karakter). */
  keyId: string;
  /** .p8 dosyasının İÇERİĞİ (PKCS#8 PEM). */
  privateKey: string;
};

function b64url(veri: Buffer | string): string {
  return Buffer.from(veri).toString('base64url');
}

/**
 * `.p8` içeriğini normalize eder.
 * Env değişkenlerinde satır sonları çoğu zaman `\n` olarak KAÇIŞLI gelir;
 * ham hâliyle verilirse createPrivateKey "unsupported" der ve giriş, sebebi
 * görünmeyen bir 500 ile düşer.
 */
function anahtariNormalize(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

let onbellek: { secret: string; expSn: number; imza: string } | null = null;

/**
 * Apple için client_secret JWT'si üretir (ES256).
 *
 * Aynı kimlikler için sonuç önbelleklenir; süre dolmaya yaklaşınca
 * kendiliğinden yenilenir. Yani "6 ayda bir elle yenile" işi ORTADAN KALKAR.
 */
export function appleClientSecret(a: AppleAnahtar): string {
  const simdi = Math.floor(Date.now() / 1000);
  // Kimlikler değişirse (panelden güncellendi) önbellek geçersizdir.
  const imza = `${a.clientId}|${a.teamId}|${a.keyId}|${a.privateKey.length}`;
  if (onbellek && onbellek.imza === imza && onbellek.expSn - YENILE_PAYI_SN > simdi) {
    return onbellek.secret;
  }

  const exp = simdi + OMUR_SN;
  const basliklar = b64url(JSON.stringify({ alg: 'ES256', kid: a.keyId, typ: 'JWT' }));
  const govde = b64url(
    JSON.stringify({
      iss: a.teamId,
      iat: simdi,
      exp,
      aud: 'https://appleid.apple.com',
      sub: a.clientId,
    }),
  );
  const imzalanacak = `${basliklar}.${govde}`;

  const key = createPrivateKey(anahtariNormalize(a.privateKey));
  // JOSE ham (r‖s) imza ister; Node varsayılanı DER üretir ve Apple onu REDDEDER.
  // `ieee-p1363` tam olarak JOSE'nin beklediği biçimdir — elle dönüştürme gerekmez.
  const imzaBytes = imzala('sha256', Buffer.from(imzalanacak), {
    key,
    dsaEncoding: 'ieee-p1363',
  });

  const secret = `${imzalanacak}.${b64url(imzaBytes)}`;
  onbellek = { secret, expSn: exp, imza };
  return secret;
}

/** Test/teşhis için: önbelleği boşalt. */
export function appleSecretOnbellegiTemizle(): void {
  onbellek = null;
}
