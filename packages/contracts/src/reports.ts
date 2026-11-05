import type { Money } from "@workspace/ledger"
import { z } from "zod"

import { idSchema, isoDateSchema } from "./common"
import type { AccountType, IsoDate } from "./common"

export interface TrialBalanceRow {
  readonly accountId: string
  readonly code: string
  readonly name: string
  readonly type: AccountType
  /** Closing balance on the debit side (zero if the balance is a credit). */
  readonly debit: Money
  readonly credit: Money
}

export interface TrialBalance {
  readonly asOf: IsoDate
  readonly rows: readonly TrialBalanceRow[]
  readonly totalDebit: Money
  readonly totalCredit: Money
}

export interface ReportRow {
  readonly accountId: string
  readonly code: string
  readonly name: string
  /** Positive in the section's natural direction (income credit, expense debit…). */
  readonly amount: Money
}

export interface ReportSection {
  readonly key: string
  readonly label: string
  readonly rows: readonly ReportRow[]
  readonly total: Money
}

export interface ProfitAndLoss {
  readonly from: IsoDate
  readonly to: IsoDate
  /** Schedule III order: revenue from operations, other income, expenses by nature. */
  readonly income: readonly ReportSection[]
  readonly expenses: readonly ReportSection[]
  readonly totalIncome: Money
  readonly totalExpenses: Money
  /** Negative for a loss. */
  readonly netProfit: Money
}

export interface BalanceSheet {
  readonly asOf: IsoDate
  /** Schedule III: shareholders' funds, non-current liabilities, current liabilities. */
  readonly equityAndLiabilities: readonly ReportSection[]
  /** Schedule III: non-current assets, current assets. */
  readonly assets: readonly ReportSection[]
  readonly totalEquityAndLiabilities: Money
  readonly totalAssets: Money
  /** Profit for the year not yet closed to reserves, included in shareholders' funds. */
  readonly currentYearProfit: Money
}

export const listEntriesFiltersSchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  /** Drill down from a report row. */
  accountId: idSchema.optional(),
  partyId: idSchema.optional(),
  sourceType: z
    .enum([
      "manual",
      "razorpay",
      "bank",
      "invoice",
      "bill",
      "inbox",
      "reversal",
      "opening_balance",
    ])
    .optional(),
  search: z.string().trim().max(100).optional(),
})
export type ListEntriesFilters = z.input<typeof listEntriesFiltersSchema>
