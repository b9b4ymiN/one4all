/**
 * Replay Storage - Store and replay mission executions for debugging and analysis
 */

export interface ReplayEvent {
  id: string;
  missionId: string;
  timestamp: string;
  type: ReplayEventType;
  agentId?: string;
  data: Record<string, unknown>;
}

export type ReplayEventType =
  | 'mission_start'
  | 'state_transition'
  | 'agent_call'
  | 'agent_response'
  | 'error'
  | 'decision'
  | 'mission_end';

export interface ReplaySession {
  id: string;
  missionId: string;
  startTime: string;
  endTime?: string;
  events: ReplayEvent[];
  metadata: {
    initialState: string;
    finalState?: string;
    agentCalls: number;
    errors: number;
    duration?: number;
  };
}

export interface ReplayStorageConfig {
  maxSessions?: number;
  maxEventsPerSession?: number;
  persistToFile?: boolean;
  storageDir?: string;
  compressionEnabled?: boolean;
}

const DEFAULT_CONFIG: ReplayStorageConfig = {
  maxSessions: 100,
  maxEventsPerSession: 10000,
  persistToFile: false,
  storageDir: './replays',
  compressionEnabled: false,
};

export class ReplayStorage {
  private sessions: Map<string, ReplaySession>;
  private currentSession: ReplaySession | null;
  private config: ReplayStorageConfig;

  constructor(config: ReplayStorageConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessions = new Map();
    this.currentSession = null;
  }

  startSession(missionId: string, initialState: string): ReplaySession {
    const session: ReplaySession = {
      id: this.generateSessionId(),
      missionId,
      startTime: new Date().toISOString(),
      events: [],
      metadata: {
        initialState,
        agentCalls: 0,
        errors: 0,
      },
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;

    this.recordEvent('mission_start', { state: initialState });

    return session;
  }

  recordEvent(
    type: ReplayEventType,
    data: Record<string, unknown>,
    agentId?: string
  ): ReplayEvent | null {
    if (!this.currentSession) {
      return null;
    }

    const event: ReplayEvent = {
      id: this.generateEventId(),
      missionId: this.currentSession.missionId,
      timestamp: new Date().toISOString(),
      type,
      agentId,
      data,
    };

    if (this.currentSession.events.length >= this.config.maxEventsPerSession!) {
      this.currentSession.events.shift();
    }

    this.currentSession.events.push(event);

    if (type === 'agent_call') {
      this.currentSession.metadata.agentCalls++;
    } else if (type === 'error') {
      this.currentSession.metadata.errors++;
    }

    return event;
  }

  recordStateTransition(fromState: string, toState: string): ReplayEvent | null {
    return this.recordEvent('state_transition', {
      fromState,
      toState,
    });
  }

  recordAgentCall(agentId: string, prompt: string, config?: Record<string, unknown>): ReplayEvent | null {
    return this.recordEvent('agent_call', {
      prompt,
      config,
    }, agentId);
  }

  recordAgentResponse(agentId: string, response: unknown, duration: number): ReplayEvent | null {
    return this.recordEvent('agent_response', {
      response,
      duration,
    }, agentId);
  }

  recordError(error: Error, context?: Record<string, unknown>): ReplayEvent | null {
    return this.recordEvent('error', {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      context,
    });
  }

  recordDecision(decision: string, reasoning: string): ReplayEvent | null {
    return this.recordEvent('decision', {
      decision,
      reasoning,
    });
  }

  endSession(finalState: string): ReplaySession | null {
    if (!this.currentSession) {
      return null;
    }

    this.currentSession.endTime = new Date().toISOString();
    this.currentSession.metadata.finalState = finalState;
    this.currentSession.metadata.duration =
      Date.now() - new Date(this.currentSession.startTime).getTime();

    this.recordEvent('mission_end', { state: finalState });

    const session = this.currentSession;
    this.currentSession = null;

    if (this.config.persistToFile) {
      this.saveSessionToFile(session);
    }

    return session;
  }

  getSession(sessionId: string): ReplaySession | null {
    return this.sessions.get(sessionId) || null;
  }

  getSessionsByMission(missionId: string): ReplaySession[] {
    return Array.from(this.sessions.values()).filter(s => s.missionId === missionId);
  }

  getCurrentSession(): ReplaySession | null {
    return this.currentSession;
  }

  exportSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return JSON.stringify(session, null, 2);
  }

  importSession(sessionJson: string): ReplaySession | null {
    try {
      const session = JSON.parse(sessionJson) as ReplaySession;
      this.sessions.set(session.id, session);
      return session;
    } catch {
      return null;
    }
  }

