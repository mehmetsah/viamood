/**
 * TR il adı ↔ ISO 3166-2:TR kodu eşleştirmesi.
 *
 * ⚠️ DİKKAT (#573 / PTT etiket bug'ı, 5 Eyl 2026): Bu kodlar Shopify siparişine
 * `province_code` olarak GÖNDERİLMEZ. Bu mağazada Shopify'ın Türkiye tanımında
 * il listesi BOŞ (`GET /countries.json` → TR.provinces = []). İl listesi olmayan
 * bir ülkeye `province_code` verilince Shopify kodu çözemiyor ve kodu doğrudan
 * `province` ALANINA yazıp `province_code`'u null'luyor. Sonuç: adres il adı
 * yerine "TR-04" taşıyor, bu değer order-ingest → KargoLab → PTT etiketine kadar
 * gidiyor ve etikette il "TR-04" olarak basılıyor (PTT kabul etmiyor).
 *
 * Kodlar burada, YALNIZCA ters yönde (kod → ad onarımı) kullanılmak üzere duruyor.
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

/** İl adı → ISO kodu (TR-XX). Bulunamazsa null.
 *  Shopify'a GÖNDERİLMEZ — bkz. dosya başındaki uyarı. */
export function provinceCode(name?: string): string | null {
  if (!name) return null;
  const key = name.trim().toLocaleLowerCase('tr');
  return TR_PROVINCE_CODES[key] ?? null;
}

/** Kod → il adı (ters harita, bir kez kurulur). */
const TR_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(TR_PROVINCE_CODES).map(([ad, kod]) => [
    kod,
    ad.charAt(0).toLocaleUpperCase('tr') + ad.slice(1),
  ]),
);

/**
 * ONARIM: "TR-04" gibi bir ISO kodu geldiyse gerçek il adına ("Ağrı") çevirir.
 * Kod değilse değeri olduğu gibi döndürür — yani her yerde güvenle sarılabilir.
 *
 * Geriye dönük gerekli: 26 Ağu–5 Eyl arasında oluşan siparişlerin adreslerinde
 * il alanı ISO kodu olarak DONMUŞ durumda (Shopify adres alanları sipariş anında
 * sabitlenir). Bu siparişler yeniden etiketlenirse doğru il basılsın diye
 * etiket üretim yolunda bu onarım uygulanır.
 */
export function ilAdiniOnar(deger?: string | null): string {
  const v = (deger ?? '').trim();
  if (!v) return '';
  const kod = v.toUpperCase();
  return TR_CODE_TO_NAME[kod] ?? v;
}
