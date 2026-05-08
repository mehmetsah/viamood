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
