/**
 * CROSS_QA State Handler
 *
 * Orchestrates cross-questioning between analyst agents
 * Analysts review and question each other's outputs
 */

import { Mission, MissionState } from '@one4all/kernel';
import { createUnifiedAdapter } from '../adapter-factory.js';
import { getAdapterForAgent } from '../agent-adapter-mapping.js';
import { readFile } from 'fs/promises';
import { getPersonaResolver } from '../registry-connector.js';

interface Question {
  from_analyst: string;
  to_analyst: string;
  question: string;
  evidence_required: boolean;
}

interface CrossQAResult {
  questions_asked: number;
  questions_answered: number;
  unresolved_questions: string[];
}

/**
 * Handle CROSS_QA state
 * Runs cross-questioning between analysts
 */
export async function handleCrossQAState(
  mission: Mission
): Promise<MissionState> {
  const ticker = mission.state.brief?.ticker || 'UNKNOWN';
  const analystOutputs = (mission.state.analyst_outputs as unknown as any[]) || [];

  console.log(`  [CROSS_QA] Starting cross-agent QA for ${ticker}`);

  if (analystOutputs.length < 2) {
    console.log(`  [CROSS_QA] Skipping QA - need at least 2 analysts (have ${analystOutputs.length})`);
    return MissionState.DEBATING;
  }

  // Run cross-questioning
  const qaResult = await runCrossQuestioning(mission);

  // Store results in mission state
  (mission.state as any).cross_qa_results = qaResult;

  console.log(`  [CROSS_QA] Completed: ${qaResult.questions_answered}/${qaResult.questions_asked} questions answered`);

  if (qaResult.unresolved_questions.length > 0) {
    console.log(`  [CROSS_QA] Unresolved: ${qaResult.unresolved_questions.join(', ')}`);
  }

  return MissionState.DEBATING;
}

/**
 * Execute cross-questioning between analysts
 */
async function runCrossQuestioning(mission: Mission): Promise<CrossQAResult> {
  const analystOutputs = (mission.state.analyst_outputs as unknown as any[]) || [];
  const questions: Question[] = [];
  const unansweredQuestions: string[] = [];
  let answeredCount = 0;

  // Step 1: Generate questions from each analyst to others
  for (let i = 0; i < analystOutputs.length; i++) {
    const questioner = analystOutputs[i];
    const questionerId = questioner?.analyst_id || `analyst_${i}`;

    for (let j = 0; j < analystOutputs.length; j++) {
      if (i === j) continue; // Don't question yourself

      const respondent = analystOutputs[j];
      const respondentId = respondent?.analyst_id || `analyst_${j}`;

      // Generate questions based on differences
      const analystQuestions = generateQuestions(
        questioner,
        respondent,
        questionerId,
        respondentId
      );

      questions.push(...analystQuestions);
    }
  }

  // Step 2: Process questions and collect answers
  for (const question of questions) {
    const answered = await questionAnalyst(mission, question);

    if (answered) {
      answeredCount++;
    } else {
      unansweredQuestions.push(`${question.to_analyst}: ${question.question}`);
    }
  }

  return {
    questions_asked: questions.length,
    questions_answered: answeredCount,
    unresolved_questions: unansweredQuestions,
  };
}

/**
 * Generate questions from one analyst to another
 */
