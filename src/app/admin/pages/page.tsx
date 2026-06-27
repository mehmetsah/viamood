import { getStoreSettings } from '@/lib/settings/store';
import { SITE_PAGES } from '@/lib/storefront/pages';
import { PageEditor } from './PageEditor';

export default async function AdminPagesPage() {
  const { theme } = await getStoreSettings();
  const overrides = (theme as { pages?: Record<string, { title?: string; html?: string }> }).pages ?? {};

  const pages = SITE_PAGES.map((p) => {
    const ov = overrides[p.slug];
    return {
      slug: p.slug,
      title: ov?.title ?? p.title,
      html: ov?.html ?? p.html,
      overridden: !!ov,
    };
  });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">İçerik Sayfaları</h1>
        <p className="text-sm text-neutral-500">Hakkımızda, iletişim, sözleşme ve politika sayfalarının metnini düzenle — kaydedince <code>/sayfa/…</code>'ya yansır.</p>
      </div>
      <PageEditor pages={pages} />
    </div>
  );
}
