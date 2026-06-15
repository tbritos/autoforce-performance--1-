const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS     = 1_500;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_URL;
    this.startKeepAlive();
  }

  private startKeepAlive() {
    // Ping backend every 4 minutes to prevent Railway cold starts
    setInterval(() => {
      fetch(`${this.baseURL}/health`, { credentials: 'include' }).catch(() => {});
    }, 4 * 60 * 1000);
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    retryCount = 1
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      ...options,
    };

    if (options?.headers) {
      config.headers = { ...config.headers, ...options.headers };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    config.signal = controller.signal;

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('autoforce_token');
          localStorage.removeItem('autoforce_user');
          window.location.href = '/';
          throw new Error('Sessão expirada');
        }

        // Retry once on server errors (5xx) — don't retry client errors (4xx)
        if (response.status >= 500 && retryCount > 0) {
          await sleep(RETRY_DELAY_MS);
          return this.request<T>(endpoint, options, retryCount - 1);
        }

        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return null as T;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.message === 'Sessão expirada') throw error;

      // Retry once on network errors (timeout, connection refused, etc.)
      if (retryCount > 0) {
        await sleep(RETRY_DELAY_MS);
        return this.request<T>(endpoint, options, retryCount - 1);
      }

      console.error(`API Request failed: ${url}`, error);
      throw error;
    }
  }

  private getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem('autoforce_token');
    if (token && token === 'dev-local-bypass') {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  }

  patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
