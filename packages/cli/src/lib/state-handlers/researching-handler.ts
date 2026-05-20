/**
 * RESEARCHING State Handler
 *
 * Runs researcher agents to gather evidence
 */

import { Mission, MissionState } from '@one4all/kernel';
import type { EvidencePackMetadata } from '@one4all/kernel';
import { createCLIAdapter, type CLIAdapterType } from '@one4all/adapters';
import { fetchStockPrice, fetchMultipleStockPrices, type StockPriceData, getIncomeStatement, getKeyMetrics, type FmpIncomeData, type FmpMetricsData } from '../stock-price.js';
import { getAdapterForAgent } from '../agent-adapter-mapping.js';
import { createUnifiedAdapter } from '../adapter-factory.js';
import { getDomainFromBrief } from '../registry-connector.js';

export interface SourceTier {
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
  tier5: number;
}

export interface ResearchEvidenceData {
  evidence_score: number;
  sources_found: number;
  tier1_sources: number;
  tier2_sources: number;
  tier3_sources: number;
  tier4_sources: number;
  tier5_sources: number;
  required_documents?: number;
  critical_gaps?: number;
  data_gaps: string[];
  // Market data from research
  current_price?: number;
  market_cap?: string;
  week_52_high?: number;
  week_52_low?: number;
  as_of_date?: string;
  financial_data?: {
    revenue?: number;
    net_income?: number;
    eps?: number;
    pe_ratio?: number;
  };
  business_context?: {
    business_model?: string;
    segments?: string[];
  };
}

/**
 * Handle RESEARCHING state
 * Returns ANALYZING if evidence score >= 40
 * Returns HUMAN_REVIEW_GATE_1 if evidence score < 40
 */
export async function handleResearchingState(
  mission: Mission,
  cliAdapter: CLIAdapterType
): Promise<MissionState> {
  const brief = mission.state.brief;
  const ticker = brief?.ticker || 'UNKNOWN';

  console.log(`  [RESEARCHING] Gathering evidence for ${ticker}...`);

  // Fetch real-time stock price from Yahoo Finance FIRST
  let stockPriceData: StockPriceData | null = null;
  try {
    stockPriceData = await fetchStockPrice(ticker);
    if (stockPriceData && stockPriceData.current_price > 0) {
      console.log(`  [RESEARCHING] Current price: $${stockPriceData.current_price} (Yahoo Finance)`);
    }
  } catch (e) {
    console.log(`  [RESEARCHING] Could not fetch live price, will use LLM estimate`);
  }

  // Fetch financial statements from FMP (US stocks only)
  let fmpIncomeData: FmpIncomeData | null = null;
  let fmpMetricsData: FmpMetricsData | null = null;
  try {
    const [incomeResult, metricsResult] = await Promise.allSettled([
      getIncomeStatement(ticker),
      getKeyMetrics(ticker),
    ]);
    if (incomeResult.status === 'fulfilled') fmpIncomeData = incomeResult.value;
    if (metricsResult.status === 'fulfilled') fmpMetricsData = metricsResult.value;

    if (fmpIncomeData || fmpMetricsData) {
      console.log(`  [RESEARCHING] FMP data loaded: income=${fmpIncomeData ? 'yes' : 'no'}, metrics=${fmpMetricsData ? 'yes' : 'no'}`);
    }
  } catch (e) {
    console.log(`  [RESEARCHING] FMP data unavailable, will use LLM knowledge`);
  }

  // Create researcher prompt with live price data
  const researcherPrompt = buildResearcherPrompt(brief, stockPriceData, fmpIncomeData, fmpMetricsData);

  // Get adapter for researcher agent (uses per-agent mapping)
  const researcherAdapterType = getAdapterForAgent('researcher-set');
  const adapter = createUnifiedAdapter(researcherAdapterType);

  console.log(`  [RESEARCHING] Using ${researcherAdapterType} for research...`);

  const result = await adapter.run(researcherPrompt, {
    timeout: 180000, // 3 minutes
  });

  if (!result.success) {
    console.log(`  [RESEARCHING] Error: ${result.error}`);
    // If research fails, proceed to human gate
    mission.state.evidence_pack = {
      sources_found: 0,
      tier1_sources: 0,
      tier2_sources: 0,
      tier3_sources: 0,
      evidence_score: 0,
      data_gaps: [`Research failed: ${result.error}`],
    };
    return MissionState.HUMAN_REVIEW_GATE_1;
  }

  // Parse evidence pack from LLM response
  const evidenceData = parseEvidenceData(result.content, ticker, stockPriceData);

  // Create proper EvidencePackMetadata
  const evidencePack: EvidencePackMetadata = {
    sources_found: evidenceData.sources_found,
    tier1_sources: evidenceData.tier1_sources,
    tier2_sources: evidenceData.tier2_sources,
    tier3_sources: evidenceData.tier3_sources,
    evidence_score: evidenceData.evidence_score,
    data_gaps: evidenceData.data_gaps,
  };

  console.log(`  [RESEARCHING] Evidence score: ${evidencePack.evidence_score}/100`);
  console.log(`  [RESEARCHING] Sources found: ${evidencePack.sources_found}`);
  console.log(`  [RESEARCHING] Tier breakdown: T1=${evidenceData.tier1_sources}, T2=${evidenceData.tier2_sources}, T3=${evidenceData.tier3_sources}`);

  // Store in mission state
  mission.state.evidence_pack = evidencePack;
  // Store additional data in synthesis_output for now
  mission.state.synthesis_output = evidenceData;

  // Check evidence score threshold
  if (evidencePack.evidence_score < 40) {
    console.log(`  [RESEARCHING] Evidence score below threshold - human review required`);
    return MissionState.HUMAN_REVIEW_GATE_1;
  }

  return MissionState.ANALYZING;
}

