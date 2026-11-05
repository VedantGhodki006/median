import type { Money } from "@workspace/ledger"

import type { IsoTimestamp, Period } from "./common"

export interface DashboardSummary {
  readonly asOf: IsoTimestamp
  /** Bank + Razorpay clearing balances. */
  readonly cash: Money
  readonly revenueThisMonth: Money
  readonly revenueLastMonth: Money
  readonly receivables: {
    /** Unpaid invoice balances. */
    readonly outstanding: Money
    /** Part of `outstanding` past its due date. */
    readonly overdue: Money
    readonly invoiceCount: number
  }
  readonly gstPayable: {
    readonly period: Period
    /** Output tax minus input tax credit. Negative means ITC carried forward. */
    readonly amount: Money
  }
  readonly inboxPendingCount: number
}
