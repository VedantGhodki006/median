import "server-only"

import { paise } from "@workspace/ledger"

import type { OrgContext } from "./context"
import { assertCan } from "./context"
import { STUB_PARTIES, daysAgo, timestampDaysAgo } from "./stub-data"
import {
  ServiceError,
  createCreditNoteInputSchema,
  idSchema,
  listCreditNotesFiltersSchema,
  pageOptionsSchema,
  parseInput,
} from "@workspace/contracts"
import type {
  CreateCreditNoteInput,
  CreditNote,
  CreditNoteListItem,
  ListCreditNotesFilters,
  Page,
  PageOptions,
} from "@workspace/contracts"

const stubNote: CreditNote = {
  id: "00000000-0000-4000-8000-0000000c0001",
  number: "CN/2026-27/0001",
  financialYear: "2026-27",
  invoice: {
    id: "00000000-0000-4000-8000-00000000a003",
    number: "INV/2026-27/0040",
  },
  party: STUB_PARTIES.acme,
  creditNoteDate: daysAgo(10),
  reason: "refund",
  placeOfSupply: "29",
  supplyType: "intrastate",
  reverseCharge: false,
  lines: [
    {
      id: "00000000-0000-4000-8000-0000000c1001",
      invoiceLineId: null,
      description: "Median Starter plan, monthly (refund for 1 month)",
      hsnSac: "998314",
      quantity: "1",
      unitPrice: paise(15_000_00n),
      gstRateBps: 1800,
      taxable: paise(15_000_00n),
      cgst: paise(1_350_00n),
      sgst: paise(1_350_00n),
      igst: paise(0n),
      total: paise(17_700_00n),
    },
  ],
  taxable: paise(15_000_00n),
  cgst: paise(1_350_00n),
  sgst: paise(1_350_00n),
  igst: paise(0n),
  roundOff: paise(0n),
  total: paise(17_700_00n),
  sourceRecordId: "00000000-0000-4000-8000-00000000b020",
  notes: null,
  journalEntryId: "00000000-0000-4000-8000-00000000e020",
  createdAt: timestampDaysAgo(10),
}

/**
 * Issues a credit note against an invoice and posts it (reverses revenue and
 * output GST). Throws NOT_FOUND (invoice), VALIDATION (crediting more than
 * was invoiced), PERIOD_LOCKED. STUB.
 */
export async function createCreditNote(
  ctx: OrgContext,
  input: CreateCreditNoteInput
): Promise<CreditNote> {
  assertCan(ctx, "ledger", "post")
  const c = parseInput(createCreditNoteInputSchema, input)
  await Promise.resolve()
  return {
    ...stubNote,
    id: crypto.randomUUID(),
    number: "CN/2026-27/0002",
    invoice: { id: c.invoiceId, number: "INV/2026-27/0042" },
    creditNoteDate: c.creditNoteDate,
    reason: c.reason,
    notes: c.notes ?? null,
    sourceRecordId: null,
    createdAt: new Date().toISOString(),
  }
}

/** Null when it doesn't exist in this organisation. STUB. */
export async function getCreditNote(
  ctx: OrgContext,
  id: string
): Promise<CreditNote | null> {
  assertCan(ctx, "ledger", "read")
  const noteId = parseInput(idSchema, id)
  await Promise.resolve()
  return noteId === stubNote.id ? stubNote : null
}

/** Newest first. STUB. */
export async function listCreditNotes(
  ctx: OrgContext,
  cursor: string | null,
  filters: ListCreditNotesFilters = {},
  options: PageOptions = {}
): Promise<Page<CreditNoteListItem>> {
  assertCan(ctx, "ledger", "read")
  const f = parseInput(listCreditNotesFiltersSchema, filters)
  const { limit } = parseInput(pageOptionsSchema, options)
  if (f.from && f.to && f.from > f.to) {
    throw new ServiceError("VALIDATION", "'from' is after 'to'.")
  }
  const { lines: _lines, ...item } = stubNote
  await Promise.resolve()
  return { items: cursor ? [] : [item].slice(0, limit), nextCursor: null }
}
