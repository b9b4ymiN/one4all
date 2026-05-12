/**
 * Constitution Validators
 *
 * Individual validators for different rule types
 */

import {
  ConstitutionRule,
  RuleContext,
  EnforcementResult,
  EnforcementLevel,
} from "../types.js";

/**
 * Base validator interface
 */
export interface RuleValidator {
  canValidate(rule: ConstitutionRule): boolean;
  validate(rule: ConstitutionRule, context: RuleContext): EnforcementResult;
}

/**
 * Evidence validator - checks evidence requirements
 */
export class EvidenceValidator implements RuleValidator {
  canValidate(rule: ConstitutionRule): boolean {
    // Skip conviction rules
    if (rule.id.includes("conviction")) {
      return false;
    }
    if (rule.validation.required_fields?.includes("conviction_level")) {
      return false;
    }
    // Handle rules with evidence-related thresholds or explicitly marked as evidence rules
    if (rule.id.startsWith("evidence_") || rule.id.includes("evidence")) {
      return true;
    }
    if (!rule.validation.thresholds) {
      return false;
    }
    const thresholds = rule.validation.thresholds;
    // Check if this is evidence thresholds (very_low, low, conditional)
    return "very_low" in thresholds || "low" in thresholds || "conditional" in thresholds;
  }

  validate(rule: ConstitutionRule, context: RuleContext): EnforcementResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    const output = context.output;

    // Check evidence score thresholds
    if (rule.validation.thresholds) {
      const score = output.evidence_score as number | undefined;
      if (score !== undefined) {
        const thresholds = rule.validation.thresholds;
        if (thresholds.very_low && score < (thresholds.very_low as number)) {
          violations.push("Evidence score below minimum threshold");
        } else if (thresholds.low && score < (thresholds.low as number)) {
          violations.push("Evidence score requires human review");
        } else if (
          thresholds.conditional &&
          score >= (thresholds.low as number) &&
          score < (thresholds.conditional as number)
        ) {
          warnings.push("Evidence score below recommended threshold");
        }
      }
    }

    // Check required documents
    if (rule.validation.required_fields) {
      const requiredDocs = rule.validation.required_fields;
      const foundDocs = output.found_documents as string[] | undefined;
      if (foundDocs) {
        for (const doc of requiredDocs) {
          if (!foundDocs.includes(doc)) {
            violations.push(`Required document missing: ${doc}`);
          }
        }
      }
    }

    // Check data gaps
    if (rule.validation.critical_fields) {
      const dataGaps = output.data_gaps as string[] | undefined;
      if (dataGaps) {
        for (const gap of dataGaps) {
          const criticalField = rule.validation.critical_fields.find((f) =>
            gap.toLowerCase().includes(f.toLowerCase())
          );
          if (criticalField) {
            violations.push(`Critical data gap: ${gap}`);
          }
        }
      }
    }

    return {
      passed: violations.length === 0,
      rule_id: rule.id,
      enforcement: rule.enforcement,
      violations,
      warnings,
    };
  }
}

/**
 * Forbidden content validator - checks for forbidden phrases
 */
export class ForbiddenContentValidator implements RuleValidator {
  canValidate(rule: ConstitutionRule): boolean {
    return rule.validation.forbidden_content !== undefined;
  }

  validate(rule: ConstitutionRule, context: RuleContext): EnforcementResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    const forbidden = rule.validation.forbidden_content || [];
    const outputText = this.extractTextFromOutput(context.output);

    for (const phrase of forbidden) {
      // Case-insensitive search for phrase
      const regex = new RegExp(`\\b${phrase}\\b`, "gi");
      if (regex.test(outputText)) {
        violations.push(`Forbidden phrase found: "${phrase}"`);
      }
    }

    return {
      passed: violations.length === 0,
      rule_id: rule.id,
      enforcement: rule.enforcement,
      violations,
      warnings,
    };
  }

  private extractTextFromOutput(output: Record<string, unknown>): string {
    // Recursively extract all string values from output
    const strings: string[] = [];

    function extract(obj: unknown): void {
      if (typeof obj === "string") {
        strings.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach(extract);
      } else if (typeof obj === "object" && obj !== null) {
        Object.values(obj).forEach(extract);
      }
    }

    extract(output);
    return strings.join(" ");
  }
}

