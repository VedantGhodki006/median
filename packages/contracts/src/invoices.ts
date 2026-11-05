import type { Money } from "@workspace/ledger"
import { z } from "zod"

import {
  gstStateCodeSchema,
  idSchema,
  isoDateSchema,
  moneySchema,
} from "./common"
import type { IsoDate, IsoTimestamp, PartyRef } from "./common"

export type InvoiceStatus = "issued" | "partially_paid" | "paid" | "cancelled"

/**
 * GST treatment of a supply. Intrastate (CGST + SGST) vs interstate (IGST)
 * comes from place of supply vs the org's state; exports and SEZ are chosen
 * explicitly. export_lut is zero-rated (no GST charged).
 */
export type SupplyType =
  "intrastate" | "interstate" | "export_with_payment" | "export_lut" | "sez"

/** GST rates in basis points (18% = 1800). */
export const GST_RATES_BPS = [0, 25, 300, 500, 1200, 1800, 2800, 4000] as const

export interface InvoiceLine {
  readonly id: string
  readonly description: string
  readonly hsnSac: string
  /** Decimal string, up to 3 places: "1", "7.5". */
  readonly quantity: string
  readonly unitPrice: Money
  readonly gstRateBps: number
  readonly taxable: Money
  readonly cgst: Money
  readonly sgst: Money
  readonly igst: Money
  readonly total: Money
}

export interface Invoice {
  readonly id: string
  /** e.g. "INV/2026-27/0042" */
  readonly number: string
  /** e.g. "2026-27" */
  readonly financialYear: string
  readonly party: PartyRef
  readonly invoiceDate: IsoDate
  readonly dueDate: IsoDate
  readonly placeOfSupply: string
  readonly supplyType: SupplyType
  /** Recipient pays GST under reverse charge; the invoice charges none. */
  readonly reverseCharge: boolean
  readonly lines: readonly InvoiceLine[]
  readonly taxable: Money
  readonly cgst: Money
  readonly sgst: Money
  readonly igst: Money
  /** Rounds the total to the rupee (-50 to +50 paise), posted to Round-off. */
  readonly roundOff: Money
  /** Rounded to the rupee. */
  readonly total: Money
  readonly paid: Money
  readonly status: InvoiceStatus
  readonly notes: string | null
  readonly journalEntryId: string | null
  readonly createdAt: IsoTimestamp
}

export type InvoiceListItem = Omit<Invoice, "lines">

export const createInvoiceInputSchema = z
  .object({
    partyId: idSchema,
    invoiceDate: isoDateSchema,
    dueDate: isoDateSchema,
    /** Omit for B2C sales where it's unknown: the organisation's state is used. */
    placeOfSupply: gstStateCodeSchema.optional(),
    /**
     * Only for exports and SEZ supplies. Omit for domestic sales: intrastate
     * vs interstate is derived from place of supply.
     */
    supplyType: z.enum(["export_with_payment", "export_lut", "sez"]).optional(),
    reverseCharge: z.boolean().default(false),
    notes: z.string().trim().max(2000).nullish(),
    lines: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(500),
          hsnSac: z
            .string()
            .trim()
            .regex(/^\d{4,8}$/, "HSN/SAC is 4–8 digits"),
          quantity: z
            .string()
            .trim()
            .regex(/^\d+(\.\d{1,3})?$/, "Quantity like 1 or 7.5"),
          unitPrice: moneySchema.refine(
            (v) => v >= 0n,
            "Price can't be negative"
          ),
          gstRateBps: z.union(GST_RATES_BPS.map((r) => z.literal(r))),
        })
      )
      .min(1)
      .max(100),
  })
  .refine(
    (i) => i.dueDate >= i.invoiceDate,
    "Due date is before the invoice date"
  )
export type CreateInvoiceInput = z.input<typeof createInvoiceInputSchema>

export const listInvoicesFiltersSchema = z.object({
  status: z.enum(["issued", "partially_paid", "paid", "cancelled"]).optional(),
  partyId: idSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
})
export type ListInvoicesFilters = z.input<typeof listInvoicesFiltersSchema>
