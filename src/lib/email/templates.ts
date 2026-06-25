/**
 * Email şablonları. Sade HTML (inline style) — ileride MJML/React-email migrasyonu mümkün.
 */
import { env } from '../env';

const BASE_STYLE = `
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
color: #14201d;
max-width: 560px;
margin: 0 auto;
padding: 32px 24px;
`;

const BUTTON_STYLE = `
display: inline-block;
padding: 14px 28px;
background: #14201d;
color: #fff !important;
text-decoration: none;
border-radius: 100px;
font-weight: 600;
margin-top: 24px;
`;

function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>Via Mood</title></head>
<body style="margin:0;background:#faf6ec;">
<div style="${BASE_STYLE}">
<h1 style="font-size:24px;color:#e1691f;margin:0 0 24px;">Via Mood</h1>
${content}
<hr style="border:none;border-top:1px solid #e6e0d4;margin:32px 0;">
<p style="font-size:12px;color:#6b7280;">Bu mail Via Mood Vendor Platform'dan otomatik gönderildi.</p>
</div></body></html>`;
}

export function vendorWelcomeEmail(vendorName: string): { subject: string; html: string; text: string } {
  return {
    subject: `Via Mood: Tedarikçi başvurun alındı`,
    html: wrap(`
      <p>Merhaba <strong>${vendorName}</strong>,</p>
      <p>Via Mood pazaryerine tedarikçi başvurun alındı. Ekibimiz inceledikten sonra (genelde 1 iş günü) sana bilgi vereceğiz.</p>
      <p>Bu süre zarfında panele giriş yapabilir, profil bilgilerini güncelleyebilirsin.</p>
      <a href="${env.APP_URL}/dashboard" style="${BUTTON_STYLE}">Panele Git</a>
    `),
    text: `Via Mood başvurun alındı, ${vendorName}. Admin onayı sonrası ürün ekleyebilirsin. Panel: ${env.APP_URL}/dashboard`,
  };
}

export function vendorApprovedEmail(vendorName: string): { subject: string; html: string; text: string } {
  return {
    subject: `🎉 Via Mood tedarikçi başvurun onaylandı`,
    html: wrap(`
      <p>Merhaba <strong>${vendorName}</strong>,</p>
      <p>Tebrikler — başvurun onaylandı! Artık ürün ekleyebilir, stok yönetebilir, sipariş alabilirsin.</p>
      <a href="${env.APP_URL}/products/new" style="${BUTTON_STYLE}">İlk Ürünü Ekle</a>
    `),
    text: `Tebrikler ${vendorName}, başvurun onaylandı. İlk ürünü ekle: ${env.APP_URL}/products/new`,
  };
}

export function vendorRejectedEmail(vendorName: string, reason: string): { subject: string; html: string; text: string } {
  return {
    subject: `Via Mood başvuru sonucu`,
    html: wrap(`
      <p>Merhaba <strong>${vendorName}</strong>,</p>
      <p>Üzgünüz — başvurun bu defa onaylanmadı.</p>
      <p><strong>Sebep:</strong> ${reason}</p>
      <p>Sorularını <a href="mailto:vendor@viamood.com">vendor@viamood.com</a> adresine iletebilirsin.</p>
    `),
    text: `${vendorName}, başvurun onaylanmadı. Sebep: ${reason}. İletişim: vendor@viamood.com`,
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
      subject: `Via Mood siparişin onaylandı — ${p.orderNumber}`,
      html: wrap(`
        <p>Merhaba <strong>${p.customerName || 'değerli müşterimiz'}</strong>,</p>
        <p>Ödemen alındı ✅ — <strong>${p.orderNumber}</strong> numaralı siparişin onaylandı. Toplam: <strong>${tl(p.total)}</strong>.</p>
        <p>Siparişin hazırlanıyor; kargoya verilince seni bilgilendireceğiz.</p>
        <a href="${env.APP_URL}/hesabim" style="${BUTTON_STYLE}">Siparişlerim</a>
      `),
      text: `Via Mood siparişin ${p.orderNumber} onaylandı (ödeme alındı). Toplam ${tl(p.total)}.`,
    };
  }

  if (p.method === 'havale') {
    const banks = p.vendors.filter((v) => v.iban);
    const rows = banks
      .map(
        (v) => `
        <div style="border:1px solid #e6e0d4;border-radius:12px;padding:16px;margin:12px 0;">
          <div style="font-weight:600;">${v.name} — <span style="color:#e1691f;">${tl(v.amount)}</span></div>
          <div style="font-family:monospace;font-size:14px;margin-top:6px;">${v.iban}</div>
          ${v.account_holder ? `<div style="font-size:13px;color:#6b7280;">Alıcı: ${v.account_holder}${v.bank ? ' · ' + v.bank : ''}</div>` : ''}
        </div>`,
      )
      .join('');
    return {
      subject: `Via Mood siparişin alındı — ${p.orderNumber} (havale bekleniyor)`,
      html: wrap(`
        <p>Merhaba <strong>${p.customerName || 'değerli müşterimiz'}</strong>,</p>
        <p>Siparişin <strong>${p.orderNumber}</strong> alındı. Toplam tutar: <strong>${tl(p.total)}</strong>.</p>
        <p>Aşağıdaki hesap(lar)a havale/EFT yaptığında siparişin işleme alınır. Açıklamaya <strong>${p.orderNumber}</strong> yazmayı unutma.</p>
        ${rows || '<p style="color:#6b7280;">Hesap bilgileri ayrıca iletilecektir.</p>'}
        <a href="${env.APP_URL}/hesabim" style="${BUTTON_STYLE}">Siparişlerim</a>
      `),
      text:
        `Via Mood siparişin ${p.orderNumber} alındı. Toplam ${tl(p.total)}. Havale: ` +
        banks.map((v) => `${v.name} ${v.iban} (${tl(v.amount)})`).join(' | ') +
        `. Açıklamaya ${p.orderNumber} yaz.`,
    };
  }

  const odeme = p.codMethod === 'kart' ? 'kapıda kart' : 'kapıda nakit';
  return {
    subject: `Via Mood siparişin alındı — ${p.orderNumber} (kapıda ödeme)`,
    html: wrap(`
      <p>Merhaba <strong>${p.customerName || 'değerli müşterimiz'}</strong>,</p>
      <p>Siparişin <strong>${p.orderNumber}</strong> alındı. Ödeme yöntemin: <strong>${odeme}</strong>.</p>
      <p>Teslimat sırasında kuryeye <strong>${tl(p.total)}</strong> ödeyeceksin.</p>
      <a href="${env.APP_URL}/hesabim" style="${BUTTON_STYLE}">Siparişlerim</a>
    `),
    text: `Via Mood siparişin ${p.orderNumber} alındı. ${odeme}, teslimatta ${tl(p.total)} ödenecek.`,
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
    ? `<a href="${p.trackingUrl}" style="${BUTTON_STYLE}">Kargonu Takip Et</a>`
    : `<a href="${env.APP_URL}/hesabim" style="${BUTTON_STYLE}">Siparişlerim</a>`;
  return {
    subject: `📦 Siparişin kargoya verildi — ${p.orderNumber}`,
    html: wrap(`
      <p>Merhaba <strong>${p.customerName || 'değerli müşterimiz'}</strong>,</p>
      <p><strong>${p.orderNumber}</strong> numaralı siparişin kargoya verildi.</p>
      ${takip}
      ${btn}
    `),
    text:
      `Via Mood siparişin ${p.orderNumber} kargoya verildi.` +
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
      <a href="${env.APP_URL}/hesabim" style="${BUTTON_STYLE}">Siparişlerim</a>
    `),
    text: `Via Mood siparişin ${p.orderNumber} teslim edildi. Afiyet olsun!`,
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
      <a href="${env.APP_URL}/payouts" style="${BUTTON_STYLE}">Ödeme Geçmişini Aç</a>
    `),
    text: `${vendorName}, ${netAmount} ödendi. ${externalRef ? `Ref: ${externalRef}. ` : ''}Detay: ${env.APP_URL}/payouts`,
  };
}
