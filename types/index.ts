export interface CalculationResult {
  randomMode: boolean;
  chosenRounding: number;
  distributedLeftover: boolean;
  jitterEnabled: boolean;
  depositA: number;
  depositB: number;
  bonusAmountA: number;
  bonusAmountB: number;
  bonusStakeA: number;
  bonusStakeB: number;
  bonusPercentA: number;
  bonusPercentB: number;
  totalBonus: number;
  leftover: number;
  stakeA: number;
  stakeB: number;
  bonusADivertedToB: number;
  canUseBonusOnA: boolean;
  canUseBonusOnB: boolean;
  minOddsForBonusA: number;
  guaranteed: number;
  profit: number;
  profitOnUsed: number;
  usedCapital: number;
  budget: number;
  oddsA: number;
  oddsB: number;
}

export interface BetEntry {
  id: string;
  amount: number;
  isBonus: boolean;
  timestamp: number;
  fundSource?: 'A' | 'B'; // Track which book the funds came from
}

export interface BookState {
  entries: BetEntry[];
  totalDeposit: number;
  totalBonus: number;
}

export interface JourneyState {
  bookA: BookState;
  bookB: BookState;
  isComplete: boolean;
}
