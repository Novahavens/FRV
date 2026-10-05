/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // react-pdf ships Node-only internals; keep it out of the server bundle graph.
  serverExternalPackages: ['@react-pdf/renderer'],
  // pdfkit loads its built-in fonts (Helvetica, Courier, ...) with a dynamic
  // require that output file tracing cannot see, so on Vercel the PDF route
  // failed with "Cannot find module .../standard-fonts/Helvetica.cjs".
  // Ship those files with the function explicitly.
  outputFileTracingIncludes: {
    '/api/claims/[id]/report': [
      './node_modules/pdfkit/js/standard-fonts/**',
      './node_modules/pdfkit/js/data/**',
      './public/brand/**',
    ],
  },
};

export default nextConfig;
