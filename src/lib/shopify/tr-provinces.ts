/**
 * TR il adı → Shopify province_code (ISO 3166-2:TR) eşleştirmesi.
 * Shopify shipping_address.province_code bu kodu bekler (TR-34 gibi).
 * İl adı string olarak gönderilince Shopify bazen tanımıyor → boş kalıyor.
 */
const TR_PROVINCE_CODES: Record<string, string> = {
  adana: 'TR-01', adıyaman: 'TR-02', afyonkarahisar: 'TR-03', ağrı: 'TR-04',
  amasya: 'TR-05', ankara: 'TR-06', antalya: 'TR-07', artvin: 'TR-08',
  aydın: 'TR-09', balıkesir: 'TR-10', bilecik: 'TR-11', bingöl: 'TR-12',
  bitlis: 'TR-13', bolu: 'TR-14', burdur: 'TR-15', bursa: 'TR-16',
  çanakkale: 'TR-17', çankırı: 'TR-18', çorum: 'TR-19', denizli: 'TR-20',
  diyarbakır: 'TR-21', edirne: 'TR-22', elazığ: 'TR-23', erzincan: 'TR-24',
  erzurum: 'TR-25', eskişehir: 'TR-26', gaziantep: 'TR-27', giresun: 'TR-28',
  gümüşhane: 'TR-29', hakkari: 'TR-30', hakkâri: 'TR-30', hatay: 'TR-31',
  isparta: 'TR-32', mersin: 'TR-33', istanbul: 'TR-34', 'i̇stanbul': 'TR-34',
  izmir: 'TR-35', 'i̇zmir': 'TR-35', kars: 'TR-36', kastamonu: 'TR-37',
  kayseri: 'TR-38', kırklareli: 'TR-39', kırşehir: 'TR-40', kocaeli: 'TR-41',
  konya: 'TR-42', kütahya: 'TR-43', malatya: 'TR-44', manisa: 'TR-45',
  kahramanmaraş: 'TR-46', mardin: 'TR-47', muğla: 'TR-48', muş: 'TR-49',
  nevşehir: 'TR-50', niğde: 'TR-51', ordu: 'TR-52', rize: 'TR-53',
  sakarya: 'TR-54', samsun: 'TR-55', siirt: 'TR-56', sinop: 'TR-57',
  sivas: 'TR-58', tekirdağ: 'TR-59', tokat: 'TR-60', trabzon: 'TR-61',
  tunceli: 'TR-62', şanlıurfa: 'TR-63', uşak: 'TR-64', van: 'TR-65',
  yozgat: 'TR-66', zonguldak: 'TR-67', aksaray: 'TR-68', bayburt: 'TR-69',
  karaman: 'TR-70', kırıkkale: 'TR-71', batman: 'TR-72', şırnak: 'TR-73',
  bartın: 'TR-74', ardahan: 'TR-75', iğdır: 'TR-76', 'ı̇ğdır': 'TR-76',
  yalova: 'TR-77', karabük: 'TR-78', kilis: 'TR-79', osmaniye: 'TR-80',
  düzce: 'TR-81',
};

/**
 * province_code (TR-XX) → kanonik il ADI.
 *
 * NEDEN VAR (#615): Ödeme formu il alanında bazen ADI değil KODU gönderiyor.
 * `provinceCode('TR-34')` tabloda eşleşme bulamayıp null dönüyor, Shopify'a
 * `province: 'TR-34'` gidiyor ve KargoLab/PTT etiketine il "TR-34" diye basılıyor.
 * 15 Eyl 2026 ölçümü: son 40 siparişin 24'ünde il alanı TR-XX kalmış.
 *
 * Not: Isparta ve Iğdır Türkçede NOKTASIZ I ile yazılır — otomatik büyük harfe
 * çevirme bunları "İsparta"/"İğdır" yapıyor, elle doğru yazıldı.
 */
