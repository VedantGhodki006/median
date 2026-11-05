// GSTR-1 draft export, in the JSON shape the GSTN offline tool imports.
//
// Internally every amount is integer paise. The GSTN format requires rupee
// amounts as JSON numbers with up to two decimals, so the export converts
// paise → rupees only at this boundary (see `paiseToGstnAmount`). The CA
// verifies the draft in the offline tool before filing.
//
// Field names follow the offline tool's JSON (ctin, inum, idt, txval…).
// Verify against the current GSTN schema on Day 6 before relying on it.

import type { Money } from "@workspace/ledger"
import { z } from "zod"

import type { IsoTimestamp, Period } from "./common"

/** Rupees with at most two decimals, as GSTN expects. */
export const gstnAmountSchema = z
  .number()
  .finite()
  .nonnegative()
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
    "At most two decimal places"
  )

/** The only paise → rupee-number conversion in Median. Exact for ≤ 2^53 paise. */
export function paiseToGstnAmount(amount: Money): number {
  return Number(amount) / 100
}

/** GST rate in percent, e.g. 18 or 0.25. */
const rateSchema = z.number().nonnegative().max(100)
/** dd-mm-yyyy */
const gstnDateSchema = z.string().regex(/^\d{2}-\d{2}-\d{4}$/, "dd-mm-yyyy")
const posSchema = z.string().regex(/^\d{2}$/)
const gstinSchema = z.string().regex(/^[0-9A-Z]{15}$/)
const yesNo = z.enum(["Y", "N"])

const itemDetailSchema = z.object({
  txval: gstnAmountSchema,
  rt: rateSchema,
  iamt: gstnAmountSchema.optional(),
  camt: gstnAmountSchema.optional(),
  samt: gstnAmountSchema.optional(),
  csamt: gstnAmountSchema.optional(),
})

const itemsSchema = z
  .array(z.object({ num: z.int().positive(), itm_det: itemDetailSchema }))
  .min(1)

const invoiceTypeSchema = z.enum(["R", "SEWP", "SEWOP", "DE"])

export const gstr1PayloadSchema = z.object({
  gstin: gstinSchema,
  /** Filing period as MMYYYY. */
  fp: z.string().regex(/^(0[1-9]|1[0-2])\d{4}$/),
  /** 4A, 4B, 6B, 6C: B2B invoices (registered recipients), incl. SEZ. */
  b2b: z
    .array(
      z.object({
        ctin: gstinSchema,
        inv: z.array(
          z.object({
            inum: z.string().min(1).max(16),
            idt: gstnDateSchema,
            val: gstnAmountSchema,
            pos: posSchema,
            rchrg: yesNo,
            inv_typ: invoiceTypeSchema,
            itms: itemsSchema,
          })
        ),
      })
    )
    .optional(),
  /** 5A: B2C large, interstate, invoice value above the threshold. */
  b2cl: z
    .array(
      z.object({
        pos: posSchema,
        inv: z.array(
          z.object({
            inum: z.string().min(1).max(16),
            idt: gstnDateSchema,
            val: gstnAmountSchema,
            itms: itemsSchema,
          })
        ),
      })
    )
    .optional(),
  /** 7: B2C small, summarised by place of supply and rate. */
  b2cs: z
    .array(
      z.object({
        sply_ty: z.enum(["INTRA", "INTER"]),
        pos: posSchema,
        typ: z.literal("OE"),
        txval: gstnAmountSchema,
        rt: rateSchema,
        iamt: gstnAmountSchema.optional(),
        camt: gstnAmountSchema.optional(),
        samt: gstnAmountSchema.optional(),
        csamt: gstnAmountSchema.optional(),
      })
    )
    .optional(),
  /** 9B: credit/debit notes to registered recipients. */
  cdnr: z
    .array(
      z.object({
        ctin: gstinSchema,
        nt: z.array(
          z.object({
            ntty: z.enum(["C", "D"]),
            nt_num: z.string().min(1).max(16),
            nt_dt: gstnDateSchema,
            val: gstnAmountSchema,
            pos: posSchema,
            rchrg: yesNo,
            inv_typ: invoiceTypeSchema,
            itms: itemsSchema,
          })
        ),
      })
    )
    .optional(),
  /** 6A: exports, with (WPAY) or without (WOPAY, under LUT) payment of IGST. */
  exp: z
    .array(
      z.object({
        exp_typ: z.enum(["WPAY", "WOPAY"]),
        inv: z.array(
          z.object({
            inum: z.string().min(1).max(16),
            idt: gstnDateSchema,
            val: gstnAmountSchema,
            sbpcode: z.string().optional(),
            sbnum: z.string().optional(),
            sbdt: gstnDateSchema.optional(),
            itms: z
              .array(
                z.object({
                  txval: gstnAmountSchema,
                  rt: rateSchema,
                  iamt: gstnAmountSchema.optional(),
                  csamt: gstnAmountSchema.optional(),
                })
              )
              .min(1),
          })
        ),
      })
    )
    .optional(),
  /** 12: HSN-wise summary of outward supplies. */
  hsn: z
    .object({
      data: z.array(
        z.object({
          num: z.int().positive(),
          hsn_sc: z.string().regex(/^\d{4,8}$/),
          desc: z.string().max(30).optional(),
          uqc: z.string().min(1).max(10),
          qty: z.number().nonnegative(),
          rt: rateSchema,
          txval: gstnAmountSchema,
          iamt: gstnAmountSchema,
          camt: gstnAmountSchema,
          samt: gstnAmountSchema,
          csamt: gstnAmountSchema,
        })
      ),
    })
    .optional(),
  /** 13: documents issued (invoice and credit-note series ranges). */
  doc_issue: z
    .object({
      doc_det: z.array(
        z.object({
          doc_num: z.int().positive(),
          docs: z.array(
            z.object({
              num: z.int().positive(),
              from: z.string().max(16),
              to: z.string().max(16),
              totnum: z.int().nonnegative(),
              cancel: z.int().nonnegative(),
              net_issue: z.int().nonnegative(),
            })
          ),
        })
      ),
    })
    .optional(),
})
export type Gstr1Payload = z.infer<typeof gstr1PayloadSchema>

export type Gstr1WarningCode =
  | "MISSING_CUSTOMER_GSTIN"
  | "MISSING_HSN"
  | "MISSING_PLACE_OF_SUPPLY"
  | "UNMATCHED_CREDIT_NOTE"

export interface Gstr1Warning {
  readonly code: Gstr1WarningCode
  readonly message: string
  /** Invoice or credit-note number the warning is about. */
  readonly documentNumber: string | null
}

export interface Gstr1Export {
  readonly period: Period
  readonly gstin: string
  /** Validated with gstr1PayloadSchema before it is returned. */
  readonly payload: Gstr1Payload
  readonly warnings: readonly Gstr1Warning[]
  /** Always true: a draft the CA checks in the offline tool before filing. */
  readonly isDraft: true
  readonly generatedAt: IsoTimestamp
}
