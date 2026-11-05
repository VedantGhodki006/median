import { z } from "zod"

import { idSchema, isoDateSchema, moneySchema } from "./common"
import type { IsoTimestamp } from "./common"
import type { ProposedEntry } from "./proposed-entry"

export type InboxItemKind =
  "bill" | "bank_line" | "razorpay_record" | "settlement_gap"
export type InboxStatus = "pending" | "approved" | "rejected"

export interface InboxItem {
  readonly id: string
  readonly kind: InboxItemKind
  readonly status: InboxStatus
  /** 0–1. How sure the rule or AI is about `proposedEntry`. */
  readonly confidence: number
  /** Why this needs a human, in plain words. */
  readonly reason: string
  readonly sourceRef: {
    readonly type: "document" | "source_record"
    readonly id: string
  }
  readonly proposedEntry: ProposedEntry
  readonly reviewedBy: string | null
  readonly reviewedAt: IsoTimestamp | null
  readonly reviewNote: string | null
  /** Set once approved and posted. */
  readonly postedEntryId: string | null
  readonly createdAt: IsoTimestamp
}

export const listInboxFiltersSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  kind: z
    .enum(["bill", "bank_line", "razorpay_record", "settlement_gap"])
    .optional(),
})
export type ListInboxFilters = z.input<typeof listInboxFiltersSchema>

/** Changes the reviewer made before approving. Omitted fields keep the proposal. */
export const inboxEditsSchema = z.object({
  entryDate: isoDateSchema.optional(),
  narration: z.string().trim().min(1).max(500).optional(),
  lines: z
    .array(
      z.object({
        accountId: idSchema,
        partyId: idSchema.nullable(),
        debit: moneySchema,
        credit: moneySchema,
        description: z.string().max(500).nullable(),
      })
    )
    .min(2)
    .optional(),
})
export type InboxEdits = z.input<typeof inboxEditsSchema>

export interface ApproveInboxItemResult {
  readonly item: InboxItem
  readonly entryId: string
}
