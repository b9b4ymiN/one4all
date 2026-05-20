import { z } from "zod";

/**
 * Universal Agent Fields
 * All agent outputs must include these fields
 */
export const UniversalAgentFieldsSchema = z.object({
  agent_id: z.string(),
  mission_id: z.string(),
  timestamp: z.string().datetime(),
  conviction_level: z.number().min(1).max(10),
  what_would_change_my_mind: z.array(z.string()),
  data_gaps_found: z.array(z.string()),
});

/**
 * 2.1 Researcher Set (researcher-set)
 */
export const ResearcherOutputSchema = UniversalAgentFieldsSchema.extend({
  agent_id: z.literal("researcher-set"),
  evidence_pack: z.object({
    metadata: z.object({
      sources_found: z.number(),
      tier1_sources: z.number(),
      tier2_sources: z.number(),
      evidence_score: z.number().min(0).max(100),
    }),
    source_log: z.array(
      z.object({
        source_name: z.string(),
        source_tier: z.enum(["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"]),
        url: z.string().url().optional(),
        filed_date: z.string().optional(),
        label: z.enum(["FACT", "MANAGEMENT_CLAIM", "UNVERIFIED"]),
      })
    ),
    financial_statements: z.object({
      income_statement: z.object({
        revenue: z.number(),
        cost_of_goods_sold: z.number(),
        gross_profit: z.number(),
        operating_income: z.number(),
        net_income: z.number(),
        eps: z.number(),
        labels: z.literal("FACT"),
        source: z.string(),
      }),
      balance_sheet: z.object({
        total_assets: z.number(),
        total_liabilities: z.number(),
        shareholders_equity: z.number(),
        labels: z.literal("FACT"),
        source: z.string(),
      }),
      cashflow_statement: z.object({
        operating_cashflow: z.number(),
        investing_cashflow: z.number(),
        financing_cashflow: z.number(),
        labels: z.literal("FACT"),
        source: z.string(),
      }),
    }),
    business_context: z.object({
      business_model: z.string(),
      segments: z.array(
        z.object({ name: z.string(), revenue: z.number(), margin: z.number() })
      ),
      risk_factors: z.array(z.string()),
    }),
    management_communication: z.object({
      guidance: z.string().optional(),
      strategy: z.string().optional(),
      labels: z.literal("MANAGEMENT_CLAIM"),
    }),
  }),
  data_gaps: z.array(
    z.object({
      requested_field: z.string(),
      not_found_in: z.array(z.string()),
      impact: z.string(),
      suggested_alternative: z.string().optional(),
    })
  ),
});

/**
 * 2.2 Forensic Accountant (forensic-accountant)
 */
export const ForensicOutputSchema = UniversalAgentFieldsSchema.extend({
  agent_id: z.literal("forensic-accountant"),
  normalized_earnings: z.object({
    reported_net_income: z.number(),
    one_off_items: z.array(
      z.object({
        item: z.string(),
        amount: z.number(),
        label: z.literal("ONE_OFF"),
        reason: z.string(),
        source: z.string(),
      })
    ),
    normalized_net_income: z.number(),
    adjustment_amount: z.number(),
  }),
  earnings_quality: z.object({
    operating_cashflow: z.number(),
    ocf_to_ni_ratio: z.number(),
    quality_rating: z.enum(["high", "medium", "low", "negative"]),
    flags: z.array(z.string()),
  }).refine((data) => {
    // If OCF < 70% of NI, quality_rating MUST be "low" or "negative"
    if (data.operating_cashflow < 0.7 * (data.ocf_to_ni_ratio !== 0 ? data.operating_cashflow / data.ocf_to_ni_ratio : 0)) {
        return ["low", "negative"].includes(data.quality_rating);
    }
    return true;
  }, {
    message: "If OCF < 70% of NI, quality_rating MUST be 'low' or 'negative'",
    path: ["quality_rating"],
  }),
  confidence: z.enum(["high", "medium", "low"]),
  confidence_reasoning: z.string(),
  key_findings: z.array(z.string()),
});

