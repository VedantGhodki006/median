import { describe, expect, it } from "vitest"

import {
  INDUSTRIES,
  SYSTEM_ACCOUNT_KEYS,
  accountTypeForCode,
  chartOfAccountsFor,
} from "./chart-of-accounts"

describe.each(INDUSTRIES)("chart of accounts: %s", (industry) => {
  const accounts = chartOfAccountsFor(industry)

  it("has unique codes", () => {
    const codes = accounts.map((a) => a.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("has exactly one account for every system key", () => {
    for (const key of SYSTEM_ACCOUNT_KEYS) {
      expect(
        accounts.filter((a) => a.systemKey === key),
        key
      ).toHaveLength(1)
    }
  })

  it("puts every code in the range for its type", () => {
    for (const account of accounts) {
      expect(accountTypeForCode(account.code), account.code).toBe(account.type)
    }
  })

  it("only uses parents that exist and share the child's type", () => {
    const byCode = new Map(accounts.map((a) => [a.code, a]))
    for (const account of accounts) {
      if (!account.parentCode) continue
      const parent = byCode.get(account.parentCode)
      expect(parent, account.code).toBeDefined()
      expect(parent?.type).toBe(account.type)
      expect(parent?.parentCode).toBeUndefined()
    }
  })

  it("is sorted by code", () => {
    const codes = accounts.map((a) => a.code)
    expect(codes).toEqual([...codes].sort())
  })
})

describe("accountTypeForCode", () => {
  it("rejects malformed codes", () => {
    expect(accountTypeForCode("12")).toBeNull()
    expect(accountTypeForCode("6000")).toBeNull()
    expect(accountTypeForCode("abcd")).toBeNull()
  })
})

describe("accounts the accounting rules depend on", () => {
  const required = {
    gst_output_cgst: "Output CGST",
    gst_output_sgst: "Output SGST",
    gst_output_igst: "Output IGST",
    gst_input_cgst: "Input CGST",
    gst_input_sgst: "Input SGST",
    gst_input_igst: "Input IGST",
    tds_receivable: "TDS receivable",
    gateway_charges: "Payment gateway charges",
    razorpay_clearing: "Razorpay clearing",
    round_off: "Round off",
  } as const

  it.each(INDUSTRIES)("are seeded for %s", (industry) => {
    const accounts = chartOfAccountsFor(industry)
    for (const [key, name] of Object.entries(required)) {
      expect(accounts.find((a) => a.systemKey === key)?.name, key).toBe(name)
    }
  })
})
