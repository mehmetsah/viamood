import { notFound } from 'next/navigation';
import { getSitePage } from '@/lib/storefront/pages';
import { getStoreSettings } from '@/lib/settings/store';

export const dynamic = 'force-dynamic';

/** İçerik sayfaları (hakkımızda, iletişim, sözleşmeler). Varsayılan içerik pages.ts'ten;
 *  admin /admin/theme'den düzenlerse store_settings.theme.pages override eder. */
export default async function SitePageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = getSitePage(slug);
  const { theme } = await getStoreSettings();
  const override = (theme as { pages?: Record<string, { title?: string; html?: string }> }).pages?.[slug];

  const page = override?.html
    ? { title: override.title || def?.title || slug, html: override.html }
    : def;
  if (!page) notFound();

  return (
    <div className="emp">
      <article className="emp-page">
        <div className="emp-wrap">
          <h1 className="emp-page__title">{page.title}</h1>
          {/* eslint-disable-next-line react/no-danger */}
          <div className="emp-page__body" dangerouslySetInnerHTML={{ __html: page.html }} />
        </div>
      </article>
    </div>
  );
}
