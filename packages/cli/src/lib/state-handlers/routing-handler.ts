/**
 * ROUTING State Handler
 *
 * CIO Router Core - Routes questions to appropriate analysts
 * based on confidence scoring and domain expertise
 */

import { Mission, MissionState } from '@one4all/kernel';
import { createUnifiedAdapter } from '../adapter-factory.js';
import { getPersonaResolver, getDomainFromBrief } from '../registry-connector.js';

export interface RoutingPlan {
  confidence: number; // 0-100
  selected_analysts: string[];
  reasoning: string;
  fallback_to_devil_advocate: boolean;
}

/**
 * Handle ROUTING state
 * Routes to EXECUTING_INQUIRY when plan is ready
 */
export async function handleRoutingState(
  mission: Mission
): Promise<MissionState> {
  const brief = mission.state.brief;
  const question = brief?.question || brief?.description || '';
  const domain = getDomainFromBrief(brief);

  console.log(`  [ROUTING] Analyzing question for routing...`);

  // Build router prompt
  const prompt = await buildRouterPrompt(question, brief?.ticker, domain);

  // Run routing analysis
  const adapter = createUnifiedAdapter('claude-cli');
  const result = await adapter.run(prompt, { timeout: 30000 });

  if (!result.success) {
    console.log(`  [ROUTING] Routing analysis failed, using defaults`);
    // Default to devil-advocate on failure
    const defaultPlan: RoutingPlan = {
      confidence: 50,
      selected_analysts: ['devil-advocate'],
      reasoning: 'Routing analysis failed, using default devil-advocate',
      fallback_to_devil_advocate: true,
    };
    mission.state.brief = {
      ...mission.state.brief!,
      owner_assumptions: {
        ...mission.state.brief?.owner_assumptions,
        routing_plan: defaultPlan,
      },
    };
    return MissionState.EXECUTING_INQUIRY;
  }

  // Parse routing plan
  const plan = parseRoutingPlan(result.content);

  console.log(`  [ROUTING] Confidence: ${plan.confidence}%, Analysts: ${plan.selected_analysts.join(', ')}`);

  // Store routing plan in brief assumptions
  mission.state.brief = {
    ...mission.state.brief!,
    owner_assumptions: {
      ...mission.state.brief?.owner_assumptions,
      routing_plan: plan,
    },
  };

  // Check if fallback to devil-advocate is needed
  if (plan.fallback_to_devil_advocate || plan.confidence < 60) {
    console.log(`  [ROUTING] Low confidence, including devil-advocate`);
    if (!plan.selected_analysts.includes('devil-advocate')) {
      plan.selected_analysts.push('devil-advocate');
    }
  }

  return MissionState.EXECUTING_INQUIRY;
}

/**
 * Build router prompt with Thai/English support
 */
async function buildRouterPrompt(question: string, ticker?: string, domain?: string): Promise<string> {
  const tickerContext = ticker ? ` about ${ticker}` : '';

  // Get available analysts from registry
  const resolver = getPersonaResolver();
  const knownAnalysts = domain ? await resolver.getKnownAnalysts(domain) : [];

  // Build analyst descriptions for the prompt
  const analystDescriptions = knownAnalysts.map(id => `- **${id}**: Analyst`).join('\n');

  return `You are the CIO Router analyzing an investor's question${tickerContext}.

## The Question:
${question}

## Your Task:
Analyze this question and determine which analyst personas should respond. Consider:

1. **Question Type**: Is this about valuation, risk, strategy, or general concerns?
2. **Domain Expertise**: Which analysts are most relevant?
3. **Confidence Level**: How confident are you in this routing? (0-100)

## Available Analysts:
${analystDescriptions || '- **devil-advocate**: Default analyst'}

Provide your routing decision in this JSON format:
{
  "confidence": number (0-100),
  "selected_analysts": ["analyst-id-1", "analyst-id-2", ...],
  "reasoning": "Brief explanation of why these analysts were selected",
  "fallback_to_devil_advocate": boolean (true if confidence < 60)
}

**Language Support**: The question may be in Thai or English. Route based on meaning, not language.

Select 2-5 analysts most relevant to this question. Default to devil-advocate for uncertainty.`;
}

/**
 * Parse routing plan from LLM output
 */
function parseRoutingPlan(content: string): RoutingPlan {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);

      // Accept selected analysts from routing response
      // Registry-based validation happens at runtime
      const validAnalysts = (data.selected_analysts || []);

      return {
        confidence: Math.min(100, Math.max(0, data.confidence || 50)),
        selected_analysts: validAnalysts.length > 0 ? validAnalysts : ['devil-advocate'],
        reasoning: data.reasoning || 'No reasoning provided',
        fallback_to_devil_advocate: data.fallback_to_devil_advocate || false,
      };
    }
  } catch (error) {
    console.log(`  [ROUTING] Failed to parse routing plan: ${error}`);
  }

  // Default fallback
  return {
    confidence: 50,
    selected_analysts: ['devil-advocate'],
    reasoning: 'Parsing failed, using default',
    fallback_to_devil_advocate: true,
  };
}
