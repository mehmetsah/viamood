/**
 * #992317 · YENİ KİŞİ DALI + B ŞIKKI ÇİVİSİ.
 * Ölçülen kusur: `davetTuket` içinde `userId` NULL ise HİÇBİR ŞEY yapılmıyor,
 * users satırı açılmıyor ama yine `{ok:true}` dönüyordu — sessiz başarı.
 * Ayrıca `sss_editor` `user_role` enum'unda YOK; o role users.role'e YAZILMAMALI.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SERVIS = readFileSync('src/lib/davet-servis.ts', 'utf8');
const SAYFA = readFileSync('src/app/auth/davet/page.tsx', 'utf8');

// ⚠ `davet-servis.ts` IMPORT EDİLMEZ: o modül `@/db/client`i çeker ve test ortamında
// DATABASE_URL yok (gerçek DB'ye bağlanmak zaten istenmez). Bu yüzden değişmezler
// KAYNAK METNİ üzerinden ölçülür — bölge kilidi deseni.
describe('B ŞIKKI — sss_editor users.role’e YAZILMAZ', () => {
  it('sss_editor → dbRol customer, yetki ayrı satır', () => {
    expect(SERVIS).toMatch(/rol === 'sss_editor'[\s\S]{0,120}dbRol: 'customer'/);
    expect(SERVIS).toMatch(/ekYetki: SSS_EDITOR/);
  });
  it('NEGATİF: admin ve super_admin davet beyaz listesinde YOK', () => {
    const m = SERVIS.match(/DAVET_EDILEBILIR_ROLLER = \[([^\]]*)\]/);
    expect(m, 'beyaz liste bulunamadı').toBeTruthy();
    expect(m![1]).not.toContain("'admin'");
    expect(m![1]).not.toContain("'super_admin'");
    expect(m![1]).toContain("'sss_editor'");
  });
  it('users insert’inde rol dbRol’dan gelir — ham davet rolü DEĞİL', () => {
    expect(SERVIS).toContain('values({ email: kayit.email, passwordHash, role: dbRol })');
  });
});

describe('yeni kişi dalı kaynakta GERÇEKTEN var', () => {
  it('userId NULL dalı users insert ediyor (eskiden hiç yoktu)', () => {
    expect(SERVIS).toMatch(/\}\s*else\s*\{/);
    expect(SERVIS).toContain('tx.insert(users)');
  });
  it('TEK İŞLEM (transaction) içinde', () => {
    expect(SERVIS).toContain('db.transaction(');
  });
  it('e-posta çakışmasında MEVCUT kullanıcıya bağlanır', () => {
    expect(SERVIS).toContain('eq(users.email, kayit.email)');
  });
  it('yetki satırı yazılıyor ve çakışma işlemi düşürmüyor', () => {
    expect(SERVIS).toContain('tx.insert(userYetkileri)');
    expect(SERVIS).toContain('onConflictDoNothing()');
  });
  it('DEĞİŞMEZ: hata hâlinde damga GERİ ALINIYOR (link ölü kalmaz)', () => {
    expect(SERVIS).toContain("set({ usedAt: null })");
  });
});

describe('/auth/davet sayfası — tek hüküm metni', () => {
  it('geçersiz tokenda form RENDER EDİLMEZ (koşullu)', () => {
    expect(SAYFA).toContain('gecerli ?');
    expect(SAYFA).toContain('<DavetForm');
  });
  it('NEGATİF: sebep ayrımı SIZDIRILMAZ — tek sabit metin kullanılır', () => {
    expect(SAYFA).toContain('DAVET_GECERSIZ_METNI');
    for (const s of ['suresi_doldu', 'kullanilmis', 'süresi dolmuş', 'daha önce kullanılmış']) {
      expect(SAYFA, `sebep sızıyor: ${s}`).not.toContain(s);
    }
  });
  it('token sunucuda doğrulanır (action çağrısı sayfada)', () => {
    expect(SAYFA).toContain('davetKontrolAction');
  });
});
