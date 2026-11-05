import "server-only"

import { paise } from "@workspace/ledger"

import type { OrgContext } from "./context"
import { assertCan } from "./context"
import { parseInput, periodSchema } from "@workspace/contracts"
import type {
  GstSummary,
  GstSupplyRow,
  GstTaxAmounts,
  Period,
} from "@workspace/contracts"

const t = (igst: bigint, cgst: bigint, sgst: bigint): GstTaxAmounts => ({
  igst: paise(igst),
  cgst: paise(cgst),
  sgst: paise(sgst),
  total: paise(igst + cgst + sgst),
})
const supply = (
  taxable: bigint,
  igst = 0n,
  cgst = 0n,
  sgst = 0n
): GstSupplyRow => ({
  taxable: paise(taxable),
  ...t(igst, cgst, sgst),
})

/** STUB. */
export async function getGstSummary(
  ctx: OrgContext,
  period: Period
): Promise<GstSummary> {
  assertCan(ctx, "report", "read")
  const p = parseInput(periodSchema, period)
  await Promise.resolve()
  return {
    period: p,
    outward: [
      {
        rateBps: 1800,
        ...supply(8_35_000_00n, 45_000_00n, 52_650_00n, 52_650_00n),
      },
      { rateBps: 500, ...supply(80_000_00n, 0n, 2_000_00n, 2_000_00n) },
    ],
    outwardTotal: supply(9_15_000_00n, 45_000_00n, 54_650_00n, 54_650_00n),
    zeroRated: {
      exportWithPayment: supply(0n),
      exportLut: supply(2_40_000_00n),
      sez: supply(60_000_00n, 10_800_00n),
    },
    reverseChargeSupplies: supply(0n),
    creditNotes: { count: 1, ...supply(15_000_00n, 0n, 1_350_00n, 1_350_00n) },
    inputTaxCredit: t(18_406_20n, 11_340_00n, 11_340_00n),
    netPayable: t(37_393_80n, 43_310_00n, 43_310_00n),
    tdsReceivable: paise(20_000_00n),
    isLocked: false,
  }
}
