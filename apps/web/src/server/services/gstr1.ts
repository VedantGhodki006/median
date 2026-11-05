import "server-only"

import {
  ServiceError,
  gstr1PayloadSchema,
  paiseToGstnAmount,
  parseInput,
  periodSchema,
} from "@workspace/contracts"
import type { Gstr1Export, Gstr1Payload, Period } from "@workspace/contracts"
import { paise } from "@workspace/ledger"

import type { OrgContext } from "./context"
import { assertCan } from "./context"
import { STUB_PARTIES } from "./stub-data"

const STUB_GSTIN = "29AABCM1234A1Z5"

/** dd-mm-yyyy from YYYY-MM-DD, as GSTN expects. */
function gstnDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-")
  return `${d}-${m}-${y}`
}

/**
 * Draft GSTR-1 JSON for the GSTN offline tool: b2b, b2cl, b2cs, cdnr, exp,
 * hsn, doc_issue. Validated against gstr1PayloadSchema before it's returned.
 * Throws VALIDATION if the organisation has no GSTIN. Always a draft the CA
 * verifies in the offline tool before filing. STUB.
 */
export async function exportGstr1(
  ctx: OrgContext,
  period: Period
): Promise<Gstr1Export> {
  assertCan(ctx, "report", "export")
  const p = parseInput(periodSchema, period)
  const [year, month] = p.split("-")
  const day = `${p}-15`
  const amt = (v: bigint) => paiseToGstnAmount(paise(v))

  const payload: Gstr1Payload = {
    gstin: STUB_GSTIN,
    fp: `${month}${year}`,
    b2b: [
      {
        ctin: STUB_PARTIES.acme.gstin,
        inv: [
          {
            inum: "INV/2026-27/0042",
            idt: gstnDate(day),
            val: amt(1_18_000_00n),
            pos: "29",
            rchrg: "N",
            inv_typ: "R",
            itms: [
              {
                num: 1,
                itm_det: {
                  txval: amt(1_00_000_00n),
                  rt: 18,
                  camt: amt(9_000_00n),
                  samt: amt(9_000_00n),
                  csamt: 0,
                },
              },
            ],
          },
        ],
      },
    ],
    b2cs: [
      {
        sply_ty: "INTRA",
        pos: "29",
        typ: "OE",
        txval: amt(80_000_00n),
        rt: 5,
        camt: amt(2_000_00n),
        samt: amt(2_000_00n),
        csamt: 0,
      },
    ],
    cdnr: [],
    exp: [],
    hsn: {
      data: [
        {
          num: 1,
          hsn_sc: "998314",
          desc: "IT services",
          uqc: "OTH",
          qty: 1,
          rt: 18,
          txval: amt(1_00_000_00n),
          iamt: 0,
          camt: amt(9_000_00n),
          samt: amt(9_000_00n),
          csamt: 0,
        },
      ],
    },
    doc_issue: {
      doc_det: [
        {
          doc_num: 1,
          docs: [
            {
              num: 1,
              from: "INV/2026-27/0040",
              to: "INV/2026-27/0042",
              totnum: 3,
              cancel: 0,
              net_issue: 3,
            },
          ],
        },
      ],
    },
  }

  const validated = gstr1PayloadSchema.safeParse(payload)
  if (!validated.success) {
    throw new ServiceError(
      "VALIDATION",
      "GSTR-1 draft failed schema validation.",
      validated.error.issues
    )
  }
  await Promise.resolve()
  return {
    period: p,
    gstin: STUB_GSTIN,
    payload: validated.data,
    warnings: [
      {
        code: "MISSING_HSN",
        message: "Invoice INV/2026-27/0039 has a line without HSN/SAC.",
        documentNumber: "INV/2026-27/0039",
      },
    ],
    isDraft: true,
    generatedAt: new Date().toISOString(),
  }
}
