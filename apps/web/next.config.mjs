/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  transpilePackages: ["@repo/ui"],
  compiler: {
    styledComponents: true,
  },
}

export default nextConfig;
