import type { IsoTimestamp, Period } from "./common"

export interface PeriodLock {
  readonly period: Period
  readonly lockedBy: string
  readonly lockedAt: IsoTimestamp
}
