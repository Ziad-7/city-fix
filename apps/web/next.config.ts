import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The old static demo page moved to the /smart-bin route.
  async redirects() {
    return [{ source: '/smart-bin-simulator.html', destination: '/smart-bin', permanent: true }];
  },
};

export default nextConfig;
