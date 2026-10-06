/**
 * #991394 · DEPLOY SAĞLIK ADRESİ — ÇİVİ.
 *
 * NEDEN: `scripts/deploy.sh` sağlık ucunu İKİ yerde çağırıyor — rollback log satırı ve
 * sağlık kapısı. 25 Eyl'de kapı doğru hedefe (`127.0.0.1:$PORT`) çevrildi ama rollback
 * satırında `http://localhost/api/health` KALDI. O adres nginx'in VARSAYILAN sunucusuna
 * gider ve uygulama sapasağlam olsa bile **404** döner ⇒ bir deploy geri alındığında
 * log'a YANLIŞ TEŞHİS düşer. Kapı değil ama arıza anında yanlış yöne baktırır.
 *
 * ⚠ YORUMLAR AYIKLANIR: betik, `localhost/api/health → 404` arızasını bir AÇIKLAMA
 * bloğunda anlatıyor. O satır belgedir, çağrı değildir; kaba bir arama onu da kırmızı
 * yakar ve çivi "yanlış yerde" bağırırdı. Bu yüzden iddialar KOD üzerinde koşar.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const YOL = path.resolve(__dirname, '../scripts/deploy.sh');
const HAM = readFileSync(YOL, 'utf8');
/** Yorum satırlarını at — gerekçe metni KOD değildir. */
const KOD = HAM.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

describe('#991394 — sağlık adresi tek kaynak', () => {
  it('🔴 KODDA localhost:80 sağlık çağrısı YOK (nginx varsayılanına gidip 404 döner)', () => {
    expect(KOD, 'rollback ya da kapı localhost:80e gidiyor').not.toMatch(
      /http:\/\/localhost(:80)?\/api\/health/,
    );
  });

  it('sağlık adresi TEK yerde kuruluyor', () => {
    const tanim = KOD.match(/^SAGLIK_URL=/gm) || [];
    expect(tanim.length, 'SAGLIK_URL birden çok yerde tanımlı — kopya geri gelmiş').toBe(1);
    expect(KOD).toContain('SAGLIK_URL="http://127.0.0.1:${SAGLIK_PORT}/api/health"');
  });

  it('🔴 KAPSAM: SAGLIK_URL, onu KULLANAN her satırdan ÖNCE tanımlı', () => {
    // Bu iddia işin püf noktası: tanım build'den SONRA kalsaydı rollback satırı
    // BOŞ adrese curl atardı — arıza değişir, çözülmezdi.
    const satir = KOD.split('\n');
    const tanim = satir.findIndex((l) => /^SAGLIK_URL=/.test(l));
    expect(tanim, 'SAGLIK_URL hiç tanımlı değil').toBeGreaterThan(-1);
    const kullanim = satir
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.includes('$SAGLIK_URL') && !/^SAGLIK_URL=/.test(l))
      .map(({ i }) => i);
    expect(kullanim.length, 'SAGLIK_URL hiç kullanılmıyor').toBeGreaterThan(0);
    for (const k of kullanim) {
      expect(k, `satır ${k + 1} tanımdan ÖNCE kullanıyor (boş adrese curl)`).toBeGreaterThan(tanim);
    }
  });

  it('rollback satırı da AYNI değişkeni kullanır (sabit adres yazmaz)', () => {
    const rb = KOD.split('\n').find((l) => l.includes('eski .next geri kondu'));
    expect(rb, 'rollback log satırı bulunamadı').toBeTruthy();
    expect(rb!, 'rollback sabit adres yazıyor').toContain('"$SAGLIK_URL"');
    expect(rb!).not.toMatch(/http:\/\/localhost/);
  });

  it('her sağlık çağrısı 127.0.0.1 üzerinden gider', () => {
    const cagrilar = KOD.split('\n').filter((l) => /curl[^|]*api\/health|curl[^|]*SAGLIK_URL/.test(l));
    expect(cagrilar.length, 'sağlık çağrısı hiç bulunamadı').toBeGreaterThan(0);
    for (const c of cagrilar) {
      expect(c, `sağlık çağrısı değişken kullanmıyor: ${c.trim().slice(0, 60)}`).toContain('SAGLIK_URL');
    }
  });
});
