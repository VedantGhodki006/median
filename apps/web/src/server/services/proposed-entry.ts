// The shape of an entry waiting in the approval inbox. Stored in
// inbox_items.proposed_entry as JSON, with amounts as integer-paise strings.

import type { ProposedEntry } from "@workspace/contracts"

/** Encodes a ProposedEntry for jsonb (bigint → string). */
export function encodeProposedEntry(entry: ProposedEntry): unknown {
  return {
    ...entry,
    lines: entry.lines.map((l) => ({
      ...l,
      debit: l.debit.toString(),
      credit: l.credit.toString(),
    })),
  }
}
