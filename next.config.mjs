/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
}

export default nextConfig
