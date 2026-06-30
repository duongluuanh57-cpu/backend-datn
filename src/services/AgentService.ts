/**
 * Barrel file — re-exports all agent sub-services for backward compatibility.
 */
export { AgentCore } from './agent/_contentAgentCore.ts';
export { getGeminiClient } from './agent/_contentGeminiClient.ts';
export { researcherNode, writerNode, reviewerNode } from './agent/_contentAgentNodes.ts';

import { AgentCore } from './agent/_contentAgentCore.ts';

export class AgentService {
  static runWorkflow = AgentCore.runWorkflow;
  static healthCheck = AgentCore.healthCheck;
}