import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { auth } from '@/lib/auth';
import { buildProfitabilityReport } from '@/lib/server/profitability-report';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const r = await buildProfitabilityReport();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Via Mood Vendor Platform';
  wb.created = new Date();

  // Sheet 1: Özet
  const sumSheet = wb.addWorksheet('Özet');
  sumSheet.columns = [
    { header: 'Metrik', key: 'metric', width: 36 },
    { header: 'Değer', key: 'value', width: 18 },
  ];
  sumSheet.addRows([
    { metric: 'Toplam variant', value: r.totalVariants },
    { metric: 'Pricing girilmiş', value: r.withPricing },
    { metric: 'Pricing eksik', value: r.withoutPricing },
    { metric: 'Trendyol ortalama kâr %', value: r.averageTrendyolPct.toFixed(2) },
    { metric: 'Instagram ortalama kâr %', value: r.averageInstagramPct.toFixed(2) },
    { metric: 'Kârlı (%25+)', value: r.countProfitable },
    { metric: 'Dikkat (%15-25)', value: r.countWarning },
    { metric: 'Zararlı (<%15)', value: r.countLoss },
    { metric: 'Ortalama kargo (TL)', value: r.averageKargoTl.toFixed(2) },
    { metric: 'Ortalama komisyon (TL)', value: r.averageCommissionTl.toFixed(2) },
    { metric: 'Ortalama reklam (TL)', value: r.averageAdvertisingTl.toFixed(2) },
    { metric: 'Toplam stok değeri (TL)', value: r.totalStockValueTl.toFixed(2) },
  ]);
  sumSheet.getRow(1).font = { bold: true };

  // Sheet 2: Variantlar
  const sheet = wb.addWorksheet('Ürünler');
  sheet.columns = [
    { header: 'Ürün adı', key: 'productTitle', width: 50 },
    { header: 'Tedarikçi', key: 'vendorName', width: 24 },
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Desi', key: 'desi', width: 8 },
    { header: 'Alış KDVsiz', key: 'purchaseExclVat', width: 14 },
    { header: 'Alış KDVli', key: 'purchaseInclVat', width: 14 },
    { header: 'Trendyol satış', key: 'trendyolPrice', width: 14 },
    { header: 'Trendyol komisyon esas', key: 'trendyolCommissionBase', width: 20 },
    { header: 'Trendyol komisyon %', key: 'trendyolCommissionPct', width: 16 },
    { header: 'Trendyol kâr TL', key: 'trendyolProfitTl', width: 14 },
    { header: 'Trendyol kâr %', key: 'trendyolProfitPct', width: 14 },
    { header: 'Instagram satış', key: 'instagramPrice', width: 14 },
    { header: 'Instagram kâr TL', key: 'instagramProfitTl', width: 14 },
    { header: 'Instagram kâr %', key: 'instagramProfitPct', width: 14 },
    { header: 'Kargo (TL)', key: 'kargoTl', width: 12 },
    { header: 'Komisyon (TL)', key: 'commissionTl', width: 14 },
    { header: 'Reklam (TL)', key: 'advertisingTl', width: 12 },
    { header: 'Paketleme (TL)', key: 'packagingTl', width: 14 },
    { header: 'Stok', key: 'available', width: 8 },
    { header: 'Stok değeri (TL)', key: 'stockValueTl', width: 16 },
    { header: 'Eklenme', key: 'createdAt', width: 12 },
  ];

  for (const row of r.rows) {
    sheet.addRow({
      productTitle: row.productTitle,
      vendorName: row.vendorName,
      sku: row.sku ?? '',
      status: row.status,
      desi: row.config.desi ?? '',
      purchaseExclVat: row.purchaseExclVat || '',
      purchaseInclVat: row.config.purchasePriceInclVat ?? '',
      trendyolPrice: row.trendyolPrice ?? '',
      trendyolCommissionBase: row.config.trendyolCommissionBase ?? '',
      trendyolCommissionPct: row.config.trendyolCommissionPct ?? '',
      trendyolProfitTl: row.trendyolProfitTl ?? '',
      trendyolProfitPct: row.trendyolProfitPct != null ? +row.trendyolProfitPct.toFixed(2) : '',
      instagramPrice: row.instagramPrice ?? '',
      instagramProfitTl: row.instagramProfitTl ?? '',
      instagramProfitPct: row.instagramProfitPct != null ? +row.instagramProfitPct.toFixed(2) : '',
      kargoTl: row.kargoTl ?? '',
      commissionTl: row.commissionTl ?? '',
      advertisingTl: row.advertisingTl,
      packagingTl: row.packagingTl,
      available: row.available,
      stockValueTl: +row.stockValueTl.toFixed(2),
      createdAt: row.createdAt.toISOString().slice(0, 10),
    });
  }
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF14201D' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Number formats
  ['F', 'G', 'H', 'I', 'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'U'].forEach((col) => {
    sheet.getColumn(col).numFmt = '#,##0.00';
  });
  ['J', 'L', 'O'].forEach((col) => {
    sheet.getColumn(col).numFmt = '0.00';
  });

  const buf = await wb.xlsx.writeBuffer();
  const filename = `via-mood-karlilik-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
