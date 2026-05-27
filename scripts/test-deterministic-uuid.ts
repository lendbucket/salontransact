import { deterministicUuid } from "@/lib/subscriptions/billing";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("PASS:", message);
}

// Test 1: same input always produces same output
const input1 = "subscription_invoice_abc123_attempt_1";
const uuid1a = deterministicUuid(input1);
const uuid1b = deterministicUuid(input1);
assert(uuid1a === uuid1b, "Determinism: same input → same output");

// Test 2: different inputs produce different outputs
const uuid2 = deterministicUuid("subscription_invoice_abc123_attempt_2");
assert(uuid1a !== uuid2, "Distinct: different inputs → different outputs");

// Test 3: output matches UUID v4 format
assert(UUID_V4_REGEX.test(uuid1a), `UUID v4 format: ${uuid1a}`);
assert(UUID_V4_REGEX.test(uuid2), `UUID v4 format: ${uuid2}`);

// Test 4: various inputs all produce valid UUIDs
const testInputs = [
  "subscription_invoice_clm00000abc_attempt_1",
  "subscription_invoice_xyz_attempt_999",
  "single",
  "", // empty string edge case
  "x".repeat(1000),  // long input
];
for (const input of testInputs) {
  const uuid = deterministicUuid(input);
  assert(UUID_V4_REGEX.test(uuid), `Valid v4 for input length=${input.length}: ${uuid}`);
}

console.log("\nAll deterministicUuid tests passed.");
