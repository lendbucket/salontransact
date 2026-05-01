import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Include docs/openapi.yaml in the deployed bundle so the
  // /api/v1/openapi.yaml route can read it at runtime on Vercel.
  outputFileTracingIncludes: {
    "/api/v1/openapi.yaml": ["./docs/openapi.yaml"],
    "/api/master/cert-tests/sessions/*/export": [
      "./lib/cert/templates/cert-test-template.xlsx",
    ],
  },
};

export default nextConfig;
