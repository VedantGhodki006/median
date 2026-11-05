import "server-only"

import type { OrgContext } from "./context"
import { assertCan } from "./context"
import { timestampDaysAgo } from "./stub-data"
import {
  listAuditFiltersSchema,
  pageOptionsSchema,
  parseInput,
} from "@workspace/contracts"
import type {
  AuditLogEntry,
  ListAuditFilters,
  Page,
  PageOptions,
} from "@workspace/contracts"

/** Newest first. STUB. */
export async function listAuditLog(
  ctx: OrgContext,
  cursor: string | null,
  filters: ListAuditFilters = {},
  options: PageOptions = {}
): Promise<Page<AuditLogEntry>> {
  assertCan(ctx, "ledger", "read")
  parseInput(listAuditFiltersSchema, filters)
  const { limit } = parseInput(pageOptionsSchema, options)
  const items: AuditLogEntry[] = [
    {
      id: "00000000-0000-4000-8000-0000000aa001",
      actor: null,
      action: "journal_entry.post",
      entity: "journal_entry",
      entityId: "00000000-0000-4000-8000-00000000e003",
      before: null,
      after: { narration: "Razorpay fee on pay_PqR8sT2uV4", total: "69620" },
      source: "razorpay_rule",
      at: timestampDaysAgo(1),
    },
    {
      id: "00000000-0000-4000-8000-0000000aa002",
      actor: { id: ctx.userId, name: "You" },
      action: "journal_entry.post",
      entity: "journal_entry",
      entityId: "00000000-0000-4000-8000-00000000e001",
      before: null,
      after: {
        narration: "Invoice INV/2026-27/0042 to Acme Retail",
        total: "11800000",
      },
      source: "invoice",
      at: timestampDaysAgo(3),
    },
  ]
  await Promise.resolve()
  return { items: cursor ? [] : items.slice(0, limit), nextCursor: null }
}
