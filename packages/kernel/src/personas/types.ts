/**
 * Analyst Types and Filtering System
 *
 * Explicitly defines which analysts provide fair_value estimates vs position sizing.
 * This prevents the $5 bug where position_size (5%) was treated as fair_value ($5).
 */

/**
 * All 12 analyst IDs in the system
 */
export type AnalystId =
  | 'consensus-analyst'
  | 'devil-advocate'
  | 'allocator-steward'
  | 'downside-protection'
  | 'greenwald-evasion'
  | 'kessler-moat'
  | 'klamran-quality'
  | 'leveraged-franchise'
  | 'michael-burry'
  | 'portfolio-manager'
  | 'damodaran-valuation'
  | 'seth-klarman';

/**
 * Analysts that provide fair_value estimates (intrinsic value per share in dollars)
 * These are the only analysts whose fair_value should be included in CIO averaging
 */
export const FAIR_VALUE_ANALYSTS: readonly AnalystId[] = [
  'damodaran-valuation',  // DCF valuation, intrinsic value in $
  'seth-klarman',         // Conservative downside estimate in $
  'greenwald-evasion',    // EPV/asset-based value in $
] as const;

/**
 * Check if an analyst provides fair_value estimates
 */
export function isFairValueAnalyst(id: AnalystId): boolean {
  return FAIR_VALUE_ANALYSTS.includes(id);
}

/**
 * Filter array of analysts to only include fair_value analysts
 */
export function getFairValueAnalysts<T extends { id: AnalystId }>(all: T[]): T[] {
  return all.filter(analyst => isFairValueAnalyst(analyst.id));
}
