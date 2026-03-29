/**
 * Claude Desktop Platform Skills
 *
 * These represent all the skills and cowork abilities available
 * through the Claude desktop app. MO can invoke these to handle
 * user requests across business domains.
 */

import type { TemplateConfig } from './templateConfig';

// ─── Helper to create a Claude skill template ──────────────────────────────

function claudeSkill(
  id: string,
  name: string,
  description: string,
  icon: string,
  tags: string[],
  cat: TemplateConfig['category'] = 'claude',
): TemplateConfig {
  return {
    id,
    name,
    description,
    icon,
    category: cat,
    version: '1.0.0',
    builtIn: true,
    tags,
    teams: [],
    steps: [
      {
        order: 1,
        name: 'Run',
        teamId: 'research',
        agents: ['deep-research'],
        requiresReview: false,
        description,
      },
    ],
    defaults: {},
    inputs: { requiresSourceImages: false, requiresBrand: false },
    outputs: { primary: 'document', formats: ['md'] },
  };
}

// ─── Data & Analytics Skills ────────────────────────────────────────────────

export const claudeDataAnalyze = claudeSkill(
  'claude-data-analyze',
  'Data Analysis',
  'Answer data questions from quick lookups to full analyses. Investigate trends, compare segments, and prepare data reports.',
  'fa-chart-line',
  ['data', 'analytics', 'reporting'],
  'analysis',
);

export const claudeDataExplore = claudeSkill(
  'claude-data-explore',
  'Data Explorer',
  'Profile and explore datasets to understand shape, quality, and patterns. Check null rates, distributions, and data quality issues.',
  'fa-magnifying-glass-chart',
  ['data', 'profiling', 'quality'],
  'analysis',
);

export const claudeDataViz = claudeSkill(
  'claude-data-viz',
  'Data Visualization',
  'Create publication-quality charts and visualizations with Python (matplotlib, seaborn, plotly).',
  'fa-chart-pie',
  ['data', 'charts', 'visualization'],
  'analysis',
);

export const claudeDashboard = claudeSkill(
  'claude-dashboard',
  'Dashboard Builder',
  'Build interactive HTML dashboards with charts, filters, and tables. KPI cards, monitoring snapshots, and shareable reports.',
  'fa-gauge-high',
  ['data', 'dashboard', 'reporting'],
  'analysis',
);

export const claudeSqlQueries = claudeSkill(
  'claude-sql-queries',
  'SQL Query Writer',
  'Write correct, performant SQL across all major data warehouse dialects (Snowflake, BigQuery, Databricks, PostgreSQL).',
  'fa-database',
  ['data', 'sql', 'queries'],
  'analysis',
);

export const claudeStatAnalysis = claudeSkill(
  'claude-stat-analysis',
  'Statistical Analysis',
  'Apply statistical methods including descriptive stats, trend analysis, outlier detection, and hypothesis testing.',
  'fa-square-root-variable',
  ['data', 'statistics', 'analysis'],
  'analysis',
);

export const claudeDataValidate = claudeSkill(
  'claude-data-validate',
  'Data Validation',
  'QA an analysis before sharing: methodology, accuracy, and bias checks.',
  'fa-check-double',
  ['data', 'validation', 'qa'],
  'analysis',
);

// ─── Design Skills ──────────────────────────────────────────────────────────

export const claudeDesignCritique = claudeSkill(
  'claude-design-critique',
  'Design Critique',
  'Get structured design feedback on usability, hierarchy, and consistency from Figma links or screenshots.',
  'fa-pen-ruler',
  ['design', 'ux', 'feedback'],
);

export const claudeAccessibilityReview = claudeSkill(
  'claude-accessibility-review',
  'Accessibility Audit',
  'Run a WCAG 2.1 AA accessibility audit on a design or page. Check color contrast, keyboard nav, touch targets, and screen readers.',
  'fa-universal-access',
  ['design', 'a11y', 'accessibility'],
);

export const claudeUserResearch = claudeSkill(
  'claude-user-research',
  'User Research',
  'Plan, conduct, and synthesize user research. Interview guides, usability tests, survey design, and research questions.',
  'fa-users',
  ['design', 'research', 'ux'],
);

export const claudeResearchSynthesis = claudeSkill(
  'claude-research-synthesis',
  'Research Synthesis',
  'Synthesize user research into themes, insights, and recommendations from transcripts, surveys, and support tickets.',
  'fa-layer-group',
  ['design', 'research', 'insights'],
);

