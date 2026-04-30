/**
 * OpenAPI spec generator for the Reyna Pay engine.
 *
 * Reads lib/api/v1/openapi/registry.ts and emits docs/openapi.yaml.
 *
 * Usage:
 *   npm run openapi:generate
 *
 * Run after any registry change. Commit the generated docs/openapi.yaml
 * alongside the schema changes that caused the regeneration.
 */

import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import yaml from "js-yaml";
import registry from "../lib/api/v1/openapi/registry";

const OUTPUT_PATH = "docs/openapi.yaml";

function main(): void {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  const spec = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Reyna Pay Engine API",
      version: "v1",
      description: [
        "The Reyna Pay engine processes payments, manages customers,",
        "tokenizes cards, tracks risk, and exposes reporting.",
        "",
        "All endpoints under /api/v1/* require an API key passed via",
        "the `Authorization: Bearer <key>` header. POST endpoints",
        "additionally require an `Idempotency-Key: <UUID v4>` header",
        "to prevent duplicate processing.",
        "",
        "See https://docs.reynapay.com for integration guides.",
      ].join("\n"),
      contact: {
        name: "Reyna Pay Engineering",
        email: "engineering@reynapay.com",
      },
    },
    servers: [
      {
        url: "https://portal.salontransact.com",
        description: "Production",
      },
    ],
  });

  // Ensure output directory exists
  const dir = dirname(OUTPUT_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const yamlOutput = yaml.dump(spec, {
    noRefs: true,
    lineWidth: 100,
    sortKeys: false,
  });

  writeFileSync(OUTPUT_PATH, yamlOutput, "utf-8");

  console.log(`✅ OpenAPI spec written to ${OUTPUT_PATH}`);
  console.log(`   Paths registered: ${Object.keys(spec.paths ?? {}).length}`);
  console.log(
    `   Components/schemas: ${Object.keys(spec.components?.schemas ?? {}).length}`
  );
}

main();
