/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          }
        ]
      },
      {
        source: "/hotel-images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