function generateQuestions(
  questioner: any,
  respondent: any,
  questionerId: string,
  respondentId: string
): Question[] {
  const questions: Question[] = [];

  // Check valuation differences
  if (questioner.fair_value && respondent.fair_value) {
    const diff = Math.abs(questioner.fair_value - respondent.fair_value);
    const pctDiff = (diff / respondent.fair_value) * 100;

    if (pctDiff > 10) {
      questions.push({
        from_analyst: questionerId,
        to_analyst: respondentId,
        question: `Your fair value ($${respondent.fair_value}) differs significantly from my estimate ($${questioner.fair_value}). What evidence supports your valuation?`,
        evidence_required: true,
      });
    }
  }

  // Check risk assessment differences
  if (questioner.risk_level && respondent.risk_level && questioner.risk_level !== respondent.risk_level) {
    questions.push({
      from_analyst: questionerId,
      to_analyst: respondentId,
      question: `You assessed this as ${respondent.risk_level} risk while I see it as ${questioner.risk_level}. What risk factors am I missing?`,
      evidence_required: true,
    });
  }

  // Check thesis disagreements
  if (questioner.thesis_summary && respondent.thesis_summary) {
    const similarity = calculateThesisSimilarity(questioner.thesis_summary, respondent.thesis_summary);
    if (similarity < 0.5) {
      questions.push({
        from_analyst: questionerId,
        to_analyst: respondentId,
        question: `Our theses appear to differ significantly. Can you explain your key assumptions about this investment?`,
        evidence_required: true,
      });
    }
  }

  return questions;
}

/**
 * Question an analyst and wait for response
 */
async function questionAnalyst(mission: Mission, question: Question): Promise<boolean> {
  const domain = mission.state.brief?.domain || 'investment-war-room';
  const adapterType = getAdapterForAgent(question.to_analyst);
  const adapter = createUnifiedAdapter(adapterType);

  console.log(`  [CROSS_QA] Questioning ${question.to_analyst}: ${question.question}`);

  try {
    // Build prompt with persona content
    const prompt = await buildQAQuestionPrompt(
      question.to_analyst,
      question.from_analyst,
      question.question,
      domain,
      mission
    );

    const result = await adapter.run(prompt, { timeout: 60000 });

    if (result.success) {
      // Store the answer in mission state for tracking
      const stateData = mission.state as any;
      if (!stateData.cross_qa_answers) {
        stateData.cross_qa_answers = [];
      }

      stateData.cross_qa_answers.push({
        question: question.question,
        from_analyst: question.from_analyst,
        to_analyst: question.to_analyst,
        answer: result.content,
        timestamp: new Date().toISOString(),
      });

      console.log(`  [CROSS_QA] ${question.to_analyst} answered successfully`);
      return true;
    } else {
      console.log(`  [CROSS_QA] ${question.to_analyst} failed to answer: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.log(`  [CROSS_QA] ${question.to_analyst} error: ${error}`);
    return false;
  }
}

/**
 * Build QA question prompt with persona content
 */
async function buildQAQuestionPrompt(
  analystId: string,
  questionerId: string,
  question: string,
  domain: string,
  mission: Mission
): Promise<string> {
  // Try to load persona content using registry
  let personaContent = '';
  try {
    const resolver = getPersonaResolver();
    const personaPath = await resolver.resolvePersonaPath(analystId, domain);
    const personaRaw = await readFile(personaPath, 'utf-8');

    // Extract persona content after frontmatter
    const frontmatterEnd = personaRaw.indexOf('---', 3);
    if (frontmatterEnd !== -1) {
      personaContent = personaRaw.substring(frontmatterEnd + 3).trim();
    }
  } catch (error) {
    // Persona not found, continue without it
  }

  const ticker = mission.state.brief?.ticker || 'this investment';

  return `You are ${analystId}, participating in a cross-quality analysis for ${ticker}.

## A Question from ${questionerId}:
${question}

## Your Task:
Provide a clear, evidence-based response to this question. If the question asks for evidence, cite specific data points, metrics, or observations that support your position.

${personaContent ? `## Your Persona:\n${personaContent}\n` : ''}

**Language Support**: Respond in the same language as the question (Thai or English).`;
}

/**
 * Calculate similarity between two theses
 */
function calculateThesisSimilarity(thesis1: string, thesis2: string): number {
  // Simple word overlap for demonstration
  const words1 = new Set(thesis1.toLowerCase().split(/\s+/));
  const words2 = new Set(thesis2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}
