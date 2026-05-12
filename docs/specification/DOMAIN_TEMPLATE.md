# Domain Template

**Version:** 1.0
**Date:** 2026-05-12
**Status:** Approved

---

## 1. Purpose

This document provides the template structure for creating new domains in one4all. A domain is a specialized area of operation with its own:
- Company Constitution
- Agent roster
- Skill library
- Mission types
- Output standards

### Domains Are the "Companies"

Each domain is like a separate "company" that runs on the same Company Kernel:
- `investment-war-room` — Investment analysis (first domain)
- `research-studio` — Research project management (future)
- `business-advisor` — Strategic business decisions (future)
- `{your-domain}` — Whatever you need

---

## 2. Domain Folder Structure

```
domains/
├── investment-war-room/          # Example: First domain
│   ├── domain.yaml               # Domain configuration
│   ├── constitution.yaml         # Domain-specific constitution rules
│   ├── agents/                   # Agent definitions
│   │   ├── researcher-set.yaml
│   │   ├── forensic-accountant.yaml
│   │   └── ...
│   ├── skills/                   # Skill definitions
│   │   ├── normalized-earnings.yaml
│   │   └── ...
│   ├── missions/                 # Mission templates
│   │   ├── stock-analysis.yaml
│   │   └── portfolio-review.yaml
│   ├── personas/                 # Agent persona files (markdown)
│   │   ├── damodaran.md
│   │   └── ...
│   └── output-templates/         # Report templates
│       └── full-investment-report.md
│
└── _template/                    # Use this to create new domains
    ├── domain.yaml
    ├── constitution.yaml
    ├── README.md
    └── agents/
        └── _template.yaml
```

---

## 3. Domain Configuration (domain.yaml)

### 3.1 Template

```yaml
# domains/{new-domain}/domain.yaml

id: {new-domain-id}
name: "{Human-Readable Domain Name}"
version: "1.0"
description: "What this domain does"

# === COMPANY CONSTITUTION ===
constitution:
  rules_file: constitution.yaml
  # All rules for this domain live here

# === DEFAULT TEAM ===
# Used when mission doesn't specify agents
default_team:
  researcher: {researcher-agent-id}
  analysts: [{analyst-ids}]
  synthesizer: {synthesizer-agent-id}
  always_include: [{optional-agents}]

# === MISSION TYPES ===
mission_types:
  - id: {mission-type-id}
    template: missions/{mission-template}.yaml
    default_agents: [{agent-list}]

  - id: {another-mission-type}
    template: missions/{template}.yaml
    default_agents: [{agent-list}]

# === MARKETS / CONTEXTS ===
# What markets or contexts this domain supports
markets: [{market-list}]
  # Examples: thai-set, us-nyse, global, etc.

# === OUTPUT STANDARDS ===
output:
  mandatory_report_sections:
    - {section-1}
    - {section-2}

  mandatory_fields:
    - {field-name-1}
    - {field-name-2}

  forbidden_content:
    - {phrase-1}
    - {phrase-2}

# === HUMAN CHECKPOINTS ===
human_checkpoints:
  after_research: always | conditional | never
  after_synthesis: always | conditional | never
  on_low_evidence: always

# === JOURNAL REQUIREMENTS ===
journal:
  required: true | false
  template: journal/{domain}-journal.yaml

# === EVIDENCE REQUIREMENTS ===
evidence:
  minimum_sources:
    - tier: tier_1
      count: 3

  required_documents: [{doc-list}]

# === CONTEXT BUDGET ===
context_budget:
  default_limit: 100000           # tokens
  compression_threshold: 0.8      # compress if 80% used
```

### 3.2 Example (Investment War Room)

```yaml
id: investment-war-room
name: "Investment War Room"
version: "1.0"
description: "Investment analysis and decision making for Thai and US markets"

constitution:
  rules_file: constitution.yaml

default_team:
  researcher: researcher-set
  analysts: [forensic-accountant, damodaran-valuation, klarman-downside]
  synthesizer: cio-synthesizer
  always_include: [pro-investor]

mission_types:
  - id: stock_analysis
    template: missions/stock-analysis.yaml
    default_agents: [researcher-set, forensic-accountant,
                     damodaran-valuation, klarman-downside,
                     portfolio-allocator, cio-synthesizer]

  - id: portfolio_review
    template: missions/portfolio-review.yaml
    default_agents: [portfolio-allocator, cio-synthesizer]

  - id: quick_screen
    template: missions/quick-screen.yaml
    default_agents: [researcher-set, damodaran-valuation]

markets: [thai-set, us-nyse, us-nasdaq]

output:
  mandatory_report_sections:
    - decision_summary
    - evidence_quality
    - normalized_earnings
    - valuation
    - downside_case
    - decision_state
    - price_to_watch
    - thesis_breakers
    - follow_up_checklist

  mandatory_fields:
    - decision_state
    - fair_value_conservative
    - price_to_watch
    - thesis_breakers

  forbidden_content:
    - "buy"
    - "sell"
    - "strong buy"
    - "strong sell"

human_checkpoints:
  after_research: always
  after_synthesis: always
  on_low_evidence: always

journal:
  required: true
  template: journal/investment-journal.yaml

evidence:
  minimum_sources:
    - tier: tier_1
      count: 3

  required_documents:
    - 56-1-one-report
    - latest-quarterly-filing

context_budget:
  default_limit: 100000
  compression_threshold: 0.8
```

