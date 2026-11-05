import { z } from "zod"

import type { IsoTimestamp } from "./common"

export interface AuditLogEntry {
  readonly id: string
  /** Null for system actions; see `source`. */
  readonly actor: { readonly id: string; readonly name: string } | null
  /** e.g. "journal_entry.post", "inbox_item.approve", "period.lock" */
  readonly action: string
  readonly entity: string
  readonly entityId: string
  /** JSON snapshots; amounts are integer-paise strings. */
  readonly before: unknown
  readonly after: unknown
  /** "web", "razorpay_rule", "bank_match", "invoice"… */
  readonly source: string
  readonly at: IsoTimestamp
}

export const listAuditFiltersSchema = z.object({
  entity: z.string().max(50).optional(),
  entityId: z.string().max(100).optional(),
})
export type ListAuditFilters = z.input<typeof listAuditFiltersSchema>
