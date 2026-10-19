import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { imzaGecerliMi } from '@/lib/reviews/verify';

const KEY = 'a'.repeat(64);
const EPOSTA = 'musteri@example.com';
const imzala = () => createHmac('sha256', KEY).update(EPOSTA).digest('hex');

describe('yorum imzası, gizli anahtar ve teslim kanıtı', () => {
  it('yalnız doğru uzunlukta, gizli anahtarlı HMAC geçerli', () => {
    expect(imzaGecerliMi(EPOSTA, imzala(), KEY)).toBe(true);
    expect(imzaGecerliMi(' MUSTERI@example.com ', imzala(), KEY)).toBe(true);
    expect(imzaGecerliMi(EPOSTA, imzala(), '')).toBe(false);
    expect(imzaGecerliMi(EPOSTA, imzala(), 'kisa')).toBe(false);
    expect(imzaGecerliMi(EPOSTA, imzala().slice(0, 60), KEY)).toBe(false);
    expect(imzaGecerliMi(EPOSTA, imzala() + '00', KEY)).toBe(false);
    expect(imzaGecerliMi(EPOSTA, 'x'.repeat(64), KEY)).toBe(false);
    expect(imzaGecerliMi('baska@example.com', imzala(), KEY)).toBe(false);
  });

  it('public repoya gömülü eski anahtara geri dönüş yok; sadece TESLİM kanıtıyla verified', () => {
    const route = readFileSync(join(__dirname, '..', 'src', 'app', 'api', 'v1', 'storefront', 'reviews', 'route.ts'), 'utf8');
    expect(route).toContain("process.env.STOREFRONT_BRIDGE_KEY ?? ''");
    expect(route).not.toContain('15e66ee567ae0186394a79588f077a84ba483c8f341508f237bd5f7500524734');
    expect(route).toContain("eq(orderLineItems.status, 'delivered')");
    expect(route).toContain("eq(orders.fulfillmentStatus, 'fulfilled')");
    expect(route).toContain('eq(products.shopifyHandle, productHandle)');
    expect(route).toContain("status: 'pending'");
    expect(route).toContain("status: 429");
  });
});