/**
 * Build researcher prompt
 */
function buildResearcherPrompt(brief: any, stockPriceData: StockPriceData | null, fmpIncome: FmpIncomeData | null = null, fmpMetrics: FmpMetricsData | null = null): string {
  const ticker = brief?.ticker || 'the company';
  const domain = getDomainFromBrief(brief);

  // If we have real-time price data, include it in the prompt
  let marketDataContext = '';
  let priceNote = '';
  if (stockPriceData && stockPriceData.current_price > 0) {
    marketDataContext = `

**IMPORTANT - Use this ACCURATE real-time market data (from Yahoo Finance):**
- Current Price: $${stockPriceData.current_price}
- 52-Week High: $${stockPriceData.week_52_high || 'N/A'}
- 52-Week Low: $${stockPriceData.week_52_low || 'N/A'}
- Market Cap: ${stockPriceData.market_cap || 'N/A'}
- Currency: ${stockPriceData.currency || 'USD'}
- As of: ${stockPriceData.as_of_date}

Do NOT estimate or guess different prices. Use these values as the source of truth.
`;
    priceNote = 'NOTE: Market data above is from Yahoo Finance - use it exactly as provided.';
  } else {
    priceNote = `IMPORTANT: Use your knowledge to find the CURRENT stock price and market data for ${ticker}. Do not use outdated prices.`;
  }

  let fmpDataContext = '';
  if (fmpIncome || fmpMetrics) {
    fmpDataContext = `\n**IMPORTANT - Use this VERIFIED financial data (from Financial Modeling Prep API):**\n`;
    if (fmpIncome && fmpIncome.periods.length > 0) {
      fmpDataContext += `\n**Income Statement (last ${fmpIncome.periods.length} years):**\n`;
      for (const p of fmpIncome.periods) {
        fmpDataContext += `- ${p.date}: Revenue=$${(p.revenue / 1e9).toFixed(1)}B, Net Income=$${(p.net_income / 1e9).toFixed(1)}B, EPS=$${p.eps.toFixed(2)}, Gross Margin=${(p.gross_margin * 100).toFixed(1)}%, Operating Margin=${(p.operating_margin * 100).toFixed(1)}%\n`;
      }
      fmpDataContext += `\nDo NOT estimate or guess different financial figures. Use these values as the source of truth.\n`;
    }
    if (fmpMetrics) {
      fmpDataContext += `\n**Key Metrics:** P/E=${fmpMetrics.pe_ratio?.toFixed(1) ?? 'N/A'}, ROE=${(fmpMetrics.roe * 100).toFixed(1)}%, ROA=${(fmpMetrics.roa * 100).toFixed(1)}%, Debt/Equity=${fmpMetrics.debt_to_equity?.toFixed(2) ?? 'N/A'}, Current Ratio=${fmpMetrics.current_ratio?.toFixed(2) ?? 'N/A'}\n`;
    }
  }

  return `You are a research analyst for the ${domain} domain.

Research ${ticker} and provide:${marketDataContext}${fmpDataContext}

1. **Financial Data**: Revenue, net income, EPS (most recent quarter available)
2. **Business Model**: Brief description of how the company makes money
3. **Key Risks**: 3-5 major risk factors
4. **Recent News**: Any significant recent developments

${priceNote}

Format your response as JSON:
{
  "current_price": number (today's stock price),
  "market_cap": string (e.g., "2.5T"),
  "week_52_high": number,
  "week_52_low": number,
  "financial_data": {
    "revenue": number,
    "net_income": number,
    "eps": number,
    "pe_ratio": number
  },
  "business_model": string,
  "segments": array of strings,
  "key_risks": array of strings,
  "recent_news": string,
  "sources": array of strings,
  "as_of_date": string (date of this data)
}

Be concise and factual. Use "UNKNOWN" for any missing data.`;
}

