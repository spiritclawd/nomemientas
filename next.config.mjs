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

// On Vercel, proxy API calls to the laptop via Cloudflare tunnel
// so YouTube extraction and heavy processing run on the local machine.
// On local dev, the API runs directly (no rewrite needed).
if (process.env.VERCEL) {
  const tunnelUrl = 'https://nomemientas.aircade.xyz'
  nextConfig.rewrites = async () => ({
    beforeFiles: [
      {
        source: '/api/:path*',
        destination: `${tunnelUrl}/api/:path*`,
      },
    ],
  })
}

export default nextConfig