/**
 * 2.3 Damodaran Valuation (damodaran-valuation)
 */
export const DamodaranOutputSchema = UniversalAgentFieldsSchema.extend({
  agent_id: z.literal("damodaran-valuation"),
  dcf_inputs: z.object({
    base_revenue: z.number(),
    revenue_growth_y1_y5: z.number(),
    revenue_growth_y6_y10: z.number(),
    terminal_growth: z.number(),
    operating_margin_target: z.number(),
    wacc: z.number().min(0.05).max(0.15),
    tax_rate: z.number(),
  }),
  dcf_results: z.object({
    fair_value_conservative: z.number(),
    fair_value_base: z.number(),
    fair_value_optimistic: z.number(),
    per_share_values: z.object({
      conservative: z.number(),
      base: z.number(),
      optimistic: z.number(),
    }),
  }),
  reverse_dcf: z.object({
    current_price: z.number(),
    implied_growth_at_current_price: z.number(),
    market_implied_wacc: z.number(),
  }),
  sensitivity: z.object({
    parameter: z.string(),
    scenarios: z.array(
      z.object({
        scenario: z.string(),
        value: z.number(),
        fair_value: z.number(),
      })
    ),
  }),
  key_assumptions: z.array(
    z.object({
      assumption: z.string(),
      value: z.union([z.number(), z.string()]),
      label: z.enum(["FACT", "DERIVED", "ASSUMPTION"]),
      source: z.string().optional(),
    })
  ),
}).refine((data) => {
    // Terminal growth MUST be ≤ risk-free rate (assumed 4% or handled by comparison if provided)
    // For now, just ensuring it's reasonable. In real app, risk_free_rate would be input.
    return data.dcf_inputs.terminal_growth <= 0.05; // 5% cap as proxy
}, {
    message: "Terminal growth MUST be ≤ risk-free rate",
    path: ["dcf_inputs", "terminal_growth"],
});

/**
 * 2.4 Seth Klarman (seth-klarman)
 */
export const KlarmanOutputSchema = UniversalAgentFieldsSchema.extend({
  agent_id: z.literal("seth-klarman"),
  downside_scenarios: z.array(
    z.object({
      scenario: z.enum(["base", "stress", "distress"]),
      description: z.string(),
      probability: z.number().min(0).max(1),
      normalized_earnings: z.number(),
      fair_value: z.number(),
      mos_percentage: z.number(),
    })
  ).min(2),
  margin_of_safety: z.object({
    current_price: z.number(),
    conservative_fair_value: z.number(),
    mos_30_price: z.number(),
    mos_50_price: z.number(),
    current_mos: z.number(),
  }),
  key_risks: z.array(
    z.object({
      risk: z.string(),
      severity: z.enum(["high", "medium", "low"]),
      probability: z.enum(["high", "medium", "low"]),
      mitigation: z.string().optional(),
    })
  ),
  balance_sheet_health: z.object({
    debt_to_equity: z.number(),
    current_ratio: z.number(),
    interest_coverage: z.number(),
    health_rating: z.enum(["strong", "adequate", "weak", "distressed"]),
  }),
});

/**
 * 2.5 Portfolio Allocator (portfolio-allocator)
 */
export const PortfolioOutputSchema = UniversalAgentFieldsSchema.extend({
  agent_id: z.literal("portfolio-allocator"),
  position_sizing: z.object({
    recommended_max_position: z.number(),
    starter_position: z.number(),
    full_position: z.number(),
    sizing_methodology: z.string(),
  }),
  portfolio_fit: z.object({
    current_exposure: z.number(),
    sector_overlap: z.array(z.string()),
    correlation_risk: z.array(z.string()),
    diversification_benefit: z.string(),
  }),
  risk_return: z.object({
    expected_return: z.number(),
    risk_level: z.enum(["low", "medium", "high"]),
    sharpe_estimate: z.number(),
    max_drawdown_estimate: z.number(),
  }),
  entry_strategy: z.object({
    initial_entry: z.number(),
    add_on_weakness: z.number(),
    stop_loss: z.number().optional(),
  }),
});