---

## 4. Constitution Template (constitution.yaml)

```yaml
# domains/{new-domain}/constitution.yaml

domain: {new-domain-id}
version: "1.0"

rules:
  # === EVIDENCE RULES ===
  - id: evidence_required_for_analysis
    description: "Every analysis must be based on verified evidence"
    enforcement: BLOCK_MISSION
    applies_to: all_agents
    exception: none

  - id: data_gaps_must_surface
    description: "Critical data gaps must be disclosed"
    enforcement: INSERT_HUMAN_REVIEW
    applies_to: researcher_agents

  # === OUTPUT RULES ===
  - id: no_forbidden_content
    description: "Output must not contain forbidden phrases"
    enforcement: REJECT_OUTPUT
    applies_to: all_agents
    forbidden_content:
      - "{phrase-1}"
      - "{phrase-2}"

  # === DOMAIN-SPECIFIC RULES ===
  - id: {rule-id}
    description: "{what this enforces}"
    enforcement: {enforcement_level}
    applies_to: {agents}
    validation:
      - "{criterion-1}"
      - "{criterion-2}"
```

---

## 5. Agent Creation Guidelines

### 5.1 Agent Card Template

```yaml
# domains/{new-domain}/agents/{agent-id}.yaml

id: {agent-id}
name: "{Human-Readable Name}"
version: "1.0"
domain: {domain-id}
active: true

# === ROLE ===
role: {role-type}
description: "{What this agent does}"

# === MODEL SELECTION ===
model:
  primary:
    provider: {claude | gemini | zai | codex}
    model: {model-id}
  fallback:
    - provider: {provider}
      model: {model-id}

# === IDENTITY ===
identity:
  persona_file: personas/{agent-id}.md
  worldview:
    - "{belief-1}"
    - "{belief-2}"
  cognitive_bias_awareness:
    - "{bias-to-watch}"

# === CAPABILITIES ===
skills:
  - {skill-id-1}
  - {skill-id-2}

# === REQUIREMENTS ===
requires:
  - {required-input-1}
  - {required-input-2}

# === INTERACTION RULES ===
interaction_rules:
  can_question:
    - {agent-id-1}
    - {agent-id-2}
  must_challenge:
    - {assumption-type-1}
  cannot_question:
    - {agent-id}

# === OUTPUT CONTRACT ===
output_contract:
  schema_file: schemas/{agent-output}.schema.yaml
  mandatory_fields:
    - {field-1}
    - {field-2}
  forbidden_content:
    - {phrase-1}
    - {phrase-2}

# === PERFORMANCE ===
timeout_seconds: {timeout}
max_tokens: {max-output}
context_budget_override: {tokens | null}
```

### 5.2 Persona Template (Markdown)

```markdown
# {Agent Name} Persona

## Role
{What role this agent plays in the domain}

## Identity
You are {persona description}. Your expertise is in {area}.

## Core Beliefs
1. {Belief 1}
2. {Belief 2}
3. {Belief 3}

## How You Work
- {Working style 1}
- {Working style 2}

## What You Care About
- {Priority 1}
- {Priority 2}

## What You Ignore
- {Things outside your scope}

## Cognitive Biases to Watch
- {Bias you're prone to}
- {How you compensate}

## Output Format
Your output must follow the schema: {schema-reference}
```

---

## 6. Skill Creation Guidelines

### 6.1 Skill Card Template

```yaml
# domains/{new-domain}/skills/{skill-id}.yaml

id: {skill-id}
name: "{Skill Name}"
version: "1.0"
domain: {domain-id}

description: |
  {Detailed description of what this skill does}
  {What problems it solves}
  {When to use it}

skill_file: skills/{skill-id}.md

applicable_to:
  - {agent-id-1}
  - {agent-id-2}

input_requirements:
  required:
    - {input-1}
    - {input-2}
  preferred:
    - {input-3}

output_schema:
  {output-field-1}: {type}
  {output-field-2}: {type}

rules:
  - "{rule-1}"
  - "{rule-2}"

validation:
  - "{validation-criterion-1}"
  - "{validation-criterion-2}"
```

### 6.2 Skill Content Template (Markdown)

```markdown
# {Skill Name}

## Purpose
{What this skill does}

## When to Use
{Use case description}

## Instructions
{Step-by-step instructions for the agent}

## Output Requirements
{What the output must contain}

## Examples
{Example inputs and outputs}
```

