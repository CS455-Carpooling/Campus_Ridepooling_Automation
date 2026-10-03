import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';
import { Suspense } from 'react';
import { SiteFooter } from '@/components/shell/SiteFooter';
import { SiteHeader, SiteHeaderSkeleton } from '@/components/shell/SiteHeader';
import './globals.css';

// latin-ext carries the rupee sign (U+20B9), which fares need; both fonts have it.
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
});

const plexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin', 'latin-ext'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'Campus Ride-Pooling',
    template: '%s | Campus Ride-Pooling',
  },
  description:
    'Shared rides from IIT Kanpur to the railway station, bus station and airport, with the fare split between the people travelling.',
};

/**
 * Every page shares this shell: a skip link, the header, the main landmark and
 * the footer. Pages render only their content. Pages that need a signed-in
 * user check it themselves with verifySession(); this layout does not protect
 * anything, because layouts are not re-rendered on navigation.
 */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-10 focus:rounded-control focus:bg-paper focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
