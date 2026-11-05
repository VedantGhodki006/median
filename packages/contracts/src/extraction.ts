import { z } from "zod"

/** Amount text as printed on a document. The AI copies it; code parses it. */
export const printedAmountSchema = z
  .string()
  .describe(
    'Amount exactly as printed, in rupees, e.g. "1,18,000.00". No maths.'
  )

/**
 * What the AI extracts from a vendor bill: text as printed on the document,
 * no calculations. Use this as the AI output schema. Median parses amounts and
 * computes tax and totals itself, and cross-checks them against
 * `printedTotals`.
 */
export const billExtractionSchema = z.object({
  vendor: z.object({
    name: z.string().min(1),
    gstin: z.string().nullable().describe("15-character GSTIN, or null"),
    stateCode: z
      .string()
      .nullable()
      .describe('Two-digit GST state code, e.g. "29"'),
  }),
  billNumber: z.string().min(1),
  billDate: z.string().describe("YYYY-MM-DD"),
  dueDate: z.string().nullable().describe("YYYY-MM-DD, or null"),
  placeOfSupplyStateCode: z.string().nullable(),
  currency: z.string().describe('ISO currency code as printed, usually "INR"'),
  lines: z
    .array(
      z.object({
        description: z.string(),
        hsnSac: z.string().nullable(),
        quantity: z
          .string()
          .nullable()
          .describe('As printed, e.g. "2" or "1.5"'),
        taxableAmount: printedAmountSchema,
        gstRatePercent: z
          .string()
          .nullable()
          .describe('GST rate as printed, e.g. "18" for 18%'),
      })
    )
    .min(1),
  printedTotals: z.object({
    taxable: printedAmountSchema.nullable(),
    cgst: printedAmountSchema.nullable(),
    sgst: printedAmountSchema.nullable(),
    igst: printedAmountSchema.nullable(),
    total: printedAmountSchema.nullable(),
  }),
})
export type BillExtraction = z.infer<typeof billExtractionSchema>
