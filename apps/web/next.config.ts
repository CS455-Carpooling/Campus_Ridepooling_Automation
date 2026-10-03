import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// next/font serves the fonts from this site, so no third-party font host is needed.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProd
            ? [
                { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
                { key: 'Content-Security-Policy', value: contentSecurityPolicy },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
