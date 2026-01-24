// Tipos compartilhados com o frontend

export interface Metric {
  id: string;
  label: string;
  value: number;
  target: number;
  unit: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  description?: string;
}

export interface ChartData {
  name: string;
  leads: number;
  qualified: number;
  sales: number;
}

// --- ADICIONAMOS ESTA PARTE NOVA ---
export interface LandingPage {
  id: string;
  name: string;
  path: string;
  views: number;            // screenPageViews
  users: number;            // activeUsers
  conversions: number;      // conversions
  conversionRate: number;   // Calculado
  avgEngagementTime: string;// averageEngagementTime
  bounceRate: number;       // <--- NOVO (Taxa de Rejeição)
  totalClicks: number;      // <--- NOVO (Total de Eventos)
  source?: string;
  createdAt?: Date;
  updatedAt?: Date;
}