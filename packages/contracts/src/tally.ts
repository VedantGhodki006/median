export interface TallyExport {
  readonly fileName: string
  /** Tally-importable XML (ENVELOPE with masters and vouchers), UTF-8. */
  readonly xml: string
  readonly ledgerCount: number
  readonly voucherCount: number
}
