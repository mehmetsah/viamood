import { StorefrontHeader } from '@/components/storefront/Header';
import { StorefrontFooter } from '@/components/storefront/Footer';

export const metadata = {
  robots: { index: true, follow: true }, // Public storefront — indexlensin
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="storefront min-h-screen flex flex-col">
      <StorefrontHeader />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
    </div>
  );
}
