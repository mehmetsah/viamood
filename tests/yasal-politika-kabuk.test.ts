/**
 * ÇİVİ — #994357: Shopify politika sayfaları ONAYLI yasal kabuğu kullanır.
 *
 * ÖLÇÜLEN ARIZA (17 Eki 2026): `/policies/privacy-policy` Shopify'ın varsayılan
 * `.shopify-policy__*` kabuğuyla çiziliyordu (canlı ölçüm), öbür yasal sayfalar
 * ise `vl-eyebrow / vl-title / vl-meta` kabuğundaydı. Üstüne
 * `/pages/gizlilik-politikasi` **301 ile** politika sayfasına yönlendiği için
 * doğru tasarımlı şablon tema deposunda VARDI ama ERİŞİLEMİYORDU.
 *
 * ⛔ YENİ TASARIM YOK (md.16): tek kaynak `via-legal-page` bölümü.
 * Bu çivi yamaların İÇERİĞİNİ ölçer; yorumlar ayıklanır ki çivi kendi
 * gerekçe metnini saymasın (bu depoda ölçülmüş yanlış-yeşil sınıfı).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const oku = (ad: string) =>
  readFileSync(new URL(`../tema-yamalari/${ad}`, import.meta.url), 'utf8');

/** Liquid yorumlarını at: {% comment %}…{% endcomment %} + `{% liquid %}` içi `#` satırları. */
const yorumsuz = (s: string) =>
  s
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
    .replace(/^\s*#.*$/gm, '');

const BOLUM = yorumsuz(oku('via-legal-page.liquid.994357-YENI'));
const SABLON = yorumsuz(oku('templates-policy.liquid.994357-YENI'));

describe('policy şablonu — onaylı bölümü çağırır, kendi tasarımını kurmaz', () => {
  it("{% section 'via-legal-page' %} ile onaylı kabuğu çağırıyor", () => {
    expect(SABLON).toContain("{% section 'via-legal-page' %}");
  });

  it('NEGATİF — şablon kendi kabuğunu/CSS’ini kurmuyor', () => {
    expect(SABLON).not.toContain('shopify-policy__');
    expect(SABLON).not.toContain('<style');
    expect(SABLON).not.toContain('vl-eyebrow');   // kabuk bölümden gelir, kopyalanmaz
  });
});

describe('bölüm — politika dalı', () => {
  it('şablon adını ÖLÇÜYOR (section ayarı olmayan yolda doc belirlensin)', () => {
    expect(BOLUM).toContain("template.name == 'policy'");
    expect(BOLUM).toContain("assign doc = 'politika'");
  });

  it('başlık Shopify’ın kendi politika adından geliyor (uydurma başlık yok)', () => {
    expect(BOLUM).toMatch(/when 'politika'\s*\n\s*assign doc_title = page_title/);
  });

  it('gövde politika metnini basıyor', () => {
    expect(BOLUM).toMatch(/\{%-\s*when 'politika'\s*-%\}\s*\n\{\{ page_description \}\}/);
  });
});

describe('(1) + (2) — eyebrow ve alt bilgi öbür sayfalarla BİREBİR', () => {
  it('"Yasal · Via Mood" ibaresi kabukta duruyor', () => {
    expect(BOLUM).toContain('Yasal · Via Mood');
  });

  it('alt bilgi biçimi canlı ölçülen satırla aynı', () => {
    // Canlı /pages/mesafeli-satis-sozlesmesi ölçümü:
    // "Son güncelleme: Mayıs 2026 · VIA GLOBAL DIŞ TİCARET LİMİTED ŞİRKETİ"
    expect(BOLUM).toContain('Son güncelleme: {{ updated }} · {{ settings.company_title }}');
    expect(BOLUM).toContain("assign updated = 'Mayıs 2026'");
  });
});

describe('(3) — panelden "Son güncelleme" alanı KALDIRILDI', () => {
  it('NEGATİF — schema’da updated_date ayarı YOK', () => {
    expect(BOLUM).not.toContain('"id": "updated_date"');
    expect(BOLUM).not.toContain('Son güncelleme tarihi');     // panel etiketi
    expect(BOLUM).not.toContain('section.settings.updated_date');
  });

  it('schema hâlâ geçerli JSON ve öbür ayarlar duruyor', () => {
    const ham = oku('via-legal-page.liquid.994357-YENI');
    const m = ham.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    expect(m).toBeTruthy();
    const sema = JSON.parse(m![1]);
    const idler = (sema.settings as Array<{ id?: string }>).map((x) => x.id);
    expect(idler).not.toContain('updated_date');
    expect(idler).toContain('doc_handle');     // asıl seçici YERİNDE
  });
});

describe('⛔ LIQUID KAPISI — etiket içinde süslü parantez YASAK', () => {
  it('`{% liquid %}` bloğunun İÇİNDE `{%` ya da `%}` YOK', () => {
    // ÖLÇÜLEN CANLI ARIZA (17 Eki 2026): yorum satırına örnek olarak
    // `{%` … `%}` yazmıştım; Liquid çözümleyici etiketi O NOKTADA kapattı,
    // altındaki `case doc` / `assign updated` HİÇ koşmadı ve canlı yasal
    // sayfalarda vl-title + vl-meta BOŞ çıktı. Yedekten geri dönülüp
    // yorumlar sadeleştirildi. Bu kapı aynı hatayı bir daha geçirmez.
    const ham = oku('via-legal-page.liquid.994357-YENI');
    const m = ham.match(/\{%-?\s*liquid([\s\S]*?)-%\}/);
    expect(m).toBeTruthy();
    expect(m![1]).not.toContain('%}');
    expect(m![1]).not.toContain('{%');
  });

  it('canlı sürümün korunan parçaları yamada DURUYOR (ezme yok)', () => {
    // Yama CANLI dosyadan türetildi (tema deposu HEAD'i GERİDE: HalkÖde metni
    // ve 'sayfa' dalı canlıda var, depoda yok). Depo tabanlı yama uygulanırsa
    // bunlar SİLİNİRDİ — bu iddia o sessiz geri almayı yakalar.
    const ham = oku('via-legal-page.liquid.994357-YENI');
    expect(ham).toContain('HalkÖde');
    expect(ham).toContain("when 'sayfa'");
  });
});
