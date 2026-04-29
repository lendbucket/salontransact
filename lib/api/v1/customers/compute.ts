import type { V1CustomerTier } from "./types";

interface VisitClassificationInput {
  totalTransactions: number;
  visitsLast365Days: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  now?: Date;
}

export function classifyTier(input: VisitClassificationInput): V1CustomerTier {
  const now = input.now ?? new Date();
  const ageOfLastVisitDays = (now.getTime() - input.lastSeenAt.getTime()) / 86400000;

  if (input.totalTransactions > 0 && ageOfLastVisitDays > 365) return "lapsed";
  if (input.visitsLast365Days >= 4) return "regular";
  if (input.visitsLast365Days >= 1 && input.visitsLast365Days <= 3) return "occasional";
  return "new";
}

export function averageDaysBetweenVisits(visitTimestamps: Date[]): number | null {
  if (visitTimestamps.length < 2) return null;
  const sorted = [...visitTimestamps].sort((a, b) => a.getTime() - b.getTime());
  let totalGapMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalGapMs += sorted[i].getTime() - sorted[i - 1].getTime();
  }
  return Math.round((totalGapMs / (sorted.length - 1) / 86400000) * 10) / 10;
}

export function daysSince(date: Date, now?: Date): number {
  return Math.floor(((now ?? new Date()).getTime() - date.getTime()) / 86400000);
}