export const claudeUxCopy = claudeSkill(
  'claude-ux-copy',
  'UX Copy',
  'Write or review UX copy: microcopy, error messages, empty states, CTAs, button labels, and confirmation dialogs.',
  'fa-font',
  ['design', 'copy', 'ux'],
);

export const claudeDesignSystem = claudeSkill(
  'claude-design-system',
  'Design System',
  'Audit, document, or extend your design system. Check naming consistency, write component docs, and design new patterns.',
  'fa-swatchbook',
  ['design', 'system', 'components'],
);

export const claudeDesignHandoff = claudeSkill(
  'claude-design-handoff',
  'Design Handoff',
  'Generate developer handoff specs: layout, design tokens, component props, interaction states, responsive breakpoints.',
  'fa-arrow-right-arrow-left',
  ['design', 'handoff', 'specs'],
);

// ─── Marketing Skills ───────────────────────────────────────────────────────

export const claudeContentDraft = claudeSkill(
  'claude-content-draft',
  'Content Drafting',
  'Draft blog posts, social media, email newsletters, landing pages, press releases, and case studies with SEO recommendations.',
  'fa-pen-to-square',
  ['marketing', 'content', 'copywriting'],
  'marketing',
);

export const claudeSeoAudit = claudeSkill(
  'claude-seo-audit',
  'SEO Audit',
  'Run a comprehensive SEO audit: keyword research, on-page analysis, content gaps, technical checks, and competitor comparison.',
  'fa-magnifying-glass',
  ['marketing', 'seo', 'audit'],
  'marketing',
);

export const claudePerformanceReport = claudeSkill(
  'claude-performance-report',
  'Marketing Performance Report',
  'Build marketing performance reports with key metrics, trend analysis, wins and misses, and optimization recommendations.',
  'fa-chart-column',
  ['marketing', 'reporting', 'analytics'],
  'marketing',
);

export const claudeEmailSequence = claudeSkill(
  'claude-email-sequence',
  'Email Sequence Designer',
  'Design multi-email sequences with full copy, timing, branching logic, exit conditions, and performance benchmarks.',
  'fa-envelopes-bulk',
  ['marketing', 'email', 'automation'],
  'marketing',
);

export const claudeCompetitiveBrief = claudeSkill(
  'claude-competitive-brief',
  'Competitive Brief',
  'Research competitors and generate positioning/messaging comparison with content gaps, opportunities, and threats.',
  'fa-binoculars',
  ['marketing', 'competitive', 'research'],
  'marketing',
);

export const claudeBrandReview = claudeSkill(
  'claude-brand-review',
  'Brand Voice Review',
  'Review content against brand voice, style guide, and messaging pillars. Flag deviations with before/after fixes.',
  'fa-spell-check',
  ['marketing', 'brand', 'review'],
  'marketing',
);

export const claudeCampaignPlan = claudeSkill(
  'claude-campaign-plan',
  'Campaign Planner',
  'Generate a full campaign brief with objectives, audience, messaging, channel strategy, content calendar, and success metrics.',
  'fa-bullhorn',
  ['marketing', 'campaign', 'planning'],
  'marketing',
);

// ─── Finance Skills ─────────────────────────────────────────────────────────

export const claudeJournalEntry = claudeSkill(
  'claude-journal-entry',
  'Journal Entry Prep',
  'Prepare journal entries with proper debits, credits, and supporting documentation for month-end close.',
  'fa-book',
  ['finance', 'accounting', 'journal'],
  'finance',
);

export const claudeFinancialStatements = claudeSkill(
  'claude-financial-statements',
  'Financial Statements',
  'Generate income statement, balance sheet, cash flow with period-over-period comparison and variance analysis.',
  'fa-file-invoice-dollar',
  ['finance', 'statements', 'reporting'],
  'finance',
);

export const claudeReconciliation = claudeSkill(
  'claude-reconciliation',
  'Reconciliation',
  'Reconcile accounts by comparing GL balances to subledgers, bank statements, or third-party data.',
  'fa-scale-balanced',
  ['finance', 'reconciliation', 'audit'],
  'finance',
);

export const claudeCloseManagement = claudeSkill(
  'claude-close-management',
  'Close Management',
  'Manage month-end close process with task sequencing, dependencies, and status tracking.',
  'fa-calendar-check',
  ['finance', 'close', 'management'],
  'finance',
);

export const claudeVarianceAnalysis = claudeSkill(
  'claude-variance-analysis',
  'Variance Analysis',
  'Decompose financial variances into drivers with narrative explanations and waterfall analysis.',
  'fa-arrow-trend-up',
  ['finance', 'variance', 'analysis'],
  'finance',
);

