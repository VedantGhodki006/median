import type { Money } from "@workspace/ledger"

import type { Period } from "./common"

export interface GstTaxAmounts {
  readonly igst: Money
  readonly cgst: Money
  readonly sgst: Money
  readonly total: Money
}

export interface GstSupplyRow extends GstTaxAmounts {
  readonly taxable: Money
}

export interface GstOutwardRow extends GstSupplyRow {
  readonly rateBps: number
}

/** GSTR-3B style summary for one month. Credit notes are netted in. */
export interface GstSummary {
  readonly period: Period
  /** 3.1(a): domestic taxable supplies, net of credit notes, by rate. */
  readonly outward: readonly GstOutwardRow[]
  readonly outwardTotal: GstSupplyRow
  /** 3.1(b): exports and SEZ supplies (zero-rated), with any IGST paid. */
  readonly zeroRated: {
    readonly exportWithPayment: GstSupplyRow
    readonly exportLut: GstSupplyRow
    readonly sez: GstSupplyRow
  }
  /** Sales where the recipient pays GST under reverse charge (no tax charged by us). */
  readonly reverseChargeSupplies: GstSupplyRow
  /** Credit notes issued in the period, already deducted from `outward`. */
  readonly creditNotes: GstSupplyRow & { readonly count: number }
  /** 4(A)(5): all other eligible ITC. */
  readonly inputTaxCredit: GstTaxAmounts
  /** Output tax minus ITC, per head. Negative means credit carried forward. */
  readonly netPayable: GstTaxAmounts
  /** TDS deducted by customers in the period (claim via Form 26AS, not GST). */
  readonly tdsReceivable: Money
  /** False while the period is still open (numbers can change). */
  readonly isLocked: boolean
}