const TR_PROVINCE_NAMES: Record<string, string> = {
  'TR-01': 'Adana', 'TR-02': 'Adıyaman', 'TR-03': 'Afyonkarahisar', 'TR-04': 'Ağrı',
  'TR-05': 'Amasya', 'TR-06': 'Ankara', 'TR-07': 'Antalya', 'TR-08': 'Artvin',
  'TR-09': 'Aydın', 'TR-10': 'Balıkesir', 'TR-11': 'Bilecik', 'TR-12': 'Bingöl',
  'TR-13': 'Bitlis', 'TR-14': 'Bolu', 'TR-15': 'Burdur', 'TR-16': 'Bursa',
  'TR-17': 'Çanakkale', 'TR-18': 'Çankırı', 'TR-19': 'Çorum', 'TR-20': 'Denizli',
  'TR-21': 'Diyarbakır', 'TR-22': 'Edirne', 'TR-23': 'Elazığ', 'TR-24': 'Erzincan',
  'TR-25': 'Erzurum', 'TR-26': 'Eskişehir', 'TR-27': 'Gaziantep', 'TR-28': 'Giresun',
  'TR-29': 'Gümüşhane', 'TR-30': 'Hakkari', 'TR-31': 'Hatay', 'TR-32': 'Isparta',
  'TR-33': 'Mersin', 'TR-34': 'İstanbul', 'TR-35': 'İzmir', 'TR-36': 'Kars',
  'TR-37': 'Kastamonu', 'TR-38': 'Kayseri', 'TR-39': 'Kırklareli', 'TR-40': 'Kırşehir',
  'TR-41': 'Kocaeli', 'TR-42': 'Konya', 'TR-43': 'Kütahya', 'TR-44': 'Malatya',
  'TR-45': 'Manisa', 'TR-46': 'Kahramanmaraş', 'TR-47': 'Mardin', 'TR-48': 'Muğla',
  'TR-49': 'Muş', 'TR-50': 'Nevşehir', 'TR-51': 'Niğde', 'TR-52': 'Ordu',
  'TR-53': 'Rize', 'TR-54': 'Sakarya', 'TR-55': 'Samsun', 'TR-56': 'Siirt',
  'TR-57': 'Sinop', 'TR-58': 'Sivas', 'TR-59': 'Tekirdağ', 'TR-60': 'Tokat',
  'TR-61': 'Trabzon', 'TR-62': 'Tunceli', 'TR-63': 'Şanlıurfa', 'TR-64': 'Uşak',
  'TR-65': 'Van', 'TR-66': 'Yozgat', 'TR-67': 'Zonguldak', 'TR-68': 'Aksaray',
  'TR-69': 'Bayburt', 'TR-70': 'Karaman', 'TR-71': 'Kırıkkale', 'TR-72': 'Batman',
  'TR-73': 'Şırnak', 'TR-74': 'Bartın', 'TR-75': 'Ardahan', 'TR-76': 'Iğdır',
  'TR-77': 'Yalova', 'TR-78': 'Karabük', 'TR-79': 'Kilis', 'TR-80': 'Osmaniye',
  'TR-81': 'Düzce',
};

/**
 * Gelen il değerini KANONİK ADA çevirir.
 *
 * - `'TR-34'` → `'İstanbul'`   (kod geldiyse ada çevrilir)
 * - `'istanbul'` → `'İstanbul'` (ad geldiyse kanonik yazıma oturur)
 * - tanınmayan değer → kırpılmış hâliyle AYNEN döner (veri kaybı yok)
 */
export function provinceName(value?: string): string {
  const ham = (value ?? '').trim();
  if (!ham) return '';
  const kodMu = /^TR-\d{2}$/i.test(ham);
  if (kodMu) return TR_PROVINCE_NAMES[ham.toUpperCase()] ?? ham;
  const kod = TR_PROVINCE_CODES[ham.toLocaleLowerCase('tr')];
  return kod ? (TR_PROVINCE_NAMES[kod] ?? ham) : ham;
}

/** İl adı → province_code (TR-XX). Bulunamazsa null. Kod verilirse kendisini döner. */
export function provinceCode(name?: string): string | null {
  if (!name) return null;
  const ham = name.trim();
  // #615: değer zaten TR-XX ise tabloda aranmasın, doğrudan kabul edilsin.
  if (/^TR-\d{2}$/i.test(ham)) return TR_PROVINCE_NAMES[ham.toUpperCase()] ? ham.toUpperCase() : null;
  return TR_PROVINCE_CODES[ham.toLocaleLowerCase('tr')] ?? null;
}
