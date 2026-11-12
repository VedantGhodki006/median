import type { IsoDate, ProfitAndLoss } from "@workspace/contracts"
import { formatInr, paise } from "@workspace/ledger"
import type { Money } from "@workspace/ledger"

import type { AskSource } from "./sources"

/**
 * Financial metrics Ask Median quotes instead of working them out itself.
 * Everything here is integer paise and bigint maths; the only rounding is the
 * final figure, to one decimal place (months and percentages).
 */
export const FINANCIAL_METRICS = [
  "runway_months",
  "burn_rate",
  "gross_margin_pct",
  "net_margin_pct",
  "revenue_growth_mom_pct",
  "expense_growth_mom_pct",
  "avg_monthly_revenue",
  "avg_monthly_expenses",
] as const
export type FinancialMetric = (typeof FINANCIAL_METRICS)[number]

/** One month's P&L, oldest first, with the page that shows it. */
export interface MonthFigures {
  readonly pl: Pick<
    ProfitAndLoss,
    "from" | "to" | "totalIncome" | "totalExpenses" | "netProfit" | "expenses"
  >
  readonly source: AskSource
}

export interface CashFigure {
  readonly asOf: IsoDate
  readonly total: Money
  readonly source: AskSource
}

export interface MetricInput {
  readonly label: string
  readonly value: string
  readonly source: AskSource
}

export interface MetricResult {
  readonly metric: FinancialMetric
  /** The finished figure to quote, e.g. "10.8 months" or "₹4,06,195.09". */
  readonly value: string
  readonly status?: "cash_flow_positive" | "burning" | "not_enough_data"
  /** One line the model repeats, e.g. "₹X cash ÷ ₹Y avg monthly expenses = 10.8 months". */
  readonly formula: string
  readonly inputs: readonly MetricInput[]
  /** Extra finished figures for metrics with more than one (burn rate, runway). */
  readonly also?: Readonly<Record<string, string>>
}

/** a ÷ b rounded half away from zero, in bigint. */
export function divRound(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new RangeError("Division by zero.")
  const negative = a < 0n !== b < 0n
  const n = a < 0n ? -a : a
  const d = b < 0n ? -b : b
  const q = (n * 2n + d) / (d * 2n)
  return negative ? -q : q
}

/** Tenths as "12.3" (and "-0.4"). */
export function tenths(t: bigint): string {
  const sign = t < 0n ? "-" : ""
  const abs = t < 0n ? -t : t
  return `${sign}${abs / 10n}.${abs % 10n}`
}

const inr = (m: bigint) => formatInr(paise(m))
const sum = (xs: readonly bigint[]) => xs.reduce((a, b) => a + b, 0n)

/** n ÷ d as a percentage to one decimal, or null when d is zero. */
function pct(n: bigint, d: bigint): string | null {
  return d === 0n ? null : `${tenths(divRound(n * 1000n, d))}%`
}

const COST_SECTION = "cost_of_materials_and_services"

/**
 * Computes one metric from monthly P&Ls (whole months, oldest first) and,
 * for runway, the cash position at the end of the range.
 */
