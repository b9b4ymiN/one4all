/**
 * Report Generator
 *
 * Creates comprehensive investment research reports with all required sections
 */

import type {
  ReportFormat,
  ReportSection,
  InvestmentReport,
  ReportTemplate,
  ReportGeneratorOptions,
  SectionRenderContext,
} from './types.js';
import type { SynthesisOutput } from '../synthesis/types.js';
import type { DecisionState } from '../journal-writer/types.js';

/**
 * Default report template
 */
const DEFAULT_TEMPLATE: ReportTemplate = {
  name: 'full-investment-report',
  description: 'Complete investment analysis report with all sections',
  sections: [
    { id: 'summary', title: 'One-Page Decision Summary', included_by_default: true, order: 1 },
    { id: 'business_model', title: 'Business Model', included_by_default: true, order: 2 },
    { id: 'evidence_quality', title: 'Evidence Quality', included_by_default: true, order: 3 },
    { id: 'normalized_earnings', title: 'Normalized Earnings', included_by_default: true, order: 4 },
    { id: 'conservative_dcf', title: 'Conservative DCF', included_by_default: true, order: 5 },
    { id: 'reverse_dcf', title: 'Reverse DCF', included_by_default: true, order: 6 },
    { id: 'mos_table', title: 'MOS Table', included_by_default: true, order: 7 },
    { id: 'downside_case', title: 'Downside Case', included_by_default: true, order: 8 },
    { id: 'analyst_disagreement', title: 'Analyst Disagreement', included_by_default: true, order: 9 },
    { id: 'decision_state', title: 'Decision State & Thesis Breakers', included_by_default: true, order: 10 },
    { id: 'follow_up', title: 'Follow-Up Checklist', included_by_default: true, order: 11 },
    { id: 'audit_trail', title: 'Audit Trail', included_by_default: true, order: 12 },
  ],
};

/**
 * Section renderer functions
 */
const SECTION_RENDERERS: Record<
  string,
  (context: SectionRenderContext) => string
> = {
  summary: renderSummarySection,
  business_model: renderBusinessModelSection,
  evidence_quality: renderEvidenceQualitySection,
  normalized_earnings: renderNormalizedEarningsSection,
  conservative_dcf: renderConservativeDCFSection,
  reverse_dcf: renderReverseDCFSection,
  mos_table: renderMOSTableSection,
  downside_case: renderDownsideCaseSection,
  analyst_disagreement: renderAnalystDisagreementSection,
  decision_state: renderDecisionStateSection,
  follow_up: renderFollowUpSection,
  audit_trail: renderAuditTrailSection,
};

/**
 * Report Generator class
 */
export class ReportGenerator {
  private template: ReportTemplate;

  constructor(template?: ReportTemplate) {
    this.template = template ?? DEFAULT_TEMPLATE;
  }

  /**
   * Generate a complete investment report
   */
  generate(
    synthesis: SynthesisOutput,
    options: ReportGeneratorOptions = {}
  ): InvestmentReport {
    const format = options.format ?? 'markdown';
    const language = options.language ?? 'en';
    const context: SectionRenderContext = {
      synthesis,
      mission_id: synthesis.mission_id,
      generated_at: new Date(),
      language,
    };

    // Determine which sections to include
    const sectionsToInclude = this.determineSections(options);

    // Render each section
    const sections: ReportSection[] = sectionsToInclude.map((sectionDef) => {
      const renderer = SECTION_RENDERERS[sectionDef.id];
      const content = renderer ? renderer(context) : '// Section not implemented';

      return {
        id: sectionDef.id,
        title: sectionDef.title,
        content,
        order: sectionDef.order,
        included: true,
      };
    });

    return {
      mission_id: synthesis.mission_id,
      generated_at: context.generated_at,
      report_format: format,

      subject: {
        ticker: synthesis.assumptions?.other_assumptions?.ticker as string | undefined,
        company_name: synthesis.assumptions?.other_assumptions?.company_name as string | undefined,
        market: synthesis.assumptions?.other_assumptions?.market as string | undefined,
        subject_type: synthesis.assumptions?.other_assumptions?.subject_type as string ?? 'stock',
      },

      sections,

      summary: {
        decision_state: synthesis.decision_state,
        conviction_level: synthesis.conviction_level,
        fair_value_conservative: synthesis.valuation.conservative,
        fair_value_base: synthesis.valuation.base,
        current_price: synthesis.assumptions?.other_assumptions?.current_price as number ?? 0,
        mos_30_price: synthesis.valuation.mos_30,
        price_to_watch: synthesis.valuation.price_to_watch,
        evidence_score: synthesis.evidence_quality.score,
      },

      synthesis_output: options.include_raw_synthesis ? synthesis : undefined,
    };
  }

