import type { RoundState } from "./rounds";

export interface ScoreSummary {
  finalScore: number | null;
  improved: boolean;
}

export function calculateScore(rounds: readonly RoundState[]): ScoreSummary {
  let finalScore: number | null = null;

  for (let index = rounds.length - 1; index >= 0; index--) {
    if (rounds[index].review.verdict === "approve") {
      finalScore = rounds[index].review.score;
      break;
    }
  }

  return {
    finalScore,
    improved: rounds.length > 1 && rounds.at(-1)!.review.score > rounds[0].review.score,
  };
}
