import "server-only"

import { paise } from "@workspace/ledger"

import type { OrgContext } from "./context"
import { assertCan } from "./context"
import { STUB_ACCOUNTS, STUB_ENTRIES } from "./stub-data"
import {
  ServiceError,
  dateRangeSchema,
  isoDateSchema,
  listEntriesFiltersSchema,
  pageOptionsSchema,
  parseInput,
} from "@workspace/contracts"
import type {
  BalanceSheet,
  IsoDate,
  JournalEntryView,
  LedgerAccountSummary,
  ListEntriesFilters,
  Page,
  PageOptions,
  ProfitAndLoss,
  ReportRow,
  ReportSection,
  TrialBalance,
  TrialBalanceRow,
} from "@workspace/contracts"

const row = (a: LedgerAccountSummary, amount: bigint): ReportRow => ({
  accountId: a.id,
  code: a.code,
  name: a.name,
  amount: paise(amount),
})
const section = (
  key: string,
  label: string,
  rows: readonly ReportRow[]
): ReportSection => ({
  key,
  label,
  rows,
  total: paise(rows.reduce((s, r) => s + r.amount, 0n)),
})

/** Closing balance of every account with activity up to `asOf`. STUB. */
export async function getTrialBalance(
  ctx: OrgContext,
  asOf: IsoDate
): Promise<TrialBalance> {
  assertCan(ctx, "report", "read")
  const date = parseInput(isoDateSchema, asOf)
  const tb = (
    a: LedgerAccountSummary,
    debit: bigint,
    credit: bigint
  ): TrialBalanceRow => ({
    accountId: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    debit: paise(debit),
    credit: paise(credit),
  })
  const rows = [
    tb(STUB_ACCOUNTS.bank, 24_31_850_00n, 0n),
    tb(STUB_ACCOUNTS.razorpayClearing, 1_12_400_00n, 0n),
    tb(STUB_ACCOUNTS.receivables, 3_42_200_00n, 0n),
    tb(STUB_ACCOUNTS.inputIgst, 18_406_20n, 0n),
    tb(STUB_ACCOUNTS.payables, 0n, 1_24_560_00n),
    tb(STUB_ACCOUNTS.outputCgst, 0n, 61_200_00n),
    tb(STUB_ACCOUNTS.outputSgst, 0n, 61_200_00n),
    tb(STUB_ACCOUNTS.outputIgst, 0n, 45_000_00n),
    tb(STUB_ACCOUNTS.capital, 0n, 25_00_000_00n),
    tb(STUB_ACCOUNTS.saasRevenue, 0n, 9_30_000_00n),
    tb(STUB_ACCOUNTS.salaries, 5_55_000_00n, 0n),
    tb(STUB_ACCOUNTS.hosting, 1_26_000_00n, 0n),
    tb(STUB_ACCOUNTS.gatewayCharges, 11_103_80n, 0n),
  ]
  await Promise.resolve()
  return {
    asOf: date,
    rows,
    totalDebit: paise(rows.reduce((s, r) => s + r.debit, 0n)),
    totalCredit: paise(rows.reduce((s, r) => s + r.credit, 0n)),
  }
}

/** Profit and loss for a date range (inclusive). STUB. */
export async function getProfitAndLoss(
  ctx: OrgContext,
  from: IsoDate,
  to: IsoDate
): Promise<ProfitAndLoss> {
  assertCan(ctx, "report", "read")
  const r = parseInput(dateRangeSchema, { from, to })
  const income = [
    section("revenue_from_operations", "Revenue from operations", [
      row(STUB_ACCOUNTS.saasRevenue, 9_30_000_00n),
    ]),
    section("other_income", "Other income", []),
  ]
  const expenses = [
    section("employee_benefits", "Employee benefits expense", [
      row(STUB_ACCOUNTS.salaries, 5_55_000_00n),
    ]),
    section("other_expenses", "Other expenses", [
      row(STUB_ACCOUNTS.hosting, 1_26_000_00n),
      row(STUB_ACCOUNTS.gatewayCharges, 11_103_80n),
    ]),
  ]
  const totalIncome = paise(income.reduce((s, x) => s + x.total, 0n))
  const totalExpenses = paise(expenses.reduce((s, x) => s + x.total, 0n))
  await Promise.resolve()
  return {
    ...r,
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit: paise(totalIncome - totalExpenses),
  }
}

/** Balance sheet as of a date, Schedule III-style grouping. STUB. */
export async function getBalanceSheet(
  ctx: OrgContext,
  asOf: IsoDate
): Promise<BalanceSheet> {
  assertCan(ctx, "report", "read")
  const date = parseInput(isoDateSchema, asOf)
  const profit = 2_37_896_20n
  const equityAndLiabilities = [
    section("shareholders_funds", "Shareholders' funds", [
      row(STUB_ACCOUNTS.capital, 25_00_000_00n),
      {
        accountId: "current-year-profit",
        code: "",
        name: "Surplus (current year)",
        amount: paise(profit),
      },
    ]),
    section("non_current_liabilities", "Non-current liabilities", []),
    section("current_liabilities", "Current liabilities", [
      row(STUB_ACCOUNTS.payables, 1_24_560_00n),
      row(STUB_ACCOUNTS.outputCgst, 61_200_00n),
      row(STUB_ACCOUNTS.outputSgst, 61_200_00n),
      row(STUB_ACCOUNTS.outputIgst, 45_000_00n),
    ]),
  ]
  const assets = [
    section("non_current_assets", "Non-current assets", []),
    section("current_assets", "Current assets", [
      row(STUB_ACCOUNTS.bank, 24_31_850_00n),
      row(STUB_ACCOUNTS.razorpayClearing, 1_12_400_00n),
      row(STUB_ACCOUNTS.receivables, 3_42_200_00n),
      row(STUB_ACCOUNTS.inputIgst, 18_406_20n),
    ]),
  ]
  await Promise.resolve()
  return {
    asOf: date,
    equityAndLiabilities,
    assets,
    totalEquityAndLiabilities: paise(
      equityAndLiabilities.reduce((s, x) => s + x.total, 0n)
    ),
    totalAssets: paise(assets.reduce((s, x) => s + x.total, 0n)),
    currentYearProfit: paise(profit),
  }
}

/** Journal entries, newest first, with their lines. STUB. */
export async function listEntries(
  ctx: OrgContext,
  filters: ListEntriesFilters,
  cursor: string | null,
  options: PageOptions = {}
): Promise<Page<JournalEntryView>> {
  assertCan(ctx, "ledger", "read")
  const f = parseInput(listEntriesFiltersSchema, filters)
  const { limit } = parseInput(pageOptionsSchema, options)
  if (f.from && f.to && f.from > f.to)
    throw new ServiceError("VALIDATION", "'from' is after 'to'.")
  const items = STUB_ENTRIES.filter(
    (e) =>
      (!f.accountId || e.lines.some((l) => l.account.id === f.accountId)) &&
      (!f.sourceType || e.sourceType === f.sourceType) &&
      (!f.search || e.narration.toLowerCase().includes(f.search.toLowerCase()))
  ).reverse()
  await Promise.resolve()
  return { items: cursor ? [] : items.slice(0, limit), nextCursor: null }
}