/**
 * Parse evidence data from LLM response
 */
function parseEvidenceData(content: string, ticker: string, stockPriceData: StockPriceData | null): ResearchEvidenceData {
  try {
    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);

      // Use real-time price data if available, otherwise use LLM response
      const currentPrice = stockPriceData?.current_price || data.current_price;
      const week52High = stockPriceData?.week_52_high || data.week_52_high;
      const week52Low = stockPriceData?.week_52_low || data.week_52_low;
      const marketCap = stockPriceData?.market_cap || data.market_cap;

      // Extract tier counts from LLM response
      const sourceTier: SourceTier = {
        tier1: data.source_tier?.tier1 || data.tier1_sources || 0,
        tier2: data.source_tier?.tier2 || data.tier2_sources || 0,
        tier3: data.source_tier?.tier3 || data.tier3_sources || 0,
        tier4: data.source_tier?.tier4 || data.tier4_sources || 0,
        tier5: data.source_tier?.tier5 || data.tier5_sources || 0,
      };

      // If no tier data provided, estimate from sources array
      if (sourceTier.tier1 === 0 && sourceTier.tier2 === 0 && sourceTier.tier3 === 0) {
        const totalSources = data.sources?.length || 1;
        // Conservative estimate: assume 1 tier 1 source, rest tier 2-3
        sourceTier.tier1 = Math.min(1, totalSources);
        sourceTier.tier2 = Math.min(2, totalSources - sourceTier.tier1);
        sourceTier.tier3 = Math.max(0, totalSources - sourceTier.tier1 - sourceTier.tier2);
      }

      // Count critical gaps (data gaps that are critical)
      const criticalGaps = identifyCriticalGaps(data);

      return {
        evidence_score: calculateEvidenceScore({
          ...data,
          source_tier: sourceTier,
          critical_gaps: criticalGaps,
          required_documents: data.required_documents || (data.financial_data?.revenue ? 1 : 0),
        }),
        sources_found: data.sources?.length || 1,
        tier1_sources: sourceTier.tier1,
        tier2_sources: sourceTier.tier2,
        tier3_sources: sourceTier.tier3,
        tier4_sources: sourceTier.tier4,
        tier5_sources: sourceTier.tier5,
        required_documents: data.required_documents || (data.financial_data?.revenue ? 1 : 0),
        critical_gaps: criticalGaps,
        data_gaps: identifyDataGaps(data),
        // Market data - prefer real-time Yahoo Finance data
        current_price: currentPrice,
        market_cap: marketCap,
        week_52_high: week52High,
        week_52_low: week52Low,
        as_of_date: stockPriceData?.as_of_date || data.as_of_date,
        financial_data: data.financial_data,
        business_context: {
          business_model: data.business_model,
          segments: data.segments,
        },
      };
    }
  } catch (error) {
    console.log(`  [RESEARCHING] Failed to parse JSON response`);
  }

  // Default evidence pack if parsing fails - use real-time data if available
  return {
    evidence_score: 30, // Low score for unparsed response
    sources_found: 1,
    tier1_sources: 0,
    tier2_sources: 0,
    tier3_sources: 0,
    tier4_sources: 0,
    tier5_sources: 0,
    required_documents: 0,
    critical_gaps: 1,
    data_gaps: ['Could not parse structured data from LLM response'],
    // Still include real-time price data
    current_price: stockPriceData?.current_price,
    market_cap: stockPriceData?.market_cap,
    week_52_high: stockPriceData?.week_52_high,
    week_52_low: stockPriceData?.week_52_low,
    as_of_date: stockPriceData?.as_of_date,
    business_context: {
      business_model: content.substring(0, 500),
    },
  };
}