export const claudeSoxTesting = claudeSkill(
  'claude-sox-testing',
  'SOX Testing',
  'Generate SOX sample selections, testing workpapers, and control assessments for SOX 404 compliance.',
  'fa-clipboard-check',
  ['finance', 'sox', 'compliance'],
  'finance',
);

// ─── Legal Skills ───────────────────────────────────────────────────────────

export const claudeContractReview = claudeSkill(
  'claude-contract-review',
  'Contract Review',
  'Review contracts against negotiation playbook. Flag deviations, generate redlines, and provide business impact analysis.',
  'fa-file-contract',
  ['legal', 'contracts', 'review'],
  'legal',
);

export const claudeComplianceCheck = claudeSkill(
  'claude-compliance-check',
  'Compliance Check',
  'Run compliance checks on proposed actions, product features, or business initiatives. Surface applicable regulations and risks.',
  'fa-shield-halved',
  ['legal', 'compliance', 'regulatory'],
  'legal',
);

export const claudeNdaTriage = claudeSkill(
  'claude-nda-triage',
  'NDA Triage',
  'Rapidly triage incoming NDAs: classify as GREEN (standard), YELLOW (counsel review), or RED (full legal review).',
  'fa-traffic-light',
  ['legal', 'nda', 'triage'],
  'legal',
);

export const claudeLegalRisk = claudeSkill(
  'claude-legal-risk',
  'Legal Risk Assessment',
  'Assess and classify legal risks using severity-by-likelihood framework with escalation criteria.',
  'fa-triangle-exclamation',
  ['legal', 'risk', 'assessment'],
  'legal',
);

export const claudeVendorCheck = claudeSkill(
  'claude-vendor-check',
  'Vendor Check',
  'Check status of existing vendor agreements across CLM, CRM, email, and document storage with gap analysis.',
  'fa-handshake',
  ['legal', 'vendor', 'contracts'],
  'legal',
);

// ─── HR Skills ──────────────────────────────────────────────────────────────

export const claudeOnboarding = claudeSkill(
  'claude-onboarding',
  'Onboarding Planner',
  'Generate onboarding checklists and first-week plans. Pre-start tasks, Day 1 schedule, and 30/60/90-day goals.',
  'fa-user-plus',
  ['hr', 'onboarding', 'planning'],
  'organisation',
);

export const claudePerformanceReview = claudeSkill(
  'claude-performance-review',
  'Performance Review',
  'Structure performance reviews with self-assessment, manager template, and calibration prep.',
  'fa-star',
  ['hr', 'performance', 'review'],
  'organisation',
);

export const claudeInterviewPrep = claudeSkill(
  'claude-interview-prep',
  'Interview Prep',
  'Create structured interview plans with competency-based questions and scorecards.',
  'fa-comments',
  ['hr', 'interview', 'hiring'],
  'organisation',
);

export const claudeCompAnalysis = claudeSkill(
  'claude-comp-analysis',
  'Compensation Analysis',
  'Analyze compensation: benchmarking, band placement, and equity modeling.',
  'fa-money-bill-trend-up',
  ['hr', 'compensation', 'analysis'],
  'organisation',
);

export const claudePeopleReport = claudeSkill(
  'claude-people-report',
  'People Report',
  'Generate headcount, attrition, diversity, or org health reports.',
  'fa-people-group',
  ['hr', 'reporting', 'analytics'],
  'organisation',
);

// ─── Operations Skills ──────────────────────────────────────────────────────

export const claudeProcessDoc = claudeSkill(
  'claude-process-doc',
  'Process Documentation',
  'Document business processes with flowcharts, RACI matrices, and SOPs.',
  'fa-diagram-project',
  ['operations', 'process', 'documentation'],
  'organisation',
);

export const claudeStatusReport = claudeSkill(
  'claude-status-report',
  'Status Report',
  'Generate status reports with KPIs, risks, and action items for leadership.',
  'fa-clipboard-list',
  ['operations', 'reporting', 'status'],
  'organisation',
);

export const claudeChangeRequest = claudeSkill(
  'claude-change-request',
  'Change Request',
  'Create change management requests with impact analysis and rollback plans.',
  'fa-arrows-rotate',
  ['operations', 'change', 'management'],
  'organisation',
);

export const claudeRiskAssessment = claudeSkill(
  'claude-risk-assessment',
  'Risk Assessment',
  'Identify, assess, and mitigate operational risks using structured risk frameworks.',
  'fa-shield',
  ['operations', 'risk', 'assessment'],
  'organisation',
);

