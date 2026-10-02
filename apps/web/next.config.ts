import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Do not advertise the framework in an X-Powered-By response header.
  poweredByHeader: false,
};

export default nextConfig;
