/**
 * #994831 · AÇIKLAMA DALGA 10 · KAYNAK ÇİVİSİ — zayıf açıklamaya ürünün KENDİ verisinden «Teknik Bilgiler» (md.52).
 * Kapı: src/lib/aciklama-zengin.ts. Veri: veri/994831-aciklama-dalga10{,-kaynak}.jsonl (Admin anlık görüntüsü 5 Kas 2026 08:02Z).
 * MUTASYON: kapının her şartı sökülünce aşağıdaki negatif örneklerden en az biri KIRILIR; veri bozulunca veri bölümü KIRILIR.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { alintidaOlmayan, satirKapisi, tabloHtml, urunKapisi, zenginGiris, type ZKaynak, type ZSatir } from '../src/lib/aciklama-zengin';
import { karar } from '../src/lib/aciklama-ekle';
import { aciklamaYazKapisi } from '../src/lib/aciklama-yer-tutucu';

const KOK = path.join(__dirname, '..');
const satir = <X,>(f: string) => readFileSync(path.join(KOK, 'veri', f), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as X);

const K: ZKaynak = {
  handle: 'ornek-kutu', title: 'Saklama Kutusu 20 LT (ASR-4035)', descriptionHtml: '<p>Ürün Materyali:Plastik Ürün Ölçüleri:490x380x200h mm</p>',
  tags: ['3 yaş üzeri'], medya: ['gid://shopify/MediaImage/1'], barkodlar: ['8690000000001'],
  esUrun: {
    'es-barkod': { title: 'Başka ad', descriptionHtml: '<p>Malzeme 1. Sınıf Polipropilen</p>', barkodlar: ['8690000000001'] },
    'es-model': { title: 'Super-Bag Kutu (ASR-4035)', descriptionHtml: '<p>Menşei Türkiye</p>', barkodlar: [] },
    'benzer': { title: 'Saklama Kutusu 30 LT (ASR-4036)', descriptionHtml: '<p>Malzeme Polipropilen</p>', barkodlar: ['8690000000099'] },
  },
};
const s = (anahtar: string, deger: string, tur: ZSatir['kaynak']['tur'], alinti: string, alan = ''): ZSatir => ({ anahtar, deger, kaynak: { tur, alan, alinti } });
const IYI = [s('Malzeme', 'Plastik', 'aciklama', 'Ürün Materyali:Plastik'), s('Ürün ölçüleri', '490 × 380 × 200 mm', 'aciklama', 'Ürün Ölçüleri:490x380x200h mm'), s('Hacim', '20 Lt', 'baslik', '20 LT')];

describe('kaynak kapısı (negatif örnekler)', () => {
  it('pozitif: başlık · açıklama · etiket · eş barkod · eş model kodu · kendi görseli geçer', () => {
    for (const x of [...IYI, s('Önerilen yaş', '3 yaş üzeri', 'etiket', '3 yaş üzeri'), s('Malzeme', 'Polipropilen', 'es-urun', 'Malzeme 1. Sınıf Polipropilen', 'es-barkod'),
      s('Menşei', 'Türkiye', 'es-urun', 'Menşei Türkiye', 'es-model'), s('Taşıma kapasitesi', '120 kg', 'urun-gorseli', '120KG TAŞIMA KAPASİTESİ', 'gid://shopify/MediaImage/1')])
      expect(satirKapisi(K, x), x.anahtar).toEqual({ ok: true });
  });
  it('UYDURMA: alıntıda olmayan sayı ya da sözcük yazılamaz', () => {
    expect(alintidaOlmayan('490 × 380 × 210 mm', 'Ürün Ölçüleri:490x380x200h mm')).toEqual(['210']);
    expect(alintidaOlmayan('Paslanmaz çelik', 'Ürün Materyali:Plastik')).toEqual(['paslanmaz', 'çelik']);
    expect(alintidaOlmayan('Plastik', 'plastikten üretilmiştir')).toEqual([]);
    expect(alintidaOlmayan('Astik', 'plastikten')).toEqual(['astik']); // sözcük ORTASINDAN parça alınamaz, yalnız sözcük başı
    expect(satirKapisi(K, s('Ürün ölçüleri', '490 × 380 × 210 mm', 'aciklama', 'Ürün Ölçüleri:490x380x200h mm'))).toMatchObject({ ok: false, sebep: expect.stringContaining('210') });
  });
  it('alıntı kaynakta birebir değilse, izinsiz türse, görsel başka ürünündeyse reddeder', () => {
    expect(satirKapisi(K, s('Malzeme', 'Plastik', 'aciklama', 'Ürün Materyali: Plastik')).ok).toBe(false);
    expect(satirKapisi(K, s('Malzeme', 'Plastik', 'internet' as never, 'Plastik'))).toMatchObject({ ok: false, sebep: expect.stringContaining('izinsiz kaynak türü') });
    expect(satirKapisi(K, s('Hacim', '20 Lt', 'urun-gorseli', '20 LT', 'gid://shopify/MediaImage/2')).ok).toBe(false);
  });
  it('BENZER ÜRÜN kaynak değildir: eş barkod ya da başlıkta aynı model kodu yoksa reddeder', () => {
    expect(satirKapisi(K, s('Malzeme', 'Polipropilen', 'es-urun', 'Malzeme Polipropilen', 'benzer'))).toMatchObject({ ok: false, sebep: expect.stringContaining('eş ürün') });
  });
  it('kaçamak · pazarlama şişirmesi · satış/kargo · yer tutucu reddedilir', () => {
    for (const [d, al] of [['Yaklaşık 20 Lt', 'Yaklaşık 20 LT'], ['Eşsiz plastik', 'Eşsiz plastik'], ['Plastik kargo', 'Plastik kargo'], ['Plastik (doldur)', 'Plastik (doldur)']] as const)
      expect(satirKapisi({ ...K, title: al }, s('Malzeme', d, 'baslik', al)).ok, d).toBe(false);
  });
  it('ürün kapısı: tablosu olan açıklamaya ikinci tablo yok · ≥3 satır · anahtar tekil', () => {
    expect(urunKapisi(K, IYI)).toEqual({ ok: true });
    expect(urunKapisi({ ...K, descriptionHtml: K.descriptionHtml + '<table><tr><td>a</td></tr></table>' }, IYI).ok).toBe(false);
    expect(urunKapisi(K, IYI.slice(0, 2)).ok).toBe(false);
    expect(urunKapisi(K, [...IYI, IYI[0]!]).ok).toBe(false);
    expect(() => zenginGiris(K, IYI.slice(0, 2))).toThrow();
  });
  it('ek HTML tablo düzeni sabit; mevcut metin korunur (hedef = mevcut + ek)', () => {
    const g = zenginGiris(K, IYI);
    expect(g.ekHtml).toBe('<h2>Teknik Bilgiler</h2><table><tbody><tr><th>Özellik</th><th>Bilgi</th></tr><tr><td>Malzeme</td><td>Plastik</td></tr><tr><td>Ürün ölçüleri</td><td>490 × 380 × 200 mm</td></tr><tr><td>Hacim</td><td>20 Lt</td></tr></tbody></table>');
    expect(g.hedefHtml).toBe(K.descriptionHtml + g.ekHtml);
    expect(tabloHtml([s('A & B', '<x>', 'baslik', '')])).toContain('<td>A &amp; B</td><td>&lt;x&gt;</td>');
  });
});

describe('dalga 10 verisi', () => {
  type G = ReturnType<typeof zenginGiris>;
  const D = satir<G>('994831-aciklama-dalga10.jsonl');
  const KY = new Map(satir<ZKaynak>('994831-aciklama-dalga10-kaynak.jsonl').map((k) => [k.handle, k]));
  it('65 ürün, handle tekil ve geçerli, her ürünün kaynak anlık görüntüsü var', () => {
    expect(D).toHaveLength(65);
    expect(new Set(D.map((x) => x.handle)).size).toBe(65);
    for (const g of D) { expect(g.handle).toMatch(/^[a-z0-9-]+$/); expect(KY.has(g.handle), g.handle).toBe(true); }
  });
  it('KAYNAK ŞARTI: her ürün kapıdan yeniden geçer ve veri satırı kapının çıktısıyla BİREBİR aynı', () => {
    for (const g of D) expect(zenginGiris(KY.get(g.handle)!, g.satirlar), g.handle).toEqual(g);
  });
  it('yazma yolu: aciklama-ekle kararı anlık görüntüye karşı «yazılacak», yer tutucu kapısı temiz', () => {
    for (const g of D) {
      const k = karar(g, KY.get(g.handle)!.descriptionHtml);
      expect(k.durum, g.handle).toBe('yazilacak');
      if (k.durum === 'yazilacak') expect(aciklamaYazKapisi(k.html), g.handle).toEqual({ ok: true });
    }
  });
  it('görsel kaynağı yalnız 4 üründe ve yalnız ürünün kendi medyası; eş ürün yalnız 3 eş model kodlu kayıt', () => {
    const gorsel = new Set(D.filter((g) => g.satirlar.some((x) => x.kaynak.tur === 'urun-gorseli')).map((g) => g.handle));
    expect(gorsel.size).toBe(4);
    const es = new Set(D.flatMap((g) => g.satirlar.filter((x) => x.kaynak.tur === 'es-urun').map((x) => x.kaynak.alan)));
    expect([...es].sort()).toEqual(['asrin-plastik-4lu-slim-organizer-set-asr-2100', 'super-bag-16-takim-cantasi-asr-2017', 'super-bag-saklama-kutusu-asr-4038']);
  });
  it('çelişkili ürünler bilerek DIŞARIDA (başlık/açıklama hacim · ölçü · adet çelişkisi; pazar yeri metni; bozuk handle)', () => {
    const h = new Set(D.map((x) => x.handle));
    for (const x of ['super-bag-20-lt-saklama-kutusu-wikro-tank-bezi', '100-lt-saklama-kutusuasr-40-40', '4lu-set-freshbox-mikrodalga-ve-difrize-uygun-saklama-kabi-krem',
      '4lu-set-freshbox-mikrodalga-ve-difrize-uygun-saklama-kabi-gri', 'panini-fifa-world-cup-2026-cikartma-paketi', 'kat-kat-istiflenebilir-clear-sise-organizeri-2-adet-seffaf-bdd-39'])
      expect(h.has(x), x).toBe(false);
  });
  it('önceki SSS dalgalarındaki hiçbir ürün bu dalgada yok (SSS\'i olanın açıklamasına dokunulmaz)', () => {
    const once = new Set(readdirSync(path.join(KOK, 'veri')).filter((f) => /^994831-sss-.*\.jsonl$/.test(f) && !f.includes('kaynak') && !f.includes('dusur'))
      .flatMap((f) => satir<{ handle: string }>(f).map((x) => x.handle)));
    expect(D.filter((g) => once.has(g.handle)).map((g) => g.handle)).toEqual([]);
  });
  it('deploy kancası: aciklama-dalga10-kur.sh son kancalardan sonra, aciklama-ekle.mts ile ve --kalite OLMADAN', () => {
    const d = readFileSync(path.join(KOK, 'scripts', 'deploy.sh'), 'utf8'), b = readFileSync(path.join(KOK, 'scripts', 'aciklama-dalga10-kur.sh'), 'utf8');
    expect(d).toContain('bash scripts/aciklama-dalga10-kur.sh || echo');
    expect(d.indexOf('gorsel-bag-coz-sanrio-kur.sh')).toBeLessThan(d.indexOf('aciklama-dalga10-kur.sh'));
    expect(b).toContain('scripts/aciklama-ekle.mts veri/994831-aciklama-dalga10.jsonl --uygula');
    expect(b).not.toContain('--kalite');
  });
});