export const claudeRunbook = claudeSkill(
  'claude-runbook',
  'Runbook Creator',
  'Create or update operational runbooks for recurring tasks with step-by-step commands and troubleshooting.',
  'fa-book-open',
  ['operations', 'runbook', 'procedures'],
  'organisation',
);

export const claudeVendorReview = claudeSkill(
  'claude-vendor-review',
  'Vendor Review',
  'Evaluate vendors: cost analysis, risk assessment, TCO breakdown, and negotiation points.',
  'fa-building',
  ['operations', 'vendor', 'evaluation'],
  'organisation',
);

export const claudeCapacityPlan = claudeSkill(
  'claude-capacity-plan',
  'Capacity Planning',
  'Plan resource capacity: workload analysis, utilization forecasting, and hire-vs-deprioritize decisions.',
  'fa-weight-scale',
  ['operations', 'capacity', 'planning'],
  'organisation',
);

// ─── Customer Support Skills ────────────────────────────────────────────────

export const claudeSupportResponse = claudeSkill(
  'claude-support-response',
  'Support Response Drafter',
  'Draft professional customer-facing responses tailored to the situation and relationship.',
  'fa-reply',
  ['support', 'customer', 'response'],
  'communication',
);

export const claudeEscalation = claudeSkill(
  'claude-escalation',
  'Customer Escalation',
  'Package escalations for engineering, product, or leadership with full context.',
  'fa-arrow-up-right-from-square',
  ['support', 'escalation', 'customer'],
  'communication',
);

export const claudeTicketTriage = claudeSkill(
  'claude-ticket-triage',
  'Ticket Triage',
  'Triage and prioritize support tickets. Categorize, assign priority P1-P4, and route to the right team.',
  'fa-inbox',
  ['support', 'triage', 'tickets'],
  'communication',
);

export const claudeKbArticle = claudeSkill(
  'claude-kb-article',
  'KB Article Writer',
  'Draft knowledge base articles from resolved issues or common questions.',
  'fa-book-bookmark',
  ['support', 'knowledge-base', 'documentation'],
  'communication',
);

// ─── Document & Presentation Skills ─────────────────────────────────────────

export const claudePptx = claudeSkill(
  'claude-pptx',
  'Presentation Builder',
  'Create, read, edit, and manipulate PowerPoint (.pptx) presentations. Slide decks, pitch decks, and formatted presentations.',
  'fa-file-powerpoint',
  ['documents', 'presentations', 'pptx'],
  'documents',
);

export const claudeDocx = claudeSkill(
  'claude-docx',
  'Word Document Builder',
  'Create, read, edit, and manipulate Word documents (.docx) with professional formatting, tables, and styles.',
  'fa-file-word',
  ['documents', 'word', 'docx'],
  'documents',
);

export const claudeXlsx = claudeSkill(
  'claude-xlsx',
  'Spreadsheet Builder',
  'Open, read, edit, or create spreadsheet files (.xlsx, .csv, .tsv) with formulas, formatting, and charts.',
  'fa-file-excel',
  ['documents', 'spreadsheets', 'xlsx'],
  'documents',
);

export const claudePdf = claudeSkill(
  'claude-pdf',
  'PDF Tools',
  'Read, extract, combine, split, rotate, watermark, and create PDF files.',
  'fa-file-pdf',
  ['documents', 'pdf', 'tools'],
  'documents',
);

// ─── Enterprise Search & Productivity ───────────────────────────────────────

export const claudeEnterpriseSearch = claudeSkill(
  'claude-enterprise-search',
  'Enterprise Search',
  'Search across all connected sources in one query. Find decisions, documents, or discussions across chat, email, cloud storage.',
  'fa-searchengin',
  ['search', 'enterprise', 'cross-platform'],
  'communication',
);

export const claudeDigest = claudeSkill(
  'claude-digest',
  'Activity Digest',
  'Generate daily or weekly digests of activity across all connected sources. Catch up on mentions and action items.',
  'fa-newspaper',
  ['productivity', 'digest', 'summary'],
  'communication',
);

export const claudeEmailReply = claudeSkill(
  'claude-email-reply',
  'Email Reply Drafter',
  'Read an email and draft an appropriate reply, or ask clarifying questions if the email is ambiguous.',
  'fa-envelope-open-text',
  ['email', 'reply', 'drafting'],
  'communication',
);

// ─── Brand Voice Skills ─────────────────────────────────────────────────────

