/**
 * PLANNING State Handler
 *
 * Analyzes brief and builds team
 */

import { Mission, MissionState } from '@one4all/kernel';
import type { MissionConfig } from '@one4all/kernel';
import { getPersonaResolver, getDomainFromBrief } from '../registry-connector.js';

/**
 * Handle PLANNING state
 * Returns next state: RESEARCHING
 */
export async function handlePlanningState(
  mission: Mission,
  domainConfig: any
): Promise<MissionState> {
  const brief = mission.state.brief;
  if (!brief) {
    throw new Error('Cannot plan mission: missing brief');
  }

  // Determine required agents based on mission type
  const team = selectAgentsForMission(brief.type);

  // Define evidence requirements
  const evidenceRequirements = domainConfig.evidence_requirements || {
    minimum_sources: [{ tier: 'tier_1', count: 1 }],
    required_documents: [],
  };

  // Create execution plan
  const executionPlan = {
    stages: ['RESEARCHING', 'ANALYZING', 'SYNTHESIZING', 'DECIDED', 'JOURNALED'],
    estimatedDuration: 600, // 10 minutes
  };

  // Store planning output in mission config
  const config: MissionConfig = {
    mission_id: mission.id,
    domain: brief.domain,
    mission_type: brief.type,
    ticker: brief.ticker,
    brief,
    required_agents: team,
    evidence_requirements: evidenceRequirements,
    human_checkpoints: [
      { after: MissionState.RESEARCHING, condition: 'conditional' },
      { after: MissionState.SYNTHESIZING, condition: 'always' },
    ],
    created_at: mission.created_at,
  };

  mission.state.config = config;

  console.log(`  [PLANNING] Team: ${team.join(', ')}`);
  console.log(`  [PLANNING] Evidence requirements: tier_1 x${evidenceRequirements.minimum_sources[0]?.count || 1}`);

  return MissionState.RESEARCHING;
}

/**
 * Select agents based on mission type
 */
function selectAgentsForMission(missionType: string): string[] {
  const baseTeam = ['researcher-set'];

  switch (missionType) {
    case 'stock_analysis':
      return [
        ...baseTeam,
        'forensic-accountant',
        'damodaran-valuation',
        'seth-klarman',
        'portfolio-allocator',
        'cio-synthesizer',
      ];

    case 'portfolio_review':
      return [
        ...baseTeam,
        'portfolio-allocator',
        'cio-synthesizer',
      ];

    case 'quick_screen':
      return [
        ...baseTeam,
        'damodaran-valuation',
        'cio-synthesizer',
      ];

    default:
      return baseTeam;
  }
}