/**
 * Required fields validator - checks for required fields
 */
export class RequiredFieldsValidator implements RuleValidator {
  canValidate(rule: ConstitutionRule): boolean {
    // Don't claim rules that are better handled by other validators
    // EvidenceValidator handles evidence thresholds (very_low, low, conditional)
    // ThresholdValidator handles min_* / max_* thresholds
    // ConvictionValidator handles conviction rules
    if (rule.id.includes("conviction")) {
      return false;
    }
    if (rule.id.includes("evidence")) {
      return false;
    }
    if (rule.validation.thresholds) {
      const thresholds = rule.validation.thresholds;
      // Skip evidence thresholds
      if ("very_low" in thresholds || "low" in thresholds || "conditional" in thresholds) {
        return false;
      }
      // Skip min/max thresholds (ThresholdValidator handles those)
      const hasMinMax = Object.keys(thresholds).some(k => k.startsWith("min_") || k.startsWith("max_"));
      if (hasMinMax) {
        return false;
      }
    }
    return rule.validation.required_fields !== undefined;
  }

  validate(rule: ConstitutionRule, context: RuleContext): EnforcementResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    const required = rule.validation.required_fields || [];
    const output = context.output;

    for (const field of required) {
      if (!(field in output) || output[field] === undefined || output[field] === null) {
        violations.push(`Required field missing: ${field}`);
      } else if (Array.isArray(output[field]) && (output[field] as unknown[]).length === 0) {
        violations.push(`Required field is empty: ${field}`);
      } else if (typeof output[field] === "string" && (output[field] as string).trim() === "") {
        violations.push(`Required field is empty: ${field}`);
      }
    }

    return {
      passed: violations.length === 0,
      rule_id: rule.id,
      enforcement: rule.enforcement,
      violations,
      warnings,
    };
  }
}

/**
 * Threshold validator - checks numeric thresholds
 */
export class ThresholdValidator implements RuleValidator {
  canValidate(rule: ConstitutionRule): boolean {
    // Skip conviction rules
    if (rule.id.includes("conviction") || rule.validation.required_fields?.includes("conviction_level")) {
      return false;
    }
    // Skip evidence-related thresholds (handled by EvidenceValidator)
    if (!rule.validation.thresholds) {
      return false;
    }
    const thresholds = rule.validation.thresholds;
    // Check if this is evidence thresholds (very_low, low, conditional)
    if ("very_low" in thresholds || "low" in thresholds || "conditional" in thresholds) {
      return false;
    }
    // Check if this has min/max style thresholds
    const hasMinMax = Object.keys(thresholds).some(k => k.startsWith("min_") || k.startsWith("max_"));
    return hasMinMax;
  }

  validate(rule: ConstitutionRule, context: RuleContext): EnforcementResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    const thresholds = rule.validation.thresholds || {};
    const output = context.output;

    // Extract the field name from min_*/max_* style thresholds
    // e.g., min_wacc, max_wacc -> wacc
    const fieldMap = new Map<string, { min?: number; max?: number }>();

