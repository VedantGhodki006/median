import type { Money } from "@workspace/ledger"
import { z } from "zod"

import { idSchema, isoDateSchema, moneySchema } from "./common"
import type { IsoDate, IsoTimestamp, PartyRef } from "./common"
import type { SupplyType } from "./invoices"

export type CreditNoteReason =
  | "refund"
  | "sales_return"
  | "post_sale_discount"
  | "deficiency_in_service"
  | "correction"

export interface CreditNoteLine {
  readonly id: string
  /** The invoice line being credited, when it maps to one. */
  readonly invoiceLineId: string | null
  readonly description: string
  readonly hsnSac: string
  readonly quantity: string
  readonly unitPrice: Money
  readonly gstRateBps: number
  readonly taxable: Money
  readonly cgst: Money
  readonly sgst: Money
  readonly igst: Money
  readonly total: Money
}

/** Reduces output GST on an earlier sales invoice. */
export interface CreditNote {
  readonly id: string
  /** e.g. "CN/2026-27/0003". Max 16 characters, own series per FY. */
  readonly number: string
  readonly financialYear: string
  readonly invoice: { readonly id: string; readonly number: string }
  readonly party: PartyRef
  readonly creditNoteDate: IsoDate
  readonly reason: CreditNoteReason
  /** Copied from the invoice. */
  readonly placeOfSupply: string
  readonly supplyType: SupplyType
  readonly reverseCharge: boolean
  readonly lines: readonly CreditNoteLine[]
  readonly taxable: Money
  readonly cgst: Money
  readonly sgst: Money
  readonly igst: Money
  readonly roundOff: Money
  readonly total: Money
  /** The Razorpay refund that caused it, if any. */
  readonly sourceRecordId: string | null
  readonly notes: string | null
  readonly journalEntryId: string | null
  readonly createdAt: IsoTimestamp
}

export type CreditNoteListItem = Omit<CreditNote, "lines">

export const createCreditNoteInputSchema = z.object({
  invoiceId: idSchema,
  creditNoteDate: isoDateSchema,
  reason: z.enum([
    "refund",
    "sales_return",
    "post_sale_discount",
    "deficiency_in_service",
    "correction",
  ]),
  notes: z.string().trim().max(2000).nullish(),
  /**
   * Lines to credit. Tax follows each invoice line's rate and the invoice's
   * supply type; amounts are computed in code.
   */
  lines: z
    .array(
      z.object({
        invoiceLineId: idSchema,
        quantity: z
          .string()
          .trim()
          .regex(/^\d+(\.\d{1,3})?$/, "Quantity like 1 or 7.5"),
        unitPrice: moneySchema.refine(
          (v) => v >= 0n,
          "Price can't be negative"
        ),
      })
    )
    .min(1)
    .max(100),
})
export type CreateCreditNoteInput = z.input<typeof createCreditNoteInputSchema>

export const listCreditNotesFiltersSchema = z.object({
  invoiceId: idSchema.optional(),
  partyId: idSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
})
export type ListCreditNotesFilters = z.input<
  typeof listCreditNotesFiltersSchema
>
