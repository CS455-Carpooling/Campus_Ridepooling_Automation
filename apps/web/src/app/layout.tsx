import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

// latin-ext carries the rupee sign (U+20B9), which fares need.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-plex-sans',
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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-paper focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