/**
 * Calculate evidence score (0-100) using tier-based algorithm
 * Tier 1: +25 per source (max 50)
 * Tier 2: +10 per source (max 20)
 * Tier 3: +5 per source (max 10)
 * Bonus: +10 for required documents, +10 for no critical gaps
 * Penalty: -15 per critical gap, -10 for no Tier 1-3, -20 for only Tier 5
 */
function calculateEvidenceScore(data: any): number {
  let score = 0;

  // Extract tier counts with backward compatibility defaults
  const tier1: number = data.tier1_sources || data.source_tier?.tier1 || 0;
  const tier2: number = data.tier2_sources || data.source_tier?.tier2 || 0;
  const tier3: number = data.tier3_sources || data.source_tier?.tier3 || 0;
  const tier4: number = data.tier4_sources || data.source_tier?.tier4 || 0;
  const tier5: number = data.tier5_sources || data.source_tier?.tier5 || 0;

  // Backward compatibility: if no tier data at all, use old algorithm
  if (tier1 === 0 && tier2 === 0 && tier3 === 0 && tier4 === 0 && tier5 === 0) {
    return calculateLegacyEvidenceScore(data);
  }

  // Tier 1: +25 per source (max 50)
  score += Math.min(tier1 * 25, 50);

  // Tier 2: +10 per source (max 20)
  score += Math.min(tier2 * 10, 20);

  // Tier 3: +5 per source (max 10)
  score += Math.min(tier3 * 5, 10);

  // Bonus: +10 for required documents
  const requiredDocs: number = data.required_documents || 0;
  if (requiredDocs > 0) {
    score += 10;
  }

  // Bonus: +10 for no critical gaps
  const criticalGaps: number = data.critical_gaps || 0;
  if (criticalGaps === 0) {
    score += 10;
  } else {
    // Penalty: -15 per critical gap
    score -= (criticalGaps * 15);
  }

  // Penalty: -10 for no Tier 1-3 sources
  if (tier1 === 0 && tier2 === 0 && tier3 === 0) {
    score -= 10;
  }

  // Penalty: -20 for only Tier 5 sources
  if (tier5 > 0 && tier1 === 0 && tier2 === 0 && tier3 === 0 && tier4 === 0) {
    score -= 20;
  }

  return Math.max(0, Math.min(score, 100));
}

/**
 * Legacy evidence score calculation for backward compatibility
 */
function calculateLegacyEvidenceScore(data: any): number {
  let score = 20; // Base score

  if (data.financial_data?.revenue) score += 20;
  if (data.financial_data?.net_income) score += 15;
  if (data.financial_data?.eps) score += 10;
  if (data.business_model) score += 15;
  if (data.key_risks?.length >= 3) score += 10;
  if (data.sources?.length >= 2) score += 10;

  return Math.min(score, 100);
}

/**
 * Identify data gaps
 */
function identifyDataGaps(data: any): string[] {
  const gaps: string[] = [];

  if (!data.financial_data?.revenue) gaps.push('Revenue data missing');
  if (!data.financial_data?.net_income) gaps.push('Net income data missing');
  if (!data.financial_data?.eps) gaps.push('EPS data missing');
  if (!data.business_model) gaps.push('Business model information missing');
  if (!data.key_risks || data.key_risks.length < 3) gaps.push('Risk analysis incomplete');

  return gaps;
}

/**
 * Identify critical gaps (gaps that significantly impact analysis quality)
 */
function identifyCriticalGaps(data: any): number {
  let criticalGaps = 0;

  if (!data.financial_data?.revenue) criticalGaps++;
  if (!data.financial_data?.net_income) criticalGaps++;
  if (!data.business_model) criticalGaps++;

  return criticalGaps;
}
