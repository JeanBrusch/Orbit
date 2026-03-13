/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      // ── Static/immutable assets: cache forever ──────────────────────────
      // Atlas object storage images (already set in their route, but belt+suspenders)
      {
        source: '/api/objects/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },

      // ── AI suggestion endpoint: short cache (content changes slowly) ────
      // 30s is enough to avoid duplicate calls when lead panel reopens
      {
        source: '/api/lead/:id/suggest',
        headers: [
          { key: 'Cache-Control', value: 's-maxage=30, stale-while-revalidate=60' },
        ],
      },

      // ── Property match endpoint: cache per-property for 2 minutes ───────
      {
        source: '/api/match/:path*',
        headers: [
          { key: 'Cache-Control', value: 's-maxage=120, stale-while-revalidate=300' },
        ],
      },

      // ── Public lead capsule (shared link): short private cache ──────────
      {
        source: '/api/public/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, no-store, must-revalidate' },
        ],
      },

      // ── Webhook & write endpoints: never cache ───────────────────────────
      {
        source: '/api/webhook/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/api/whatsapp/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },

      // ── All other API routes: revalidate on every request but allow CDN
      //    to serve stale for 1s (avoids thundering herd, not a real cache) ─
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },

      // ── Next.js pages & static files: rely on Next.js defaults ──────────
      // (no catch-all for /:path* — removing the old global rule that was
      //  incorrectly disabling cache even for _next/static assets)
    ]
  },
  devIndicators: false,
  allowedDevOrigins: [
    'https://*.replit.dev',
    'https://*.spock.replit.dev',
  ],
}

export default nextConfig
