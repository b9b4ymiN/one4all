/**
 * Debate Executor
 *
 * Executes debate sessions by connecting analysts to LLMs.
 * This is the component that actually invokes LLM calls - DebateController
 * only tracks session state, it does not call LLMs.
 */

import type { DebateSession, DebateContribution } from './types.js';
import { DebatePhase } from './types.js';
import { DebateController } from './debate-controller.js';
import { PersonaResolver } from '../registry/persona-resolver.js';
import type { AgentConfig } from '../registry/types.js';
import { readFileSync } from 'node:fs';

/**
 * LLM Adapter interface for dependency injection
 * This allows mocking in tests without API keys
 */
export interface LLMAdapter {
  chat(params: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  }): Promise<string>;
}

/**
 * Result of a single debate round
 */
export interface RoundResult {
  round: number;
  contributions: DebateContribution[];
  converged: boolean;
  errors: Array<{ analystId: string; error: string }>;
}

/**
 * Result of a full debate execution
 */
export interface DebateExecutionResult {
  debateId: string;
  totalRounds: number;
  converged: boolean;
  finalPhase: DebatePhase;
  totalContributions: number;
  errors: Array<{ round: number; analystId: string; error: string }>;
}

/**
 * Debate Executor - connects debate sessions to LLM calls
 */
export class DebateExecutor {
  constructor(
    private readonly llmAdapter: LLMAdapter,
    private readonly personaResolver: PersonaResolver,
    private readonly debateController: DebateController
  ) {}

