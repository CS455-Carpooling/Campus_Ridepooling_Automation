'use client';

// Manrope and IBM Plex Mono from Google Fonts, the font host that the site's
// Content-Security-Policy allows (next.config.ts). Both include the rupee sign
// (U+20B9), which fares need.
export const DESIGN_SYSTEM_FONTS =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400..800&display=swap';

/**
 * The font stylesheet of the design system, rendered in place. It is a client
 * component because Next.js renders the 404 page's server components on every
 * request, and React preloads any stylesheet it meets there on every page.
 */
export function DesignSystemFonts() {
  return <link rel="stylesheet" href={DESIGN_SYSTEM_FONTS} />;
}
