/**
 * Email şablonları. Responsive (mobil uyumlu) HTML — tablo tabanlı akışkan layout,
 * viewport meta + @media sorguları. Taban stiller inline; media query desteklemeyen
 * istemcilerde de okunur kalır. İleride MJML/React-email migrasyonu mümkün.
 */
import { env } from '../env';
import { BRAND_NAME, VENDOR_SUPPORT_EMAIL } from '../brand';

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

const BUTTON_STYLE = `
display: inline-block;
padding: 14px 32px;
background: #14201d;
color: #ffffff !important;
text-decoration: none;
border-radius: 100px;
font-weight: 600;
font-size: 16px;
line-height: 1.2;
margin-top: 24px;
`;

/** Responsive buton — mobilde tam genişlik olur (bkz. .em-btn media query). */
function button(href: string, label: string): string {
  return `<a href="${href}" class="em-btn" style="${BUTTON_STYLE}">${label}</a>`;
}

/**
 * Bulletproof responsive email wrapper.
 * - viewport meta + tablo tabanlı akışkan layout → telefonda düzgün ölçeklenir
 * - <style> içindeki @media ile mobilde padding/başlık/buton ayarlanır
 * - inline stiller taban: media query desteklemeyen istemcilerde de okunur kalır
 */
function wrap(content: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${BRAND_NAME}</title>
<!--[if mso]><style type="text/css">body,table,td,h1,p,a{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style type="text/css">
  html,body{margin:0 !important;padding:0 !important;width:100% !important;background:#faf6ec;}
  *{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;}
  table{border-collapse:collapse !important;}
  img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
  a{color:#e1691f;}
  .em-mono{word-break:break-all;}
  @media only screen and (max-width:600px){
    .em-container{width:100% !important;}
    .em-pad{padding:26px 20px !important;}
    .em-h1{font-size:22px !important;}
    .em-btn{display:block !important;text-align:center !important;padding-left:16px !important;padding-right:16px !important;}
    .em-mono{font-size:13px !important;}
    .em-card{padding:14px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#faf6ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf6ec;width:100%;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" class="em-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td class="em-pad" style="padding:36px 32px;font-family:${FONT};color:#14201d;font-size:16px;line-height:1.6;">
            <h1 class="em-h1" style="font-size:24px;color:#e1691f;margin:0 0 24px;font-weight:700;">${BRAND_NAME}</h1>
            ${content}
            <hr style="border:none;border-top:1px solid #e6e0d4;margin:32px 0 0;" />
            <p style="font-size:12px;color:#6b7280;margin:20px 0 0;">Bu mail ${env.APP_NAME}'dan otomatik gönderildi.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;
}

/**
 * Şifre sıfırlama maili. Buton çalışmayan istemciler için ham adres de basılır.
 * "Hoş geldin" indirim kodu maili (Defter #974).
 *
 * ⚠️ Kod parametre olarak GELİR — bu dosyaya sabit yazma. Çağıran taraf
 * (lib/welcome-signup.ts) değeri sunucu ortam değişkeninden okur; kod hiçbir
 * zaman istemciye gönderilmez.
 */
export function welcomeDiscountEmail(p: {
  name?: string;
  code: string;
}): { subject: string; html: string; text: string } {
  const hitap = p.name ? `Merhaba <strong>${p.name}</strong>,` : 'Merhaba,';
  return {
    subject: `${BRAND_NAME}: %10 hoş geldin indirim kodunuz`,
    html: wrap(`
      <p>${hitap}</p>
      <p>Aramıza hoş geldiniz. İlk siparişinizde kullanabileceğiniz <strong>%10 indirim kodunuz</strong> hazır:</p>
      <div class="em-card" style="margin:24px 0;padding:20px;border:1px dashed #d9cfc0;border-radius:12px;background:#fffdf9;text-align:center;">
        <span class="em-mono" style="font-size:26px;font-weight:700;letter-spacing:2px;color:#14201d;">${p.code}</span>
      </div>
      <p style="font-size:14px;color:#6b6660;">
        Kod <strong>1000₺ ve üzeri ilk siparişinizde</strong> geçerlidir. Ödeme adımında
        indirim kodu alanına yazmanız yeterli.
      </p>
      ${button(`${env.STOREFRONT_URL}`, 'Alışverişe başla')}
      <p style="margin-top:24px;font-size:14px;color:#6b6660;">
        Evinizi düzenleyen ürünlerde size iyi alışverişler dileriz.
      </p>
    `),
    text:
      `${BRAND_NAME} — %10 hoş geldin indiriminiz\n\n` +
      `İndirim kodunuz: ${p.code}\n` +
      `1000₺ ve üzeri ilk siparişinizde geçerlidir.\n\n` +
      `${env.STOREFRONT_URL}`,
  };
}

/**
 * Şifre sıfırlama maili.
 * Linki tıklayamayan istemciler için ham adres de metin olarak basılır.
 * "Bu isteği sen yapmadıysan..." satırı bilinçli: kullanıcı hesabının hedef
 * alındığını fark edebilsin, ama panik yaratmadan.
 */
export function passwordResetEmail(p: {
  name?: string;
  resetUrl: string;
  dakika: number;
}): { subject: string; html: string; text: string } {
  const hitap = p.name ? `Merhaba <strong>${p.name}</strong>,` : 'Merhaba,';
  const sure = p.dakika >= 60 ? `${Math.round(p.dakika / 60)} saat` : `${p.dakika} dakika`;
  return {
    subject: `${BRAND_NAME}: Şifre sıfırlama`,
    html: wrap(`
      <p>${hitap}</p>
      <p>${BRAND_NAME} hesabın için şifre sıfırlama talebi aldık. Yeni şifreni
         belirlemek için aşağıdaki butona tıkla.</p>
      ${button(p.resetUrl, 'Yeni şifre belirle')}
      <p style="margin-top:24px;font-size:14px;color:#6b6660;">
        Bu bağlantı <strong>${sure}</strong> geçerlidir ve yalnızca
        <strong>bir kez</strong> kullanılabilir.
      </p>
      <p style="font-size:14px;color:#6b6660;">
        Buton çalışmazsa bu adresi tarayıcına yapıştır:<br>
        <span class="em-mono" style="font-size:13px;">${p.resetUrl}</span>
      </p>
      <p style="font-size:14px;color:#6b6660;">
        Bu isteği <strong>siz yapmadıysanız</strong> bu maili yok sayabilirsiniz —
        şifreniz değişmez.
      </p>
    `),
    text:
      `${BRAND_NAME} — şifre sıfırlama\n\n` +
      `Yeni şifreni belirlemek için: ${p.resetUrl}\n\n` +
      `Bağlantı ${sure} geçerlidir ve bir kez kullanılabilir.\n` +
      `Bu isteği siz yapmadıysanız bu maili yok sayabilirsiniz — şifreniz değişmez.`,
  };
}

/**
 * DAVET (ilk giriş) e-postası — #992317 / #992334.
 *
 * `passwordResetEmail`in kardeşi; bilinçli İKİ FARK var:
 *   1) Metin "şifreni sıfırla" demez — davet edilen kişinin HENÜZ hesabı yoktur,
 *      "sıfırlama" ifadesi yanıltır ve kişi "ben hesap açmadım ki" diye eler.
 *   2) "Bu isteği siz yapmadıysanız yok sayın" cümlesi KORUNUR ama farklı gerekçeyle:
 *      orada şifre değişmez, burada hesap hiç açılmaz.
 *
 * ⚠ Süre metni parametreden gelir, koda GÖMÜLMEZ — `DAVET_OMRU_SAAT` tek kaynak.
 *   Sabit yazılsaydı ömür değiştiğinde mail yalan söylerdi.
 */
export function daveteEmail(p: {
  davetUrl: string;
  saat: number;
  rolAciklama?: string;
}): { subject: string; html: string; text: string } {
  const ne = p.rolAciklama ? ` (${p.rolAciklama})` : '';
  return {
    subject: `${BRAND_NAME}: Hesabın hazır — parolanı belirle`,
    html: wrap(`
      <p>Merhaba,</p>
      <p>${BRAND_NAME} yönetim paneli için sana bir hesap${ne} açıldı.
         Parolanı <strong>kendin</strong> belirleyeceksin — biz sana parola göndermiyoruz.</p>
      ${button(p.davetUrl, 'Parolamı belirle')}
      <p style="margin-top:24px;font-size:14px;color:#6b6660;">
        Bu bağlantı <strong>${p.saat} saat</strong> geçerlidir ve yalnızca
        <strong>bir kez</strong> kullanılabilir. Parolanı belirlediğin anda bağlantı kapanır.
      </p>
      <p style="font-size:14px;color:#6b6660;">
        Buton çalışmazsa bu adresi tarayıcına yapıştır:<br>
        <span class="em-mono" style="font-size:13px;">${p.davetUrl}</span>
      </p>
      <p style="font-size:14px;color:#6b6660;">
        Bu daveti <strong>beklemiyorsanız</strong> maili yok sayabilirsiniz —
        bağlantı kullanılmadan süresi dolar ve hesap açılmaz.
      </p>
    `),
    text:
      `${BRAND_NAME} — hesabın hazır\n\n` +
      `Parolanı belirlemek için: ${p.davetUrl}\n\n` +
      `Bağlantı ${p.saat} saat geçerlidir ve bir kez kullanılabilir.\n` +
      `Bu daveti beklemiyorsanız maili yok sayabilirsiniz — hesap açılmaz.`,
  };
}

export function vendorWelcomeEmail(vendorName: string): { subject: string; html: string; text: string } {
  return {
    subject: `${BRAND_NAME}: Tedarikçi başvurun alındı`,
    html: wrap(`
      <p>Merhaba <strong>${vendorName}</strong>,</p>
      <p>${BRAND_NAME} pazaryerine tedarikçi başvurun alındı. Ekibimiz inceledikten sonra (genelde 1 iş günü) sana bilgi vereceğiz.</p>
      <p>Bu süre zarfında panele giriş yapabilir, profil bilgilerini güncelleyebilirsin.</p>
      ${button(`${env.APP_URL}/dashboard`, 'Panele Git')}
    `),
    text: `${BRAND_NAME} başvurun alındı, ${vendorName}. Admin onayı sonrası ürün ekleyebilirsin. Panel: ${env.APP_URL}/dashboard`,
  };
}

export function vendorApprovedEmail(vendorName: string): { subject: string; html: string; text: string } {
  return {
    subject: `🎉 ${BRAND_NAME} tedarikçi başvurun onaylandı`,
    html: wrap(`
      <p>Merhaba <strong>${vendorName}</strong>,</p>
      <p>Tebrikler — başvurun onaylandı! Artık ürün ekleyebilir, stok yönetebilir, sipariş alabilirsin.</p>
      ${button(`${env.APP_URL}/products/new`, 'İlk Ürünü Ekle')}
    `),
    text: `Tebrikler ${vendorName}, başvurun onaylandı. İlk ürünü ekle: ${env.APP_URL}/products/new`,
  };
}

export function vendorRejectedEmail(vendorName: string, reason: string): { subject: string; html: string; text: string } {
  return {
    subject: `${BRAND_NAME} başvuru sonucu`,
    html: wrap(`
      <p>Merhaba <strong>${vendorName}</strong>,</p>
      <p>Üzgünüz — başvurun bu defa onaylanmadı.</p>
      <p><strong>Sebep:</strong> ${reason}</p>
      <p>Sorularını <a href="mailto:${VENDOR_SUPPORT_EMAIL}">${VENDOR_SUPPORT_EMAIL}</a> adresine iletebilirsin.</p>
    `),
    text: `${vendorName}, başvurun onaylanmadı. Sebep: ${reason}. İletişim: ${VENDOR_SUPPORT_EMAIL}`,
  };
}

/**
 * Native sipariş onay e-postası (FAZ 2). Shopify `send_receipt` yerine geçer.
 * Havale → her tedarikçinin IBAN'ı + tutarı. COD → kapıda ödeme bilgisi.
 */
export function orderConfirmationEmail(p: {
  orderNumber: string;
  customerName: string;
  total: number; // TL
  method: 'havale' | 'cod' | 'card';
  codMethod?: 'nakit' | 'kart' | '';
  vendors: Array<{ name: string; iban?: string; account_holder?: string; bank?: string; amount: number }>;
}): { subject: string; html: string; text: string } {
  const tl = (n: number) =>
    n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

  if (p.method === 'card') {
    return {
      subject: `${BRAND_NAME} siparişin onaylandı — ${p.orderNumber}`,
      html: wrap(`
        <p>Merhaba <strong>${p.customerName || 'değerli müşterimiz'}</strong>,</p>
        <p>Ödemen alındı ✅ — <strong>${p.orderNumber}</strong> numaralı siparişin onaylandı. Toplam: <strong>${tl(p.total)}</strong>.</p>
        <p>Siparişin hazırlanıyor; kargoya verilince seni bilgilendireceğiz.</p>
        ${button(`${env.APP_URL}/hesabim`, 'Siparişlerim')}
      `),
      text: `${BRAND_NAME} siparişin ${p.orderNumber} onaylandı (ödeme alındı). Toplam ${tl(p.total)}.`,
    };
  }

  if (p.method === 'havale') {
    const banks = p.vendors.filter((v) => v.iban);
    const rows = banks
      .map(
        (v) => `
        <div class="em-card" style="border:1px solid #e6e0d4;border-radius:12px;padding:16px;margin:12px 0;">
          <div style="font-weight:600;">${v.name} — <span style="color:#e1691f;">${tl(v.amount)}</span></div>
          <div class="em-mono" style="font-family:monospace;font-size:14px;margin-top:6px;word-break:break-all;">${v.iban}</div>
          ${v.account_holder ? `<div style="font-size:13px;color:#6b7280;">Alıcı: ${v.account_holder}${v.bank ? ' · ' + v.bank : ''}</div>` : ''}
        </div>`,
      )
      .join('');
    return {
      subject: `${BRAND_NAME} siparişin alındı — ${p.orderNumber} (havale bekleniyor)`,
      html: wrap(`
        <p>Merhaba <strong>${p.customerName || 'değerli müşterimiz'}</strong>,</p>
        <p>Siparişin <strong>${p.orderNumber}</strong> alındı. Toplam tutar: <strong>${tl(p.total)}</strong>.</p>
        <p>Aşağıdaki hesap(lar)a havale/EFT yaptığında siparişin işleme alınır. Açıklamaya <strong>${p.orderNumber}</strong> yazmayı unutma.</p>
        ${rows || '<p style="color:#6b7280;">Hesap bilgileri ayrıca iletilecektir.</p>'}
        ${button(`${env.APP_URL}/hesabim`, 'Siparişlerim')}
      `),
      text:
        `${BRAND_NAME} siparişin ${p.orderNumber} alındı. Toplam ${tl(p.total)}. Havale: ` +
        banks.map((v) => `${v.name} ${v.iban} (${tl(v.amount)})`).join(' | ') +
        `. Açıklamaya ${p.orderNumber} yaz.`,
    };
  }

  const odeme = p.codMethod === 'kart' ? 'kapıda kart' : 'kapıda nakit';
  return {
    subject: `${BRAND_NAME} siparişin alındı — ${p.orderNumber} (kapıda ödeme)`,
    html: wrap(`
      <p>Merhaba <strong>${p.customerName || 'değerli müşterimiz'}</strong>,</p>
      <p>Siparişin <strong>${p.orderNumber}</strong> alındı. Ödeme yöntemin: <strong>${odeme}</strong>.</p>
      <p>Teslimat sırasında kuryeye <strong>${tl(p.total)}</strong> ödeyeceksin.</p>
      ${button(`${env.APP_URL}/hesabim`, 'Siparişlerim')}
    `),
    text: `${BRAND_NAME} siparişin ${p.orderNumber} alındı. ${odeme}, teslimatta ${tl(p.total)} ödenecek.`,
  };
}

/** Native sipariş kargoya verildi e-postası (FAZ 2 Dilim 3). Shopify shipment maili yerine. */
export function orderShippedEmail(p: {
  orderNumber: string;
  customerName: string;
  carrier?: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const takip = p.trackingNumber
    ? `<p>Takip no: <strong>${p.trackingNumber}</strong>${p.carrier ? ` · ${p.carrier}` : ''}</p>`
    : '';
  const btn = p.trackingUrl
    ? button(p.trackingUrl, 'Kargonu Takip Et')
    : button(`${env.APP_URL}/hesabim`, 'Siparişlerim');
  return {
    subject: `📦 Siparişin kargoya verildi — ${p.orderNumber}`,
    html: wrap(`
      <p>Merhaba <strong>${p.customerName || 'değerli müşterimiz'}</strong>,</p>
      <p><strong>${p.orderNumber}</strong> numaralı siparişin kargoya verildi.</p>
      ${takip}
      ${btn}
    `),
    text:
      `${BRAND_NAME} siparişin ${p.orderNumber} kargoya verildi.` +
      (p.trackingNumber ? ` Takip: ${p.trackingNumber}${p.carrier ? ' (' + p.carrier + ')' : ''}.` : '') +
      (p.trackingUrl ? ` ${p.trackingUrl}` : ''),
  };
}

/** Native sipariş teslim edildi e-postası (FAZ 2 Dilim 3). */
export function orderDeliveredEmail(p: {
  orderNumber: string;
  customerName: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `✅ Siparişin teslim edildi — ${p.orderNumber}`,
    html: wrap(`
      <p>Merhaba <strong>${p.customerName || 'değerli müşterimiz'}</strong>,</p>
      <p><strong>${p.orderNumber}</strong> numaralı siparişin teslim edildi. Afiyet olsun!</p>
      <p>Ürünlerimizi beğendiysen değerlendirmen bizim için çok kıymetli.</p>
      ${button(`${env.APP_URL}/hesabim`, 'Siparişlerim')}
    `),
    text: `${BRAND_NAME} siparişin ${p.orderNumber} teslim edildi. Afiyet olsun!`,
  };
}

export function payoutPaidEmail(
  vendorName: string,
  netAmount: string,
  externalRef: string | null,
): { subject: string; html: string; text: string } {
  return {
    subject: `💸 Ödemen yapıldı — ${netAmount}`,
    html: wrap(`
      <p>Merhaba <strong>${vendorName}</strong>,</p>
      <p>Hak edişlerin için <strong>${netAmount}</strong> tutarındaki ödeme banka hesabına gönderildi.</p>
      ${externalRef ? `<p><strong>Banka referansı:</strong> ${externalRef}</p>` : ''}
      <p>Ödemenin hesabına geçişi 1-3 iş günü sürebilir.</p>
      ${button(`${env.APP_URL}/payouts`, 'Ödeme Geçmişini Aç')}
    `),
    text: `${vendorName}, ${netAmount} ödendi. ${externalRef ? `Ref: ${externalRef}. ` : ''}Detay: ${env.APP_URL}/payouts`,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * OTOMATİK AKIŞ MAİLLERİ (#994057) — hoş geldin · sepet terki · checkout terki
 *
 * ⚠ TİCARİ DİL TASLAKTIR: bu yedi metnin onayı md.31 gereği ŞAH + Ayşe'dedir.
 * Kod ayağı metne bağımlı DEĞİL — `akisMaili` tek kapı, onaylı metin gelince
 * yalnız bu blok değişir, gönderim katmanı değişmez.
 *
 * ⚠ İNDİRİM CÜMLESİ TEK YERDEN: `indirimCumlesi()`. Eski `welcomeDiscountEmail`
 * "1000₺ ve üzeri ilk siparişinizde geçerlidir" diyor — Yunus'un #994057 spec'i
 * ise "%10 · 1.500₺ üstünde indirim 300₺'de tavanlanır". İkisi AYNI DEĞİL; eski
 * şablon bilerek DEĞİŞTİRİLMEDİ (statik kodla çalışan ayrı akış, ürün yönü kararı
 * sahibin) ama yeni akışlar spec'in cümlesini kullanır.
 * ────────────────────────────────────────────────────────────────────────── */

/** Spec'in indirim kuralının tek cümlelik, müşteriye dönük hâli. */
export function indirimCumlesi(yuzde: number, esikTl: number, tavanTl: number): string {
  return `%${yuzde} indirim · ${esikTl.toLocaleString('tr-TR')}₺ üzeri siparişlerde indirim en çok ${tavanTl.toLocaleString('tr-TR')}₺ olarak uygulanır.`;
}

function kodKutusu(kod: string): string {
  return `<div class="em-card" style="margin:24px 0;padding:20px;border:1px dashed #d9cfc0;border-radius:12px;background:#fffdf9;text-align:center;">
        <span class="em-mono" style="font-size:26px;font-weight:700;letter-spacing:2px;color:#14201d;">${kod}</span>
      </div>`;
}

function kucukNot(metin: string): string {
  return `<p style="font-size:14px;line-height:1.5;color:#6b6660;">${metin}</p>`;
}

export interface AkisMailGirdi {
  /** hos_geldin | sepet_terki | checkout_terki */
  akis: string;
  adim: number;
  name?: string | null;
  /** Kuponlu adımda ZORUNLU; kuponsuz adımda verilmez. */
  kod?: string | null;
  /** Kuponun son geçerlilik günü — "7 gün" yerine müşteriye TARİH yazılır. */
  bitisAni?: Date | null;
  /** Sepeti/checkout'u tamamlama bağlantısı (yoksa vitrin adresi). */
  devamUrl?: string | null;
  yuzde?: number;
  esikTl?: number;
  tavanTl?: number;
}

/**
 * Akış maili — TEK KAPI. Bilinmeyen akış/adım için `null` döner; çağıran o satırı
 * 'atlandi' işaretler. ⛔ Burada `throw` YOK: tek bir eksik metin yüzünden
 * zamanlayıcının tüm turu düşerse öteki müşterilerin maili de gitmez.
 */
export function akisMaili(g: AkisMailGirdi): { subject: string; html: string; text: string } | null {
  const hitap = g.name ? `Merhaba <strong>${g.name}</strong>,` : 'Merhaba,';
  const devam = g.devamUrl || env.STOREFRONT_URL;
  const kural = indirimCumlesi(g.yuzde ?? 10, g.esikTl ?? 1500, g.tavanTl ?? 300);
  const tarih = g.bitisAni
    ? g.bitisAni.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const sure = tarih ? `Kod <strong>${tarih}</strong> tarihine kadar geçerli.` : '';
  const kodlu = (g.kod ?? '').trim();

  const yaz = (subject: string, govde: string, duz: string) => ({
    subject,
    html: wrap(govde),
    text: `${BRAND_NAME} — ${subject}\n\n${duz}\n\n${devam}`,
  });

  if (g.akis === 'hos_geldin' && g.adim === 1) {
    if (!kodlu) return null;
    return yaz(`${BRAND_NAME}: indirim kodunuz hazır`, `
      <p>${hitap}</p>
      <p>Aramıza hoş geldiniz. İlk siparişinizde kullanabileceğiniz <strong>kişisel indirim kodunuz</strong>:</p>
      ${kodKutusu(kodlu)}
      ${kucukNot(`${kural} ${sure} Kod yalnızca size tanımlıdır ve bir kez kullanılır.`)}
      ${button(devam, 'Alışverişe başla')}
    `, `İndirim kodunuz: ${kodlu}\n${kural}${tarih ? `\nSon gün: ${tarih}` : ''}`);
  }

  if (g.akis === 'hos_geldin' && g.adim === 2) {
    return yaz(`${BRAND_NAME}: indirim kodunuzu kullanmayı unutmayın`, `
      <p>${hitap}</p>
      <p>İndirim kodunuz hâlâ hesabınızda duruyor${tarih ? ` ve <strong>${tarih}</strong> tarihinde sona eriyor` : ''}.</p>
      ${kodlu ? kodKutusu(kodlu) : ''}
      ${kucukNot(kural)}
      ${button(devam, 'Ürünlere göz at')}
    `, `İndirim kodunuz hâlâ geçerli${tarih ? ` (son gün ${tarih})` : ''}.${kodlu ? `\nKod: ${kodlu}` : ''}`);
  }

  if (g.akis === 'sepet_terki' && g.adim === 1) {
    return yaz(`${BRAND_NAME}: sepetinizi sizin için ayırdık`, `
      <p>${hitap}</p>
      <p>Sepetinizdeki ürünler duruyor. Kaldığınız yerden devam edebilirsiniz.</p>
      ${button(devam, 'Sepetime dön')}
      ${kucukNot('Stoklar sınırlı olabilir; ürünlerin ayrılması garanti edilmez.')}
    `, 'Sepetinizdeki ürünler duruyor — kaldığınız yerden devam edebilirsiniz.');
  }

  if (g.akis === 'sepet_terki' && g.adim === 2) {
    if (!kodlu) return null;
    return yaz(`${BRAND_NAME}: sepetiniz için indirim kodunuz`, `
      <p>${hitap}</p>
      <p>Kararınızı kolaylaştırmak için sepetinize özel bir indirim kodu tanımladık:</p>
      ${kodKutusu(kodlu)}
      ${kucukNot(`${kural} ${sure} Kod yalnızca size tanımlıdır ve bir kez kullanılır.`)}
      ${button(devam, 'Sepetimi tamamla')}
    `, `Sepetinize özel indirim kodu: ${kodlu}\n${kural}${tarih ? `\nSon gün: ${tarih}` : ''}`);
  }

  if (g.akis === 'sepet_terki' && g.adim === 3) {
    return yaz(`${BRAND_NAME}: sepetiniz için son hatırlatma`, `
      <p>${hitap}</p>
      <p>Sepetinizi kapatmadan önce son bir hatırlatma yapmak istedik.</p>
      ${button(devam, 'Sepetime dön')}
      ${kucukNot('Bu konuda size bir daha yazmayacağız.')}
    `, 'Sepetiniz için son hatırlatma.');
  }

  if (g.akis === 'checkout_terki' && g.adim === 1) {
    return yaz(`${BRAND_NAME}: ödeme adımınız yarım kaldı`, `
      <p>${hitap}</p>
      <p>Siparişiniz ödeme adımında kaldı. Bıraktığınız yerden tek dokunuşla tamamlayabilirsiniz.</p>
      ${button(devam, 'Siparişimi tamamla')}
      ${kucukNot('Ödeme sayfası 3D Secure ile korunur; kart bilgileri tarafımızda saklanmaz.')}
    `, 'Siparişiniz ödeme adımında kaldı — bıraktığınız yerden tamamlayabilirsiniz.');
  }

  if (g.akis === 'checkout_terki' && g.adim === 2) {
    if (!kodlu) return null;
    return yaz(`${BRAND_NAME}: siparişiniz için indirim kodunuz`, `
      <p>${hitap}</p>
      <p>Yarım kalan siparişiniz için size özel bir indirim kodu tanımladık:</p>
      ${kodKutusu(kodlu)}
      ${kucukNot(`${kural} ${sure} Kod yalnızca size tanımlıdır ve bir kez kullanılır.`)}
      ${button(devam, 'Siparişimi tamamla')}
    `, `Siparişiniz için indirim kodu: ${kodlu}\n${kural}${tarih ? `\nSon gün: ${tarih}` : ''}`);
  }

  return null;
}
