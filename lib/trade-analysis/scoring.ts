import { CompatibilityMetrics } from './types';

/**
 * Calculates a comprehensive compatibility score (0-100)
 * Higher scores indicate better trade potential
 */
export function calculateCompatibilityScore(metrics: CompatibilityMetrics): number {
  const { 
    youHaveRate, 
    theyHaveRate, 
    youHaveCount, 
    theyHaveCount, 
    totalMutualCards, 
    valueBalance 
  } = metrics;
  
  // Component 1: Mutual Interest Score (0-40 points)
  // More mutual cards = higher base score
  const mutualInterestScore = Math.min(40, totalMutualCards * 4);
  
  // Component 2: Balance Score (0-30 points)
  // Both sides having cards for each other is ideal
  let balanceScore = 0;
  if (youHaveCount > 0 && theyHaveCount > 0) {
    // Calculate rate difference penalty
    const rateDifference = Math.abs(youHaveRate - theyHaveRate);
    balanceScore = Math.max(0, 30 - (rateDifference / 4));
  }
  
  // Component 3: Rate Quality Score (0-20 points)
  // Higher match rates are better
  const averageRate = (youHaveRate + theyHaveRate) / 2;
  const rateScore = Math.min(20, averageRate * 0.2);
  
  // Component 4: Value Balance Score (0-10 points)
  // Prefer trades with balanced values
  let valueScore = 10;
  if (valueBalance >= 10) {
    // Reduce score based on imbalance
    valueScore = Math.max(0, 10 - (valueBalance / 10));
  }
  
  // Calculate final score
  const totalScore = mutualInterestScore + balanceScore + rateScore + valueScore;
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, totalScore));
}

/**
 * Determines trade potential based on compatibility score
 */
export function getTradePotential(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Determines balance status based on value difference
 */
export function getBalanceStatus(valueDifference: number): 'you_ahead' | 'they_ahead' | 'balanced' {
  // Consider trades balanced if within $5 difference
  const BALANCE_THRESHOLD = 5;
  
  if (Math.abs(valueDifference) < BALANCE_THRESHOLD) {
    return 'balanced';
  }
  
  // Positive difference means current user's cards are worth more
  return valueDifference > 0 ? 'you_ahead' : 'they_ahead';
}

/**
 * Generates a human-readable trade recommendation
 */
export function getTradeRecommendation(
  score: number,
  hasMutualInterest: boolean,
  balanceStatus: 'you_ahead' | 'they_ahead' | 'balanced'
): string {
  if (!hasMutualInterest) {
    return 'No mutual trade interest found';
  }
  
  const potential = getTradePotential(score);
  
  let recommendation = '';
  switch (potential) {
    case 'high':
      recommendation = 'Excellent trade match! ';
      break;
    case 'medium':
      recommendation = 'Good trade potential. ';
      break;
    case 'low':
      recommendation = 'Limited trade potential. ';
      break;
  }
  
  switch (balanceStatus) {
    case 'balanced':
      recommendation += 'Trade values are well balanced.';
      break;
    case 'you_ahead':
      recommendation += 'You may need to offer additional value to balance the trade.';
      break;
    case 'they_ahead':
      recommendation += 'They may need to offer additional value to balance the trade.';
      break;
  }
  
  return recommendation;
}