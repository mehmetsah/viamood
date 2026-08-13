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
