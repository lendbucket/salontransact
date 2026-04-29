/**
 * Re-export formatTransactionAsCharge as transactionToCharge for semantic clarity.
 * GET /charges/[id] and GET /charges (list) both use this.
 */
export { formatTransactionAsCharge as transactionToCharge } from "./format";
