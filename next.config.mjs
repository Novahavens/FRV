/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // react-pdf ships Node-only internals; keep it out of the server bundle graph.
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
