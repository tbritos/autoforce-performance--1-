const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_URL;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      // FIX: credentials: 'include' sends the httpOnly session cookie automatically.
      // The Authorization header is no longer used for browser sessions.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        // Keep Authorization header as fallback for dev-bypass and API key clients
        ...this.getAuthHeader(),
      },
      ...options,
    };

    // Merge headers so options.headers don't wipe out Content-Type
    if (options?.headers) {
      config.headers = { ...config.headers, ...options.headers };
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        if (response.status === 401) {
          // Clear any residual localStorage state
          localStorage.removeItem('autoforce_token');
          localStorage.removeItem('autoforce_user');
          window.location.href = '/';
          throw new Error('Sessão expirada');
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
      if (error instanceof Error && error.message !== 'Sessão expirada') {
        console.error(`API Request failed: ${url}`, error);
      }
      throw error;
    }
  }

  private getAuthHeader(): Record<string, string> {
    // Only used for dev-bypass — real sessions use httpOnly cookie
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
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