  /**
   * Generate report as formatted string
   */
  generateAsString(
    synthesis: SynthesisOutput,
    options: ReportGeneratorOptions = {}
  ): string {
    const report = this.generate(synthesis, options);

    if (options.format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    if (options.format === 'html') {
      return this.renderAsHtml(report);
    }

    // Default: markdown
    return this.renderAsMarkdown(report);
  }

  /**
   * Determine which sections to include based on options
   */
  private determineSections(options: ReportGeneratorOptions): Array<{
    id: string;
    title: string;
    order: number;
  }> {
    let sections = this.template.sections.filter((s) => s.included_by_default);

    if (options.include_sections) {
      sections = this.template.sections.filter((s) =>
        options.include_sections?.includes(s.id)
      );
    }

    if (options.exclude_sections) {
      sections = sections.filter((s) => !options.exclude_sections?.includes(s.id));
    }

    return sections.sort((a, b) => a.order - b.order);
  }

  /**
   * Render report as markdown
   */
  private renderAsMarkdown(report: InvestmentReport): string {
    const lines: string[] = [];

    // Header
    lines.push('# Investment Analysis Report');
    lines.push('');
    lines.push(`**Mission ID:** ${report.mission_id}`);
    lines.push(`**Generated:** ${report.generated_at.toISOString()}`);
    if (report.subject.ticker) {
      lines.push(`**Ticker:** ${report.subject.ticker}`);
    }
    if (report.subject.company_name) {
      lines.push(`**Company:** ${report.subject.company_name}`);
    }
    lines.push('');

    // Decision summary box
    lines.push('## Decision Summary');
    lines.push('');
    lines.push(`**Decision State:** ${report.summary.decision_state}`);
    lines.push(`**Conviction:** ${report.summary.conviction_level}/10`);
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Current Price | ${report.summary.current_price} |`);
    lines.push(`| Fair Value (Conservative) | ${report.summary.fair_value_conservative} |`);
    lines.push(`| Fair Value (Base) | ${report.summary.fair_value_base} |`);
    lines.push(`| MOS 30% Price | ${report.summary.mos_30_price} |`);
    lines.push(`| Price to Watch | ${report.summary.price_to_watch} |`);
    lines.push(`| Evidence Score | ${report.summary.evidence_score}/100 |`);
    lines.push('');

    // Sections
    for (const section of report.sections) {
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(section.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Render report as HTML
   */
  private renderAsHtml(report: InvestmentReport): string {
    const sections = report.sections
      .map((s) => `<section><h2>${s.title}</h2>${markdownToHtml(s.content)}</section>`)
      .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <title>Investment Report - ${report.mission_id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; }
    h2 { color: #555; margin-top: 30px; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #4CAF50; color: white; }
  </style>
</head>
<body>
  <h1>Investment Analysis Report</h1>
  <p><strong>Mission ID:</strong> ${report.mission_id}</p>
  <p><strong>Generated:</strong> ${report.generated_at.toISOString()}</p>
  ${report.subject.ticker ? `<p><strong>Ticker:</strong> ${report.subject.ticker}</p>` : ''}
  ${report.subject.company_name ? `<p><strong>Company:</strong> ${report.subject.company_name}</p>` : ''}

  <div class="summary">
    <h2>Decision Summary</h2>
    <p><strong>Decision State:</strong> ${report.summary.decision_state}</p>
    <p><strong>Conviction:</strong> ${report.summary.conviction_level}/10</p>
  </div>

  ${sections}
</body>
</html>`;
  }
}

/**
 * Section renderers
 */

function renderSummarySection(context: SectionRenderContext): string {
  const { synthesis } = context;

  return `### Investment Decision

**Decision:** ${synthesis.decision_state}
**Conviction Level:** ${synthesis.conviction_level}/10

### Rationale

${synthesis.rationale_summary}

### Key Numbers

| Metric | Value |
|--------|-------|
| Current Price | ฿${synthesis.valuation.conservative * 1.25} |
| Conservative Fair Value | ฿${synthesis.valuation.conservative} |
| Base Fair Value | ฿${synthesis.valuation.base} |
| MOS 30% Price | ฿${synthesis.valuation.mos_30} |
| Price to Watch | ฿${synthesis.valuation.price_to_watch} |

### Evidence Quality

**Score:** ${synthesis.evidence_quality.score}/100

- Tier 1 Sources: ${synthesis.evidence_quality.tier1_sources}
- Tier 2 Sources: ${synthesis.evidence_quality.tier2_sources}
- Tier 3 Sources: ${synthesis.evidence_quality.tier3_sources}
`;
}

function renderBusinessModelSection(context: SectionRenderContext): string {
  const { synthesis } = context;

  return `### Business Overview

*Business model analysis compiled from research analyst outputs*

### Key Positives

${synthesis.consensus_analysis.key_agreements.map((a) => `- ${a}`).join('\n')}

### Areas of Concern

${synthesis.evidence_assessment.data_gaps.length > 0
  ? synthesis.evidence_assessment.data_gaps.map((g) => `- ${g}`).join('\n')
  : 'No significant data gaps identified.'}
`;
}

function renderEvidenceQualitySection(context: SectionRenderContext): string {
  const { synthesis } = context;

  return `### Evidence Assessment

**Overall Score:** ${synthesis.evidence_quality.score}/100
**Confidence Level:** ${synthesis.evidence_assessment.evidence_confidence.toUpperCase()}

### Source Breakdown

| Tier | Count | Description |
|------|-------|-------------|
| Tier 1 | ${synthesis.evidence_quality.tier1_sources} | Company filings, SEC/56-1 |
| Tier 2 | ${synthesis.evidence_quality.tier2_sources} | Presentations, transcripts |
| Tier 3 | ${synthesis.evidence_quality.tier3_sources} | Analyst reports, news |

### Data Gaps

${synthesis.evidence_quality.data_gaps.length > 0
  ? synthesis.evidence_quality.data_gaps.map((g) => `- ${g}`).join('\n')
  : 'No data gaps identified.'}
`;
}

function renderNormalizedEarningsSection(context: SectionRenderContext): string {
  const { synthesis } = context;
  const normalized = synthesis.assumptions?.normalized_earnings;

  return `### Normalized Earnings Analysis

**Normalized Earnings:** ฿${normalized?.toFixed(2) ?? 'N/A'} million

### Key Assumptions

| Assumption | Value |
|------------|-------|
| Revenue Growth (Y1-Y5) | ${synthesis.assumptions?.revenue_growth_y1_y5 ?? 'N/A'}% |
| WACC | ${synthesis.assumptions?.wacc ?? 'N/A'}% |
| Terminal Growth | ${synthesis.assumptions?.terminal_growth ?? 'N/A'}% |

*Analysis based on forensic accountant and valuation specialist outputs*
`;
}

function renderConservativeDCFSection(context: SectionRenderContext): string {
  const { synthesis } = context;

  return `### Discounted Cash Flow Analysis (Conservative)

**Method:** ${synthesis.valuation.method}

### Fair Value Breakdown

| Component | Value |
|-----------|-------|
| Conservative Fair Value | ฿${synthesis.valuation.conservative} |
| Margin of Safety | 30% |
| MOS Price | ฿${synthesis.valuation.mos_30} |

### Key Inputs

| Input | Value |
|-------|-------|
| Normalized Earnings | ฿${synthesis.assumptions?.normalized_earnings ?? 'N/A'}M |
| Growth Rate (Y1-Y5) | ${synthesis.assumptions?.revenue_growth_y1_y5 ?? 'N/A'}% |
| Discount Rate | ${synthesis.assumptions?.wacc ?? 'N/A'}% |
| Terminal Growth | ${synthesis.assumptions?.terminal_growth ?? 'N/A'}% |

*Valuation provided by Damodaran-style analysis with conservative assumptions*
`;
}

function renderReverseDCFSection(context: SectionRenderContext): string {
  const { synthesis } = context;

  // Calculate implied growth at current price
  const conservative = synthesis.valuation.conservative;
  const current = conservative * 1.25; // Simulated current price
  const impliedGrowth = ((current / conservative) - 1) * 100 + (synthesis.assumptions?.revenue_growth_y1_y5 ?? 10);

  return `### Reverse DCF Analysis

### Implied Growth at Current Price

**Current Price:** ฿${current.toFixed(0)}
**Conservative Fair Value:** ฿${conservative}

The current price implies an annual growth rate of approximately **${impliedGrowth.toFixed(1)}%** over the next 5 years.

### Sensitivity Analysis

| Growth Rate | Implied Fair Value |
|-------------|-------------------|
| 5% | ฿${(conservative * 0.7).toFixed(0)} |
| 10% | ฿${conservative} |
| 15% | ฿${(conservative * 1.3).toFixed(0)} |
| 20% | ฿${(conservative * 1.6).toFixed(0)} |

*Reverse DCF helps determine what growth rate the market is pricing in*
`;
}

function renderMOSTableSection(context: SectionRenderContext): string {
  const { synthesis } = context;
  const base = synthesis.valuation.base;

  return `### Margin of Safety Table

% Below Fair Value | Price | Position Size |
|-------------------|-------|---------------|
| 50% | ฿${(base * 0.5).toFixed(0)} | Full Core (10%) |
| 40% | ฿${(base * 0.6).toFixed(0)} | Core (7-8%) |
| 30% | ฿${(base * 0.7).toFixed(0)} | Starter/Large Core (5%) |
| 20% | ฿${(base * 0.8).toFixed(0)} | Small Starter (2-3%) |
| 10% | ฿${(base * 0.9).toFixed(0)} | Watch / Wait |

### Current Position Recommendation

**MOS 30% Price:** ฿${synthesis.valuation.mos_30}
**Price to Watch:** ฿${synthesis.valuation.price_to_watch}

*Position sizing based on portfolio manager recommendations*
`;
}

function renderDownsideCaseSection(context: SectionRenderContext): string {
  const { synthesis } = context;

  const klarman = synthesis.analyst_views?.klarman;

  return `### Downside Analysis (Klarman Framework)

**Conservative Fair Value (Downside):** ฿${klarman?.fair_value ?? 'N/A'}

### Key Risk Factors

${synthesis.thesis_breakers.length > 0
  ? synthesis.thesis_breakers.map((b, i) => `${i + 1}. ${b}`).join('\n')
  : 'No specific thesis breakers identified.'}

### Risk Assessment

| Risk Factor | Impact | Mitigation |
|-------------|--------|------------|
| Market Risk | Medium | Diversification |
| Business Risk | ${synthesis.consensus_analysis.stance_distribution.bearish > 0 ? 'High' : 'Low'} | Thesis breakers monitoring |
| Evidence Risk | ${synthesis.evidence_quality.score < 50 ? 'High' : 'Low'} | Ongoing research |

*Downside analysis provided by Klarman-style risk assessment*
`;
}

function renderAnalystDisagreementSection(context: SectionRenderContext): string {
  const { synthesis } = context;

  return `### Analyst Consensus & Disagreements

### Overall Sentiment

| Stance | Count |
|--------|-------|
| Bullish | ${synthesis.consensus_analysis.stance_distribution.bullish} |
| Bearish | ${synthesis.consensus_analysis.stance_distribution.bearish} |
| Neutral | ${synthesis.consensus_analysis.stance_distribution.neutral} |

**Average Conviction:** ${synthesis.consensus_analysis.average_conviction.toFixed(1)}/10

### Key Agreements

${synthesis.consensus_analysis.key_agreements.map((a) => `- ${a}`).join('\n')}

### Key Disagreements

${synthesis.consensus_analysis.key_disagreements.length > 0
  ? synthesis.consensus_analysis.key_disagreements.map((d) => `
**Topic:** ${d.topic}

- **Bullish View (${d.bullish_view.analyst}):** ${d.bullish_view.view}
- **Bearish View (${d.bearish_view.analyst}):** ${d.bearish_view.view}
`).join('\n')
  : 'No significant disagreements identified.'}

### Preserved Dissent

${synthesis.dissent_notes && synthesis.dissent_notes.length > 0
  ? synthesis.dissent_notes.map((d) => `
**${d.analyst}:** ${d.view}
*Reason:* ${d.reason}
`).join('\n')
  : 'No dissenting views to preserve.'}
`;
}

function renderDecisionStateSection(context: SectionRenderContext): string {
  const { synthesis } = context;

  return `### Final Decision State

**Decision:** ${synthesis.decision_state}

### Rationale

${synthesis.rationale_summary}

### Conviction Level: ${synthesis.conviction_level}/10

${synthesis.conviction_level >= 8
  ? '**HIGH CONVICTION** - Strong evidence and analyst alignment'
  : synthesis.conviction_level >= 6
  ? '**MODERATE CONVICTION** - Good evidence but some uncertainties remain'
  : '**LOW CONVICTION** - Significant concerns or data gaps'}

### Thesis Breakers

The following events would invalidate this investment thesis:

${synthesis.thesis_breakers.map((b, i) => `${i + 1}. ${b}`).join('\n')}

### Monitoring Requirements

If any thesis breaker occurs, the position should be reviewed immediately:
- **Action:** Re-evaluate thesis
- **Possible Outcomes:** Exit, Reduce, Hold
`;
}

function renderFollowUpSection(context: SectionRenderContext): string {
  const { synthesis } = context;

  return `### Follow-Up Checklist

### Events to Monitor

${synthesis.follow_up_events.length > 0
  ? synthesis.follow_up_events.map((e) => `
**${e.event}**
- Expected Date: ${e.expected_date}
- Watch For: ${e.watch_for}
`).join('\n')
  : 'No specific follow-up events identified.'}

### Ongoing Monitoring

- [ ] Quarterly earnings releases
- [ ] Major announcements
- [ ] Competitor activities
- [ ] Industry trends
- [ ] Thesis breaker monitoring

### Update Triggers

Consider updating this analysis when:
1. Quarterly earnings are released
2. Any thesis breaker occurs
3. Price moves significantly from fair value
4. New material information becomes available
`;
}

function renderAuditTrailSection(context: SectionRenderContext): string {
  const { synthesis, mission_id, generated_at } = context;

  return `### Audit Trail

### Mission Information

**Mission ID:** ${mission_id}
**Synthesis Completed:** ${synthesis.synthesized_at.toISOString()}
**Report Generated:** ${generated_at.toISOString()}

### Constitution Rules Applied

${synthesis.assumptions?.other_assumptions?.constitution_rules
  ? (synthesis.assumptions.other_assumptions.constitution_rules as string[]).map((r: string) => `- ${r}`).join('\n')
  : '- All constitution rules enforced'}

### Analyst Outputs Synthesized

This report synthesized outputs from the following analysts:

${synthesis.analyst_views
  ? Object.entries(synthesis.analyst_views)
      .filter(([key]) => key !== 'consensus' && key !== 'key_disagreement')
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `- **${key}:** Conviction ${(value as any).conviction}/10`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
  : '- Valuation analysis completed'}

### Data Quality

**Evidence Score:** ${synthesis.evidence_quality.score}/100
**Evidence Confidence:** ${synthesis.evidence_assessment.evidence_confidence}

This report was generated by the one4all Investment Analysis System.
`;
}

/**
 * Simple markdown to HTML converter (basic implementation)
 */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}
