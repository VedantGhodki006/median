import { paise } from "@workspace/ledger"
import { describe, expect, it } from "vitest"

import {
  computeMetric,
  divRound,
  lastThreeMonths,
  wholeMonths,
} from "./metrics"
import type { CashFigure, MonthFigures } from "./metrics"

function month(
  from: string,
  to: string,
  income: bigint,
  expenses: bigint,
  cost = 0n
): MonthFigures {
  return {
    pl: {
      from,
      to,
      totalIncome: paise(income),
      totalExpenses: paise(expenses),
      netProfit: paise(income - expenses),
      expenses: [
        {
          key: "cost_of_materials_and_services",
          label: "Cost of materials and services",
          rows: [],
          total: paise(cost),
        },
      ],
    },
    source: { title: from, href: `/reports?from=${from}&to=${to}` },
  }
}

const cash = (total: bigint): CashFigure => ({
  asOf: "2026-10-31",
  total: paise(total),
  source: { title: "Cash position", href: "/cash" },
})

// Acme Labs, Aug–Oct 2026: profitable, ₹4,06,195.09 average monthly expenses.
const acme = [
  month("2026-08-01", "2026-08-31", 3_00_000_00n, 3_90_000_00n, 50_000_00n),
  month("2026-09-01", "2026-09-30", 5_00_000_00n, 4_10_000_00n, 60_000_00n),
  month("2026-10-01", "2026-10-31", 6_00_000_00n, 4_18_585_27n, 70_000_00n),
]

describe("computeMetric", () => {
  it("gives gross runway when the business is cash-flow positive", () => {
    const r = computeMetric("runway_months", acme, cash(43_73_507_24n))
    expect(r.status).toBe("cash_flow_positive")
    expect(r.value).toBe("10.8 months")
    expect(r.formula).toBe(
      "₹43,73,507.24 cash ÷ ₹4,06,195.09 avg monthly expenses = 10.8 months"
    )
    expect(r.inputs[0]).toMatchObject({
      value: "₹43,73,507.24",
      source: { href: "/cash" },
    })
  })

  it("divides cash by net burn when burning", () => {
    const burning = [
      month("2026-10-01", "2026-10-31", 2_00_000_00n, 2_52_000_00n),
    ]
    const r = computeMetric("runway_months", burning, cash(7_48_000_00n))
    expect(r.status).toBe("burning")
    // 7,48,000 ÷ 52,000 = 14.38…
    expect(r.value).toBe("14.4 months")
    expect(r.formula).toBe(
      "₹7,48,000.00 cash ÷ ₹52,000.00 avg monthly net burn = 14.4 months"
    )
  })

  it("treats zero net burn as cash-flow positive and survives no expenses", () => {
    const even = [month("2026-10-01", "2026-10-31", 1_000_00n, 1_000_00n)]
    expect(
      computeMetric("runway_months", even, cash(10_000_00n))
    ).toMatchObject({
      status: "cash_flow_positive",
      value: "10.0 months",
    })
    const idle = [month("2026-10-01", "2026-10-31", 0n, 0n)]
    expect(
      computeMetric("runway_months", idle, cash(10_000_00n))
    ).toMatchObject({
      status: "cash_flow_positive",
      value: "not available",
    })
  })

  it("gives net and gross burn; negative net burn means cash-flow positive", () => {
    const r = computeMetric("burn_rate", acme, null)
    expect(r.status).toBe("cash_flow_positive")
    expect(r.also).toEqual({
      netBurnMonthly: "-₹60,471.58",
      grossBurnMonthly: "₹4,06,195.09",
    })
  })

  it("computes margins, averages and growth to one decimal", () => {
    expect(computeMetric("gross_margin_pct", acme, null)).toMatchObject({
      // (14,00,000 − 1,80,000) ÷ 14,00,000 = 87.14…%
      value: "87.1%",
      formula:
        "(₹14,00,000.00 revenue − ₹1,80,000.00 cost of materials and services) ÷ ₹14,00,000.00 revenue = 87.1%",
    })
    expect(computeMetric("net_margin_pct", acme, null).value).toBe("13.0%")
    expect(computeMetric("avg_monthly_revenue", acme, null).value).toBe(
      "₹4,66,666.67"
    )
    expect(computeMetric("avg_monthly_expenses", acme, null).value).toBe(
      "₹4,06,195.09"
    )
    expect(computeMetric("revenue_growth_mom_pct", acme, null).value).toBe(
      "20.0%"
    )
    expect(computeMetric("expense_growth_mom_pct", acme, null).value).toBe(
      "2.1%"
    )
  })

  it("says when there isn't enough data instead of dividing by zero", () => {
    const one = [month("2026-10-01", "2026-10-31", 0n, 1_000_00n)]
    expect(computeMetric("gross_margin_pct", one, null).status).toBe(
      "not_enough_data"
    )
    expect(computeMetric("revenue_growth_mom_pct", one, null).status).toBe(
      "not_enough_data"
    )
    expect(computeMetric("runway_months", [], cash(1n)).status).toBe(
      "not_enough_data"
    )
  })
})

describe("helpers", () => {
  it("rounds half away from zero and refuses zero divisors", () => {
    expect(divRound(5n, 2n)).toBe(3n)
    expect(divRound(-5n, 2n)).toBe(-3n)
    expect(divRound(4n, 3n)).toBe(1n)
    expect(() => divRound(1n, 0n)).toThrow(RangeError)
  })

  it("picks whole months and the last three before today", () => {
    expect(lastThreeMonths("2026-11-12")).toEqual({
      from: "2026-08-01",
      to: "2026-10-31",
    })
    expect(lastThreeMonths("2027-01-05")).toEqual({
      from: "2026-10-01",
      to: "2026-12-31",
    })
    expect(wholeMonths("2026-08-15", "2026-10-31")).toEqual([
      { from: "2026-09-01", to: "2026-09-30" },
      { from: "2026-10-01", to: "2026-10-31" },
    ])
    expect(wholeMonths("2026-12-01", "2027-02-28")).toHaveLength(3)
  })
})
