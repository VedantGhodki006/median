import "server-only"

import {
  ServiceError,
  deleteOrgDataInputSchema,
  parseInput,
} from "@workspace/contracts"
import type {
  DeleteOrgDataInput,
  DeleteOrgDataResult,
  OrgDataExport,
} from "@workspace/contracts"

import type { OrgContext } from "./context"
import { assertCan } from "./context"

/**
 * Everything the organisation has, as a zip: one CSV per table (amounts in
 * integer paise) plus manifest.json. STUB: empty zip bytes with a realistic
 * manifest (the zip library comes in its own PR on Day 6).
 */
export async function exportOrgData(ctx: OrgContext): Promise<OrgDataExport> {
  assertCan(ctx, "report", "export")
  await Promise.resolve()
  const generatedAt = new Date().toISOString()
  return {
    fileName: `median-export-${generatedAt.slice(0, 10)}.zip`,
    mimeType: "application/zip",
    bytes: new Uint8Array(),
    manifest: {
      organizationId: ctx.orgId,
      generatedAt,
      tables: [
        { table: "ledger_accounts", file: "ledger_accounts.csv", rows: 58 },
        { table: "journal_entries", file: "journal_entries.csv", rows: 412 },
        { table: "journal_lines", file: "journal_lines.csv", rows: 1290 },
        { table: "invoices", file: "invoices.csv", rows: 37 },
        { table: "audit_log", file: "audit_log.csv", rows: 905 },
      ],
    },
  }
}

/**
 * Deletes the organisation's data, keeping the books (deletion option A).
 * Owner only, two steps:
 * 1. `{ step: "request" }` → a short-lived token and what will happen;
 * 2. `{ step: "confirm", token, organizationName }` → deletes credentials,
 *    documents, raw payloads, members and contact details now; keeps the
 *    ledger, invoices, credit notes and audit log read-only until
 *    `retentionUntil`; writes a deletion tombstone.
 * Throws FORBIDDEN (not owner), VALIDATION (bad token or name). STUB.
 */
export async function deleteOrgData(
  ctx: OrgContext,
  input: DeleteOrgDataInput
): Promise<DeleteOrgDataResult> {
  assertCan(ctx, "settings", "update")
  if (ctx.role !== "owner") {
    throw new ServiceError(
      "FORBIDDEN",
      "Only the owner can delete the organisation's data."
    )
  }
  const { confirmation } = parseInput(deleteOrgDataInputSchema, input)
  await Promise.resolve()
  const retentionUntil = "2035-03-31"
  if (confirmation.step === "request") {
    return {
      step: "request",
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      summary: {
        deleteNow: [
          { table: "connections", rows: 2 },
          { table: "documents", rows: 64 },
          { table: "source_records", rows: 3120 },
          { table: "member", rows: 3 },
          { table: "parties (contact details)", rows: 41 },
        ],
        retainReadOnly: [
          { table: "journal_entries", rows: 412 },
          { table: "invoices", rows: 37 },
          { table: "credit_notes", rows: 2 },
          { table: "audit_log", rows: 905 },
        ],
        retentionUntil,
      },
    }
  }
  return {
    step: "confirm",
    tombstoneId: crypto.randomUUID(),
    deletedAt: new Date().toISOString(),
    retentionUntil,
  }
}
