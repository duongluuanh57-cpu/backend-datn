/**
 * Barrel file — re-exports all agent sub-services for backward compatibility.
 */
export { AgentCore } from './agent/agentCore.ts';
export { getGeminiClient } from './agent/geminiClient.ts';
export { researcherNode, writerNode, reviewerNode } from './agent/agentNodes.ts';

import { AgentCore } from './agent/agentCore.ts';

export class AgentService {
  static runWorkflow = AgentCore.runWorkflow;
  static healthCheck = AgentCore.healthCheck;
}