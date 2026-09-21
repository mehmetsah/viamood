/**
 * Halköde initialize'a gelen kart alanlarının ŞEKİL denetimi (21 Eyl 2026).
 *
 * Neden: initialize taslak siparişi paySmart3D'den ÖNCE açar (invoice_id'ye taslak
 * numarası gömülü). Denetim yokken yazım hatalı her kart numarası Shopify'da bir
 * "halkode-pending" taslağı bırakıyordu. Şekil hatası artık taslak AÇILMADAN 422 döner.
 *
 * Bu yalnız biçim denetimidir (Luhn, ay/yıl, CVV uzunluğu) — kartın geçerli olduğunu
 * banka söyler. Değerler hiçbir yere yazılmaz; dönen metin kart verisi İÇERMEZ.
 */

export interface KartAlanlari {
  cc_no?: string;
  expiry_month?: string;
  expiry_year?: string;
  cvv?: string;
}

export type KartDenetimi =
  | { ok: true; ccNo: string; ay: string; yil: string; cvv: string }
  | { ok: false; alan: 'cc_no' | 'expiry' | 'cvv'; mesaj: string };

function luhn(n: string): boolean {
  let s = 0;
  let alt = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = n.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    s += d;
    alt = !alt;
  }
  return s % 10 === 0;
}

/** `simdi` yalnız test için — üretimde verilmez. */
export function kartDenetle(k: KartAlanlari, simdi: Date = new Date()): KartDenetimi {
  const ccNo = String(k.cc_no ?? '').replace(/\D/g, '');
  if (ccNo.length < 15 || ccNo.length > 19 || !luhn(ccNo)) {
    return { ok: false, alan: 'cc_no', mesaj: 'Kart numarasını kontrol edin.' };
  }

  const ayS = String(k.expiry_month ?? '').replace(/\D/g, '');
  let yilS = String(k.expiry_year ?? '').replace(/\D/g, '');
  if (yilS.length === 2) yilS = `20${yilS}`;
  const ay = Number(ayS);
  const yil = Number(yilS);
  const buYil = simdi.getFullYear();
  const buAy = simdi.getMonth() + 1;
  if (
    !ayS ||
    ayS.length > 2 ||
    !(ay >= 1 && ay <= 12) ||
    yilS.length !== 4 ||
    yil < buYil ||
    yil > buYil + 20 ||
    (yil === buYil && ay < buAy)
  ) {
    return { ok: false, alan: 'expiry', mesaj: 'Son kullanma tarihini kontrol edin.' };
  }

  const cvv = String(k.cvv ?? '').replace(/\D/g, '');
  if (cvv.length < 3 || cvv.length > 4) {
    return { ok: false, alan: 'cvv', mesaj: 'CVV kodunu kontrol edin.' };
  }

  return { ok: true, ccNo, ay: String(ay).padStart(2, '0'), yil: String(yil), cvv };
}
