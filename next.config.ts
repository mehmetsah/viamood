import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { NextConfig } from 'next';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // KYC evrak yüklemesi için
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'via-mood.myshopify.com' },
    ],
  },
  serverExternalPackages: ['postgres', 'bullmq', 'iyzipay'],
};

export default nextConfig;
