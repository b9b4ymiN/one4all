/**
 * A2A Command Utilities
 *
 * Shared utility functions for A2A CLI commands
 */

/**
 * Simple validation function for agent cards
 * In full implementation, this would use the actual AgentCardSchema from @one4all/a2a
 */
export function validateAgentCard(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!data.id) errors.push('id is required');
  if (!data.name) errors.push('name is required');
  if (!data.version) errors.push('version is required');
  if (!data.domain) errors.push('domain is required');
  if (!data.role) errors.push('role is required');
  if (!data.capabilities) errors.push('capabilities is required');

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
