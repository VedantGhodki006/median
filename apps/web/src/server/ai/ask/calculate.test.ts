import { paise } from "@workspace/ledger"
import { describe, expect, it } from "vitest"

import { calculate } from "./calculate"

describe("calculate", () => {
  it("evaluates + − × ÷ with precedence and parentheses, exactly", () => {
    expect(
      calculate({
        expression: "(revenue − cost) ÷ revenue",
        unit: "percent",
        operands: [
          { label: "revenue", valuePaise: paise(14_00_000_00n) },
          { label: "cost", valuePaise: paise(1_80_000_00n) },
        ],
      })
    ).toEqual({
      ok: true,
      result: "87.1%",
      formula:
        "(₹14,00,000.00 revenue − ₹1,80,000.00 cost) ÷ ₹14,00,000.00 revenue = 87.1%",
    })
    expect(
      calculate({
        expression: "a + b * c - d / e",
        unit: "number",
        operands: [
          { label: "a", value: 1 },
          { label: "b", value: 2 },
          { label: "c", value: 3 },
          { label: "d", value: 1 },
          { label: "e", value: 4 },
        ],
      })
    ).toMatchObject({ ok: true, result: "6.75" })
  })

  it("keeps money in paise and rounds only at the end", () => {
    expect(
      calculate({
        expression: "total / months",
        unit: "inr",
        operands: [
          { label: "total", valuePaise: paise(12_18_585_27n) },
          { label: "months", value: 3 },
        ],
      })
    ).toMatchObject({ ok: true, result: "₹4,06,195.09" })
  })

  it("handles negatives and unary minus", () => {
    expect(
      calculate({
        expression: "-(revenue - expenses)",
        unit: "inr",
        operands: [
          { label: "revenue", valuePaise: paise(2_00_000_00n) },
          { label: "expenses", valuePaise: paise(2_52_000_00n) },
        ],
      })
    ).toMatchObject({ ok: true, result: "₹52,000.00" })
  })

  it("refuses division by zero", () => {
    expect(
      calculate({
        expression: "cash / burn",
        unit: "months",
        operands: [
          { label: "cash", valuePaise: paise(100n) },
          { label: "burn", valuePaise: paise(0n) },
        ],
      })
    ).toMatchObject({ ok: false, error: "DIVISION_BY_ZERO" })
  })

  it("accepts nothing but operands, operators and parentheses", () => {
    const ops = [{ label: "a", value: 1 }] as const
    for (const expression of [
      "a + 2",
      "process.exit()",
      "a; a",
      "Math.max(a)",
      "a ** a",
    ]) {
      expect(calculate({ expression, unit: "number", operands: ops }).ok).toBe(
        false
      )
    }
    expect(
      calculate({ expression: "b", unit: "number", operands: ops })
    ).toMatchObject({ ok: false, error: "UNKNOWN_OPERAND" })
    expect(
      calculate({ expression: "(a", unit: "number", operands: ops })
    ).toMatchObject({ ok: false, error: "INVALID_EXPRESSION" })
    expect(
      calculate({
        expression: "a",
        unit: "number",
        operands: [{ label: "bad label", value: 1 }],
      })
    ).toMatchObject({ ok: false, error: "INVALID_OPERAND" })
  })
})
