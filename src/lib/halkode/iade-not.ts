/**
 * Shopify siparişine iade notu düşer.
 *
 * Neden ayrı dosya ve DİNAMİK import ediliyor: iade ucu Shopify erişimi
 * olmadan da çalışabilmeli. Not yazma başarısız olsa bile PARA İADESİ
 * yapılmış olur — bu yüzden not, iadenin başarısını etkilemez, yalnız
 * `payment_refunds.shopify_noted` alanına sonucu yazarız.
 *
 * Mevcut notun ÜSTÜNE yazmaz, ALTINA ekler: sipariş notunda kargo/müşteri
 * bilgileri duruyor olabilir, onları silmek veri kaybı olurdu.
 */
const API_VER = process.env.SHOPIFY_API_VERSION || '2024-10';

export interface IadeNotu {
  tutarTl: number;
  tarih: Date;
  durum: string;
  invoiceId: string;
}

function trTarih(d: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export async function shopifySiparisNotuEkle(shopifyOrderId: string, n: IadeNotu): Promise<string> {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!shop || !token) return 'atlandi: shopify kimligi yok';

  // gid://shopify/Order/123 gelirse sayısal kısmı al (iki biçim de dolaşımda)
  const id = String(shopifyOrderId).replace(/^.*\//, '');
  const base = `https://${shop}/admin/api/${API_VER}/orders/${id}.json`;
  const h = { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };

  const mevcut = await fetch(base, { headers: h });
  if (!mevcut.ok) return `okunamadi: HTTP ${mevcut.status}`;
  const eskiNot = String(((await mevcut.json()) as { order?: { note?: string } }).order?.note ?? '');

  const satir = `iade: ${n.tutarTl.toFixed(2)} TL · ${trTarih(n.tarih)} · durum: ${n.durum} · işlem: ${n.invoiceId}`;
  if (eskiNot.includes(n.invoiceId) && eskiNot.includes('iade:')) return 'zaten yazili';

  const yeniNot = eskiNot ? `${eskiNot}\n${satir}` : satir;
  const yaz = await fetch(base, {
    method: 'PUT', headers: h,
    body: JSON.stringify({ order: { id: Number(id), note: yeniNot } }),
  });
  return yaz.ok ? 'yazildi' : `yazilamadi: HTTP ${yaz.status}`;
}