  async replaySession(
    sessionId: string,
    onEvent: (event: ReplayEvent) => void | Promise<void>
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    for (const event of session.events) {
      await onEvent(event);
    }

    return true;
  }

  async replaySessionAtSpeed(
    sessionId: string,
    onEvent: (event: ReplayEvent) => void | Promise<void>,
    speedMultiplier: number = 1
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    let lastTimestamp = session.events[0]?.timestamp
      ? new Date(session.events[0].timestamp).getTime()
      : Date.now();

    for (const event of session.events) {
      const eventTime = new Date(event.timestamp).getTime();
      const delay = (eventTime - lastTimestamp) / speedMultiplier;

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      await onEvent(event);
      lastTimestamp = eventTime;
    }

    return true;
  }

  getSessionStatistics(sessionId: string): Record<string, unknown> | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const agentCalls = session.events.filter(e => e.type === 'agent_call');
    const errors = session.events.filter(e => e.type === 'error');
    const stateTransitions = session.events.filter(e => e.type === 'state_transition');
    const decisions = session.events.filter(e => e.type === 'decision');

    const agentDurations = session.events
      .filter(e => e.type === 'agent_response')
      .map(e => e.data.duration as number)
      .filter((d): d is number => typeof d === 'number');

    return {
      sessionId: session.id,
      missionId: session.missionId,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.metadata.duration,
      totalEvents: session.events.length,
      agentCalls: agentCalls.length,
      errors: errors.length,
      stateTransitions: stateTransitions.length,
      decisions: decisions.length,
      averageAgentDuration: agentDurations.length > 0
        ? agentDurations.reduce((a, b) => a + b, 0) / agentDurations.length
        : 0,
      totalAgentDuration: agentDurations.reduce((a, b) => a + b, 0),
    };
  }

  getTimeline(sessionId: string): Array<{ timestamp: string; type: string; description: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return session.events.map(event => ({
      timestamp: event.timestamp,
      type: event.type,
      description: this.formatEventDescription(event),
    }));
  }

  private formatEventDescription(event: ReplayEvent): string {
    switch (event.type) {
      case 'mission_start':
        return `Mission started in state ${event.data.state}`;
      case 'mission_end':
        return `Mission ended in state ${event.data.state}`;
      case 'state_transition':
        return `Transitioned from ${event.data.fromState} to ${event.data.toState}`;
      case 'agent_call':
        return `Agent ${event.agentId} called`;
      case 'agent_response':
        return `Agent ${event.agentId} responded (${event.data.duration}ms)`;
      case 'error':
        return `Error: ${event.data.errorMessage}`;
      case 'decision':
        return `Decision: ${event.data.decision}`;
      default:
        return event.type;
    }
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clearAllSessions(): void {
    this.sessions.clear();
    this.currentSession = null;
  }

  private async saveSessionToFile(session: ReplaySession): Promise<void> {
    // Implementation would write to file system
    // This is a placeholder for actual file persistence
    if (this.config.persistToFile) {
      const filename = `${this.config.storageDir}/${session.id}.json`;
      // In a real implementation, this would use fs.writeFile
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  getEventByType(sessionId: string, eventType: ReplayEventType): ReplayEvent[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return session.events.filter(e => e.type === eventType);
  }

  getEventsByAgent(sessionId: string, agentId: string): ReplayEvent[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return session.events.filter(e => e.agentId === agentId);
  }

  compareSessions(sessionId1: string, sessionId2: string): Record<string, unknown> | null {
    const session1 = this.sessions.get(sessionId1);
    const session2 = this.sessions.get(sessionId2);

    if (!session1 || !session2) {
      return null;
    }

    return {
      session1Duration: session1.metadata.duration,
      session2Duration: session2.metadata.duration,
      durationDifference: (session2.metadata.duration || 0) - (session1.metadata.duration || 0),
      session1AgentCalls: session1.metadata.agentCalls,
      session2AgentCalls: session2.metadata.agentCalls,
      agentCallDifference: session2.metadata.agentCalls - session1.metadata.agentCalls,
      session1Errors: session1.metadata.errors,
      session2Errors: session2.metadata.errors,
      errorDifference: session2.metadata.errors - session1.metadata.errors,
      sameInitialState: session1.metadata.initialState === session2.metadata.initialState,
      sameFinalState: session1.metadata.finalState === session2.metadata.finalState,
    };
  }
}

export function createReplayStorage(config?: ReplayStorageConfig): ReplayStorage {
  return new ReplayStorage(config);
}
