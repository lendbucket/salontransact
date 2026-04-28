/**
 * API key types — public-facing shapes (full key never leaves the create endpoint).
 */

export interface ApiKeyPublic {
  id: string;
  merchantId: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  lastUsed: string | null;
  createdAt: string;
}

export interface ApiKeyListResponse {
  data: ApiKeyPublic[];
  count: number;
  activeCount: number;
}

/**
 * Returned ONCE on POST /api/api-keys — the full key is shown to the user
 * exactly one time and never stored in plaintext-readable form. Future
 * GET responses return only ApiKeyPublic.
 */
export interface ApiKeyCreatedResponse extends ApiKeyPublic {
  fullKey: string;
}

/**
 * Master view: includes merchant info for grouping and filtering.
 */
export interface MasterApiKeyRow extends ApiKeyPublic {
  merchantBusinessName: string;
}

export interface MasterApiKeyListResponse {
  data: MasterApiKeyRow[];
  count: number;
  activeCount: number;
  merchantsRepresented: number;
}
