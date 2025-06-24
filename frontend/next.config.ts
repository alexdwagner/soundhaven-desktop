import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disable static export in development
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  // Only set distDir for production
  ...(process.env.NODE_ENV === 'production' ? {
    distDir: 'out'
  } : {}),
  // Enable CORS for development
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  // Proxy audio and API requests to Electron backend
  async rewrites() {
    const audioServerPort = process.env.AUDIO_SERVER_PORT || '3000';
    return [
      {
        source: '/audio/:path*',
        destination: `http://localhost:${audioServerPort}/audio/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `http://localhost:${audioServerPort}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
