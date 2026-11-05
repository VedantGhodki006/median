// Data export and deletion (deletion option A): everything except the books
// is removed immediately; the ledger, invoices, credit notes and audit log are
// kept read-only until `retentionUntil`, then purged.

import { z } from "zod"

import type { IsoDate, IsoTimestamp } from "./common"

export interface OrgDataExportManifest {
  readonly organizationId: string
  readonly generatedAt: IsoTimestamp
  /** One CSV per table, amounts in integer paise. */
  readonly tables: readonly {
    readonly table: string
    readonly file: string
    readonly rows: number
  }[]
}

export interface OrgDataExport {
  readonly fileName: string
  readonly mimeType: "application/zip"
  /** Zip: one CSV per table plus manifest.json. */
  readonly bytes: Uint8Array
  readonly manifest: OrgDataExportManifest
}

export const deleteOrgDataInputSchema = z.object({
  confirmation: z.discriminatedUnion("step", [
    /** Step 1: get a short-lived token and a summary of what happens. */
    z.object({ step: z.literal("request") }),
    /** Step 2: confirm with the token and the organisation's name, typed. */
    z.object({
      step: z.literal("confirm"),
      token: z.string().min(1).max(500),
      organizationName: z.string().trim().min(1).max(200),
    }),
  ]),
})
export type DeleteOrgDataInput = z.input<typeof deleteOrgDataInputSchema>

export interface DeletionTableCount {
  readonly table: string
  readonly rows: number
}

export type DeleteOrgDataResult =
  | {
      readonly step: "request"
      readonly token: string
      readonly expiresAt: IsoTimestamp
      readonly summary: {
        readonly deleteNow: readonly DeletionTableCount[]
        readonly retainReadOnly: readonly DeletionTableCount[]
        /** 8 years from the end of the last financial year with books. */
        readonly retentionUntil: IsoDate
      }
    }
  | {
      readonly step: "confirm"
      readonly tombstoneId: string
      readonly deletedAt: IsoTimestamp
      readonly retentionUntil: IsoDate
    }
