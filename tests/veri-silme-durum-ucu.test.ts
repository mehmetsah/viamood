/**
 * #990686 madde 4 — durum sorgulama ucu çivisi.
 *
 * Bu uç KİMLİK DOĞRULAMASI İSTEMEZ (Meta'ya verilen durum URL'i açıktır), bu
 * yüzden sızıntı ayağı mutlu yoldan ÖNEMLİDİR: kod bilen kişi yalnız durumu
 * görmeli; "bu Facebook kullanıcısı bizde var mı" bilgisini GÖREMEMELİ.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const durum: { secilenAlanlar: string[]; sonuc: Record<string, unknown>[] } = {
  secilenAlanlar: [],
  sonuc: [],
};

vi.mock('@/db/schema/veri-silme', () => ({
  veriSilmeTalepleri: {
    kod: 'kod',
    provider: 'provider',
    durum: 'durum',
    createdAt: 'created_at',
    completedAt: 'completed_at',
    providerUserId: 'provider_user_id',
    userId: 'user_id',
    detay: 'detay',
  },
}));
vi.mock('drizzle-orm', () => ({ eq: (...a: unknown[]) => a }));
vi.mock('@/db/client', () => ({
  db: {
    select: (alanlar: Record<string, string>) => {
      durum.secilenAlanlar = Object.keys(alanlar ?? {});
      return { from: () => ({ where: () => ({ limit: async () => durum.sonuc }) }) };
    },
  },
}));

const { GET } = await import('@/app/api/veri-silme-durumu/route');

function istek(qs: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = new URL(`https://hesap.viamood.com.tr/api/veri-silme-durumu${qs}`);
  return { nextUrl: u } as any;
}

beforeEach(() => {
  durum.secilenAlanlar = [];
  durum.sonuc = [];
});

describe('durum ucu — mutlu yol', () => {
  it('bilinen kod 200 döner, durum ve tarihler gelir', async () => {
    durum.sonuc = [
      { kod: 'abc123abc123', provider: 'facebook', durum: 'onay-bekliyor', createdAt: new Date('2026-10-03T00:00:00Z'), completedAt: null },
    ];
    const res = await GET(istek('?kod=abc123abc123'));
    expect(res.status).toBe(200);
    const g = (await res.json()) as Record<string, unknown>;
    expect(g.ok).toBe(true);
    expect(g.durum).toBe('onay-bekliyor');
    expect(g.tamamlandi, 'silme yapılmadı ⇒ tamamlandı null kalmalı').toBeNull();
  });
});

describe('NEGATİF — sızıntı yok', () => {
  it('SEÇİLEN ALANLAR arasında provider_user_id / user_id / detay YOK', async () => {
    durum.sonuc = [{ kod: 'k', provider: 'facebook', durum: 'alindi', createdAt: new Date(), completedAt: null }];
    await GET(istek('?kod=k'));
    expect(durum.secilenAlanlar).not.toContain('providerUserId');
    expect(durum.secilenAlanlar).not.toContain('userId');
    expect(durum.secilenAlanlar, 'detay operatör notu — "bu kişi bizde var" bilgisini sızdırır')
      .not.toContain('detay');
  });

  it('bilinmeyen kod 404 ve TEK VE AYNI cümle — "yok" ile "göremezsin" ayrışmaz', async () => {
    durum.sonuc = [];
    const res = await GET(istek('?kod=olmayan-kod'));
    expect(res.status).toBe(404);
    const ham = await res.text();
    expect(ham).toContain('bulunamadı');
    expect(ham).not.toContain('yetki');
    expect(ham).not.toContain('@');
  });

  it('kod BOŞSA 400 — DB sorgusu hiç kurulmaz (tüm tabloyu seçme riski)', async () => {
    const res = await GET(istek(''));
    expect(res.status).toBe(400);
    expect(durum.secilenAlanlar, 'kod yoksa select bile çağrılmamalı').toHaveLength(0);
  });

  it('yalnız boşluktan oluşan kod da 400 (trim)', async () => {
    const res = await GET(istek('?kod=%20%20'));
    expect(res.status).toBe(400);
    expect(durum.secilenAlanlar).toHaveLength(0);
  });
});
