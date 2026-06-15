export interface TopScorerPlayer {
  name: string;
  country: string;
  countryCode: string;
}

// June 17 23:59 BRT = June 18 02:59 UTC
export const TOP_SCORER_DEADLINE = new Date('2026-06-18T03:00:00Z');

export function isTopScorerOpen(): boolean {
  return new Date() < TOP_SCORER_DEADLINE;
}
