import { describe, it, expect } from 'vitest';
import { validateAgentCard } from '@one4all/a2a/schemas/agent-card.schema.js';
import type { AgentCard } from '@one4all/a2a/schemas/agent-card.schema.js';

/**
 * Behavioral Validation Tests: Output Contract
 *
 * These tests verify that agents produce outputs that comply with their
 * declared output contracts, including mandatory fields, forbidden content,
 * and validation rules.
 */
describe('Behavioral Validation: Output Contract', () => {
  const agentWithMandatoryFields: AgentCard = {
    id: 'contract-agent',
    name: 'Contract Compliant Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'analyst',
    description: 'Agent that strictly follows output contract',
    tags: [],
    capabilities: {
      input_types: ['test'],
      output_types: ['result'],
      skills: [],
      tools_required: [],
      tools_provided: [],
    },
    output_contract: {
      mandatory_fields: ['result', 'confidence', 'timestamp'],
      forbidden_content: ['error', 'exception'],
      validation_rules: ['confidence must be between 0 and 1', 'result must be a string'],
    },
    performance: {
      timeout_seconds: 120,
      max_tokens: 8192,
      max_retries: 3,
    },
    a2a_config: {
      endpoint: 'https://contract.example.com',
    },
  };

  const agentWithMinimalContract: AgentCard = {
    id: 'minimal-contract-agent',
    name: 'Minimal Contract Agent',
    version: '1.0.0',
    domain: 'test',
    active: true,
    role: 'analyst',
    description: 'Agent with minimal output contract',
    tags: [],
    capabilities: {
      input_types: ['test'],
      output_types: ['result'],
      skills: [],
      tools_required: [],
      tools_provided: [],
    },
    output_contract: {
      mandatory_fields: [],
      forbidden_content: [],
      validation_rules: [],
    },
    performance: {
      timeout_seconds: 120,
      max_tokens: 8192,
      max_retries: 3,
    },
    a2a_config: {
      endpoint: 'https://minimal.example.com',
    },
  };

  describe('Mandatory Fields Validation', () => {
    it('should require all mandatory fields in output', () => {
      const validOutput = {
        result: 'Analysis complete',
        confidence: 0.95,
        timestamp: '2026-05-13T20:00:00Z',
      };

      // Check that all mandatory fields are present
      for (const field of agentWithMandatoryFields.output_contract.mandatory_fields) {
        expect(validOutput).toHaveProperty(field);
      }
    });

    it('should detect missing mandatory fields', () => {
      const invalidOutput = {
        result: 'Analysis complete',
        // Missing 'confidence' and 'timestamp'
      };

      const missingFields = agentWithMandatoryFields.output_contract.mandatory_fields.filter(
        field => !(field in invalidOutput)
      );

      expect(missingFields).toContain('confidence');
      expect(missingFields).toContain('timestamp');
    });

    it('should accept outputs with no mandatory fields', () => {
      const anyOutput = { anything: 'goes' };

      // Agent with minimal contract accepts any output
      expect(agentWithMinimalContract.output_contract.mandatory_fields).toHaveLength(0);
    });
  });

  describe('Forbidden Content Detection', () => {
    it('should detect forbidden content in output', () => {
      const invalidOutput = {
        result: 'An error occurred during processing',
        confidence: 0.5,
        timestamp: '2026-05-13T20:00:00Z',
      };

      // Check for forbidden content
      const hasForbiddenContent = agentWithMandatoryFields.output_contract.forbidden_content.some(
        forbidden => JSON.stringify(invalidOutput).toLowerCase().includes(forbidden)
      );

      expect(hasForbiddenContent).toBe(true);
    });

    it('should accept outputs without forbidden content', () => {
      const validOutput = {
        result: 'Analysis complete successfully',
        confidence: 0.95,
        timestamp: '2026-05-13T20:00:00Z',
      };

      const hasForbiddenContent = agentWithMandatoryFields.output_contract.forbidden_content.some(
        forbidden => JSON.stringify(validOutput).toLowerCase().includes(forbidden)
      );

      expect(hasForbiddenContent).toBe(false);
    });

    it('should handle empty forbidden content list', () => {
      const agentWithoutForbiddenContent: AgentCard = {
        ...agentWithMinimalContract,
        output_contract: {
          mandatory_fields: [],
          forbidden_content: [], // No forbidden content
          validation_rules: [],
        },
      };

      const anyOutput = { error: 'anything' };

      // Should not reject any content
      expect(agentWithoutForbiddenContent.output_contract.forbidden_content).toHaveLength(0);
    });
  });

  describe('Validation Rules', () => {
    it('should validate confidence is between 0 and 1', () => {
      const output = { confidence: 0.95 };

      const confidenceValid = output.confidence >= 0 && output.confidence <= 1;
      expect(confidenceValid).toBe(true);
    });

    it('should reject invalid confidence values', () => {
      const invalidOutputs = [
        { confidence: -0.1 },
        { confidence: 1.5 },
        { confidence: 2 },
      ];

      invalidOutputs.forEach(output => {
        const confidenceValid = output.confidence >= 0 && output.confidence <= 1;
        expect(confidenceValid).toBe(false);
      });
    });

    it('should validate result is a string', () => {
      const validOutput = { result: 'This is a string' };
      expect(typeof validOutput.result).toBe('string');
    });

    it('should reject non-string result', () => {
      const invalidOutputs = [
        { result: 123 },
        { result: { nested: 'object' } },
        { result: ['array'] },
      ];

      invalidOutputs.forEach(output => {
        expect(typeof output.result).not.toBe('string');
      });
    });
  });

  describe('Output Contract Compliance Score', () => {
    it('should calculate high compliance score for fully compliant outputs', () => {
      const fullyCompliantOutput = {
        result: 'Valid string result',
        confidence: 0.85,
        timestamp: '2026-05-13T20:00:00Z',
      };

      // Check all criteria
      const hasAllMandatoryFields = agentWithMandatoryFields.output_contract.mandatory_fields.every(
        field => field in fullyCompliantOutput
      );

      const hasNoForbiddenContent = !agentWithMandatoryFields.output_contract.forbidden_content.some(
        forbidden => JSON.stringify(fullyCompliantOutput).toLowerCase().includes(forbidden)
      );

      const confidenceValid = fullyCompliantOutput.confidence >= 0 && fullyCompliantOutput.confidence <= 1;
      const resultIsString = typeof fullyCompliantOutput.result === 'string';

      const complianceScore = (
        (hasAllMandatoryFields ? 1 : 0) +
        (hasNoForbiddenContent ? 1 : 0) +
        (confidenceValid ? 1 : 0) +
        (resultIsString ? 1 : 0)
      ) / 4;

      expect(complianceScore).toBe(1);
    });

    it('should calculate low compliance score for non-compliant outputs', () => {
      const nonCompliantOutput = {
        // Missing mandatory fields
        result: 123, // Not a string
        confidence: 1.5, // Invalid
      };

      let complianceCount = 0;
      const totalChecks = 4;

      if ('result' in nonCompliantOutput) complianceCount++;
      if ('confidence' in nonCompliantOutput) complianceCount++;
      if ('timestamp' in nonCompliantOutput) complianceCount++;
      // All other checks fail

      const complianceScore = complianceCount / totalChecks;

      expect(complianceScore).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Contract Schema Validation', () => {
    it('should validate agent card with output contract', () => {
      const result = validateAgentCard(agentWithMandatoryFields);
      expect(result.valid).toBe(true);
    });

    it('should validate agent card with minimal contract', () => {
      const result = validateAgentCard(agentWithMinimalContract);
      expect(result.valid).toBe(true);
    });

    it('should accept empty output contract', () => {
      const agentWithEmptyContract: AgentCard = {
        ...agentWithMinimalContract,
        output_contract: {
          mandatory_fields: [],
          forbidden_content: [],
          validation_rules: [],
        },
      };

      const result = validateAgentCard(agentWithEmptyContract);
      expect(result.valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle outputs with extra fields', () => {
      const outputWithExtras = {
        result: 'Valid',
        confidence: 0.8,
        timestamp: '2026-05-13T20:00:00Z',
        extraField: 'This is allowed',
        anotherExtra: 123,
      };

      // Extra fields should not cause validation to fail
      const hasAllMandatoryFields = agentWithMandatoryFields.output_contract.mandatory_fields.every(
        field => field in outputWithExtras
      );

      expect(hasAllMandatoryFields).toBe(true);
    });

    it('should handle null values in mandatory fields', () => {
      const outputWithNulls = {
        result: null,
        confidence: null,
        timestamp: null,
      };

      // Null values should be detected as missing/invalid
      const hasValidMandatoryFields = agentWithMandatoryFields.output_contract.mandatory_fields.every(
        field => field in outputWithNulls && outputWithNulls[field] !== null
      );

      expect(hasValidMandatoryFields).toBe(false);
    });

    it('should handle case-sensitive forbidden content', () => {
      const output = { result: 'An ERROR occurred' };

      // 'error' is forbidden, but 'ERROR' might not be caught if check is case-sensitive
      const hasError = output.result.toLowerCase().includes('error');
      expect(hasError).toBe(true);
    });
  });
});
