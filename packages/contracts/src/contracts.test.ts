import { paise } from "@workspace/ledger"
import { describe, expect, it } from "vitest"

import { dateRangeSchema } from "./common"
import { sourceRecordSchema } from "./connectors"
import { deleteOrgDataInputSchema } from "./data-rights"
import { gstnAmountSchema, paiseToGstnAmount } from "./gstr1"

const record = {
  provider: "bank-statement",
  kind: "bank_line",
  externalId: null,
  dedupeHash: "a".repeat(64),
  occurredAt: "2026-11-01T00:00:00+05:30",
  amountPaise: 1_18_000_00n,
  direction: "inflow",
  currency: "INR",
  reference: "UTR123",
  settlementExternalId: null,
  payload: { narration: "NEFT ACME" },
} as const

describe("sourceRecordSchema", () => {
  it("accepts a bank line identified by its dedupe hash", () => {
    expect(sourceRecordSchema.parse(record).amountPaise).toBe(1_18_000_00n)
  })

  it("needs an externalId or a dedupeHash", () => {
    const result = sourceRecordSchema.safeParse({ ...record, dedupeHash: null })
    expect(result.success).toBe(false)
  })

  it("rejects floats, negative amounts and bad currencies", () => {
    for (const bad of [
      { amountPaise: 100.5 },
      { amountPaise: -1n },
      { currency: "inr" },
    ]) {
      expect(sourceRecordSchema.safeParse({ ...record, ...bad }).success).toBe(
        false
      )
    }
  })
})

describe("GSTN amounts", () => {
  it("converts paise to rupees only at the GSTN boundary", () => {
    expect(paiseToGstnAmount(paise(1_18_000_50n))).toBe(118000.5)
    expect(gstnAmountSchema.safeParse(118000.5).success).toBe(true)
  })

  it("rejects sub-paise and negative amounts", () => {
    expect(gstnAmountSchema.safeParse(1.005).success).toBe(false)
    expect(gstnAmountSchema.safeParse(-1).success).toBe(false)
  })
})

describe("deleteOrgDataInputSchema", () => {
  it("has a request step and a confirm step", () => {
    expect(
      deleteOrgDataInputSchema.safeParse({ confirmation: { step: "request" } })
        .success
    ).toBe(true)
    expect(
      deleteOrgDataInputSchema.safeParse({
        confirmation: { step: "confirm", token: "t", organizationName: "Acme" },
      }).success
    ).toBe(true)
  })

  it("won't confirm without the typed organisation name", () => {
    expect(
      deleteOrgDataInputSchema.safeParse({
        confirmation: { step: "confirm", token: "t" },
      }).success
    ).toBe(false)
  })
})

describe("dateRangeSchema", () => {
  it("rejects a range that ends before it starts", () => {
    expect(
      dateRangeSchema.safeParse({ from: "2026-11-02", to: "2026-11-01" })
        .success
    ).toBe(false)
  })
})
