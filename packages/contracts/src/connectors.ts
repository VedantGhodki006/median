// Connector framework contract: every data source (Razorpay, bank
// statements, Tally import…) produces normalised SourceRecords. Posting rules
// only ever see SourceRecords, never provider payloads.

import { z } from "zod"

import { idSchema, moneySchema } from "./common"
import type { IsoTimestamp } from "./common"

export type ConnectorAuthType = "api_key" | "oauth" | "file"

export type ConnectionStatus =
  "connected" | "syncing" | "error" | "disconnected"

/** A connector the app can offer (from the registry). */
export interface ConnectorInfo {
  /** Registry id, e.g. "razorpay", "bank-statement", "tally-import". */
  readonly provider: string
  readonly displayName: string
  readonly authType: ConnectorAuthType
  readonly description: string
  /** File connectors: accepted MIME types / extensions. */
  readonly accepts: readonly string[]
}

export interface ConnectionSummary {
  readonly id: string
  readonly provider: string
  readonly authType: ConnectorAuthType
  readonly label: string
  /** Last four characters of the key id, e.g. "…a1B2". Never the secret. */
  readonly keyHint: string | null
  /** Bank connections: the ledger account their lines post to. */
  readonly ledgerAccountId: string | null
  readonly status: ConnectionStatus
  readonly lastSyncedAt: IsoTimestamp | null
  readonly lastError: string | null
}

export const sourceRecordKindSchema = z.enum([
  "payment",
  "refund",
  "fee",
  "settlement",
  "payout",
  "bank_line",
  "order",
  "invoice",
  "party",
  "opening_balance",
])
export type SourceRecordKind = z.infer<typeof sourceRecordKindSchema>

/**
 * One normalised record from any connector. Identity is the provider's
 * `externalId`, or a `dedupeHash` (sha-256 hex) for rows without one.
 */
export const sourceRecordSchema = z
  .object({
    provider: z.string().min(1),
    kind: sourceRecordKindSchema,
    externalId: z.string().min(1).max(200).nullable(),
    dedupeHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/, "dedupeHash is sha-256 hex")
      .nullable(),
    occurredAt: z.iso.datetime({ offset: true }),
    /** Non-negative magnitude in paise; `direction` carries the sign. */
    amountPaise: moneySchema.refine((v) => v >= 0n, "Amount is a magnitude"),
    direction: z.enum(["inflow", "outflow"]),
    currency: z.string().regex(/^[A-Z]{3}$/, "ISO 4217 currency code"),
    /** Bank reference / UTR, order id… */
    reference: z.string().max(500).nullable(),
    /** Settlement this record was paid out in, when known. */
    settlementExternalId: z.string().max(200).nullable(),
    /** The provider's raw data, kept for audit and re-processing. */
    payload: z.record(z.string(), z.unknown()),
  })
  .refine((r) => r.externalId !== null || r.dedupeHash !== null, {
    message: "A source record needs an externalId or a dedupeHash",
  })
export type SourceRecordInput = z.input<typeof sourceRecordSchema>
export type SourceRecord = z.output<typeof sourceRecordSchema>

export const connectInputSchema = z.object({
  provider: z.string().min(1).max(50),
  /** Connector-specific; each connector validates its own shape. */
  credentials: z.unknown(),
})

/** Razorpay API-key credentials (validated by the razorpay connector). */
export const razorpayCredentialsSchema = z.object({
  keyId: z
    .string()
    .trim()
    .regex(
      /^rzp_(test|live)_[A-Za-z0-9]+$/,
      "Razorpay key id looks like rzp_live_…"
    ),
  keySecret: z.string().trim().min(10).max(100),
})

/** Bank statement connection: one per bank account. */
export const bankStatementCredentialsSchema = z.object({
  label: z.string().trim().min(1).max(100),
  ledgerAccountId: idSchema,
})

export interface SyncResult {
  readonly connectionId: string
  /** Records received from the provider this run, by kind. */
  readonly fetched: Partial<Record<SourceRecordKind, number>>
  /** New source records stored (re-runs skip existing ones). */
  readonly inserted: number
  readonly skippedExisting: number
  /** Records posted directly by high-confidence rules. */
  readonly posted: number
  /** Records sent to the inbox for review. */
  readonly sentToInbox: number
  readonly status: ConnectionStatus
  readonly lastSyncedAt: IsoTimestamp
}

/** A file handed to a file connector. */
export const importFileSchema = z.discriminatedUnion("kind", [
  /** Raw text: CSV, Tally XML. Parsed on the server. */
  z.object({
    kind: z.literal("text"),
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(100),
    text: z.string().max(20_000_000),
  }),
  /** Rows already extracted (e.g. PDF statements via the AI module). */
  z.object({
    kind: z.literal("rows"),
    fileName: z.string().min(1).max(255),
    rows: z.array(z.unknown()).max(50_000),
  }),
])
export type ImportFile = z.input<typeof importFileSchema>

export const importFileOptionsSchema = z.object({
  /** Required for bank statements: which bank connection the file belongs to. */
  connectionId: idSchema.optional(),
})
export type ImportFileOptions = z.input<typeof importFileOptionsSchema>

export interface ImportResult {
  readonly connectionId: string
  /** New records stored. */
  readonly imported: number
  /** Already imported before (same externalId / dedupe hash). */
  readonly duplicates: number
  readonly posted: number
  readonly sentToInbox: number
  /** Rows that couldn't be read; reported, not thrown. */
  readonly errors: readonly {
    readonly index: number
    readonly message: string
  }[]
}

/** @deprecated Use syncConnection; kept for syncRazorpay(). */
export interface SyncRazorpayResult {
  readonly fetched: {
    readonly payments: number
    readonly refunds: number
    readonly settlements: number
  }
  /** New source records stored (re-runs skip existing external ids). */
  readonly inserted: number
  readonly skippedExisting: number
  /** Records posted directly by high-confidence rules. */
  readonly posted: number
  /** Records sent to the inbox for review. */
  readonly sentToInbox: number
  readonly lastSyncedAt: IsoTimestamp
}

/** @deprecated Use connect(ctx, "razorpay", credentials). */
export const connectRazorpayInputSchema = z.object({
  keyId: z
    .string()
    .trim()
    .regex(
      /^rzp_(test|live)_[A-Za-z0-9]+$/,
      "Razorpay key id looks like rzp_live_…"
    ),
  keySecret: z.string().trim().min(10).max(100),
})
