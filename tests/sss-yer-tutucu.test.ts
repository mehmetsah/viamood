/**
 * #994831 · SSS YER TUTUCU / İÇ NOT SÜZGECİ · ÇİVİ (md.52 — 1 Kas 2026, Elif).
 * Derlem: veri/994831-sss-*.jsonl (kaynak anlık görüntüleri hariç) — bugüne dek yazılan TÜM SSS çiftleri. Ölçülen tek
 * gerçek yer tutucu dalga 4'teki m-bison satırıdır; o satır veri/994831-sss-yer-tutucu-dusur.jsonl ile gizlenir.
 * NEGATİF KONTROL: derleme enjekte edilen 3 yer tutucu cevabın 3'ü de yakalanır; meşru zor örneklerde yanlış alarm 0.
 * MUTASYON: herhangi bir desen silinir/gevşetilirse, sözcük sınırı `\b`ye dönerse ya da kapılardan biri sökülürse KIRILIR.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cevapUygunMu, kucuk as eksenKucuk } from '../src/lib/sss-eksen';
import { karar, type SssDusurGiris, type SssSatir } from '../src/lib/sss-dusur';
import { kucuk, YER_TUTUCU_DESENLERI, yerTutucuBul, yerTutucuMu } from '../src/lib/sss-yer-tutucu';
import { satirAyristir } from '../src/lib/urun-sss-ice-aktar';
import { MESRU } from './yer-tutucu-ornek';

const VERI = path.join(__dirname, '..', 'veri');
const satir = <T,>(f: string) => readFileSync(path.join(VERI, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as T);
type Cift = { dosya: string; handle: string; soru: string; cevap: string };
const DERLEM: Cift[] = readdirSync(VERI).filter((f) => /^994831-sss-.*\.jsonl$/.test(f) && !f.includes('kaynak')).sort().flatMap((f) =>
  satir<{ handle: string; sss?: Array<{ soru: string; cevap: string }>; soru?: string; yeniCevap?: string; onceCevap?: string }>(f).flatMap((o) =>
    (o.sss ?? [{ soru: o.soru ?? '', cevap: o.yeniCevap ?? o.onceCevap ?? '' }]).map((q) => ({ dosya: f, handle: o.handle, soru: q.soru, cevap: q.cevap }))));
const tara = (d: Cift[]) => d.filter((x) => yerTutucuMu(x.soru) || yerTutucuMu(x.cevap));

const MBISON = 'ultra-street-fighter-ii-m-bison-aksiyon-figuru';
const MBISON_CEVAP = "Model kodu: 34XXX (kutudaki EAN'ı gir).";

/** Her desen için bir yakalanması gereken örnek — biri sökülürse ilgili satır kırılır. */
const YAKALANMALI: Array<[string, string]> = [
  ['XXX şablon kodu', 'Model kodu: 34XXX.'],
  ['soru işareti dizisi', 'Ürün kodu: ???'],
  ['parantez içi emir', 'Yaş: 3+ (kutudaki yaşı gir).'],
  ['iç not sözcüğü', 'Malzeme: TODO.'],
  ['gelecek zaman boşluğu', 'Ölçüler üretici sayfasından eklenecek.'],
  ['editör birinci tekil', 'Bunun için kısa bir metin hazırlayayım.'],
  ['editör emri', 'Barkodu kontrol et.'],
  ['boş / şablon parantez', 'Güvenlik uyarısı ___ dikkat.'],
  ['ölç + doğrula emri', 'Ölçüleri cetvelle ölç ve doğrula.'],
  ['editör önerisi', 'Öneri: buraya bakım cümlesi gelsin.'],
];


describe('derlem — bugüne dek yazılan TÜM SSS çiftleri', () => {
  it('derlem boş değil ve dalga 2…9 dosyalarını kapsıyor', () => {
    expect(DERLEM.length).toBeGreaterThan(1000);
    expect(new Set(DERLEM.map((x) => x.dosya))).toContain('994831-sss-dalga9.jsonl');
  });
  it('tek gerçek yer tutucu: dalga 4 m-bison «34XXX (kutudaki EAN\'ı gir)»', () => {
    expect(tara(DERLEM).map((x) => [x.dosya, x.handle, x.cevap])).toEqual([
      ['994831-sss-dalga4.jsonl', MBISON, MBISON_CEVAP],
      ['994831-sss-yer-tutucu-dusur.jsonl', MBISON, MBISON_CEVAP], // gizleme girdisinin kendisi
    ]);
  });
  it('NEGATİF KONTROL: enjekte edilen 3 yer tutucunun 3\'ü yakalanır, meşru çiftlerde yanlış alarm 0', () => {
    const enjekte: Cift[] = [
      { dosya: 'enjekte', handle: 'a', soru: 'Ölçüleri nedir?', cevap: 'Ölçü: XX x XX cm (ölçüp gir).' },
      { dosya: 'enjekte', handle: 'b', soru: 'Ürün kodu nedir?', cevap: 'Ürün kodu: ??? — EAN eklenecek.' },
      { dosya: 'enjekte', handle: 'c', soru: 'Malzemesi nedir?', cevap: 'TODO: üretici sayfasına bakayım.' },
    ];
    const temiz = DERLEM.filter((x) => x.handle !== MBISON);
    const karisik = [...temiz.slice(0, 400), enjekte[0]!, ...temiz.slice(400, 800), enjekte[1]!, ...temiz.slice(800), enjekte[2]!];
    expect(tara(karisik)).toEqual(enjekte);
    expect(tara(temiz)).toEqual([]);
  });
});