export const claudeBrandDiscovery = claudeSkill(
  'claude-brand-discovery',
  'Brand Discovery',
  'Search connected platforms for brand materials and produce a discovery report across Notion, Confluence, Drive, and more.',
  'fa-compass',
  ['brand', 'discovery', 'materials'],
  'marketing',
);

export const claudeBrandGuidelines = claudeSkill(
  'claude-brand-guidelines',
  'Brand Guideline Generator',
  'Generate brand voice guidelines from documents, transcripts, discovery reports, or any combination of source materials.',
  'fa-palette',
  ['brand', 'guidelines', 'voice'],
  'marketing',
);

export const claudeBrandEnforcement = claudeSkill(
  'claude-brand-enforcement',
  'Brand Voice Enforcement',
  'Apply brand guidelines to content creation. Write emails, proposals, LinkedIn posts, and presentations in your brand voice.',
  'fa-stamp',
  ['brand', 'voice', 'enforcement'],
  'marketing',
);

// ─── Creative Skills ────────────────────────────────────────────────────────

export const claudeCanvasDesign = claudeSkill(
  'claude-canvas-design',
  'Visual Design Creator',
  'Create beautiful visual art in .png and .pdf using design philosophy. Posters, artwork, and static visual pieces.',
  'fa-paintbrush',
  ['creative', 'design', 'visual'],
);

export const claudeAlgorithmicArt = claudeSkill(
  'claude-algorithmic-art',
  'Algorithmic Art',
  'Create algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Generative art and flow fields.',
  'fa-wand-sparkles',
  ['creative', 'art', 'generative'],
);

export const claudeGifCreator = claudeSkill(
  'claude-gif-creator',
  'GIF Creator',
  'Create animated GIFs optimized for Slack with constraints, validation, and animation concepts.',
  'fa-film',
  ['creative', 'gif', 'animation'],
);

// ─── Presentation Skills ────────────────────────────────────────────────────

export const claudeGammaPresentations = claudeSkill(
  'claude-gamma-presentations',
  'Gamma Presentations',
  'Create stunning AI-powered presentations, pitch decks, and documents using the Gamma API. Auto-layouts, smart design, and brand-consistent slides.',
  'fa-display',
  ['presentations', 'gamma', 'slides'],
  'documents',
);

// ─── Registry of all Claude skills ──────────────────────────────────────────

export const CLAUDE_SKILL_TEMPLATES: TemplateConfig[] = [
  // Data & Analytics
  claudeDataAnalyze,
  claudeDataExplore,
  claudeDataViz,
  claudeDashboard,
  claudeSqlQueries,
  claudeStatAnalysis,
  claudeDataValidate,
  // Design
  claudeDesignCritique,
  claudeAccessibilityReview,
  claudeUserResearch,
  claudeResearchSynthesis,
  claudeUxCopy,
  claudeDesignSystem,
  claudeDesignHandoff,
  // Marketing
  claudeContentDraft,
  claudeSeoAudit,
  claudePerformanceReport,
  claudeEmailSequence,
  claudeCompetitiveBrief,
  claudeBrandReview,
  claudeCampaignPlan,
  // Finance
  claudeJournalEntry,
  claudeFinancialStatements,
  claudeReconciliation,
  claudeCloseManagement,
  claudeVarianceAnalysis,
  claudeSoxTesting,
  // Legal
  claudeContractReview,
  claudeComplianceCheck,
  claudeNdaTriage,
  claudeLegalRisk,
  claudeVendorCheck,
  // HR
  claudeOnboarding,
  claudePerformanceReview,
  claudeInterviewPrep,
  claudeCompAnalysis,
  claudePeopleReport,
  // Operations
  claudeProcessDoc,
  claudeStatusReport,
  claudeChangeRequest,
  claudeRiskAssessment,
  claudeRunbook,
  claudeVendorReview,
  claudeCapacityPlan,
  // Customer Support
  claudeSupportResponse,
  claudeEscalation,
  claudeTicketTriage,
  claudeKbArticle,
  // Documents & Presentations
  claudePptx,
  claudeDocx,
  claudeXlsx,
  claudePdf,
  // Enterprise Search & Productivity
  claudeEnterpriseSearch,
  claudeDigest,
  claudeEmailReply,
  // Brand Voice
  claudeBrandDiscovery,
  claudeBrandGuidelines,
  claudeBrandEnforcement,
  // Creative
  claudeCanvasDesign,
  claudeAlgorithmicArt,
  claudeGifCreator,
  // Presentations
  claudeGammaPresentations,
];
