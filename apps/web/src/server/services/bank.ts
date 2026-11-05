import "server-only"

import type { OrgContext } from "./context"
import { requireConsent } from "./consent"
import { assertCan } from "./context"
import {
  bankRowSchema,
  importBankRowsOptionsSchema,
  parseInput,
} from "@workspace/contracts"
import type {
  BankImportResult,
  ImportBankRowsOptions,
} from "@workspace/contracts"

/**
 * Imports bank lines, matches them deterministically and sends the rest to
 * the inbox. Invalid rows are reported in `errors`, not thrown. Safe to
 * re-import the same statement. Throws CONSENT_REQUIRED.
 *
 * @deprecated Use `importFile(ctx, "bank-statement", { kind: "rows", … },
 * { connectionId })`. STUB.
 */
export async function importBankRows(
  ctx: OrgContext,
  rows: readonly unknown[],
  options: ImportBankRowsOptions
): Promise<BankImportResult> {
  assertCan(ctx, "ledger", "post")
  parseInput(importBankRowsOptionsSchema, options)
  await requireConsent(ctx)
  const errors: { rowIndex: number; message: string }[] = []
  const matched: BankImportResult["matched"][number][] = []
  const unmatched: BankImportResult["unmatched"][number][] = []
  rows.forEach((row, rowIndex) => {
    const parsed = bankRowSchema.safeParse(row)
    if (!parsed.success) {
      errors.push({
        rowIndex,
        message: parsed.error.issues[0]?.message ?? "Invalid row",
      })
    } else if (parsed.data.credit !== null && rowIndex % 3 !== 2) {
      matched.push({
        rowIndex,
        sourceRecordId: crypto.randomUUID(),
        matchKind: "razorpay_settlement",
        entryId: crypto.randomUUID(),
      })
    } else {
      unmatched.push({
        rowIndex,
        sourceRecordId: crypto.randomUUID(),
        inboxItemId: crypto.randomUUID(),
      })
    }
  })
  await Promise.resolve()
  return {
    imported: matched.length + unmatched.length,
    duplicates: 0,
    matched,
    unmatched,
    errors,
  }
}