export function computeMetric(
  metric: FinancialMetric,
  months: readonly MonthFigures[],
  cash: CashFigure | null
): MetricResult {
  const count = BigInt(months.length)
  const first = months[0]
  const last = months.at(-1)
  if (!first || !last) {
    return {
      metric,
      value: "not available",
      status: "not_enough_data",
      formula: "No whole months in the range.",
      inputs: [],
    }
  }
  const span = `${first.pl.from} to ${last.pl.to}`
  const revenue = sum(months.map((m) => m.pl.totalIncome))
  const expenses = sum(months.map((m) => m.pl.totalExpenses))
  const net = sum(months.map((m) => m.pl.netProfit))
  const avgRevenue = divRound(revenue, count)
  const avgExpenses = divRound(expenses, count)
  // Net burn: cash out minus cash in, approximated from the P&L.
  const avgNetBurn = divRound(expenses - revenue, count)
  const monthSources = months.map((m) => m.source)
  const revenueInput: MetricInput = {
    label: `Revenue, ${span}`,
    value: inr(revenue),
    source: monthSources[0] ?? first.source,
  }
  const perMonth = (label: string, pick: (m: MonthFigures) => bigint) =>
    months.map((m) => ({
      label: `${label}, ${m.pl.from} to ${m.pl.to}`,
      value: inr(pick(m)),
      source: m.source,
    }))
  const revenueInputs = perMonth("Revenue", (m) => m.pl.totalIncome)
  const expenseInputs = perMonth("Expenses", (m) => m.pl.totalExpenses)
  const months_ = `${months.length} month${months.length === 1 ? "" : "s"}`

  switch (metric) {
    case "avg_monthly_revenue":
      return {
        metric,
        value: inr(avgRevenue),
        formula: `${inr(revenue)} revenue ÷ ${months_} = ${inr(avgRevenue)} a month`,
        inputs: revenueInputs,
      }
    case "avg_monthly_expenses":
      return {
        metric,
        value: inr(avgExpenses),
        formula: `${inr(expenses)} expenses ÷ ${months_} = ${inr(avgExpenses)} a month`,
        inputs: expenseInputs,
      }
    case "burn_rate":
      return {
        metric,
        value: inr(avgNetBurn),
        status: avgNetBurn > 0n ? "burning" : "cash_flow_positive",
        formula: `Net burn: (${inr(expenses)} expenses − ${inr(revenue)} revenue) ÷ ${months_} = ${inr(avgNetBurn)} a month; gross burn: ${inr(expenses)} ÷ ${months_} = ${inr(avgExpenses)} a month`,
        inputs: [...revenueInputs, ...expenseInputs],
        also: {
          netBurnMonthly: inr(avgNetBurn),
          grossBurnMonthly: inr(avgExpenses),
        },
      }
    case "gross_margin_pct": {
      const cost = sum(
        months.flatMap((m) =>
          m.pl.expenses
            .filter((s) => s.key === COST_SECTION)
            .map((s) => s.total)
        )
      )
      const value = pct(revenue - cost, revenue)
      return {
        metric,
        value: value ?? "not available",
        ...(value ? {} : { status: "not_enough_data" as const }),
        formula: value
          ? `(${inr(revenue)} revenue − ${inr(cost)} cost of materials and services) ÷ ${inr(revenue)} revenue = ${value}`
          : "No revenue in the range, so there is no margin.",
        inputs: [
          revenueInput,
          {
            label: `Cost of materials and services, ${span}`,
            value: inr(cost),
            source: first.source,
          },
        ],
      }
    }
    case "net_margin_pct": {
      const value = pct(net, revenue)
      return {
        metric,
        value: value ?? "not available",
        ...(value ? {} : { status: "not_enough_data" as const }),
        formula: value
          ? `${inr(net)} net profit ÷ ${inr(revenue)} revenue = ${value}`
          : "No revenue in the range, so there is no margin.",
        inputs: [
          revenueInput,
          {
            label: `Net profit, ${span}`,
            value: inr(net),
            source: first.source,
          },
        ],
      }
    }
    case "revenue_growth_mom_pct":
    case "expense_growth_mom_pct": {
      const isRevenue = metric === "revenue_growth_mom_pct"
      const what = isRevenue ? "revenue" : "expenses"
      const pick = (m: MonthFigures) =>
        isRevenue ? m.pl.totalIncome : m.pl.totalExpenses
      const prev = months.at(-2)
      const inputs = isRevenue ? revenueInputs : expenseInputs
      if (!prev)
        return {
          metric,
          value: "not available",
          status: "not_enough_data",
          formula: "Month-on-month growth needs at least two whole months.",
          inputs,
        }
      const before = pick(prev)
      const after = pick(last)
      const value = pct(after - before, before)
      return {
        metric,
        value: value ?? "not available",
        ...(value ? {} : { status: "not_enough_data" as const }),
        formula: value
          ? `(${inr(after)} − ${inr(before)}) ÷ ${inr(before)} ${what} = ${value}`
          : `No ${what} in ${prev.pl.from} to ${prev.pl.to}, so growth can't be measured.`,
        inputs: inputs.slice(-2),
      }
    }
    case "runway_months": {
      if (!cash)
        return {
          metric,
          value: "not available",
          status: "not_enough_data",
          formula: "No cash position.",
          inputs: [],
        }
      const cashInput: MetricInput = {
        label: `Cash in bank and in hand, ${cash.asOf}`,
        value: inr(cash.total),
        source: cash.source,
      }
      const inputs = [cashInput, ...revenueInputs, ...expenseInputs]
      if (avgNetBurn > 0n) {
        const runway = `${tenths(divRound(cash.total * 10n, avgNetBurn))} months`
        return {
          metric,
          value: runway,
          status: "burning",
          formula: `${inr(cash.total)} cash ÷ ${inr(avgNetBurn)} avg monthly net burn = ${runway}`,
          inputs,
          also: { netBurnMonthly: inr(avgNetBurn) },
        }
      }
      // Net burn ≤ 0: the business is cash-flow positive. Gross runway is
      // how long cash lasts if revenue stopped.
      if (avgExpenses <= 0n)
        return {
          metric,
          value: "not available",
          status: "cash_flow_positive",
          formula: "Cash-flow positive, and no expenses in the range.",
          inputs,
        }
      const gross = `${tenths(divRound(cash.total * 10n, avgExpenses))} months`
      return {
        metric,
        value: gross,
        status: "cash_flow_positive",
        formula: `${inr(cash.total)} cash ÷ ${inr(avgExpenses)} avg monthly expenses = ${gross}`,
        inputs,
        also: {
          grossRunway: gross,
          avgMonthlyNetProfit: inr(-avgNetBurn),
          avgMonthlyExpenses: inr(avgExpenses),
        },
      }
    }
  }
}

/** First and last day of each calendar month from `from` to `to`, whole months only. */
export function wholeMonths(
  from: IsoDate,
  to: IsoDate
): { from: IsoDate; to: IsoDate }[] {
  const out: { from: IsoDate; to: IsoDate }[] = []
  let [y, m] = from.split("-").map(Number) as [number, number]
  if (!from.endsWith("-01")) m += 1
  for (;;) {
    if (m > 12) {
      y += 1
      m = 1
    }
    const start = `${y}-${String(m).padStart(2, "0")}-01`
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    if (end > to) break
    out.push({ from: start, to: end })
    m += 1
  }
  return out
}

/** The last three whole months before `today`. */
export function lastThreeMonths(today: IsoDate): {
  from: IsoDate
  to: IsoDate
} {
  const [y, m] = today.split("-").map(Number) as [number, number]
  const end = new Date(Date.UTC(y, m - 1, 0))
  const start = new Date(Date.UTC(y, m - 4, 1))
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}
