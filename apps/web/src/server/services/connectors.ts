import "server-only"

import {
  ServiceError,
  connectInputSchema,
  idSchema,
  importFileOptionsSchema,
  importFileSchema,
  parseInput,
} from "@workspace/contracts"
import type {
  ConnectionSummary,
  ConnectorInfo,
  ImportFile,
  ImportFileOptions,
  ImportResult,
  SyncResult,
} from "@workspace/contracts"

import type { OrgContext } from "./context"
import { assertCan } from "./context"
import { requireConsent } from "./consent"
import { STUB_ACCOUNTS, timestampDaysAgo } from "./stub-data"

// STUB until Day 2: the registry lives in integrations/registry.ts.
const STUB_CONNECTORS: readonly ConnectorInfo[] = [
  {
    provider: "razorpay",
    displayName: "Razorpay",
    authType: "api_key",
    description: "Payments, refunds, fees and settlements.",
    accepts: [],
  },
  {
    provider: "bank-statement",
    displayName: "Bank statement",
    authType: "file",
    description: "CSV or PDF statements from any Indian bank.",
    accepts: ["text/csv", "application/pdf"],
  },
  {
    provider: "tally-import",
    displayName: "Import from Tally",
    authType: "file",
    description:
      "Masters, opening balances and vouchers from a Tally XML export.",
    accepts: ["application/xml", "text/xml"],
  },
]

const stubConnections: readonly ConnectionSummary[] = [
  {
    id: "00000000-0000-4000-8000-0000000000c1",
    provider: "razorpay",
    authType: "api_key",
    label: "Razorpay live",
    keyHint: "…Xy9Q",
    ledgerAccountId: null,
    status: "connected",
    lastSyncedAt: timestampDaysAgo(0),
    lastError: null,
  },
  {
    id: "00000000-0000-4000-8000-0000000000c2",
    provider: "bank-statement",
    authType: "file",
    label: "HDFC current a/c",
    keyHint: null,
    ledgerAccountId: STUB_ACCOUNTS.bank.id,
    status: "connected",
    lastSyncedAt: timestampDaysAgo(2),
    lastError: null,
  },
]

function findConnector(provider: string): ConnectorInfo {
  const connector = STUB_CONNECTORS.find((c) => c.provider === provider)
  if (!connector)
    throw new ServiceError("NOT_FOUND", `No connector "${provider}".`)
  return connector
}

/** Every connector the app can offer. Needs no organisation. */
export async function listConnectors(): Promise<readonly ConnectorInfo[]> {
  await Promise.resolve()
  return STUB_CONNECTORS
}

/** The organisation's connections, newest first. STUB. */
export async function listConnections(
  ctx: OrgContext
): Promise<readonly ConnectionSummary[]> {
  assertCan(ctx, "ledger", "read")
  await Promise.resolve()
  return stubConnections
}

/**
 * Connects a provider: the connector validates and tests the credentials,
 * then they are stored encrypted. Throws CONSENT_REQUIRED, NOT_FOUND
 * (unknown provider), VALIDATION, INTEGRATION (provider rejected them). STUB.
 */
export async function connect(
  ctx: OrgContext,
  provider: string,
  credentials: unknown
): Promise<ConnectionSummary> {
  assertCan(ctx, "ledger", "post")
  const input = parseInput(connectInputSchema, { provider, credentials })
  await requireConsent(ctx)
  const connector = findConnector(input.provider)
  return {
    id: crypto.randomUUID(),
    provider: connector.provider,
    authType: connector.authType,
    label: connector.displayName,
    keyHint: connector.authType === "api_key" ? "…a1B2" : null,
    ledgerAccountId: null,
    status: "connected",
    lastSyncedAt: null,
    lastError: null,
  }
}

/** Stops syncing and deletes stored credentials; data already imported stays. STUB. */
export async function disconnect(
  ctx: OrgContext,
  connectionId: string
): Promise<ConnectionSummary> {
  assertCan(ctx, "ledger", "post")
  const id = parseInput(idSchema, connectionId)
  const connection = stubConnections.find((c) => c.id === id)
  if (!connection) throw new ServiceError("NOT_FOUND", "Connection not found.")
  await Promise.resolve()
  return { ...connection, status: "disconnected", keyHint: null }
}

/**
 * Pulls new records since the saved cursor and runs the posting rules on
 * them. Safe to re-run. Throws CONSENT_REQUIRED, NOT_FOUND, CONFLICT (already
 * syncing). STUB.
 */
export async function syncConnection(
  ctx: OrgContext,
  connectionId: string
): Promise<SyncResult> {
  assertCan(ctx, "ledger", "post")
  const id = parseInput(idSchema, connectionId)
  await requireConsent(ctx)
  if (!stubConnections.some((c) => c.id === id)) {
    throw new ServiceError("NOT_FOUND", "Connection not found.")
  }
  return {
    connectionId: id,
    fetched: { payment: 148, refund: 3, fee: 148, settlement: 9 },
    inserted: 308,
    skippedExisting: 0,
    posted: 302,
    sentToInbox: 6,
    status: "connected",
    lastSyncedAt: new Date().toISOString(),
  }
}

/**
 * Imports a file through a file connector (bank statement, Tally XML).
 * Unreadable rows are reported in `errors`, not thrown; re-importing the same
 * file creates no duplicates. Throws CONSENT_REQUIRED, NOT_FOUND, VALIDATION
 * (e.g. bank statement without connectionId). STUB.
 */
export async function importFile(
  ctx: OrgContext,
  provider: string,
  file: ImportFile,
  options: ImportFileOptions = {}
): Promise<ImportResult> {
  assertCan(ctx, "ledger", "post")
  const f = parseInput(importFileSchema, file)
  const o = parseInput(importFileOptionsSchema, options)
  await requireConsent(ctx)
  const connector = findConnector(provider)
  if (connector.authType !== "file") {
    throw new ServiceError(
      "VALIDATION",
      `${connector.displayName} doesn't take files.`
    )
  }
  if (provider === "bank-statement" && !o.connectionId) {
    throw new ServiceError(
      "VALIDATION",
      "Choose which bank account this statement is for."
    )
  }
  const rows = f.kind === "rows" ? f.rows.length : f.text.split("\n").length - 1
  return {
    connectionId: o.connectionId ?? crypto.randomUUID(),
    imported: Math.max(0, rows),
    duplicates: 0,
    posted: Math.floor(Math.max(0, rows) * 0.8),
    sentToInbox: Math.max(0, rows) - Math.floor(Math.max(0, rows) * 0.8),
    errors: [],
  }
}
