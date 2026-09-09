import Link from 'next/link';
import { Suspense } from 'react';
import CustodyStatusPanel from '@/components/dashboard/CustodyStatusPanel';
import RecentShipmentsPanel from '@/components/dashboard/RecentShipmentsPanel';
import StatementSummaryPanel from '@/components/dashboard/StatementSummaryPanel';

/**
 * Admin → Kargo & Cari
 *
 * KargoLab'deki kargo/zimmet/cari durumunun Via Mood panelindeki tek ekranı.
 * Karma model (C7/D2): özet burada, detay KargoLab'de — "KargoLab'de aç"
 * bağlantıları /admin/kargolab-gecis üzerinden tek kullanımlık jetonla gider,
 * kullanıcı ikinci kez giriş yapmaz.
 *
 * Her panel kendi Suspense'i içinde: KargoLab yavaşsa ya da erişilemezse
 * sayfanın kalanı çalışır kalır.
 */

const skeleton = (
  <section className="mb-8">
    <div className="h-28 rounded-xl bg-neutral-100 animate-pulse" />
  </section>
);

export default function AdminKargoPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Kargo &amp; Cari</h1>
      <p className="text-neutral-600 mb-6">
        KargoLab&apos;deki gönderi, zimmet ve cari durumu. Detaylı işlemler için tek tıkla
        KargoLab paneline geçebilirsiniz.
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/admin/kargolab-gecis?target=shipments"
          className="px-4 py-2 rounded-lg bg-[var(--color-brand-ink)] text-white text-sm font-semibold hover:opacity-90"
        >
          Kargolar →
        </Link>
        <Link
          href="/admin/kargolab-gecis?target=statements"
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50"
        >
          Cari Ekstre →
        </Link>
        <Link
          href="/admin/kargolab-gecis?target=custody"
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50"
        >
          Zimmet →
        </Link>
        <Link
          href="/admin/shipping-rates"
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50"
        >
          Kargo Tarifeleri
        </Link>
      </div>

      <Suspense fallback={skeleton}>
        <CustodyStatusPanel />
      </Suspense>

      <Suspense fallback={skeleton}>
        <StatementSummaryPanel />
      </Suspense>

      <Suspense fallback={skeleton}>
        <RecentShipmentsPanel />
      </Suspense>
    </div>
  );
}
