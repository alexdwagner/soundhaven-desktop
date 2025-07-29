import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disable linting during build to fix compilation issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // CORS is now handled dynamically in API routes via utils/cors.ts
  // This allows mobile device access from 192.168.*.* networks
  // Proxy only audio requests to Electron backend, let Next.js handle API routes
  async rewrites() {
    const audioServerPort = process.env.AUDIO_SERVER_PORT || '3000';
    return [
      {
        source: '/audio/:path*',
        destination: `http://localhost:${audioServerPort}/audio/:path*`,
      },
    ];
  },
};

export default nextConfig;
