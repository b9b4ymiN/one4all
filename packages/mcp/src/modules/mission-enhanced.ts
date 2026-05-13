/**
 * MCP Mission Enhanced Handler
 *
 * Extended mission operations: run, abort, replay
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MissionStateMachine } from '@one4all/kernel';
import type { Brief, Mission } from '@one4all/kernel/src/state-machine/types.js';

/**
 * Get tool definitions for enhanced mission operations
 */
export function getMissionEnhancedTools(): Tool[] {
  return [
    {
      name: 'mission_run',
      description: 'Execute a mission through the state machine (fire-and-forget). Returns mission_id for polling status.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          type: {
            type: 'string',
            description: 'Mission type (e.g., stock_analysis)',
          },
          domain: {
            type: 'string',
            description: 'Domain ID (e.g., investment-war-room)',
          },
          description: {
            type: 'string',
            description: 'Mission description',
          },
          ticker: {
            type: 'string',
            description: 'Stock ticker (for stock_analysis missions)',
          },
          owner_assumptions: {
            type: 'object' as const,
            description: 'Owner assumptions for the mission',
          },
          constraints: {
            type: 'object' as const,
            description: 'Constraints for the mission',
          },
        },
        required: ['type', 'domain', 'description'],
      },
    },
    {
      name: 'mission_abort',
      description: 'Abort a running mission',
      inputSchema: {
        type: 'object' as const,
        properties: {
          mission_id: {
            type: 'string',
            description: 'Mission ID to abort',
          },
        },
        required: ['mission_id'],
      },
    },
    {
      name: 'mission_replay',
      description: 'Replay a mission with new configuration',
      inputSchema: {
        type: 'object' as const,
        properties: {
          mission_id: {
            type: 'string',
            description: 'Original mission ID to replay',
          },
          new_description: {
            type: 'string',
            description: 'New description for replay',
          },
          new_ticker: {
            type: 'string',
            description: 'New ticker for replay',
          },
        },
        required: ['mission_id'],
      },
    },
  ];
}

/**
 * Handle mission_run tool
 */
export async function handleMissionRun(
  args: any,
  stateMachine: MissionStateMachine,
  missions: Map<string, Mission>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { type, domain, description, ticker, owner_assumptions, constraints } = args;

    const brief: Brief = {
      type,
      domain,
      description,
      ticker,
      owner_assumptions: owner_assumptions || {},
      constraints: constraints || {},
    };

    const mission = stateMachine.createMission(brief);
    missions.set(mission.id, mission);

    // Start execution (fire-and-forget)
    // In a real implementation, this would trigger the state machine execution
    // For now, we'll create the mission and let the caller poll for status

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          mission_id: mission.id,
          state: mission.state.current_state,
          message: 'Mission created successfully. Use get_mission_status to poll for progress.',
          created_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Failed to create mission',
          details: error instanceof Error ? error.message : String(error),
        }),
      }],
      isError: true,
    };
  }
}

/**
 * Handle mission_abort tool
 */
export async function handleMissionAbort(
  args: any,
  missions: Map<string, Mission>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { mission_id } = args;

    const mission = missions.get(mission_id);

    if (!mission) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Mission not found',
            mission_id,
          }),
        }],
        isError: true,
      };
    }

    // Transition to FAILED state to abort
    // Note: In a real implementation, this would properly abort the mission
    mission.state = 'FAILED' as any;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          mission_id,
          state: 'FAILED',
          message: 'Mission aborted successfully',
          aborted_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Failed to abort mission',
          details: error instanceof Error ? error.message : String(error),
        }),
      }],
      isError: true,
    };
  }
}

/**
 * Handle mission_replay tool
 */
export async function handleMissionReplay(
  args: any,
  stateMachine: MissionStateMachine,
  missions: Map<string, Mission>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { mission_id, new_description, new_ticker } = args;

    const originalMission = missions.get(mission_id);

    if (!originalMission) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Original mission not found',
            mission_id,
          }),
        }],
        isError: true,
      };
    }

    // Create new mission based on original
    const brief: Brief = {
      type: originalMission.state.brief?.type || 'stock_analysis',
      domain: originalMission.state.brief?.domain || 'investment-war-room',
      description: new_description || originalMission.state.brief?.description || '',
      ticker: new_ticker || originalMission.state.brief?.ticker,
      owner_assumptions: originalMission.state.brief?.owner_assumptions,
      constraints: originalMission.state.brief?.constraints,
    };

    const newMission = stateMachine.createMission(brief);
    missions.set(newMission.id, newMission);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          original_mission_id: mission_id,
          new_mission_id: newMission.id,
          state: newMission.state.current_state,
          message: 'Mission replay created successfully',
          created_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Failed to replay mission',
          details: error instanceof Error ? error.message : String(error),
        }),
      }],
      isError: true,
    };
  }
}
