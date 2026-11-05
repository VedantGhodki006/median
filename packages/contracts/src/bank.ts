import { z } from "zod"

import { idSchema, isoDateSchema, rupeeAmountTextSchema } from "./common"

/**
 * One normalised bank statement line. CSV imports (papaparse, server-side)
 * and PDF statements (AI module) both produce this shape. Amounts are rupee
 * text as printed; exactly one of `debit` / `credit` is set.
 */
export const bankRowSchema = z
  .object({
    date: isoDateSchema,
    description: z.string().trim().min(1).max(500),
    reference: z.string().trim().max(200).nullable(),
    debit: rupeeAmountTextSchema.nullable(),
    credit: rupeeAmountTextSchema.nullable(),
    balance: rupeeAmountTextSchema.nullable(),
  })
  .refine(
    (r) => (r.debit === null) !== (r.credit === null),
    "Set exactly one of debit or credit"
  )
export type BankRow = z.input<typeof bankRowSchema>

export const importBankRowsOptionsSchema = z.object({
  /** The bank ledger account (asset) these lines belong to. */
  bankAccountId: idSchema,
})
export type ImportBankRowsOptions = z.input<typeof importBankRowsOptionsSchema>

export type BankMatchKind =
  "razorpay_settlement" | "invoice_payment" | "known_vendor"

export interface BankImportResult {
  readonly imported: number
  /** Rows already imported before (same date, amount, reference, balance). */
  readonly duplicates: number
  readonly matched: readonly {
    readonly rowIndex: number
    readonly sourceRecordId: string
    readonly matchKind: BankMatchKind
    readonly entryId: string
  }[]
  readonly unmatched: readonly {
    readonly rowIndex: number
    readonly sourceRecordId: string
    readonly inboxItemId: string
  }[]
  readonly errors: readonly {
    readonly rowIndex: number
    readonly message: string
  }[]
}