    for (const [key, threshold] of Object.entries(thresholds)) {
      if (key.startsWith("min_")) {
        const field = key.slice(4); // Remove "min_" prefix
        if (!fieldMap.has(field)) fieldMap.set(field, {});
        fieldMap.get(field)!.min = threshold as number;
      } else if (key.startsWith("max_")) {
        const field = key.slice(4); // Remove "max_" prefix
        if (!fieldMap.has(field)) fieldMap.set(field, {});
        fieldMap.get(field)!.max = threshold as number;
      } else if (typeof threshold === "number" || typeof threshold === "string") {
        // Direct field thresholds - handle below
        const value = output[key];
        if (typeof value === "number") {
          if (typeof threshold === "number") {
            if (value > threshold) {
              warnings.push(`${key} (${value}) exceeds threshold (${threshold})`);
            }
          } else if (typeof threshold === "string") {
            const match = threshold.match(/^([<>]=?)(\d+(?:\.\d+)?)$/);
            if (match) {
              const operator = match[1];
              const limit = parseFloat(match[2]);
              let violated = false;

              switch (operator) {
                case ">":
                  violated = value > limit;
                  break;
                case ">=":
                  violated = value >= limit;
                  break;
                case "<":
                  violated = value < limit;
                  break;
                case "<=":
                  violated = value <= limit;
                  break;
              }

              if (violated) {
                violations.push(`${key} (${value}) violates threshold (${threshold})`);
              }
            }
          }
        }
      }
    }

    // Check min/max thresholds
    for (const [field, bounds] of fieldMap.entries()) {
      const value = output[field];

      if (typeof value === "number") {
        if (bounds.min !== undefined && value < bounds.min) {
          violations.push(`${field} (${value}) below minimum (${bounds.min})`);
        }
        if (bounds.max !== undefined && value > bounds.max) {
          violations.push(`${field} (${value}) exceeds maximum (${bounds.max})`);
        }
      }
    }

    return {
      passed: violations.length === 0,
      rule_id: rule.id,
      enforcement: rule.enforcement,
      violations,
      warnings,
    };
  }
}

/**
 * Conviction level validator
 */
export class ConvictionValidator implements RuleValidator {
  canValidate(rule: ConstitutionRule): boolean {
    // Check by rule ID or by required_fields containing conviction_level
    if (rule.id.includes("conviction")) {
      return true;
    }
    if (rule.validation.required_fields) {
      return rule.validation.required_fields.includes("conviction_level");
    }
    return false;
  }

  validate(rule: ConstitutionRule, context: RuleContext): EnforcementResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    const conviction = context.output.conviction_level as number | undefined;

    if (conviction === undefined) {
      violations.push("Conviction level is required");
    } else if (typeof conviction !== "number" || conviction < 1 || conviction > 10) {
      violations.push("Conviction level must be a number between 1 and 10");
    } else if (rule.validation.thresholds) {
      // Check conviction guidelines
      const guidelines = rule.validation.thresholds;
      if (guidelines.low && conviction <= (guidelines.low as number) && !context.output.conviction_reasoning) {
        warnings.push("Low conviction should include reasoning");
      }
    }

    return {
      passed: violations.length === 0,
      rule_id: rule.id,
      enforcement: rule.enforcement,
      violations,
      warnings,
    };
  }
}

/**
 * Source tier validator
 */
export class SourceTierValidator implements RuleValidator {
  canValidate(rule: ConstitutionRule): boolean {
    return rule.id.includes("source") || rule.id.includes("tier");
  }

  validate(rule: ConstitutionRule, context: RuleContext): EnforcementResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    const output = context.output;

    // Check that all FACT claims have source tiers
    const claims = output.claims as Array<{ claim: string; label?: string; source_tier?: string }> | undefined;
    if (claims) {
      for (const claim of claims) {
        if (claim.label === "FACT" && !claim.source_tier) {
          violations.push(`FACT claim missing source tier: "${claim.claim.substring(0, 50)}..."`);
        }
      }
    }

    return {
      passed: violations.length === 0,
      rule_id: rule.id,
      enforcement: rule.enforcement,
      violations,
      warnings,
    };
  }
}

/**
 * Get appropriate validator for a rule
 */
export function getValidator(rule: ConstitutionRule): RuleValidator {
  const validators: RuleValidator[] = [
    new EvidenceValidator(),
    new ForbiddenContentValidator(),
    new RequiredFieldsValidator(),
    new ThresholdValidator(),
    new ConvictionValidator(),
    new SourceTierValidator(),
  ];

  for (const validator of validators) {
    if (validator.canValidate(rule)) {
      return validator;
    }
  }

  // Default to required fields validator
  return new RequiredFieldsValidator();
}
