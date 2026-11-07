import type { PredictionInput, ReportResponse, HistoryResponse, AckInput, ActiveReportResponse, PersonalWarningResponse, BeachLocation } from '../types/api';
import type { FishermanProfile } from '../lib/profile';

import { API_BASE_URL } from '../config';
import { loadRegistration } from '../lib/registration';

export interface BmkgData {
  beach: string;
  weather: string;
  windSpeed: number;
  humidity?: number;
  windDirection: string;
  temperature: number;
  isSafe: boolean;
  fetchedAt: number;
}

export interface AlertFeedItem {
  alertId: string;
  beachLocation: string;
  riskLevel: string;
  reporterCount: number;
  actionRecommendation: string;
  triggeredCodes: string[];
  serverTimestamp: number;
}

export class ApiError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // If we can't parse the error response, use the default message
    }
    throw new ApiError(errorMessage, response.status);
  }
  
  // Handle 204 No Content or empty responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }
  
  return response.json();
}

export const reportService = {
  async submitReport(data: PredictionInput): Promise<ReportResponse> {
    // The fisherman's token goes in the header and in the body: a report queued offline by the
    // service worker is replayed from its body.
    const token = loadRegistration()?.token;
    const response = await fetch(`${API_BASE_URL}/api/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Fisherman-Token': token } : {}),
      },
      body: JSON.stringify(token ? { ...data, fishermanToken: token } : data),
    });

    return handleResponse<ReportResponse>(response);
  },

  async getHistory(limit: number = 20, mine: boolean = true): Promise<HistoryResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      mine: mine.toString(),
    });

    const response = await fetch(`${API_BASE_URL}/api/history?${params}`, {
      method: 'GET',
    });

    return handleResponse<HistoryResponse>(response);
  },

  async getActiveReports(beachLocation: string): Promise<ActiveReportResponse> {
    const response = await fetch(`${API_BASE_URL}/api/reports/active?beach_location=${encodeURIComponent(beachLocation)}`, {
      method: 'GET',
    });

    return handleResponse<ActiveReportResponse>(response);
  },

  async getPersonalWarning(beachLocation: BeachLocation, profile: FishermanProfile): Promise<PersonalWarningResponse> {
    const response = await fetch(`${API_BASE_URL}/api/warning/personal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beach_location: beachLocation, fisherman_profile: profile }),
    });
    return handleResponse<PersonalWarningResponse>(response);
  },

  async getBmkg(beachLocation: BeachLocation): Promise<BmkgData | null> {
    const response = await fetch(`${API_BASE_URL}/api/bmkg/${encodeURIComponent(beachLocation)}`);
    const body = await handleResponse<{ ok: boolean; data: BmkgData | null }>(response);
    return body.data ?? null;
  },

  async getBmkgAll(): Promise<BmkgData[]> {
    const response = await fetch(`${API_BASE_URL}/api/bmkg`);
    const body = await handleResponse<{ ok: boolean; data: (BmkgData | null)[] }>(response);
    return (body.data ?? []).filter((d): d is BmkgData => d != null);
  },

  async getAlerts(limit: number = 20): Promise<AlertFeedItem[]> {
    const response = await fetch(`${API_BASE_URL}/api/alerts?limit=${limit}`);
    const body = await handleResponse<{ ok: boolean; data: AlertFeedItem[] }>(response);
    return body.data ?? [];
  },

  async sendAck(data: AckInput): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    await handleResponse(response);
  },
};
