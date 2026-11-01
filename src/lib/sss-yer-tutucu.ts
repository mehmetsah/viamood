/**
 * #994831 · SSS YER TUTUCU / İÇ NOT SÜZGECİ (md.52 — müşteriye «34XXX (kutudaki EAN'ı gir)» gibi yarım metin gitmez).
 *
 * ÖLÇÜLEN OLAY (1 Kas 2026, Elif): 1000 açık SSS satırında tek gerçek yer tutucu — m-bison «Ürün kodu nedir?» →
 * «Model kodu: 34XXX (kutudaki EAN'ı gir).» (kaynak veri/994831-sss-dalga4.jsonl). O dalgada üretim kapısı yoktu;
 * dalga 7+ kapısı (cevapUygunMu) yalnız eksen sorularını tanıyordu. Bu modül iki yazma kapısına bağlıdır:
 * toplu içe aktarma (urun-sss-ice-aktar.ts · satirAyristir) ve dalga üretim kapısı (sss-eksen.ts · cevapUygunMu);
 * sss-dusur.ts de yer tutuculu cevabı gizleyebilir.
 *
 * Desenler `kucuk()` metin üzerinde koşar. Sözcük sınırı JS `\b` ile DEĞİL, harf sınıfıyla kurulur: `\b` «ı/ş/ğ»yi
 * harf saymaz, «(bakım)» içinde «bak» eşleşirdi.
 * BİLEREK DIŞARIDA (ölçülmüş yanlış alarm, 1000 satır): yalın «öneri/önerisi» → «Yıkama: Önerisi 30°C.» meşru;
 * yalın «belirtilmemiş» → meşru; uzak «ölç … doğrula» → açıklamalarda «ölçüler … doğrulanmıştır» (12 meşru cümle).
 *
 * Çivi: tests/sss-yer-tutucu.test.ts.
 */
/** sss-eksen.ts `kucuk` ile BİREBİR aynı (çivi eşitliği ölçer) — sss-eksen bu modülü içe aktardığı için döngü kurulmasın diye burada. */
export const kucuk = (s: string) => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');

const B = '(?<![\\p{L}\\p{N}])'; // sözcük başı
const S = '(?![\\p{L}\\p{N}])'; // sözcük sonu
const r = (k: string) => new RegExp(k, 'u');

export const YER_TUTUCU_DESENLERI: ReadonlyArray<{ ad: string; desen: RegExp }> = [
  { ad: 'XXX şablon kodu', desen: r(`\\d+x{2,}${S}|${B}x{3,}${S}|${B}x{2,}\\d`) },
  { ad: 'soru işareti dizisi', desen: /\?{2,}/ },
  { ad: 'parantez içi emir', desen: r(`\\([^)]*${B}(gir|yaz|ekle|doldur|kontrol et|teyit et|doğrula|bak|güncelle|ölç)${S}[^)]*\\)`) },
  { ad: 'iç not sözcüğü', desen: r(`${B}(todo|tbd|fixme|placeholder|lorem ipsum|yer tutucu)${S}`) },
  { ad: 'gelecek zaman boşluğu', desen: r(`${B}(eklenecek|belirlenecek|güncellenecek|doldurulacak|girilecek|yazılacak)${S}`) },
  { ad: 'editör birinci tekil', desen: r(`${B}(hazırlayayım|ekleyeyim|bakayım|yazayım|kontrol edeyim|öneriyorum|önerim)${S}`) },
  { ad: 'editör emri', desen: r(`${B}(kontrol et|teyit et)${S}`) },
  { ad: 'boş / şablon parantez', desen: /\(\s*\)|\[\s*\]|\{\{|\}\}|_{3,}|\.{4,}/ },
  { ad: 'ölç + doğrula emri', desen: r(`${B}ölç\\p{L}*.{0,30}${B}doğrula(?!n)|${B}doğrula(?!n)\\p{L}*.{0,30}${B}ölç`) },
  { ad: 'editör önerisi', desen: r(`(^|[.(]\\s*)öneri(m|miz)?\\s*:|${B}(soru|cevap|metin|içerik|sss) önerisi${S}`) },
];

/** Metinde yakalanan desen adları (boş dizi = temiz). */
export function yerTutucuBul(metin: string): string[] {
  const t = kucuk(metin);
  return YER_TUTUCU_DESENLERI.filter((d) => d.desen.test(t)).map((d) => d.ad);
}

export const yerTutucuMu = (metin: string) => yerTutucuBul(metin).length > 0;
