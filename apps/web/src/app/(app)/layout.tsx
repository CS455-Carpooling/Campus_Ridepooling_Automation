import { Suspense, type ReactNode } from 'react';
import { AppHeader, AppHeaderSkeleton } from '@/components/shell/AppHeader';
import { SiteFooter } from '@/components/shell/SiteFooter';

/**
 * Layout of the signed-in app. Access is checked by each page with
 * verifySession(), not here: layouts are not re-rendered on navigation.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<AppHeaderSkeleton />}>
        <AppHeader />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
