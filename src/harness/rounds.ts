import type { Review } from "./validateReview";

export interface RoundState {
  round: number;
  plan: string;
  review: Review;
}

function copyRound(state: RoundState): RoundState {
  return {
    ...state,
    review: {
      ...state.review,
      issues: [...state.review.issues],
    },
  };
}

export class RoundHistory {
  private readonly rounds: RoundState[] = [];

  add(state: RoundState): void {
    this.rounds.push(copyRound(state));
  }

  all(): RoundState[] {
    return this.rounds.map(copyRound);
  }
}
