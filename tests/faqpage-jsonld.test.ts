/**
 * #995628 · FAQPage JSON-LD tema yaması · ÇİVİ (sahip kararı, Mehmet 1 Kas 10:00: «Google SSS'i yapısal veri olarak okur; görünen sayfa HİÇ değişmez»).
 * Paket: tema-yamalari/995628-faqpage-jsonld/ (AYRI paket — tema-yamalari/995332-kart-gorsel/ dosyalarına HİÇ dokunmaz).
 * Canlı basım YOK: bas.py KIP=CANLI yalnız CANLI_ONAY=995628-yunus-mehmet ile koşar. Davranış (ham HTML'de FAQPage 1 · soru sayısı = açık SSS ·
 * kapalı iade satırı 0 · SSS'siz üründe 0 · görünür fark 0 · KIP=GERI) önizleme temasında ölçüldü: raporlar/995628-faqpage-jsonld-20261101.md.
 * MUTASYON: kaçış, kaynak, boş liste/boş satır korumaları, koruma bloğunun içi, görünmezlik, tür, idempotans, canlı kilidi kaldırılırsa KIRILIR.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const P = path.join(__dirname, '..', 'tema-yamalari', '995628-faqpage-jsonld');
const oku = (f: string) => readFileSync(path.join(P, f), 'utf8');
const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const ONCE = oku('ONCESI/snippets__via-product-tabs.liquid');
const SONRA = oku('SONRASI/snippets__via-product-tabs.liquid');
const M = JSON.parse(oku('md5.json')) as Record<string, { once: string; sonra: string }>;
const CAPA = '<script>window.__vmSSS = {{ vm_sss | json }};</script>\n';
const KORUMA = '{%- if vm_sss != blank and vm_sss.size > 0 -%}\n';

/** SONRASI = ÖNCESİ'ne TEK bitişik ekleme mi? Eklenen parçayı döndürür. */
function ekleme(): { yer: number; blok: string } {
  expect(ONCE.split(CAPA)).toHaveLength(2);
  const i = ONCE.indexOf(CAPA) + CAPA.length;
  const blok = SONRA.slice(i, i + (SONRA.length - ONCE.length));
  expect(SONRA.slice(0, i) + SONRA.slice(i + blok.length)).toBe(ONCE);
  return { yer: i, blok };
}

