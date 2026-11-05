import type { Money } from "@workspace/ledger"
import { z } from "zod"

import { idSchema, isoDateSchema, moneyJsonSchema } from "./common"
import type { IsoDate } from "./common"

export interface ProposedLine {
  readonly accountId: string
  readonly partyId: string | null
  readonly debit: Money
  readonly credit: Money
  readonly description: string | null
}

export interface ProposedEntry {
  readonly entryDate: IsoDate
  readonly narration: string
  readonly lines: readonly ProposedLine[]
}

/** Parses the JSON stored in inbox_items.proposed_entry. */
export const proposedEntryJsonSchema = z.object({
  entryDate: isoDateSchema,
  narration: z.string().min(1).max(500),
  lines: z
    .array(
      z.object({
        accountId: idSchema,
        partyId: idSchema.nullable(),
        debit: moneyJsonSchema,
        credit: moneyJsonSchema,
        description: z.string().max(500).nullable(),
      })
    )
    .min(2),
})
