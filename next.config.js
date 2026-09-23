const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
    // Next.js 14.x requires opting in explicitly to use instrumentation.ts
    // (the file Sentry's server/edge init now lives in — see instrumentation.ts).
    // This becomes on-by-default in Next.js 15+, so this line can be removed
    // whenever this app upgrades past 14.
    instrumentationHook: true,
  },
};

// withSentryConfig only affects the BUILD (source map upload, some
// automatic instrumentation) — it's harmless to leave wrapped even before
// Sentry is configured. Source maps aren't uploaded anywhere unless
// SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are also set (see
// .env.local.example); until then this just silently does nothing extra.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
});
