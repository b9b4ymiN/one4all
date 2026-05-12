import { describe, it, expect } from 'vitest';
import {
  ForensicOutputSchema,
  ResearcherOutputSchema,
  DamodaranOutputSchema,
  UniversalAgentFieldsSchema,
} from '../src/schemas/agents';

describe('Agent Schemas (Zod)', () => {
  const baseFields = {
    agent_id: 'test-agent',
    mission_id: 'test-mission',
    timestamp: new Date().toISOString(),
    conviction_level: 8,
    what_would_change_my_mind: ['New data'],
    data_gaps_found: [],
  };

  describe('UniversalAgentFieldsSchema', () => {
    it('should validate valid base fields', () => {
      const result = UniversalAgentFieldsSchema.safeParse(baseFields);
      expect(result.success).toBe(true);
    });

    it('should reject invalid conviction level', () => {
      const invalid = { ...baseFields, conviction_level: 11 };
      const result = UniversalAgentFieldsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('ForensicOutputSchema', () => {
    const validForensic = {
      ...baseFields,
      agent_id: 'forensic-accountant',
      normalized_earnings: {
        reported_net_income: 1000,
        one_off_items: [],
        normalized_net_income: 1000,
        adjustment_amount: 0,
      },
      earnings_quality: {
        operating_cashflow: 800,
        ocf_to_ni_ratio: 0.8,
        quality_rating: 'high',
        flags: [],
      },
      confidence: 'high',
      confidence_reasoning: 'Consistent OCF',
      key_findings: ['Strong cash flow'],
    };

    it('should validate valid forensic output', () => {
      const result = ForensicOutputSchema.safeParse(validForensic);
      expect(result.success).toBe(true);
    });

    it('should enforce quality_rating "low" if OCF < 70% of NI', () => {
      const invalidForensic = {
        ...validForensic,
        earnings_quality: {
          operating_cashflow: 500, // 50% of NI (1000)
          ocf_to_ni_ratio: 0.5,
          quality_rating: 'high', // Invalid: should be low/negative
          flags: [],
        },
      };
      const result = ForensicOutputSchema.safeParse(invalidForensic);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('low');
      }
    });

    it('should allow quality_rating "low" if OCF < 70% of NI', () => {
        const lowQualityForensic = {
          ...validForensic,
          earnings_quality: {
            operating_cashflow: 500,
            ocf_to_ni_ratio: 0.5,
            quality_rating: 'low',
            flags: ['Low OCF'],
          },
        };
        const result = ForensicOutputSchema.safeParse(lowQualityForensic);
        expect(result.success).toBe(true);
      });
  });

  describe('DamodaranOutputSchema', () => {
    const validDamodaran = {
      ...baseFields,
      agent_id: 'damodaran-valuation',
      dcf_inputs: {
        base_revenue: 100,
        revenue_growth_y1_y5: 0.1,
        revenue_growth_y6_y10: 0.05,
        terminal_growth: 0.03,
        operating_margin_target: 0.2,
        wacc: 0.08,
        tax_rate: 0.2,
      },
      dcf_results: {
        fair_value_conservative: 1000,
        fair_value_base: 1200,
        fair_value_optimistic: 1500,
        per_share_values: {
          conservative: 10,
          base: 12,
          optimistic: 15,
        },
      },
      reverse_dcf: {
        current_price: 12,
        implied_growth_at_current_price: 0.05,
        market_implied_wacc: 0.08,
      },
      sensitivity: {
        parameter: 'WACC',
        scenarios: [],
      },
      key_assumptions: [],
    };

    it('should validate valid damodaran output', () => {
      const result = DamodaranOutputSchema.safeParse(validDamodaran);
      expect(result.success).toBe(true);
    });

    it('should reject terminal growth > 5%', () => {
      const invalidDamodaran = {
        ...validDamodaran,
        dcf_inputs: {
          ...validDamodaran.dcf_inputs,
          terminal_growth: 0.06,
        },
      };
      const result = DamodaranOutputSchema.safeParse(invalidDamodaran);
      expect(result.success).toBe(false);
    });
  });
});
