// Median service layer. Every function takes an OrgContext first (get it
// with requireOrgContext()) and throws ServiceError on expected failures.
// Types and schemas live in @workspace/contracts and are re-exported here so
// existing imports keep working; import them from @workspace/contracts.

export * from "@workspace/contracts"
export type { OrgContext } from "./context"
export { assertCan, requireOrgContext } from "./context"

export * from "./accounts"
export * from "./audit"
export * from "./bank"
export * from "./connectors"
export * from "./consent"
export * from "./credit-notes"
export * from "./dashboard"
export * from "./data-rights"
export * from "./extraction"
export * from "./gst"
export * from "./gst-profile"
export * from "./gstr1"
export * from "./inbox"
export * from "./invoices"
export { postManualEntry, reverseEntry } from "./ledger"
export * from "./parties"
export * from "./periods"
export * from "./razorpay"
export * from "./reports"
export * from "./tally"
