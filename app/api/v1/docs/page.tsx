/**
 * /api/v1/docs
 *
 * Interactive API documentation rendered by Scalar from the engine's
 * OpenAPI spec. Public — no auth required. The actual API endpoints
 * remain auth-protected; only the docs describing them are public.
 *
 * Spec source: /api/v1/openapi.yaml (served by sibling route).
 *
 * Scalar config docs: https://github.com/scalar/scalar
 */

"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export default function ApiDocsPage() {
  return (
    <ApiReferenceReact
      configuration={{
        url: "/api/v1/openapi.yaml",
        title: "Reyna Pay Engine API",
        searchHotKey: "k",
      }}
    />
  );
}
