/**
 * Motor de pontuação — função pura, testável, sem dependências de infra.
 */

export interface ScoringRules {
  pointsExactScore: number;
  pointsCorrectWinner: number;
  pointsGoalDiff: number;
  bonusUnderdog: number;
  bonusUniqueHit: number;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  /** rankings FIFA aproximados para detectar zebra (menor = mais forte) */
  homeRank?: number;
  awayRank?: number;
}

export interface BetInput {
  homeScore: number;
  awayScore: number;
}

export interface BetScore {
  points: number;
  isExactScore: boolean;
  isCorrectWinner: boolean;
  isGoalDiff: boolean;
  isUnderdogHit: boolean;
}

type Outcome = 'HOME' | 'AWAY' | 'DRAW';

function outcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

export function scoreBet(bet: BetInput, result: MatchResult, rules: ScoringRules): BetScore {
  const betOutcome = outcome(bet.homeScore, bet.awayScore);
  const realOutcome = outcome(result.homeScore, result.awayScore);

  const isCorrectWinner = betOutcome === realOutcome;
  const isExactScore =
    isCorrectWinner && bet.homeScore === result.homeScore && bet.awayScore === result.awayScore;
  const isGoalDiff =
    isCorrectWinner &&
    !isExactScore &&
    bet.homeScore - bet.awayScore === result.homeScore - result.awayScore;

  // zebra: vitória do time pior ranqueado (diferença >= 20 posições)
  const isUnderdogHit =
    isCorrectWinner &&
    realOutcome !== 'DRAW' &&
    result.homeRank !== undefined &&
    result.awayRank !== undefined &&
    ((realOutcome === 'HOME' && result.homeRank - result.awayRank >= 20) ||
      (realOutcome === 'AWAY' && result.awayRank - result.homeRank >= 20));

  let points = 0;
  if (isExactScore) points = rules.pointsExactScore;
  else if (isGoalDiff) points = rules.pointsGoalDiff;
  else if (isCorrectWinner) points = rules.pointsCorrectWinner;

  if (isUnderdogHit) points += rules.bonusUnderdog;

  return { points, isExactScore, isCorrectWinner, isGoalDiff, isUnderdogHit };
}

/** Aplica bônus de "único a acertar" sobre os scores já calculados. */
export function applyUniqueHitBonus<T extends { score: BetScore }>(
  scored: T[],
  rules: ScoringRules,
): Array<T & { isUniqueHit: boolean }> {
  const exactHits = scored.filter((s) => s.score.isExactScore);
  const winnerHits = scored.filter((s) => s.score.isCorrectWinner);
  return scored.map((s) => {
    const isUniqueHit =
      (s.score.isExactScore && exactHits.length === 1) ||
      (s.score.isCorrectWinner && winnerHits.length === 1 && !s.score.isExactScore);
    return {
      ...s,
      isUniqueHit,
      score: isUniqueHit
        ? { ...s.score, points: s.score.points + rules.bonusUniqueHit }
        : s.score,
    };
  });
}
