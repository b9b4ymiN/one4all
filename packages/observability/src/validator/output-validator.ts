/**
 * Output Validator - Zod-based schema validation for all outputs
 */

import { z } from 'zod';

export const AgentOutputSchema = z.object({
  missionId: z.string(),
  agentId: z.string(),
  timestamp: z.string(),
  output: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

export const DecisionOutputSchema = z.object({
  missionId: z.string(),
  decision: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  recommendation: z.string().optional(),
  alternativeOptions: z.array(z.string()).optional(),
  riskFactors: z.array(z.string()).optional(),
  timestamp: z.string(),
});

export type DecisionOutput = z.infer<typeof DecisionOutputSchema>;

export const ResearchOutputSchema = z.object({
  missionId: z.string(),
  topic: z.string(),
  findings: z.array(z.object({
    source: z.string(),
    content: z.string(),
    tier: z.number(),
    timestamp: z.string(),
  })),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  gaps: z.array(z.string()).optional(),
  timestamp: z.string(),
});

export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

export const DebateOutputSchema = z.object({
  missionId: z.string(),
  round: z.number(),
  participants: z.array(z.object({
    agentId: z.string(),
    position: z.string(),
    argument: z.string(),
    evidence: z.array(z.string()),
  })),
  consensus: z.string().optional(),
  disagreementPoints: z.array(z.string()).optional(),
  timestamp: z.string(),
});

export type DebateOutput = z.infer<typeof DebateOutputSchema>;

export const ValidationError = z.object({
  path: z.array(z.string()),
  message: z.string(),
  code: z.enum(['invalid_type', 'unrecognized_keys', 'invalid_union', 'invalid_enum_value', 'too_small', 'too_big', 'custom']),
  expected: z.string().optional(),
  received: z.unknown().optional(),
});

export type ValidationErrorType = z.infer<typeof ValidationError>;

export interface ValidationResult {
  success: boolean;
  data?: unknown;
  errors?: ValidationErrorType[];
  warnings?: string[];
}

export interface ValidatorConfig {
  strictMode?: boolean;
  allowUnrecognizedKeys?: boolean;
  enableCoercion?: boolean;
}

const DEFAULT_CONFIG: ValidatorConfig = {
  strictMode: false,
  allowUnrecognizedKeys: false,
  enableCoercion: true,
};

export class OutputValidator {
  private config: ValidatorConfig;

  constructor(config: ValidatorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  validateAgentOutput(output: unknown, schema?: z.ZodSchema): ValidationResult {
    const schemaToUse = schema || AgentOutputSchema;
    return this.validate(output, schemaToUse);
  }

  validateDecision(output: unknown): ValidationResult {
    return this.validate(output, DecisionOutputSchema);
  }

  validateResearch(output: unknown): ValidationResult {
    return this.validate(output, ResearchOutputSchema);
  }

  validateDebate(output: unknown): ValidationResult {
    return this.validate(output, DebateOutputSchema);
  }

  validate(output: unknown, schema: z.ZodSchema): ValidationResult {
    const result = schema.safeParse(output);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    const errors: ValidationErrorType[] = result.error.errors.map(err => {
      const errorEntry: ValidationErrorType = {
        path: err.path.map(String),
        message: err.message,
        code: err.code as ValidationErrorType['code'],
      };

      // expected and received only exist on certain issue types
      if ('expected' in err) {
        errorEntry.expected = String(err.expected);
      }
      if ('received' in err) {
        errorEntry.received = err.received;
      }

      return errorEntry;
    });

    const warnings = this.generateWarnings(result.error);

    return {
      success: false,
      errors,
      warnings,
    };
  }

  private generateWarnings(error: z.ZodError): string[] {
    const warnings: string[] = [];

    for (const issue of error.errors) {
      if (issue.code === 'unrecognized_keys') {
        warnings.push(`Unrecognized key: ${issue.path.join('.')}`);
      }
    }

    return warnings;
  }

  validateOrThrow<T>(output: unknown, schema: z.ZodSchema<T>): T {
    return schema.parse(output);
  }

  async validateAsync(output: unknown, schema: z.ZodSchema): Promise<ValidationResult> {
    try {
      const result = await schema.safeParseAsync(output);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        errors: result.error.errors.map(err => ({
          path: err.path.map(String),
          message: err.message,
          code: err.code as ValidationErrorType['code'],
        })),
      };
    } catch {
      return {
        success: false,
        errors: [{
          path: [],
          message: 'Validation failed due to an unexpected error',
          code: 'custom',
        }],
      };
    }
  }

  createCustomSchema<T extends z.ZodTypeAny>(schema: T): T {
    return schema;
  }

  createSchemaFromShape<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
    return z.object(shape);
  }

  sanitizeOutput<T>(output: unknown, schema: z.ZodSchema<T>): T | null {
    const result = this.validate(output, schema);
    return result.success ? (result.data as T) : null;
  }

  formatValidationErrors(result: ValidationResult): string[] {
    if (result.success || !result.errors) {
      return [];
    }

    return result.errors.map(err => {
      const path = err.path.length > 0 ? err.path.join('.') : 'root';
      const message = err.message;
      const expected = err.expected ? ` (expected: ${err.expected})` : '';
      return `Validation error at '${path}': ${message}${expected}`;
    });
  }

  getDefaultSchemas(): Record<string, z.ZodSchema> {
    return {
      agentOutput: AgentOutputSchema,
      decision: DecisionOutputSchema,
      research: ResearchOutputSchema,
      debate: DebateOutputSchema,
    };
  }
}

export const PrebuiltSchemas = {
  missionState: z.enum(['DRAFT', 'PLANNING', 'RESEARCHING', 'ANALYZING', 'CROSS_QA', 'DEBATING', 'SYNTHESIZING', 'DECIDED', 'JOURNALED', 'FAILED', 'HUMAN_REVIEW']),

  evidence: z.object({
    id: z.string(),
    source: z.string().url(),
    tier: z.number().int().min(1).max(3),
    content: z.string().min(1),
    timestamp: z.string(),
  }),

  constitution: z.object({
    id: z.string(),
    rule: z.string().min(1),
    level: z.enum(['BLOCK_MISSION', 'INSERT_HUMAN_REVIEW', 'WARN_AND_FLAG', 'REJECT_OUTPUT']),
    domain: z.string(),
  }),

  journalEntry: z.object({
    missionId: z.string().uuid(),
    timestamp: z.string(),
    state: z.enum(['DRAFT', 'PLANNING', 'RESEARCHING', 'ANALYZING', 'CROSS_QA', 'DEBATING', 'SYNTHESIZING', 'DECIDED', 'JOURNALED', 'FAILED', 'HUMAN_REVIEW']),
    decision: z.string().min(1),
    reasoning: z.string().min(1),
    confidence: z.number().min(0).max(1),
    evidenceCount: z.number().int().min(0),
    tags: z.array(z.string()).optional(),
  }),
};

export type PrebuiltSchemaTypes = {
  missionState: z.infer<typeof PrebuiltSchemas.missionState>;
  evidence: z.infer<typeof PrebuiltSchemas.evidence>;
  constitution: z.infer<typeof PrebuiltSchemas.constitution>;
  journalEntry: z.infer<typeof PrebuiltSchemas.journalEntry>;
};

export function createValidatorWithDefaults(config?: ValidatorConfig): OutputValidator {
  return new OutputValidator(config);
}
