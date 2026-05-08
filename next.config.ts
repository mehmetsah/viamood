import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
