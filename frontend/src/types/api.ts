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
  /** Anonymous phone id (see lib/device.ts). */
  deviceId?: string;
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
export type RiskLevel = 'NORMAL' | 'WASPADA' | 'SIAGA' | 'EKSTREM';
export type WarningStrategyCode = 'STANDARD' | 'EXTRA_WARNING' | 'ENHANCED_MONITORING' | 'MAXIMUM_ALERT';

export interface WarningStrategy {
  code: WarningStrategyCode;
  label_id: string;
  label_en: string;
  message_id: string;
  trust_tier: 'High' | 'Low';
  behavioral_class: 0 | 1;
  behavioral_label: 'Actionable' | 'Inaction';
  behavioral_source: 'random_forest' | 'beach_profile';
}

export interface Contribution {
  factor: string;
  label_id: string;
  category: 'natural_sign' | 'community';
  weight: number;
  direction: 'increases_risk' | 'neutral';
  detail_id?: string;
}

export interface CommunityFactor {
  key: string;
  label_id: string;
  value: number;
  status: string;
  detail_id?: string;
}

export interface Explanation {
  summary_id?: string;
  contributions: Contribution[];
  community_profile?: {
    beach: string;
    overall: string;
    factors: CommunityFactor[];
  } | null;
}

export interface Reassurance {
  shapRisk: string;
  bmkgRisk: string;
  agreed: boolean;
  finalLevel: RiskLevel | string;
  bmkgDetails?: { waveHeight: number; windSpeed: number; hasWarning: boolean } | null;
  details?: {
    weather?: { windSpeed?: number | null; waveHeight?: number | null; weather?: string | null } | null;
    warning?: unknown;
  };
}

export interface MlSignDecision {
  code: string;
  trust_tier: 'High' | 'Low';
  ranked: boolean;
  behavioral_class: 0 | 1;
  probability_actionable: number | null;
  strategy: WarningStrategyCode;
  dominant_action: string | null;
}

export interface ActiveWarningEvent {
  alertId?: string;
  riskLevel?: string;
  serverTimestamp?: number;
  decision: {
    is_actionable: boolean;
    community_characteristics?: string;
    shouldDistribute?: boolean;
    final_risk_level?: RiskLevel | string;
    warning_strategy?: WarningStrategyCode | null;
  };
  ml: {
    action_recommendation?: string;
    active_warning?: string[];
    sign_description?: string;
    escalation_level?: 1 | 2 | 3 | 4;
    lik_risk_level?: RiskLevel;
    warning_strategy?: WarningStrategy | null;
    signs?: MlSignDecision[];
    explanation?: Explanation;
  };
  input: {
    lik_codes: string[];
    beach_location: BeachLocation;
  };
  reassurance?: Reassurance;
}

/** Personal warning computed from the fisherman's own profile (POST /api/warning/personal). */
export interface PersonalWarningResponse {
  ok: boolean;
  active: boolean;
  alertId?: string;
  lik_risk_level?: RiskLevel;
  warning_strategy?: WarningStrategy | null;
  action_recommendation?: string;
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