/**
 * 2.6 Pro-Investor (pro-investor)
 */
export const ProInvestorOutputSchema = UniversalAgentFieldsSchema.extend({
  agent_id: z.literal("pro-investor"),
  checklist_results: z.array(
    z.object({
      rule: z.string(),
      passed: z.boolean(),
      reasoning: z.string(),
    })
  ),
  framework_alignment: z.object({
    passes_framework: z.boolean(),
    failed_rules: z.array(z.string()),
    caveats: z.array(z.string()),
  }),
  personal_context: z.object({
    current_portfolio_fit: z.string(),
    liquidity_needs: z.string(),
    time_horizon: z.string(),
    risk_tolerance: z.string(),
  }),
});

/**
 * 2.7 CIO Synthesizer (cio-synthesizer)
 */
export const DecisionStateSchema = z.enum([
  "REJECT",
  "WATCH",
  "RESEARCH_MORE",
  "WAIT_FOR_PRICE",
  "STARTER_POSITION",
  "CORE_CANDIDATE",
  "ADD_ON_WEAKNESS",
  "HOLD",
  "TRIM",
  "EXIT_THESIS_BROKEN",
]);

export const CIOOutputSchema = z.object({
  agent_id: z.literal("cio-synthesizer"),
  mission_id: z.string(),
  timestamp: z.string().datetime(),
  decision: z.object({
    decision_state: DecisionStateSchema,
    decision_date: z.string().datetime(),
    rationale_summary: z.string(),
  }),
  valuation: z.object({
    fair_value_conservative: z.number(),
    fair_value_base: z.number(),
    price_for_mos_30: z.number(),
    current_price: z.number(),
    price_to_watch: z.number(),
  }),
  analyst_views: z.object({
    damodaran: z.object({ fair_value: z.number(), conviction: z.number(), view: z.string() }),
    klarman: z.object({ fair_value: z.number(), conviction: z.number(), view: z.string() }),
    portfolio: z.object({ position: z.number(), conviction: z.number(), view: z.string() }),
    consensus: z.string(),
  }),
  agreement_analysis: z.object({
    high_confidence_points: z.array(z.string()),
    disagreement_points: z.array(
      z.object({
        topic: z.string(),
        agents: z.array(z.string()),
        nature_of_disagreement: z.string(),
      })
    ),
  }),
  thesis_breakers: z.array(z.string()).min(1),
  follow_up_events: z.array(
    z.object({
      event: z.string(),
      expected_date: z.string(),
      watch_for: z.string(),
    })
  ),
  evidence_quality: z.object({
    score: z.number(),
    tier1_sources: z.number(),
    data_gaps: z.array(z.string()),
  }),
  what_next: z.object({
    action: z.string(),
    trigger: z.string(),
    timeframe: z.string(),
  }),
});

/**
 * 2.8 Book Master (book-master)
 */
export const BookMasterOutputSchema = z.object({
  agent_id: z.literal("book-master"),
  mission_id: z.string(),
  timestamp: z.string().datetime(),
  report_format: z.enum(["full_investment_report", "executive_summary", "data_sheet"]),
  report: z.object({
    title: z.string(),
    date: z.string(),
    ticker: z.string(),
    sections: z.array(
      z.object({
        heading: z.string(),
        content: z.string(),
        tables: z.array(z.any()).optional(),
        charts: z.array(z.any()).optional(),
      })
    ),
    appendix: z.object({
      data_sources: z.array(z.string()),
      methodology: z.string(),
      assumptions: z.array(z.string()),
    }).optional(),
  }),
});

