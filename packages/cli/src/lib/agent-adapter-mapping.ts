/**
 * Agent-to-Adapter Mapping
 *
 * Maps each agent to its preferred LLM backend.
 * Distributes load across CLI tools and ZAI API.
 */

export type AdapterType = 'gemini-cli' | 'claude-cli' | 'zai-api';

export interface AgentAdapterMapping {
  agent_id: AdapterType;
  fallback?: AdapterType;
}

/**
 * Agent to adapter mapping configuration
 *
 * Distribution strategy:
 * - damodaran-valuation → claude-cli (high quality reasoning for DCF)
 * - klarman-downside → zai-api (fast risk analysis via API)
 * - portfolio-allocator → gemini-cli (portfolio decisions)
 * - cio-synthesizer → claude-cli (final synthesis needs quality)
 * - researcher-set → gemini-cli (research speed)
 * - forensic-accountant → zai-api (number crunching via API)
 */
export const AGENT_ADAPTER_MAP: Record<string, AgentAdapterMapping> = {
  // Analysts
  'damodaran-valuation': { agent_id: 'claude-cli', fallback: 'gemini-cli' },
  'klarman-downside': { agent_id: 'zai-api', fallback: 'gemini-cli' },
  'portfolio-allocator': { agent_id: 'gemini-cli', fallback: 'claude-cli' },

  // Research team
  'researcher-set': { agent_id: 'gemini-cli', fallback: 'claude-cli' },
  'forensic-accountant': { agent_id: 'zai-api', fallback: 'gemini-cli' },

  // Synthesis
  'cio-synthesizer': { agent_id: 'claude-cli', fallback: 'zai-api' },

  // Other analysts (balanced distribution)
  'consensus-analyst': { agent_id: 'gemini-cli', fallback: 'claude-cli' },
  'devil-advocate': { agent_id: 'zai-api', fallback: 'claude-cli' },
  'allocator-steward': { agent_id: 'gemini-cli', fallback: 'zai-api' },
  'downside-protection': { agent_id: 'zai-api', fallback: 'gemini-cli' },
  'greenwald-evasion': { agent_id: 'claude-cli', fallback: 'zai-api' },
  'kessler-moat': { agent_id: 'gemini-cli', fallback: 'claude-cli' },
  'klamran-quality': { agent_id: 'zai-api', fallback: 'claude-cli' },
  'leveraged-franchise': { agent_id: 'gemini-cli', fallback: 'zai-api' },
  'michael-burry': { agent_id: 'claude-cli', fallback: 'zai-api' },
  'portfolio-manager': { agent_id: 'gemini-cli', fallback: 'claude-cli' },
  'seth-klarman': { agent_id: 'zai-api', fallback: 'claude-cli' },
};

/**
 * Get adapter type for an agent
 */
export function getAdapterForAgent(agentId: string): AdapterType {
  const mapping = AGENT_ADAPTER_MAP[agentId];
  return mapping?.agent_id || 'gemini-cli'; // Default to gemini-cli
}

/**
 * Get fallback adapter for an agent
 */
export function getFallbackAdapterForAgent(agentId: string): AdapterType | undefined {
  const mapping = AGENT_ADAPTER_MAP[agentId];
  return mapping?.fallback;
}
