import "server-only"

import {
  idSchema,
  isoDateSchema,
  isServiceError,
  listEntriesFiltersSchema,
  listInboxFiltersSchema,
  listInvoicesFiltersSchema,
  listPartiesFiltersSchema,
  periodSchema,
} from "@workspace/contracts"
import type { IsoDate } from "@workspace/contracts"
import { paise } from "@workspace/ledger"
import { tool } from "ai"
import { z } from "zod"

import {
  getBalanceSheet,
  getCashPosition,
  getDashboardSummary,
  getGstSummary,
  getInvoice,
  getProfitAndLoss,
  getReceivablesAgeing,
  getRevenueBreakdown,
  getTrialBalance,
  listEntries,
  listInboxItems,
  listInvoices,
  listParties,
} from "@/server/services"
import type { OrgContext } from "@/server/services"

import type { AskToolName } from "@/lib/ask-tools"
import { todayIso } from "@/lib/format-date"

import { calculate } from "./calculate"
import type { FinancialMetric } from "./metrics"
import {
  FINANCIAL_METRICS,
  computeMetric,
  lastThreeMonths,
  wholeMonths,
} from "./metrics"

import { sources } from "./sources"
import type { AskSource } from "./sources"
import { toModelJson } from "./to-model-json"
import type { ModelJson } from "./to-model-json"

/**
 * What every Ask Median tool returns. `data` is the service result with money
 * already formatted; `sources` are the pages that show it. A failure the
 * user should hear about (no access, not found, bad input) comes back as
 * `ok: false` so the model can say so instead of guessing.
 */
export type AskToolResult =
  | {
      readonly ok: true
      readonly data: ModelJson
      readonly sources: readonly AskSource[]
    }
  | { readonly ok: false; readonly error: string; readonly message: string }

/** Rows per page: enough to answer, small enough to keep the prompt cheap. */
const PAGE_LIMIT = 25

const cursorField = z
  .string()
  .max(500)
  .nullable()
  .default(null)
  .describe("nextCursor from a previous call, to read the next page.")

async function run<T>(
  load: () => Promise<T>,
  sourcesOf: (result: T) => readonly AskSource[]
): Promise<AskToolResult> {
  try {
    const result = await load()
    return { ok: true, data: toModelJson(result), sources: sourcesOf(result) }
  } catch (error) {
    if (isServiceError(error)) {
      return { ok: false, error: error.code, message: error.message }
    }
    throw error
  }
}

/**
 * Loads whole-month P&Ls (and, for runway, cash at the end of the range) and
 * computes one metric in code. from/to default to the last three whole months,
 * with cash as of today.
 */
export async function loadFinancialMetric(
  ctx: OrgContext,
  input: {
    readonly metric: FinancialMetric
    readonly from?: IsoDate | undefined
    readonly to?: IsoDate | undefined
  },
  today: IsoDate
) {
  const range = { ...lastThreeMonths(today) }
  if (input.from) range.from = input.from
  if (input.to) range.to = input.to
  const months = wholeMonths(range.from, range.to)
  // "How much runway do we have" means cash today; a named range, cash at its end.
  const cashAsOf = input.to ? (months.at(-1)?.to ?? range.to) : today
  const [pls, cash] = await Promise.all([
    Promise.all(
      months.map((m) =>
        getProfitAndLoss(ctx, m.from, m.to, { comparative: false })
      )
    ),
    input.metric === "runway_months" ? getCashPosition(ctx, cashAsOf) : null,
  ])
  return computeMetric(
    input.metric,
    pls.map((pl) => ({ pl, source: sources.profitAndLoss(pl.from, pl.to) })),
    cash ? { asOf: cash.asOf, total: cash.total, source: sources.cash() } : null
  )
}

/**
 * The read-only tools Ask Median may call, bound to the signed-in user's
 * context. Each wraps one existing service, which checks the organisation and
 * the role itself. None of them posts, approves or changes anything.
 */
