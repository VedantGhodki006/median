import { formatInr, paise } from "@workspace/ledger"

import { divRound, tenths } from "./metrics"

/**
 * A safe arithmetic evaluator for Ask Median: + − × ÷ and parentheses over
 * named operands only. No literals, no functions, no eval. Values are exact
 * fractions of bigints, so nothing is lost to floats until the final rounding.
 */
export interface CalcOperand {
  /** Referenced by this name in the expression: letters, digits, underscores. */
  readonly label: string
  /** Money, in integer paise. */
  readonly valuePaise?: bigint | undefined
  /** A plain number (a count of months, a rate). Up to 6 decimal places. */
  readonly value?: number | undefined
  readonly sourceLink?: string | undefined
}

export type CalcUnit = "inr" | "number" | "percent" | "months"

export type CalcResult =
  | { readonly ok: true; readonly result: string; readonly formula: string }
  | { readonly ok: false; readonly error: string; readonly message: string }

/** An exact rational number, den > 0. */
interface Q {
  readonly n: bigint
  readonly d: bigint
}

const SCALE = 1_000_000n

function fromNumber(x: number): Q {
  return { n: BigInt(Math.round(x * Number(SCALE))), d: SCALE }
}

class CalcError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

type Token =
  | { readonly kind: "name"; readonly text: string }
  | { readonly kind: "op"; readonly text: "+" | "-" | "*" | "/" }
  | { readonly kind: "paren"; readonly text: "(" | ")" }

const OPS: Record<string, "+" | "-" | "*" | "/"> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "*": "*",
  "×": "*",
  x: "*",
  "/": "/",
  "÷": "/",
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expression.length) {
    const c = expression[i] ?? ""
    if (/\s/.test(c)) {
      i += 1
      continue
    }
    if (c === "(" || c === ")") {
      tokens.push({ kind: "paren", text: c })
      i += 1
      continue
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(expression.slice(i))?.[0]
    if (name && name !== "x") {
      tokens.push({ kind: "name", text: name })
      i += name.length
      continue
    }
    const op = OPS[c]
    if (op) {
      tokens.push({ kind: "op", text: op })
      i += 1
      continue
    }
    throw new CalcError(
      "INVALID_EXPRESSION",
      `Unexpected "${c}". Use operand labels, + − × ÷ and parentheses only; put every number in an operand.`
    )
  }
  return tokens
}

function evaluate(tokens: readonly Token[], values: ReadonlyMap<string, Q>): Q {
  let pos = 0
  const peek = () => tokens[pos]

  const add = (a: Q, b: Q, sign: 1n | -1n): Q => ({
    n: a.n * b.d + sign * b.n * a.d,
    d: a.d * b.d,
  })
  const mul = (a: Q, b: Q): Q => ({ n: a.n * b.n, d: a.d * b.d })
  const div = (a: Q, b: Q): Q => {
    if (b.n === 0n)
      throw new CalcError("DIVISION_BY_ZERO", "The expression divides by zero.")
    const sign = b.n < 0n ? -1n : 1n
    return { n: a.n * b.d * sign, d: a.d * b.n * sign }
  }

  function primary(): Q {
    const t = peek()
    if (!t)
      throw new CalcError("INVALID_EXPRESSION", "The expression ends early.")
    pos += 1
    if (t.kind === "op" && t.text === "-") {
      const v = primary()
      return { n: -v.n, d: v.d }
    }
    if (t.kind === "paren" && t.text === "(") {
      const v = sumExpr()
      const close = peek()
      if (close?.kind !== "paren" || close.text !== ")")
        throw new CalcError("INVALID_EXPRESSION", "A parenthesis isn't closed.")
      pos += 1
      return v
    }
    if (t.kind === "name") {
      const v = values.get(t.text)
      if (!v)
        throw new CalcError(
          "UNKNOWN_OPERAND",
          `"${t.text}" isn't one of the operands.`
        )
      return v
    }
    throw new CalcError("INVALID_EXPRESSION", `Unexpected "${t.text}".`)
  }

  function product(): Q {
    let v = primary()
    for (;;) {
      const t = peek()
      if (t?.kind !== "op" || (t.text !== "*" && t.text !== "/")) return v
      pos += 1
      v = t.text === "*" ? mul(v, primary()) : div(v, primary())
    }
  }

  function sumExpr(): Q {
    let v = product()
    for (;;) {
      const t = peek()
      if (t?.kind !== "op" || (t.text !== "+" && t.text !== "-")) return v
      pos += 1
      v = add(v, product(), t.text === "+" ? 1n : -1n)
    }
  }

  const result = sumExpr()
  if (pos !== tokens.length)
    throw new CalcError("INVALID_EXPRESSION", "The expression has extra input.")
  return result
}

function display(op: CalcOperand): string {
  if (op.valuePaise !== undefined) return formatInr(paise(op.valuePaise))
  return String(op.value)
}

function formatResult(q: Q, unit: CalcUnit): string {
  switch (unit) {
    // Money operands are rupees (paise ÷ 100), so ×100 gives paise.
    case "inr":
      return formatInr(paise(divRound(q.n * 100n, q.d)))
    case "percent":
      return `${tenths(divRound(q.n * 1000n, q.d))}%`
    case "months":
      return `${tenths(divRound(q.n * 10n, q.d))} months`
    case "number": {
      const hundredths = divRound(q.n * 100n, q.d)
      const sign = hundredths < 0n ? "-" : ""
      const abs = hundredths < 0n ? -hundredths : hundredths
      return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`
    }
  }
}

/**
 * Evaluates `expression` over `operands`. Money operands count in rupees, so
 * "cash / expenses" is a plain ratio and "revenue - cost" is money. For
 * "percent", the expression gives a fraction (0.25 → "25.0%").
 */
export function calculate(input: {
  readonly expression: string
  readonly operands: readonly CalcOperand[]
  readonly unit: CalcUnit
}): CalcResult {
  try {
    const values = new Map<string, Q>()
    for (const op of input.operands) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(op.label) || op.label === "x")
        throw new CalcError(
          "INVALID_OPERAND",
          `Label "${op.label}" must be letters, digits and underscores.`
        )
      if ((op.valuePaise === undefined) === (op.value === undefined))
        throw new CalcError(
          "INVALID_OPERAND",
          `Operand "${op.label}" needs exactly one of valuePaise or value.`
        )
      values.set(
        op.label,
        op.valuePaise !== undefined
          ? { n: op.valuePaise, d: 100n }
          : fromNumber(op.value ?? 0)
      )
    }
    const tokens = tokenize(input.expression)
    const q = evaluate(tokens, values)
    const result = formatResult(q, input.unit)
    const byLabel = new Map(input.operands.map((o) => [o.label, o]))
    const shown = tokens
      .map((t) => {
        if (t.kind === "name") {
          const op = byLabel.get(t.text)
          return op ? `${display(op)} ${t.text.replaceAll("_", " ")}` : t.text
        }
        if (t.kind === "op")
          return { "+": "+", "-": "−", "*": "×", "/": "÷" }[t.text]
        return t.text
      })
      .join(" ")
      .replaceAll("( ", "(")
      .replaceAll(" )", ")")
    return { ok: true, result, formula: `${shown} = ${result}` }
  } catch (error) {
    if (error instanceof CalcError)
      return { ok: false, error: error.code, message: error.message }
    throw error
  }
}
