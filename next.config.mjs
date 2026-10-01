/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The calculation is deterministic and server-side; keep payloads small.
    typedRoutes: true,
  },
};

export default nextConfig;
