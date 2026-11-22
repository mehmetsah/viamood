/**
 * #995986 k3b — kazanç rozeti ürün adının ÜSTÜNDEN fiyatın ALTINA ("Vergiler dahildir."ın hemen altı).
 *
 * Ağ YOK: paket dosyaları + GERÇEK yama.py koşturulur. Windows-uyumlu:
 *   · md5 karşılaştırmaları LF'e normalleştirilmiş içerik üzerinden (checkout kipinden bağımsız),
 *   · python / python3 otomatik seçilir,
 *   · alt sürecin çıktısı sys.stdout.buffer ile alınır (metin kipi Windows'ta \n → \r\n yapar).
 *
 * ★ LF GÜVENCESİ: paketin DİSKTEKİ baytlarında CR olmadığı ayrıca doğrulanır — Shopify'a giden
 *   içerik budur. Kök .gitattributes (tema-yamalari/** text eol=lf) bunu checkout'ta sabitler.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lf, yamaKosHam } from './tema-ortak';

const DEPO = join(__dirname, '..');
const KOK = join(DEPO, 'tema-yamalari', '995986-k3b-rozet-yeri');
const K3 = join(DEPO, 'tema-yamalari', '995986-k3-kazanc-rozeti');

const oku = (...p: string[]) => lf(readFileSync(join(...p), 'utf8'));
const ham = (...p: string[]) => readFileSync(join(...p));
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const js = (s: string) => JSON.parse(s.slice(s.indexOf('{')));

/** HAM stdout: satır sonları dokunulmaz — LF güvencesi testi bunu şart koşuyor. */
const py = (kod: string, girdi = ''): Buffer => yamaKosHam(KOK, kod, girdi);

/** yama.uygula çıktısı — baytlar bozulmadan (stdout.buffer). */
const uygula = (sabit: 'TPL' | 'BLK', girdi: string) =>
  py(
    `sys.stdout.buffer.write(yama.uygula(yama.${sabit}, sys.stdin.buffer.read().decode('utf-8')).encode('utf-8'))`,
    girdi,
  ).toString('utf8');

/** Beklenen DUR mesajını okumak için: stderr metni (hata çıkmazsa 'HATA-YOK'). */
function pyHata(kod: string, girdi = ''): string {
  try {
    py(kod, girdi);
    return 'HATA-YOK';
  } catch (e: unknown) {
    const h = e as { stderr?: Buffer | string; message?: string };
    if (Buffer.isBuffer(h.stderr)) return h.stderr.toString('utf8');
    return String(h.stderr ?? h.message ?? '');
  }
}

const TPL = 'templates__product.json';
const BLK = 'blocks__via-kazanc.liquid';
const dilim = (s: string, a: string, b: string) => {
  const i = s.indexOf(a);
  expect(i).toBeGreaterThanOrEqual(0);
  return s.slice(i, s.indexOf(b, i) + b.length);
};

