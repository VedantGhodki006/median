import "server-only"

import { paise, parseRupees } from "@workspace/ledger"

import type { OrgContext } from "./context"
import { requireConsent } from "./consent"
import { assertCan } from "./context"
import { STUB_ACCOUNTS, STUB_PARTIES } from "./stub-data"
import {
  billExtractionSchema,
  idSchema,
  parseInput,
} from "@workspace/contracts"
import type { InboxItem } from "@workspace/contracts"

/**
 * Turns a validated bill extraction into a pending purchase entry with input
 * tax credit. Tax and totals are computed in code; the AI's output is only
 * read. Throws CONSENT_REQUIRED, or VALIDATION if the extraction doesn't
 * match the schema. STUB:
 * returns a fixed proposal; Day 4 computes it from the extraction.
 */
export async function createInboxItemFromExtraction(
  ctx: OrgContext,
  documentId: string,
  extraction: unknown
): Promise<InboxItem> {
  assertCan(ctx, "ledger", "propose")
  const docId = parseInput(idSchema, documentId)
  const bill = parseInput(billExtractionSchema, extraction)
  await requireConsent(ctx)
  const taxable = bill.lines.reduce(
    (sum, l) => sum + parseRupees(l.taxableAmount),
    0n
  )
  // Placeholder maths for the stub only (9% + 9%); Day 4 replaces it.
  const halfTax = (taxable * 900n) / 10_000n
  await Promise.resolve()
  return {
    id: crypto.randomUUID(),
    kind: "bill",
    status: "pending",
    confidence: 0.8,
    reason: `Bill ${bill.billNumber} from ${bill.vendor.name}. Check the expense account.`,
    sourceRef: { type: "document", id: docId },
    proposedEntry: {
      entryDate: bill.billDate,
      narration: `${bill.vendor.name} bill ${bill.billNumber}`,
      lines: [
        {
          accountId: STUB_ACCOUNTS.hosting.id,
          partyId: null,
          debit: paise(taxable),
          credit: paise(0n),
          description: null,
        },
        {
          accountId: STUB_ACCOUNTS.inputCgst.id,
          partyId: null,
          debit: paise(halfTax),
          credit: paise(0n),
          description: "CGST",
        },
        {
          accountId: STUB_ACCOUNTS.inputSgst.id,
          partyId: null,
          debit: paise(halfTax),
          credit: paise(0n),
          description: "SGST",
        },
        {
          accountId: STUB_ACCOUNTS.payables.id,
          partyId: STUB_PARTIES.aws.id,
          debit: paise(0n),
          credit: paise(taxable + 2n * halfTax),
          description: null,
        },
      ],
    },
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    postedEntryId: null,
    createdAt: new Date().toISOString(),
  }
}
