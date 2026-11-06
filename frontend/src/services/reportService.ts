import type { PredictionInput, ReportResponse, HistoryResponse, AckInput, ActiveReportResponse } from '../types/api';

const API_BASE_URL = 'https://api.samudraapp.com';

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
    const response = await fetch(`${API_BASE_URL}/api/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
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
