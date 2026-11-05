import "server-only"

import type { OrgContext } from "./context"
import { assertCan } from "./context"
import { dateRangeSchema, parseInput } from "@workspace/contracts"
import type { IsoDate, TallyExport } from "@workspace/contracts"

/** STUB: a well-formed but empty Tally envelope. */
export async function exportTally(
  ctx: OrgContext,
  from: IsoDate,
  to: IsoDate
): Promise<TallyExport> {
  assertCan(ctx, "report", "export")
  const r = parseInput(dateRangeSchema, { from, to })
  await Promise.resolve()
  return {
    fileName: `median-tally-${r.from}-to-${r.to}.xml`,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC><REQUESTDATA/></IMPORTDATA></BODY>
</ENVELOPE>
`,
    ledgerCount: 0,
    voucherCount: 0,
  }
}
