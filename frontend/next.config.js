/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

// Only require @next/bundle-analyzer in development
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
  module.exports = withBundleAnalyzer(nextConfig);
} else {
  module.exports = nextConfig;
}
