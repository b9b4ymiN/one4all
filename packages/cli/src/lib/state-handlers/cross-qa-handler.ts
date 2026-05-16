/**
 * CROSS_QA State Handler
 *
 * Orchestrates cross-questioning between analyst agents
 * Analysts review and question each other's outputs
 */

import { Mission, MissionState } from '@one4all/kernel';

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
  // In full implementation, this would:
  // 1. Send question to the specific analyst
  // 2. Wait for their response with evidence
  // 3. Track whether question was answered satisfactorily

  // For now, simulate answering based on evidence requirement
  if (question.evidence_required) {
    // Check if mission has relevant evidence
    const hasEvidence = mission.state.evidence_pack && Object.keys(mission.state.evidence_pack).length > 0;
    return hasEvidence ?? false;
  }

  return true;
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
