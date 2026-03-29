/**
 * Templates — public API
 *
 * Entry point for the template configuration system.
 */

// Types
export type {
  TemplateConfig,
  TemplateStep,
  TeamActivation,
  TeamId,
  AgentId,
  TemplateRegistry,
} from './templateConfig';

// Built-in templates
export {
  BUILT_IN_TEMPLATES,
  whatIfTransformation,
  videoFromKeyframes,
  staffTrainingVideo,
  productMarketingCampaign,
  liveShoppingChannel,
} from './builtInTemplates';

// Claude desktop platform skills
export { CLAUDE_SKILL_TEMPLATES } from './claudeSkills';