---

## 7. Mission Template

```yaml
# domains/{new-domain}/missions/{mission-type}.yaml

id: {mission-type-id}
name: "{Mission Type Name}"
domain: {domain-id}

description: "{What this mission type does}"

# === REQUIRED INPUTS ===
required_inputs:
  - name: {input-name-1}
    type: {string | number | object}
    required: true
  - name: {input-name-2}
    type: {type}
    required: false

# === DEFAULT AGENTS ===
default_agents:
  - {agent-id-1}
  - {agent-id-2}

# === EXECUTION PLAN ===
execution_plan:
  sequential:
    - {agent-id-1}
  parallel:
    - {agent-id-2}
    - {agent-id-3}
  sequential:
    - {agent-id-4}

# === EVIDENCE REQUIREMENTS ===
evidence_requirements:
  minimum_sources:
    - tier: tier_1
      count: {number}

  required_documents:
    - {doc-type-1}

# === OUTPUT REQUIREMENTS ===
output_requirements:
  mandatory_fields:
    - {field-1}
    - {field-2}

  report_template: output-templates/{template}.md

# === HUMAN CHECKPOINTS ===
human_checkpoints:
  - after: {state}
    condition: always | conditional
    trigger: "{when to trigger}"
```

---

## 8. Creating a New Domain

### 8.1 Step-by-Step Process

```
1. COPY THE TEMPLATE
   cp -r domains/_template domains/{new-domain}

2. EDIT DOMAIN.YAML
   - Set id, name, description
   - Define default team
   - List mission types

3. CREATE CONSTITUTION
   - Copy and adapt constitution.yaml
   - Define domain-specific rules

4. CREATE AGENTS
   - For each agent: create agent card
   - For each agent: create persona file
   - Define output schemas

5. CREATE SKILLS
   - For each skill: create skill card
   - For each skill: create skill content

6. CREATE MISSIONS
   - Define mission types
   - Create execution plans

7. CREATE OUTPUT TEMPLATES
   - Define report formats
   - Specify mandatory sections

8. TEST WITH MOCK ADAPTERS
   - Run test mission
   - Verify agent interactions
   - Check output formats

9. DEPLOY
   - Domain is ready to use
```

### 8.2 What Doesn't Change

When creating a new domain, you DON'T modify:
- `kernel/` — Company Kernel is domain-agnostic
- `adapters/` — Runtime adapters work for any domain
- `observability/` — Logging is universal
- `registry/models.yaml` — Can add models, but structure stays same

You ONLY modify:
- `domains/{new-domain}/` — Your domain's configuration

---

## 9. Domain Checklist

Use this checklist when creating a new domain:

### Configuration
- [ ] domain.yaml created and valid
- [ ] constitution.yaml created
- [ ] Default team defined
- [ ] Mission types defined
- [ ] Markets/contexts defined

### Agents
- [ ] All agent cards created
- [ ] All persona files created
- [ ] Output schemas defined
- [ ] Interaction rules specified
- [ ] Model selection configured

### Skills
- [ ] All skill cards created
- [ ] All skill content files created
- [ ] Applicability defined
- [ ] Validation rules specified

### Missions
- [ ] All mission templates created
- [ ] Execution plans defined
- [ ] Evidence requirements specified
- [ ] Output requirements defined

### Output
- [ ] Report templates created
- [ ] Mandatory fields defined
- [ ] Journal template (if required)

### Testing
- [ ] Test mission runs successfully
- [ ] All agent outputs valid
- [ ] Constitution rules enforced
- [ ] Journal entries created correctly

---

## 10. Example: Creating a Research Studio Domain

```yaml
# domains/research-studio/domain.yaml

id: research-studio
name: "Research Studio"
version: "1.0"
description: "Academic and professional research project management"

constitution:
  rules_file: constitution.yaml

default_team:
  researcher: literature-reviewer
  analysts: [methodology-advisor, data-analyst, peer-reviewer]
  synthesizer: research-director

mission_types:
  - id: literature_review
    template: missions/literature-review.yaml
    default_agents: [literature-reviewer, research-director]

  - id: research_design
    template: missions/research-design.yaml
    default_agents: [methodology-advisor, peer-reviewer, research-director]

  - id: data_analysis
    template: missions/data-analysis.yaml
    default_agents: [data-analyst, peer-reviewer, research-director]

markets: [academic, corporate, personal]

output:
  mandatory_report_sections:
    - research_question
    - methodology
    - findings
    - limitations
    - recommendations

  mandatory_fields:
    - research_question
    - methodology
    - confidence_level

journal:
  required: true
  template: journal/research-journal.yaml

evidence:
  minimum_sources:
    - tier: tier_1
      count: 5  # Peer-reviewed sources

  required_documents:
    - literature_review
```
