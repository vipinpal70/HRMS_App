/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    optimizeCss: true, // inlines critical CSS, defers the rest
  },
};

export default nextConfig;
