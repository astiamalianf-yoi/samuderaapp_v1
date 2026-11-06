// Observation Types
export interface IObservation {
  attribute: string;
  object: string;
  value: string;
  label: string;
}

// Report Types based on API schema
export type BeachLocation = 
  | 'pantai_lampuuk'
  | 'pantai_lhoknga'
  | 'pantai_ulee_lheue'
  | 'pantai_depok'
  | 'pantai_samas';

export interface PredictionInput {
  lik_codes: string[];
  beach_location: BeachLocation;
  clientReportId?: string;
  createdAtClient?: number;
}

export interface ReportResponse {
  success: boolean;
  alertId?: string;
  message?: string;
}

// History Types
export interface HistoryItem {
  id: string;
  userId: string;
  lik_codes: string[];
  beach_location: BeachLocation;
  createdAt: number;
  alertId?: string;
}

export interface HistoryResponse {
  items: HistoryItem[];
  count: number;
}

// ACK Types
export type TransportType = 'SSE' | 'WS' | 'PUSH';
export type AckStage = 'DELIVERED' | 'OPENED';

export interface AckInput {
  alertId: string;
  transport: TransportType;
  receivedAtClient: number;
  serverTimestamp: number;
  ackStage?: AckStage;
  clientId?: string;
}

// Push Subscription Types
export interface PushSubscription {
  endpoint: string;
  expirationTime?: number;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Active Report Types
export interface ActiveWarningEvent {
  decision: {
    is_actionable: boolean;
    community_characteristics?: string;
    shouldDistribute?: boolean;
  };
  ml: {
    action_recommendation?: string;
    active_warning?: string[];
    sign_description?: string;
    escalation_level?: 1 | 2 | 3 | 4;
  };
  input: {
    lik_codes: string[];
    beach_location: BeachLocation;
  };
}

export interface ActiveWarning {
  codes: string[];
  triggeredAt: number;
  alertId: string;
  reportCount?: number;
  reportCounts?: Record<string, number>;
  alertEvent: ActiveWarningEvent;
}

export interface ActiveReportResponse {
  ok: boolean;
  beach_location: BeachLocation;
  window_ms: number;
  threshold: number;
  counts: Record<string, { count: number; triggered: boolean }>;
  active_warning?: ActiveWarning;
}
