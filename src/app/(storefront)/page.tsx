import { getStoreSettings } from '@/lib/settings/store';
import { getStorefrontProducts } from '@/lib/storefront/products';
import { resolveHomeSections } from '@/lib/storefront/sections';
import { SectionRenderer } from './_home/SectionRenderer';

export const dynamic = 'force-dynamic';

/** Anasayfa — config-tabanlı section render (store_settings.theme.homeSections, /admin/theme'den düzenlenebilir). */
export default async function HomePage() {
  const products = await getStorefrontProducts({ limit: 24 });
  const { theme } = await getStoreSettings();
  const sections = resolveHomeSections((theme as { homeSections?: unknown }).homeSections);

  return (
    <div className="emp">
      {sections.filter((s) => s.visible).map((s) => (
        <SectionRenderer key={s.id} section={s} products={products} />
      ))}
    </div>
  );
}