export function createAskTools(ctx: OrgContext, today: IsoDate = todayIso()) {
  return {
    getDashboardSummary: tool({
      description:
        "Headline numbers for the home screen: money in, money owed to you, cash, tax due, recent months.",
      inputSchema: z.object({}),
      execute: () =>
        run(
          () => getDashboardSummary(ctx),
          () => [sources.dashboard()]
        ),
    }),

    getProfitAndLoss: tool({
      description:
        "Profit and loss (income, expenses, net profit) for a date range.",
      inputSchema: z.object({ from: isoDateSchema, to: isoDateSchema }),
      execute: ({ from, to }) =>
        run(
          () => getProfitAndLoss(ctx, from, to),
          () => [sources.profitAndLoss(from, to)]
        ),
    }),

    getBalanceSheet: tool({
      description: "Balance sheet (assets, liabilities, equity) as of a date.",
      inputSchema: z.object({ asOf: isoDateSchema }),
      execute: ({ asOf }) =>
        run(
          () => getBalanceSheet(ctx, asOf),
          () => [sources.balanceSheet(asOf)]
        ),
    }),

    getTrialBalance: tool({
      description:
        "Trial balance: every account's debit and credit totals as of a date.",
      inputSchema: z.object({ asOf: isoDateSchema }),
      execute: ({ asOf }) =>
        run(
          () => getTrialBalance(ctx, asOf),
          () => [sources.trialBalance(asOf)]
        ),
    }),

    listEntries: tool({
      description:
        "Posted journal entries, newest first. Filter by date range, account id (from a report row), party id, source, or narration text.",
      inputSchema: z.object({
        ...listEntriesFiltersSchema.shape,
        cursor: cursorField,
      }),
      execute: ({ cursor, ...filters }) =>
        run(
          () => listEntries(ctx, filters, cursor, { limit: PAGE_LIMIT }),
          () => [sources.journal(filters)]
        ),
    }),

    listInvoices: tool({
      description:
        "Sales invoices, newest first. Filter by status, customer (party id) or invoice date range.",
      inputSchema: z.object({
        ...listInvoicesFiltersSchema.shape,
        cursor: cursorField,
      }),
      execute: ({ cursor, ...filters }) =>
        run(
          () => listInvoices(ctx, cursor, filters, { limit: PAGE_LIMIT }),
          (page) => [
            sources.invoices(filters.partyId),
            ...page.items.map((i) => sources.invoice(i.id, i.number)),
          ]
        ),
    }),

    getInvoice: tool({
      description:
        "One invoice with its lines, tax and payment status, by invoice id.",
      inputSchema: z.object({ id: idSchema }),
      execute: ({ id }) =>
        run(
          async () => {
            const invoice = await getInvoice(ctx, id)
            if (!invoice) return { found: false }
            return invoice
          },
          (invoice) =>
            "number" in invoice
              ? [sources.invoice(invoice.id, invoice.number)]
              : []
        ),
    }),

    getReceivablesAgeing: tool({
      description:
        "Money owed to you by customers, bucketed by days past due (not due, 1–30, 31–60, 61–90, over 90), as of today.",
      inputSchema: z.object({ cursor: cursorField }),
      execute: ({ cursor }) =>
        run(
          () => getReceivablesAgeing(ctx, cursor, { limit: PAGE_LIMIT }),
          () => [sources.receivablesAgeing()]
        ),
    }),

    getGstSummary: tool({
      description:
        "GST for one month: outward supplies by rate, credit notes, input tax credit, TDS, net payable.",
      inputSchema: z.object({
        period: periodSchema.describe("The month, as YYYY-MM."),
      }),
      execute: ({ period }) =>
        run(
          () => getGstSummary(ctx, period),
          () => [sources.gst(period)]
        ),
    }),

    getRevenueBreakdown: tool({
      description:
        "Revenue for a date range, by stream (income account) and by customer.",
      inputSchema: z.object({
        from: isoDateSchema,
        to: isoDateSchema,
        cursor: cursorField,
      }),
      execute: ({ from, to, cursor }) =>
        run(
          () =>
            getRevenueBreakdown(ctx, from, to, cursor, { limit: PAGE_LIMIT }),
          () => [sources.revenue(from, to)]
        ),
    }),

    getCashPosition: tool({
      description:
        "Bank and cash balances as of a date, with reconciliation status.",
      inputSchema: z.object({ asOf: isoDateSchema }),
      execute: ({ asOf }) =>
        run(
          () => getCashPosition(ctx, asOf),
          () => [sources.cash()]
        ),
    }),

    listInboxItems: tool({
      description:
        "Items in the AI inbox waiting for review (or approved/rejected), newest first: bills, bank lines, Razorpay records.",
      inputSchema: z.object({
        ...listInboxFiltersSchema.shape,
        cursor: cursorField,
      }),
      execute: ({ cursor, ...filters }) =>
        run(
          () => listInboxItems(ctx, cursor, filters, { limit: PAGE_LIMIT }),
          () => [sources.inbox()]
        ),
    }),

    listParties: tool({
      description:
        "Customers and vendors, with GSTIN and state. Search by name; filter by kind.",
      inputSchema: z.object({
        ...listPartiesFiltersSchema.shape,
        cursor: cursorField,
      }),
      execute: ({ cursor, ...filters }) =>
        run(
          () => listParties(ctx, cursor, filters, { limit: PAGE_LIMIT }),
          (page) => [
            sources.parties(),
            ...page.items.map((p) => sources.party(p.id, p.name)),
          ]
        ),
    }),

    getFinancialMetrics: tool({
      description:
        "A financial metric computed in code from the P&L and cash position, with its formula and inputs: runway_months, burn_rate (net and gross, monthly), gross_margin_pct, net_margin_pct, revenue_growth_mom_pct, expense_growth_mom_pct, avg_monthly_revenue, avg_monthly_expenses. Uses whole months; from/to default to the last three whole months.",
      inputSchema: z.object({
        metric: z.enum(FINANCIAL_METRICS),
        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
      }),
      execute: (input) =>
        run(
          () => loadFinancialMetric(ctx, input, today),
          (result) => [
            ...new Map(
              result.inputs.map((i) => [i.source.href, i.source])
            ).values(),
          ]
        ),
    }),

    calculate: tool({
      description:
        'Exact arithmetic (+ − × ÷ and parentheses) over figures you fetched with other tools, for anything getFinancialMetrics doesn\'t cover. Name each figure as an operand (label: letters, digits, underscores) and write the expression with those labels only, e.g. "(revenue - cost) / revenue" with unit "percent". Money goes in as valuePaise (integer paise: ₹1,234.50 is 123450); counts and rates as value. Money counts in rupees inside the expression.',
      inputSchema: z.object({
        expression: z.string().min(1).max(500),
        operands: z
          .array(
            z.object({
              label: z.string().min(1).max(60),
              valuePaise: z
                .string()
                .regex(/^-?\d{1,18}$/)
                .optional()
                .describe("Money in integer paise, as a string of digits."),
              value: z.number().finite().optional(),
              sourceLink: z
                .string()
                .regex(/^\/[^\s]*$/)
                .optional()
                .describe(
                  "The href from the tool result the figure came from."
                ),
            })
          )
          .min(1)
          .max(20),
        unit: z
          .enum(["inr", "number", "percent", "months"])
          .describe(
            "How to show the result: inr (money), percent (expression gives a fraction), months, or number."
          ),
      }),
      execute: ({ expression, operands, unit }): AskToolResult => {
        const result = calculate({
          expression,
          unit,
          operands: operands.map((o) => ({
            label: o.label,
            valuePaise:
              o.valuePaise === undefined
                ? undefined
                : paise(BigInt(o.valuePaise)),
            value: o.value,
            sourceLink: o.sourceLink,
          })),
        })
        if (!result.ok) return result
        return {
          ok: true,
          data: { result: result.result, formula: result.formula },
          sources: operands.flatMap((o) =>
            o.sourceLink ? [{ title: o.label, href: o.sourceLink }] : []
          ),
        }
      },
    }),
  }
}

export type AskTools = ReturnType<typeof createAskTools>

// Every tool has a label for the UI, and every label a tool.
export type AskToolLabelsMatch = [keyof AskTools] extends [AskToolName]
  ? [AskToolName] extends [keyof AskTools]
    ? true
    : never
  : never
const labelsMatch: AskToolLabelsMatch = true
void labelsMatch
