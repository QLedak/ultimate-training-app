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
    // lib/prompts/static-content.ts reads content/**/*.md off disk at
    // request time via fs.readFileSync(path.join(process.cwd(), relativePath)).
    // Vercel's build only bundles files its static tracer can prove a
    // serverless function needs, and it can't follow a path built from a
    // variable (relativePath here) back to a literal file -- so content/
    // silently never made it into the deployed function, producing
    // ENOENT at /var/task/content/... in production even though it reads
    // fine locally off the real filesystem. This tells the tracer to
    // bundle the whole directory for every route regardless.
    outputFileTracingIncludes: {
      "/**": ["./content/**/*"],
    },
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
