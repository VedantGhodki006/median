import "server-only"

import { ServiceError } from "@workspace/contracts"
import type {
  ConnectionSummary,
  SyncRazorpayResult,
} from "@workspace/contracts"

import { connect, listConnections, syncConnection } from "./connectors"
import type { OrgContext } from "./context"

/**
 * @deprecated Use `connect(ctx, "razorpay", { keyId, keySecret })`.
 * Kept so existing screens keep working.
 */
export async function connectRazorpay(
  ctx: OrgContext,
  keyId: string,
  keySecret: string
): Promise<ConnectionSummary> {
  return connect(ctx, "razorpay", { keyId, keySecret })
}

/**
 * @deprecated Use `syncConnection(ctx, connectionId)`. Syncs the
 * organisation's Razorpay connection. Throws NOT_FOUND if there is none.
 */
export async function syncRazorpay(
  ctx: OrgContext
): Promise<SyncRazorpayResult> {
  const connection = (await listConnections(ctx)).find(
    (c) => c.provider === "razorpay" && c.status !== "disconnected"
  )
  if (!connection)
    throw new ServiceError("NOT_FOUND", "Razorpay isn't connected.")
  const result = await syncConnection(ctx, connection.id)
  return {
    fetched: {
      payments: result.fetched.payment ?? 0,
      refunds: result.fetched.refund ?? 0,
      settlements: result.fetched.settlement ?? 0,
    },
    inserted: result.inserted,
    skippedExisting: result.skippedExisting,
    posted: result.posted,
    sentToInbox: result.sentToInbox,
    lastSyncedAt: result.lastSyncedAt,
  }
}
