/**
 * Küçük simetrik "secret box" — pazaryeri API kredensiyellerini at-rest şifreler.
 *
 * AES-256-GCM (authenticated) + AUTH_SECRET'ten scrypt ile türetilen 32-byte anahtar.
 * Format: `base64(iv):base64(tag):base64(ciphertext)`. IV her şifrelemede rastgele.
 *
 * Neden env AUTH_SECRET türevi: yeni bir prod env değişkeni gerektirmez; AUTH_SECRET
 * zaten zorunlu (>=32 char) ve rotasyonu bilinçli bir işlemdir. İleride ayrılmak
 * istenirse INTEGRATION_ENC_KEY eklenip getKey() değiştirilebilir.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KDF_SALT = 'viamood/vendor-integrations/v1';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'secretbox: AUTH_SECRET (>=32 karakter) gerekli — entegrasyon şifreleme anahtarı bundan türetilir.',
    );
  }
  cachedKey = scryptSync(secret, KDF_SALT, 32);
  return cachedKey;
}

/** Düz metni şifreler → `iv:tag:cipher` (base64). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

/** `iv:tag:cipher` (base64) → düz metin. Bozulmuş/oynanmış veri GCM ile yakalanır (throw). */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('secretbox: geçersiz şifreli veri formatı (iv:tag:cipher bekleniyor)');
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}

/** Test/rotasyon için anahtar önbelleğini sıfırlar. */
export function _resetKeyCache(): void {
  cachedKey = null;
}