  /**
   * Execute a single round of debate
   *
   * For each analyst:
   * 1. Load their persona from disk
   * 2. Construct a debate prompt including the topic and previous contributions
   * 3. Invoke the LLM with the persona + prompt
   * 4. Submit the contribution back to the session
   *
   * @param session - The debate session
   * @param analystIds - IDs of analysts to execute this round
   * @param domain - The domain ID for loading personas
   * @returns Round result with contributions, convergence status, and any errors
   */
  async executeRound(
    session: DebateSession,
    analystIds: string[],
    domain: string
  ): Promise<RoundResult> {
    const contributions: DebateContribution[] = [];
    const errors: Array<{ analystId: string; error: string }> = [];

    // Get previous contributions for context
    const previousContributions = session.contributions.filter(
      c => c.phase === session.current_phase ||
           c.phase === DebatePhase.OPENING_STATEMENTS
    );

    for (const analystId of analystIds) {
      try {
        // Load agent config and persona
        const agent = await this.personaResolver.getAgent(analystId);
        if (!agent) {
          throw new Error(`Agent '${analystId}' not found in registry`);
        }

        const personaPath = await this.personaResolver.resolvePersonaPath(analystId, domain);
        const persona = readFileSync(personaPath, 'utf-8');

        // Get analyst's current position
        const currentPosition = session.positions.get(analystId);

        // Construct debate prompt
        const prompt = this.constructDebatePrompt({
          persona,
          analystId,
          currentPosition,
          topic: session.config.mission_id,
          phase: session.current_phase,
          previousContributions: previousContributions.filter(c => c.analyst_id !== analystId),
          roundNumber: session.current_round,
        });

        // Get performance config from agent
        const timeout = agent.performance.timeout_seconds * 1000;
        const maxTokens = agent.performance.max_tokens;

        // Invoke LLM with timeout
        const response = await Promise.race([
          this.llmAdapter.chat({
            prompt,
            maxTokens,
            temperature: 0.7,
          }),
          this.createTimeout(timeout),
        ]);

        // Extract conviction score from response (simplified - in production, use structured output)
        const convictionScore = this.extractConvictionScore(response, currentPosition?.conviction_score);

        // Submit contribution to session
        const result = await this.debateController.submitContribution(
          session.id,
          analystId,
          response,
          convictionScore,
          previousContributions.map(c => c.analyst_id)
        );

        if (result.approved && result.contribution) {
          contributions.push(result.contribution);
        } else {
          errors.push({
            analystId,
            error: `Contribution rejected: ${result.violations.join('; ')}`,
          });
        }
      } catch (error) {
        errors.push({
          analystId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Check for convergence
    const converged = this.debateController.checkConvergence(session);

    return {
      round: session.current_round,
      contributions,
      converged,
      errors,
    };
  }

  /**
   * Run a complete debate session
   *
   * Executes rounds until:
   * - Convergence is detected, OR
   * - Maximum rounds are reached, OR
   * - A fatal error occurs
   *
   * @param session - The debate session
   * @param analystIds - IDs of participating analysts
   * @param domain - The domain ID
   * @param maxRounds - Optional override for max rounds (defaults to session config)
   * @returns Debate execution result
   */
  async runDebate(
    session: DebateSession,
    analystIds: string[],
    domain: string,
    maxRounds?: number
  ): Promise<DebateExecutionResult> {
    const actualMaxRounds = maxRounds ?? session.config.max_rounds;
    const allErrors: Array<{ round: number; analystId: string; error: string }> = [];

    let currentPhase = session.current_phase;

    // Execute opening statements first
    if (currentPhase === DebatePhase.INITIALIZATION) {
      this.debateController.transitionPhase(session.id, DebatePhase.OPENING_STATEMENTS, 'Starting debate');
      currentPhase = DebatePhase.OPENING_STATEMENTS;
    }

    // Main debate loop
    while (session.current_round < actualMaxRounds && !session.converged) {
      // Execute round
      const roundResult = await this.executeRound(session, analystIds, domain);

      // Collect errors
      for (const error of roundResult.errors) {
        allErrors.push({
          round: roundResult.round,
          analystId: error.analystId,
          error: error.error,
        });
      }

      // Check convergence
      if (roundResult.converged) {
        this.debateController.transitionPhase(session.id, DebatePhase.CONVERGENCE, 'Debate converged');
        break;
      }

      // Transition to next phase
      const nextPhase = this.determineNextPhase(currentPhase);
      const transitionResult = this.debateController.transitionPhase(
        session.id,
        nextPhase,
        `Round ${session.current_round} complete`
      );

      if (!transitionResult.allowed) {
        // Transition blocked - end debate
        break;
      }

      currentPhase = nextPhase;
    }

    // Complete the debate if still running
    if (!session.completed_at) {
      this.debateController.completeDebate(session.id);
    }

    return {
      debateId: session.id,
      totalRounds: session.current_round + 1,
      converged: session.converged,
      finalPhase: session.current_phase,
      totalContributions: session.contributions.length,
      errors: allErrors,
    };
  }

  /**
   * Construct a debate prompt for an analyst
   */
  private constructDebatePrompt(params: {
    persona: string;
    analystId: string;
    currentPosition?: any;
    topic: string;
    phase: DebatePhase;
    previousContributions: DebateContribution[];
    roundNumber: number;
  }): string {
    const {
      persona,
      analystId,
      currentPosition,
      topic,
      phase,
      previousContributions,
      roundNumber,
    } = params;

    let prompt = `# Debate Instructions

You are ${analystId}, participating in a structured debate on: ${topic}

## Your Persona
${persona}

`;

    // Add current position if available
    if (currentPosition) {
      prompt += `## Your Current Position
- Stance: ${currentPosition.stance}
- Conviction: ${currentPosition.conviction_score}/100
- Thesis: ${currentPosition.thesis_summary}

`;
    }

    // Add phase-specific instructions
    prompt += `## Current Phase: ${phase}
`;
    switch (phase) {
      case DebatePhase.OPENING_STATEMENTS:
        prompt += `Present your initial thesis and stance on this topic. Be clear about your position and key arguments.
`;
        break;
      case DebatePhase.REBUTTAL:
        prompt += `Respond to the arguments presented by other analysts. Challenge their positions and defend your own.
`;
        break;
      case DebatePhase.CROSS_EXAMINATION:
        prompt += `Ask probing questions to other analysts. Challenge their assumptions and evidence.
`;
        break;
      case DebatePhase.CLOSING_ARGUMENTS:
        prompt += `Summarize your final position. Acknowledge valid points from others and explain what would change your mind.
`;
        break;
    }

    // Add context from previous contributions
    if (previousContributions.length > 0) {
      prompt += `## Previous Arguments from Other Analysts
`;
      for (const contrib of previousContributions) {
        prompt += `
### ${contrib.analyst_id} (Conviction: ${contrib.conviction_score}/100)
${contrib.content}
`;
      }
      prompt += `
`;
    }

    prompt += `## Instructions
1. Stay in character as defined in your persona
2. Reference specific arguments from other analysts when responding
3. Provide evidence-based reasoning
4. End with your conviction score (0-100) on this topic
5. Be direct and specific - avoid vague generalities

## Your Response:
`;

    return prompt;
  }

  /**
   * Extract conviction score from LLM response
   * This is a simplified implementation - production should use structured output
   */
  private extractConvictionScore(response: string, previousScore?: number): number {
    // Try to find explicit conviction score in response
    const convictionRegex = /conviction[:\s]*(\d+)/i;
    const match = response.match(convictionRegex);

    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 0 && score <= 100) {
        return score;
      }
    }

    // Fallback: analyze tone (simplified)
    const bullishWords = ['strong', 'excellent', 'compelling', 'convinced', 'certain'];
    const bearishWords = ['weak', 'poor', 'unconvincing', 'doubtful', 'uncertain'];

    let bullishCount = 0;
    let bearishCount = 0;

    const lowerResponse = response.toLowerCase();
    for (const word of bullishWords) {
      if (lowerResponse.includes(word)) bullishCount++;
    }
    for (const word of bearishWords) {
      if (lowerResponse.includes(word)) bearishCount++;
    }

    if (bullishCount > bearishCount) {
      return Math.min(80, (previousScore ?? 50) + 10);
    } else if (bearishCount > bullishCount) {
      return Math.max(20, (previousScore ?? 50) - 10);
    }

    return previousScore ?? 50;
  }

  /**
   * Determine next phase in debate sequence
   */
  private determineNextPhase(currentPhase: DebatePhase): DebatePhase {
    const phaseSequence: DebatePhase[] = [
      DebatePhase.OPENING_STATEMENTS,
      DebatePhase.REBUTTAL,
      DebatePhase.CROSS_EXAMINATION,
      DebatePhase.CLOSING_ARGUMENTS,
    ];

    const currentIndex = phaseSequence.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex === phaseSequence.length - 1) {
      return DebatePhase.CLOSING_ARGUMENTS;
    }

    return phaseSequence[currentIndex + 1];
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`LLM request timed out after ${ms}ms`)), ms);
    });
  }
}

/**
 * Create a debate executor instance
 */
export function createDebateExecutor(
  llmAdapter: LLMAdapter,
  personaResolver: PersonaResolver,
  debateController?: DebateController
): DebateExecutor {
  const controller = debateController ?? new DebateController();
  return new DebateExecutor(llmAdapter, personaResolver, controller);
}
