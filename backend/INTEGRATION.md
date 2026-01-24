# 🔗 Integração Frontend ↔ Backend

## Passo a Passo para Conectar o Frontend ao Backend

### 1. Configurar Variável de Ambiente no Frontend

Crie/edite o arquivo `.env.local` na raiz do projeto frontend:

```env
VITE_API_URL=http://localhost:5000/api
```

### 2. Atualizar `services/dataService.ts`

Substitua as chamadas ao LocalStorage por chamadas HTTP:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const DataService = {
  getDashboardMetrics: async (): Promise<Metric[]> => {
    const response = await fetch(`${API_URL}/dashboard/metrics`);
    if (!response.ok) throw new Error('Failed to fetch metrics');
    return response.json();
  },

  getPerformanceHistory: async (): Promise<ChartData[]> => {
    const response = await fetch(`${API_URL}/dashboard/history`);
    if (!response.ok) throw new Error('Failed to fetch history');
    return response.json();
  },

  // ... outros métodos
};
```

### 3. Criar Cliente HTTP (Opcional - Recomendado)

Crie `services/apiClient.ts`:

```typescript
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
      headers: {
        'Content-Type': 'application/json',
        // Adicionar token JWT quando autenticação estiver pronta
        // Authorization: `Bearer ${getToken()}`,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

### 4. Usar no DataService

```typescript
import { apiClient } from './apiClient';

export const DataService = {
  getDashboardMetrics: () => 
    apiClient.get<Metric[]>('/dashboard/metrics'),

  getPerformanceHistory: () => 
    apiClient.get<ChartData[]>('/dashboard/history'),

  getDailyLeadsHistory: () => 
    apiClient.get<DailyLeadEntry[]>('/leads/daily'),

  saveDailyLeadEntry: (entry: Omit<DailyLeadEntry, 'id'>) => 
    apiClient.post<DailyLeadEntry>('/leads/daily', entry),
  
  // ... outros métodos
};
```

## 🚀 Testando a Integração

1. Inicie o backend:
```bash
cd backend
npm install
npm run dev
```

2. Inicie o frontend:
```bash
npm run dev
```

3. Verifique se as requisições estão funcionando no Network tab do DevTools.

## 🔐 Autenticação (Próximo Passo)

Quando a autenticação JWT estiver implementada:

1. Adicionar interceptor para incluir token:
```typescript
// No apiClient
headers: {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
}
```

2. Tratar erros 401 (não autorizado):
```typescript
if (response.status === 401) {
  // Redirecionar para login
  window.location.href = '/login';
}
```
