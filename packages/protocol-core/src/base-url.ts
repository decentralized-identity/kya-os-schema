/**
 * The base URL that every published schema `$id` is templated from.
 *
 * Schema documents are served at `${SCHEMA_BASE_URL}/v1/protocol/<area>/<name>/<version>`
 * so that `$ref` resolution and external validators work against a stable URL.
 * The base URL is parameterized so the publishing host can move without
 * per-document churn: override it by environment for a different host.
 */
export const SCHEMA_BASE_URL: string =
  process.env.KYA_OS_SCHEMA_BASE_URL ?? "https://schema.kya-os.org";

/** Build the canonical `$id` for a protocol schema. */
export function protocolSchemaId(
  area: string,
  name: string,
  version = "v1.0.0",
): string {
  return `${SCHEMA_BASE_URL}/v1/protocol/${area}/${name}/${version}`;
}
