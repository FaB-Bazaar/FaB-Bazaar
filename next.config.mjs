/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker standalone production image
  output: 'standalone',

  experimental: {
    // The prod container runs with a read-only root FS (docker-compose
    // `read_only: true`). ISR revalidation tries to persist regenerated pages
    // to `.next/server/app/<route>.html` and fails with EROFS on every hit,
    // flooding the logs (the 2026-08-26 outage post-mortem had to grep past
    // thousands of these). With flushToDisk off, revalidated pages are kept
    // in the in-memory incremental cache instead; the build's prerendered
    // HTML is still read from disk. A tmpfs over `.next/server/app` is NOT an
    // option — it would hide the compiled route files.
    isrFlushToDisk: false,
  },

  async redirects() {
    return [
      // Product rename: Fabby Chat → Volzar (keeps old bookmarks working)
      { source: '/fabby-chat', destination: '/volzar', permanent: false },
      // Page rename: /card-facets → /tags (public browse; API paths unchanged)
      { source: '/card-facets', destination: '/tags', permanent: false },
    ]
  },

  // Ensure trailing slashes are handled consistently
  trailingSlash: false,

  // Disable automatic image optimization if not needed
  images: {
    domains: ['v0.blob.com'],
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Remove console statements ONLY in production using SWC compiler
  compiler: process.env.NODE_ENV === 'production' ? {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  } : {},

  // Disable source maps in production to prevent code inspection in DevTools
  productionBrowserSourceMaps: false,

  // Webpack config to completely disable source maps in production builds
  webpack: (config, { dev }) => {
    if (!dev) {
      config.devtool = false;
    }
    return config;
  },
}

export default nextConfig
