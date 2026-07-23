/** @type {import('next').NextConfig} */

// Sandbox CSP. Kept functional for Next's hydration/styles; tighten with nonces
// before production (see SECURITY_NOTES.md). 'unsafe-inline' is required here for
// Next's inline bootstrap script and next/font styles.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Static preview mode (JME_STATIC_PREVIEW=1): exports the storefront as plain
// HTML for GitHub Pages. API routes and /ops are stripped by the preview
// workflow before this build runs; forms are disabled behind a visible banner.
const staticPreview = process.env.JME_STATIC_PREVIEW === "1";

const nextConfig = {
  reactStrictMode: true,
  // Sandbox build: keep images unoptimized so the app runs with no remote
  // image service and static placeholders work without configuration.
  images: {
    unoptimized: true,
  },
  ...(staticPreview
    ? {
        output: "export",
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
      }
    : {
        // Self-contained server build for the Dockerfile (node .next/standalone/server.js).
        output: "standalone",
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
