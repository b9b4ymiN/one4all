/**
 * Mission Tracer - Track mission lifecycle and state transitions
 */

import { MissionState } from '@one4all/shared';

export interface TraceEvent {
  id: string;
  missionId: string;
  timestamp: string;
  eventType: TraceEventType;
  state?: MissionState;
  agentId?: string;
  data?: Record<string, unknown>;
  duration?: number;
}

export type TraceEventType =
  | 'mission_created'
  | 'state_transition'
  | 'agent_assigned'
  | 'agent_completed'
  | 'error'
  | 'checkpoint'
  | 'decision'
  | 'evidence_added'
  | 'debate_round'
  | 'human_review';

export interface MissionTrace {
  missionId: string;
  createdAt: string;
  completedAt?: string;
  events: TraceEvent[];
  metadata: {
    initialState: MissionState;
    finalState?: MissionState;
    totalDuration?: number;
    agentCount: number;
    errorCount: number;
  };
}

export interface TraceFilter {
  missionId?: string;
  eventType?: TraceEventType;
  agentId?: string;
  startTime?: string;
  endTime?: string;
  state?: MissionState;
}

export interface TracerConfig {
  enableConsole?: boolean;
  maxEventsInMemory?: number;
  persistenceEnabled?: boolean;
}

const DEFAULT_CONFIG: TracerConfig = {
  enableConsole: false,
  maxEventsInMemory: 10000,
  persistenceEnabled: false,
};

export class MissionTracer {
  private traces: Map<string, MissionTrace>;
  private config: TracerConfig;

  constructor(config: TracerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.traces = new Map();
  }

  createTrace(missionId: string, initialState: MissionState): MissionTrace {
    const trace: MissionTrace = {
      missionId,
      createdAt: new Date().toISOString(),
      events: [],
      metadata: {
        initialState,
        agentCount: 0,
        errorCount: 0,
      },
    };

    this.traces.set(missionId, trace);
    this.recordEvent(missionId, 'mission_created', { state: initialState });

    return trace;
  }

  recordEvent(
    missionId: string,
    eventType: TraceEventType,
    data?: Record<string, unknown>,
    agentId?: string
  ): TraceEvent | null {
    const trace = this.traces.get(missionId);
    if (!trace) {
      return null;
    }

    const event: TraceEvent = {
      id: this.generateEventId(),
      missionId,
      timestamp: new Date().toISOString(),
      eventType,
      agentId,
      data,
    };

    trace.events.push(event);

    if (eventType === 'error') {
      trace.metadata.errorCount++;
    }

    if (this.config.enableConsole) {
      console.log(`[Trace] ${missionId} | ${eventType}`, data || '');
    }

    return event;
  }

  recordStateTransition(
    missionId: string,
    fromState: MissionState,
    toState: MissionState,
    metadata?: Record<string, unknown>
  ): TraceEvent | null {
    const trace = this.traces.get(missionId);
    if (!trace) {
      return null;
    }

    const lastEvent = trace.events[trace.events.length - 1];
    const duration = lastEvent
      ? Date.now() - new Date(lastEvent.timestamp).getTime()
      : undefined;

    const event = this.recordEvent(missionId, 'state_transition', {
      fromState,
      toState,
      duration,
      ...metadata,
    });

    return event;
  }

  recordAgentAssignment(
    missionId: string,
    agentId: string,
    role: string,
    metadata?: Record<string, unknown>
  ): TraceEvent | null {
    const trace = this.traces.get(missionId);
    if (!trace) {
      return null;
    }

    const uniqueAgents = new Set(
      trace.events
        .filter(e => e.eventType === 'agent_assigned')
        .map(e => e.agentId)
    );
    uniqueAgents.add(agentId);
    trace.metadata.agentCount = uniqueAgents.size;

    return this.recordEvent(missionId, 'agent_assigned', {
      role,
      ...metadata,
    }, agentId);
  }

  recordCheckpoint(
    missionId: string,
    name: string,
    data?: Record<string, unknown>
  ): TraceEvent | null {
    return this.recordEvent(missionId, 'checkpoint', {
      checkpointName: name,
      ...data,
    });
  }

  recordDecision(
    missionId: string,
    decision: string,
    reasoning: string,
    confidence?: number,
    metadata?: Record<string, unknown>
  ): TraceEvent | null {
    return this.recordEvent(missionId, 'decision', {
      decision,
      reasoning,
      confidence,
      ...metadata,
    });
  }

  recordEvidence(
    missionId: string,
    evidenceId: string,
    tier: number,
    source: string,
    metadata?: Record<string, unknown>
  ): TraceEvent | null {
    return this.recordEvent(missionId, 'evidence_added', {
      evidenceId,
      tier,
      source,
      ...metadata,
    });
  }