describe('paket ve md5', () => {
  it('tek dosya; ÖNCESİ = canlıdan okunan 6092caea…, SONRASI md5.json ile aynı', () => {
    expect(Object.keys(M)).toEqual(['snippets/via-product-tabs.liquid']);
    expect(md5(ONCE)).toBe('6092caea718ad07259f3338bb8182def');
    expect(M['snippets/via-product-tabs.liquid']).toEqual({ once: md5(ONCE), sonra: md5(SONRA) });
  });
  it('yama.py: uygula(ÖNCESİ) = SONRASI; ikinci uygulama ve çapasız dosya REDDEDİLİR', () => {
    const py = (kod: string) => execFileSync('python3', ['-c', `import sys; sys.path.insert(0, ${JSON.stringify(P)}); import yama\n${kod}`], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    expect(md5(py(`import sys; sys.stdout.write(yama.uygula('snippets/via-product-tabs.liquid', open(${JSON.stringify(path.join(P, 'ONCESI/snippets__via-product-tabs.liquid'))}, encoding='utf-8').read()))`))).toBe(md5(SONRA));
    expect(() => py(`yama.uygula('snippets/via-product-tabs.liquid', open(${JSON.stringify(path.join(P, 'SONRASI/snippets__via-product-tabs.liquid'))}, encoding='utf-8').read())`)).toThrow();
    expect(() => py(`yama.uygula('snippets/via-product-tabs.liquid', 'çapa yok')`)).toThrow();
    expect(() => py(`yama.uygula('layout/theme.liquid', 'x')`)).toThrow();
  });
});

describe('eklenen blok', () => {
  it('yalnız EKLEME: __vmSSS satırının hemen ardında ve AYNI SSS korumasının İÇİNDE (SSS\'siz üründe hiç basılmaz)', () => {
    const { yer, blok } = ekleme();
    expect(SONRA.slice(yer - CAPA.length, yer)).toBe(CAPA);
    const k = SONRA.lastIndexOf(KORUMA, yer); expect(k).toBeGreaterThan(-1);
    expect(SONRA.slice(k + KORUMA.length, yer)).toBe(CAPA);
    expect(SONRA.slice(yer + blok.length).startsWith('{%- endif -%}\n')).toBe(true);
    expect(blok.match(/\{%-? if /g)?.length).toBe(blok.match(/\{%-? endif/g)?.length);
    let derinlik = 0; // blok dış korumayı (vm_sss if'i) KAPATAMAZ: if/endif derinliği hiçbir noktada 0'ın altına inmez, sonda 0'dır
    for (const t of blok.matchAll(/\{%-?\s*(if|endif)\b/g)) { derinlik += t[1] === 'if' ? 1 : -1; expect(derinlik).toBeGreaterThanOrEqual(0); }
    expect(derinlik).toBe(0);
  });
  it('schema.org FAQPage: @context · @type · mainEntity[Question{name, acceptedAnswer{Answer, text}}]; tek ld+json script', () => {
    const { blok } = ekleme();
    expect(blok.match(/<script\b/g)).toHaveLength(1);
    expect(blok).toContain('<script type="application/ld+json" data-vm-faq>');
    expect(blok).toContain('{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[');
    expect(blok).toContain('{"@type":"Question","name":{{ vm_q.soru | json }},"acceptedAnswer":{"@type":"Answer","text":{{ vm_q.cevap | json }} } }');
    expect(blok).toContain(']}</script>');
  });
  it('kaynak TEK: yalnız vm_sss (window.__vmSSS ile aynı değişken); başka metafield/API/fetch yok; metin | json ile kaçışlanır', () => {
    const { blok } = ekleme();
    expect(blok.match(/for vm_q in (\w+)/g)).toEqual(['for vm_q in vm_sss', 'for vm_q in vm_sss']);
    expect(blok).not.toMatch(/metafields|fetch|api\/|urun-sss|\| raw/);
    for (const m of blok.matchAll(/\{\{(.*?)\}\}/g)) expect(m[1]!.trim()).toMatch(/\| json$/);
  });
  it('boş liste / boş satır: geçerli satır sayısı 0 ise script YOK; soru ya da cevabı boş satır atlanır (iki döngüde de)', () => {
    const { blok } = ekleme();
    expect(blok).toContain('{%- if vm_faq_n > 0 -%}');
    expect(blok.indexOf('{%- if vm_faq_n > 0 -%}')).toBeLessThan(blok.indexOf('<script'));
    expect(blok.match(/\{%- if vm_q\.soru != blank and vm_q\.cevap != blank -%\}/g)).toHaveLength(2);
    expect(blok).toContain('{%- if vm_faq_i > 0 -%},{%- endif -%}');
  });
  it('görünmez: blokta ld+json dışında HTML öğesi, stil ya da metin düğümü yok', () => {
    const { blok } = ekleme();
    const html = blok.replace(/\{%-? comment -?%\}[\s\S]*?\{%-? endcomment -?%\}/g, '').replace(/\{%-?[\s\S]*?-?%\}/g, '').replace(/<script type="application\/ld\+json" data-vm-faq>[\s\S]*?<\/script>/, '');
    expect(html.trim()).toBe('');
    expect(blok).not.toMatch(/<(div|span|p|style|link|img|details)\b|class=/);
  });
});

describe('basım kapıları', () => {
  const bas = oku('bas.py'), cal = oku('calistir.sh');
  it('yalnız bu dosya; varsayılan ONIZLEME; canlıya yalnız KIP=CANLI + CANLI_ONAY anahtarıyla; GERI tek dosya döndürür', () => {
    expect(bas).toContain("SIRA = ['snippets/via-product-tabs.liquid']");
    expect(bas).toContain("KIP = os.environ.get('KIP', 'ONIZLEME')");
    expect(bas).toContain("if os.environ.get('CANLI_ONAY') != '995628-yunus-mehmet': raise SystemExit(");
    expect(bas).toContain("raise SystemExit('DUR: canlıya yalnız KIP=CANLI ile yazılır')");
    expect(bas).toMatch(/if KIP == 'GERI':[\s\S]*?put\(t, k, open\(B \+ '\/ONCESI\/'/);
    expect(cal).toContain('KIP=${KIP:-ONIZLEME}');
  });
  it('995332 paketine hiçbir yoldan erişmez (ayrı paket, ayrı sunucu dizini)', () => {
    for (const s of [bas, cal, oku('yama.py')]) expect(s).not.toMatch(/995332-kart-gorsel|\/tmp\/t995332|ek-blok\.css|YENI\//);
    expect(cal).toContain('tar -czf - -C "$D" bas.py yama.py md5.json ONCESI');
  });
});
