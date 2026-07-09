/**
 * Mikro V17 API tipleri.
 * Yunus'tan gelen örnek payload'lar + Swagger introspection'a göre.
 */

export interface MikroAddress {
  /** Adres satırı */
  Adres?: string;
  Ulke?: string;
  Sehir?: string;
  Kasaba?: string;
  PostaKodu?: string;
  OzelNot?: string;
  YonKodu?: string;
  AdresKodu?: string;
  ModemNo?: string;
}

export interface MikroAddressFatura {
  Ulke?: string;
  AdresNo?: number;
  Sehir?: string;
  Kasaba?: string;
  Cadde?: string;
  Mahalle?: string;
  Sokak?: string;
  Bina?: string;
  Kapi?: string;
  PostaKodu?: string;
  OzelNot?: string;
  YonKodu?: string;
  AdresKodu?: string;
  ModemNo?: string;
}

export interface MikroCariDto {
  UnvaniSoyadi: string;
  UnvaniAdi: string;            // boşsa "."
  /** "120.20.01.E{n}" formatında */
  Kodu: string;
  EpostaAdresi?: string;
  CepTelefonu?: string;
  Telefon1?: string;
  Telefon2?: string;
  VergiDaire?: string;
  /** TC veya VKN. Bilinmezse "11111111111" */
  VergiNo?: string;
  WebAdresi?: string;
  DovizTip1: string;            // "TL"
  DovizTip2?: string;
  DovizTip3?: string;
  GrupKodu?: string;
  SektorKodu?: string;
  MuhasebeKodu1?: string;
  MuhasebeKodu2?: string;
  MuhasebeKodu3?: string;
  EFatura?: boolean;
  Alias?: string;
  VergiMukellefi?: boolean;
  Adres1?: MikroAddress;
  Adres2?: MikroAddress;
  Yetkili?: unknown[];
  FaturaAdresi?: MikroAddressFatura;
  SevkAdresi?: MikroAddressFatura;
  DigerAdresler?: unknown[];
  VadeFarki?: number;
  AcikTaninanKredi?: number;
  PasaportNo?: string;
}

/** Sipariş satırı (Hareket) */
export interface MikroHareket {
  /** Satır GUID — yeni satırda sıfır-GUID placeholder: "{00000000-0000-0000-0000-000000000000}" */
  Id?: string;
  /** 0: Stok, 1: Hizmet */
  Cinsi: 0 | 1;
  StokKodu: string;
  Barkodu?: string;
  isDelete?: boolean;
  /** DİKKAT: KDV TUTARI (TL) — oran DEĞİL! (Fiyat = KDV hariç birim fiyat; Yunus'un çalışan Woo formatı) */
  KDV?: number;
  IstisnaKodu?: number;
  Miktar: number;
  Fiyat: number;
  Iskonto1?: number;
  Iskonto2?: number;
  Iskonto3?: number;
  Iskonto4?: number;
  Iskonto5?: number;
  Aciklama?: string;
  /** Entegrasyon takip ID — bizim DB id'mizi yazıyoruz */
  EntegrasyonID?: string;
  KargoDetay?: MikroKargoDetay;
}

export interface MikroKargoDetay {
  Adi?: string;
  Soyadi?: string;
  Adres?: string;
  Il?: string;
  Ilce?: string;
  Telefon?: string;
  KargoBarkod?: string;
  KargoFirmaId?: string;
  VergiNo?: string;
  VergiDaire?: string;
}

export interface MikroEvrakAciklama {
  Aciklama1?: string;
  Aciklama2?: string;
  Aciklama3?: string;
  Aciklama4?: string;
  Aciklama5?: string;
  Aciklama6?: string;
  Aciklama7?: string;
  Aciklama8?: string;
  Aciklama9?: string;
  Aciklama10?: string;
}

export interface MikroEvrak {
  /** ISO datetime — örn "2026-05-15T23:59:59" */
  Tarih: string;
  TeslimTarihi?: string;
  TeslimTuruKodu?: string;       // "PTT", "ARAS" vs.
  SaticiKodu?: string;
  SrmMerkezKodu?: string;        // "99"
  DepoNo?: number;               // 1
  OdemePlaniNo?: number;         // 99
  ProjeKodu?: string;            // "SHOPIFY"
  /** Sipariş numarası (Shopify order name) — zorunlu */
  EvrakSeri: string;
  EvrakSira?: number;            // genelde 1
  Tip?: number;
  BelgeNo?: string;
  /** Cari kod — zorunlu */
  CariHesapKodu: string;
  DovizCinsi?: string;
  DovizKuru?: number;
  EvrakDokumAciklamasi?: string;
  EvrakAciklama?: MikroEvrakAciklama;
  Vade?: number;
  MikroUserNo?: number;
  AdresNo?: number;
  SiparisDurumu?: boolean;
  Satirlar?: MikroHareket[];
}

export interface MikroSiparisOnayDto {
  EvrakSeri: string;
  EvrakSira: number;
  Tip?: number;
  /** Yunus: şimdilik 1 */
  OnaylayanMikroKullaniciNo: number;
}

export interface MikroApiError {
  errorMessage?: string;
  message?: string;
  Message?: string;
  ModelState?: Record<string, string[]>;
}