  recordDebateRound(
    missionId: string,
    round: number,
    participants: string[],
    outcome: string,
    metadata?: Record<string, unknown>
  ): TraceEvent | null {
    return this.recordEvent(missionId, 'debate_round', {
      round,
      participants,
      outcome,
      ...metadata,
    });
  }

  recordError(
    missionId: string,
    error: Error,
    context?: Record<string, unknown>
  ): TraceEvent | null {
    return this.recordEvent(missionId, 'error', {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...context,
    });
  }

  completeTrace(missionId: string, finalState: MissionState): MissionTrace | null {
    const trace = this.traces.get(missionId);
    if (!trace) {
      return null;
    }

    trace.completedAt = new Date().toISOString();
    trace.metadata.finalState = finalState;
    trace.metadata.totalDuration = Date.now() - new Date(trace.createdAt).getTime();

    this.recordEvent(missionId, 'mission_created', {
      state: finalState,
      duration: trace.metadata.totalDuration,
    });

    return trace;
  }

  getTrace(missionId: string): MissionTrace | null {
    return this.traces.get(missionId) || null;
  }

  getEvents(missionId: string, filter?: TraceFilter): TraceEvent[] {
    const trace = this.traces.get(missionId);
    if (!trace) {
      return [];
    }

    let events = trace.events;

    if (filter) {
      if (filter.eventType) {
        events = events.filter(e => e.eventType === filter.eventType);
      }
      if (filter.agentId) {
        events = events.filter(e => e.agentId === filter.agentId);
      }
      if (filter.startTime) {
        events = events.filter(e => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        events = events.filter(e => e.timestamp <= filter.endTime!);
      }
    }

    return events;
  }

  getAllTraces(): MissionTrace[] {
    return Array.from(this.traces.values());
  }

  getActiveMissions(): string[] {
    return Array.from(this.traces.values())
      .filter(trace => !trace.completedAt)
      .map(trace => trace.missionId);
  }

  getTraceSummary(missionId: string): Record<string, unknown> | null {
    const trace = this.traces.get(missionId);
    if (!trace) {
      return null;
    }

    const eventsByType = new Map<TraceEventType, number>();
    for (const event of trace.events) {
      eventsByType.set(
        event.eventType,
        (eventsByType.get(event.eventType) || 0) + 1
      );
    }

    const agents = new Set(
      trace.events
        .filter(e => e.agentId)
        .map(e => e.agentId!)
    );

    return {
      missionId: trace.missionId,
      createdAt: trace.createdAt,
      completedAt: trace.completedAt,
      totalEvents: trace.events.length,
      eventsByType: Object.fromEntries(eventsByType),
      uniqueAgents: agents.size,
      totalDuration: trace.metadata.totalDuration,
      initialState: trace.metadata.initialState,
      finalState: trace.metadata.finalState,
      errorCount: trace.metadata.errorCount,
    };
  }

  clearTrace(missionId: string): boolean {
    return this.traces.delete(missionId);
  }

  clearAllTraces(): void {
    this.traces.clear();
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  exportTrace(missionId: string): string | null {
    const trace = this.traces.get(missionId);
    if (!trace) {
      return null;
    }
    return JSON.stringify(trace, null, 2);
  }

  importTrace(traceJson: string): MissionTrace | null {
    try {
      const trace = JSON.parse(traceJson) as MissionTrace;
      this.traces.set(trace.missionId, trace);
      return trace;
    } catch {
      return null;
    }
  }

  getTimeline(missionId: string): Array<{ timestamp: string; description: string }> {
    const trace = this.traces.get(missionId);
    if (!trace) {
      return [];
    }

    return trace.events.map(event => ({
      timestamp: event.timestamp,
      description: this.formatEventDescription(event),
    }));
  }

  private formatEventDescription(event: TraceEvent): string {
    switch (event.eventType) {
      case 'mission_created':
        return `Mission created in state ${event.data?.state}`;
      case 'state_transition':
        return `Transitioned from ${event.data?.fromState} to ${event.data?.toState}`;
      case 'agent_assigned':
        return `Agent ${event.agentId} assigned as ${event.data?.role}`;
      case 'agent_completed':
        return `Agent ${event.agentId} completed task`;
      case 'error':
        return `Error: ${event.data?.errorMessage}`;
      case 'checkpoint':
        return `Checkpoint: ${event.data?.checkpointName}`;
      case 'decision':
        return `Decision: ${event.data?.decision}`;
      case 'evidence_added':
        return `Evidence added from ${event.data?.source} (Tier ${event.data?.tier})`;
      case 'debate_round':
        return `Debate round ${event.data?.round} completed: ${event.data?.outcome}`;
      case 'human_review':
        return `Human review requested`;
      default:
        return event.eventType;
    }
  }
}