describe('#995986 k3b kazanç rozetinin yeri', () => {
  const m = JSON.parse(oku(KOK, 'md5.json')) as Record<string, { once: string; sonra: string }>;
  const oTpl = oku(KOK, 'ONCESI', TPL);
  const sTpl = oku(KOK, 'SONRASI', TPL);
  const oBlk = oku(KOK, 'ONCESI', BLK);
  const sBlk = oku(KOK, 'SONRASI', BLK);

  it('md5 zinciri: ÖNCESİ = k3 SONRASI/YENİ = 22 Kas canlı ölçümü; SONRASI dosyalarla tutuyor', () => {
    // Paket dosyaları ↔ md5.json
    expect(md5(oTpl)).toBe(m['templates/product.json']!.once);
    expect(md5(sTpl)).toBe(m['templates/product.json']!.sonra);
    expect(md5(oBlk)).toBe(m['blocks/via-kazanc.liquid']!.once);
    expect(md5(sBlk)).toBe(m['blocks/via-kazanc.liquid']!.sonra);

    // Kesintisiz zincir: k3'ün bıraktığı yerden başlıyoruz (995986-k1 → k3 → k3b)
    expect(m['templates/product.json']!.once).toBe(md5(oku(K3, 'SONRASI', TPL)));
    expect(m['blocks/via-kazanc.liquid']!.once).toBe(md5(oku(K3, 'YENI', BLK)));

    // 22 Kas 2026 canlı tema (195348856964) GET ölçümü — sabitlendi
    expect(m['templates/product.json']!.once).toBe('7ee2e9d91d914a4bbbef8e3f189b47a1');
    expect(m['blocks/via-kazanc.liquid']!.once).toBe('36a4455867454a6e429317b6bc4b957a');
    expect(m['templates/product.json']!.sonra).toBe('17a4b18ae5816160849a299ab3a1922e');
  });

  it('block_order: rozet başından alınıp price_a7krng\'in HEMEN ardına geçti; başka hiçbir alan değişmedi', () => {
    const o = js(oTpl).sections.main.blocks['product-details'];
    const s = js(sTpl).sections.main.blocks['product-details'];

    expect(o.block_order[0]).toBe('via_kazanc'); // taşınacak olan gerçekten baştaydı
    expect(s.block_order.indexOf('via_kazanc')).toBe(s.block_order.indexOf('price_a7krng') + 1);
    expect(s.block_order).toEqual([
      'text_GnyQiN', 'reviews', 'price_a7krng', 'via_kazanc', 'variant_picker_m8',
      'vm_rozetler', 'sku_via_001', 'via_kargo_sayaci', 'buy_buttons_eYQEYi', 'accordion_g8EVVp',
    ]);
    // Hiçbir blok eklenmedi/silinmedi
    expect([...s.block_order].sort()).toEqual([...o.block_order].sort());
    // block_order dışında iki JSON birebir aynı (via_kazanc TANIMI da yerinde kaldı)
    const kirp = (x: string) => {
      const c = js(x);
      delete c.sections.main.blocks['product-details'].block_order;
      return c;
    };
    expect(kirp(sTpl)).toEqual(kirp(oTpl));
    // Saf sıralama → bayt uzunluğu değişmez
    expect(sTpl.length).toBe(oTpl.length);
  });

  it('product.cok-al.json DOKUNULMADI: pakette dosyası yok, yama.SIRA içermiyor', () => {
    const hepsi = [...readdirSync(join(KOK, 'ONCESI')), ...readdirSync(join(KOK, 'SONRASI'))];
    expect(hepsi.filter((f) => f.includes('cok-al'))).toEqual([]);
    const sira = JSON.parse(py('import json; sys.stdout.buffer.write(json.dumps(yama.SIRA).encode())').toString('utf8'));
    expect(sira).toEqual(['blocks/via-kazanc.liquid', 'templates/product.json']);
  });

  it('liquid: tutar hesabı · rozet satırı · stylesheet · schema BAYT BAYT aynı; renk kümesi değişmedi', () => {
    expect(dilim(sBlk, '{%- liquid', '-%}')).toBe(dilim(oBlk, '{%- liquid', '-%}'));
    expect(dilim(sBlk, '{% stylesheet %}', '{% endstylesheet %}')).toBe(dilim(oBlk, '{% stylesheet %}', '{% endstylesheet %}'));
    expect(dilim(sBlk, '{% schema %}', '{% endschema %}')).toBe(dilim(oBlk, '{% schema %}', '{% endschema %}'));
    expect(sBlk).toContain('<p class="via-kazanc" data-via-kazanc {{ block.shopify_attributes }}>Kazancınız {{ kazanc | money_without_trailing_zeros }}</p>');

    const stil = dilim(sBlk, '{% stylesheet %}', '{% endstylesheet %}');
    expect(new Set((stil.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).map((x) => x.toLowerCase()))).toEqual(new Set(['#1c6b45', '#fff']));
  });

  it('variant:update geri-düşümü: yeni çapa product-price; eski h1 yolu YEDEK olarak duruyor; JS para biçimlemiyor', () => {
    expect(oBlk).not.toContain('product-price'); // ÖNCESİ'nde yok
    expect(sBlk).toContain("var fiyat = document.querySelector('.product-details product-price');");
    expect(sBlk).toContain('fiyat.parentNode.insertBefore(document.importNode(yeni, true), fiyat.nextSibling)');
    // cok-al şablonunda product-price yok → eski yol yedek olarak KALMALI
    expect(sBlk).toContain("var h1 = document.querySelector('.product-details h1');");
    expect(sBlk).toContain('baslik.parentNode.insertBefore(document.importNode(yeni, true), baslik)');
    expect((sBlk.match(/insertBefore/g) ?? []).length).toBe(2);
    expect(sBlk).not.toMatch(/toLocaleString|Intl\.NumberFormat|formatMoney/);
  });

  it('yama.py: iki dosyayı bayt bayt üretir; ikinci uygulamayı ve bozulan çapayı/kümeyi/uzunluğu reddeder', () => {
    expect(uygula('TPL', oTpl)).toBe(sTpl);
    expect(uygula('BLK', oBlk)).toBe(sBlk);

    // İkinci uygulama (idempotans kapısı)
    expect(pyHata("yama.uygula(yama.TPL, sys.stdin.buffer.read().decode('utf-8'))", sTpl)).toMatch(/zaten tasinmis/);
    expect(pyHata("yama.uygula(yama.BLK, sys.stdin.buffer.read().decode('utf-8'))", sBlk)).toMatch(/zaten uygulanmis/);

    // Çapa tutmazsa
    expect(
      pyHata(`yama.SIRA_CAPA = yama.SIRA_CAPA.replace('"reviews",', '"reviewsX",'); yama.uygula(yama.TPL, sys.stdin.buffer.read().decode('utf-8'))`, oTpl),
    ).toMatch(/capa 0 kez/);

    // block_order'dan blok düşerse (küme değişimi)
    expect(
      pyHata(`yama.SIRA_YENI = yama.SIRA_YENI.replace('            "reviews",\\n', ''); yama.uygula(yama.TPL, sys.stdin.buffer.read().decode('utf-8'))`, oTpl),
    ).toMatch(/block_order kumesi degisti/);

    // Saf sıralama bozulursa (uzunluk kapısı)
    expect(
      pyHata(`yama.SIRA_YENI = yama.SIRA_YENI + '\\n'; yama.uygula(yama.TPL, sys.stdin.buffer.read().decode('utf-8'))`, oTpl),
    ).toMatch(/saf siralama degil/);

    // Yeni JS çapası düşerse
    expect(
      pyHata(`yama.JS_YENI = yama.JS_CAPA; yama.uygula(yama.BLK, sys.stdin.buffer.read().decode('utf-8'))`, oBlk),
    ).toMatch(/zaten uygulanmis|insertBefore sayisi 2 degil|yorum capasi/);
  });

  it('★ LF güvencesi: disk baytlarında CR yok, yama çıktısında CR yok, yaz() CR\'yi reddeder, .gitattributes sabitler', () => {
    // 1) Paketin DİSKTEKİ baytları — Shopify'a giden içerik budur
    const dosyalar = [
      ['md5.json'], ['yama.py'], ['bas.py'],
      ['ONCESI', TPL], ['ONCESI', BLK], ['SONRASI', TPL], ['SONRASI', BLK],
    ];
    for (const p of dosyalar) {
      expect(ham(KOK, ...p).includes(0x0d), `CR bulundu: ${p.join('/')}`).toBe(false);
    }
    expect(ham(DEPO, 'tema-yamalari', 'yerel-bas.py').includes(0x0d)).toBe(false);

    // 2) yama.uygula çıktısı
    expect(uygula('TPL', oTpl)).not.toContain('\r');
    expect(uygula('BLK', oBlk)).not.toContain('\r');
    // CRLF'li girdi verilse bile ONCESI kapısı/çapa tutmaz → sessizce CRLF üretilmez
    expect(pyHata("yama.uygula(yama.TPL, sys.stdin.buffer.read().decode('utf-8'))", oTpl.replace(/\n/g, '\r\n'))).toMatch(/capa 0 kez/);

    // 3) yaz() CR'yi reddeder, oku() CRLF'i LF'e indirir
    expect(pyHata("yama.yaz(sys.argv[1] + '/CR-OLMAMALI.tmp', 'a\\r\\nb')")).toMatch(/CR iceren icerik yazilamaz/);
    expect(readdirSync(KOK)).not.toContain('CR-OLMAMALI.tmp');

    // 4) Kaynaklarda metin kipli dosya açma YOK (yalnız 'rb'/'wb'); bas.py hiç open() çağırmaz
    const yamaKaynak = oku(KOK, 'yama.py');
    const basKaynak = oku(KOK, 'bas.py');
    expect(yamaKaynak.match(/\bopen\(/g)).toHaveLength(2);
    expect(yamaKaynak).toContain("open(y, 'rb')");
    expect(yamaKaynak).toContain("open(y, 'wb')");
    expect(basKaynak.match(/\bopen\(/g)).toBeNull(); // urlopen( sayilmaz

    // 5) bas.py'de PUT'tan ÖNCE CR kapısı
    const put = basKaynak.slice(basKaynak.indexOf('def put('), basKaynak.indexOf('def dosya('));
    expect(put).toMatch(/if '\\r' in v:/);
    expect(put.indexOf("if '\\r' in v:")).toBeLessThan(put.indexOf('urlopen'));

    // 6) Kök .gitattributes checkout'u LF'e sabitliyor
    const attr = oku(DEPO, '.gitattributes');
    expect(attr).toMatch(/^tema-yamalari\/\*\*\s+text\s+eol=lf$/m);
    expect(attr).toMatch(/^tests\/\*\*\s+text\s+eol=lf$/m);
  });
});
