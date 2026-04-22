import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/favicon.svg',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000'
      },
      {
        protocol: 'http',
        hostname: 'localhost'
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '4000'
      },
      {
        protocol: 'http',
        hostname: '::1'
      },
      {
        protocol: 'http',
        hostname: '0.0.0.0'
      }
    ]
  },
  generateBuildId: async () => {
    return process.env['RELEASE_SHA'] || 'local';
  },
};

export default withNextIntl(nextConfig);
