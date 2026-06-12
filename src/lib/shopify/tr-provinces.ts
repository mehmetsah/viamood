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

/** İl adı → province_code (TR-XX). Bulunamazsa null. */
export function provinceCode(name?: string): string | null {
  if (!name) return null;
  const key = name.trim().toLocaleLowerCase('tr');
  return TR_PROVINCE_CODES[key] ?? null;
}