describe('desenler', () => {
  it.each(YAKALANMALI)('%s yakalanır', (ad, metin) => expect(yerTutucuBul(metin)).toContain(ad));
  it('her desenin bir yakalama örneği var (desen eklenip çivisiz kalamaz)', () => {
    expect(YER_TUTUCU_DESENLERI.map((d) => d.ad).sort()).toEqual(YAKALANMALI.map(([a]) => a).sort());
  });
  it.each(MESRU)('meşru: %s', (m) => expect(yerTutucuBul(m)).toEqual([]));
  it('Türkçe büyük harf: «İÇERİK EKLENECEK» ve «KONTROL ET» yakalanır; kucuk sss-eksen ile birebir', () => {
    expect(yerTutucuBul('İÇERİK EKLENECEK')).toContain('gelecek zaman boşluğu');
    expect(yerTutucuBul('BARKODU KONTROL ET')).toContain('editör emri');
    for (const s of ['İade IŞIK Iğdır', 'ÖLÇÜ', MBISON_CEVAP]) expect(kucuk(s)).toBe(eksenKucuk(s));
  });
});

describe('yazma kapıları', () => {
  it('dalga üretim kapısı (cevapUygunMu): eksen şartını sağlasa da yer tutuculu cevap reddedilir', () => {
    expect(cevapUygunMu('Kaç yaş için uygun?', 'Yaş: 3+.')).toEqual({ ok: true });
    expect(cevapUygunMu('Kaç yaş için uygun?', 'Yaş: 3+ (kutudaki yaşı gir).')).toMatchObject({ ok: false, sebep: expect.stringContaining('yer tutucu') });
  });
  it('toplu içe aktarma (satirAyristir): soru ya da cevapta yer tutucu varsa satır reddedilir', () => {
    const s = (soru: string, cevap: string) => JSON.stringify({ handle: 'kutu-a', sss: [{ soru: 'Kaç yaş için uygun?', cevap: 'Yaş: 3+.' }, { soru, cevap }] });
    expect(satirAyristir(s('Ürün kodu nedir?', MBISON_CEVAP))).toMatchObject({ hata: expect.stringContaining('2. soru: yer tutucu') });
    expect(satirAyristir(s('Ürün kodu ???', 'ABC123'))).toMatchObject({ hata: expect.stringContaining('yer tutucu') });
    expect(satirAyristir(s('Ürün kodu nedir?', 'Model kodu: 34512.'))).toMatchObject({ kayitlar: expect.any(Array) });
  });
});

describe('m-bison gizleme (sss-dusur kipi)', () => {
  const G = satir<SssDusurGiris>('994831-sss-yer-tutucu-dusur.jsonl');
  const K = satir<{ handle: string; satirlar: SssSatir[] }>('994831-sss-yer-tutucu-dusur-kaynak.jsonl');
  it('veri: tek ürün, tek satır; öncesi cevap DB anlık görüntüsüyle birebir; gerekçe uydurma yok diyor', () => {
    expect(G).toHaveLength(1);
    expect(G[0]).toMatchObject({ handle: MBISON, soru: 'Ürün kodu nedir?', onceCevap: MBISON_CEVAP });
    expect(G[0]!.gerekce).toMatch(/gerçek model kodu yok/);
    expect(K).toHaveLength(1);
    expect(K[0]!.satirlar.filter((x) => x.acik).map((x) => x.cevap)).toEqual(['Yaş: 13+.', MBISON_CEVAP]);
  });
  it('karar: yalnız yer tutuculu satır düşer, «Kaç yaş için uygun?» bayt bayt kalır', () => {
    expect(karar(G[0]!, K[0]!.satirlar)).toEqual({ durum: 'yazilacak', sira: 1, yeniAcik: [{ soru: 'Kaç yaş için uygun?', cevap: 'Yaş: 13+.', sira: 0 }] });
  });
  it('cevap gerçek bir kodla düzeltilmişse (yer tutucu yok, kural dışı eksen değil) DÜŞÜRÜLMEZ', () => {
    const temiz = 'Model kodu: 34512.';
    const s = K[0]!.satirlar.map((x) => (x.sira === 1 ? { ...x, cevap: temiz } : x));
    expect(karar({ ...G[0]!, onceCevap: temiz }, s)).toMatchObject({ durum: 'atlandi', sebep: expect.stringContaining('yer tutucu yok') });
  });
});
