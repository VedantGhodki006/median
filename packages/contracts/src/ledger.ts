import type { Money } from "@workspace/ledger"
import { z } from "zod"

import { idSchema, isoDateSchema, moneySchema } from "./common"
import type { IsoDate } from "./common"

export const postEntryInputSchema = z.object({
  entryDate: isoDateSchema,
  narration: z.string().trim().min(1).max(500),
  sourceType: z.enum([
    "manual",
    "razorpay",
    "bank",
    "invoice",
    "bill",
    "inbox",
    "reversal",
    "opening_balance",
  ]),
  sourceId: z.string().max(100).nullish(),
  reversesEntryId: idSchema.nullish(),
  lines: z
    .array(
      z.object({
        accountId: idSchema,
        partyId: idSchema.nullish(),
        debit: moneySchema,
        credit: moneySchema,
        description: z.string().trim().max(500).nullish(),
        dimensions: z.record(z.string(), z.string()).nullish(),
      })
    )
    .min(1)
    .max(500),
})
export type PostEntryInput = z.input<typeof postEntryInputSchema>

export interface PostedEntryResult {
  readonly id: string
  readonly entryDate: IsoDate
  readonly period: string
  readonly total: Money
}

export const manualEntryInputSchema = postEntryInputSchema.omit({
  sourceType: true,
  sourceId: true,
  reversesEntryId: true,
})
export type ManualEntryInput = z.input<typeof manualEntryInputSchema>

export const reverseEntryInputSchema = z.object({
  entryId: idSchema,
  date: isoDateSchema.optional(),
  narration: z.string().trim().min(1).max(500).optional(),
})
