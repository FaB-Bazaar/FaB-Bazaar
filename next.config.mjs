/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker standalone production image
  output: 'standalone',

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
