/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sandbox build: keep images unoptimized so the app runs with no remote
  // image service and static placeholders work without configuration.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
