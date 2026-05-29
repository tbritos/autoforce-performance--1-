import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  TooltipProps
} from 'recharts';
import { ChartData } from '../types';
import { AlertCircle } from 'lucide-react';

interface ChartsProps {
  data: ChartData[];
  isLoading?: boolean;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey?: string;
}

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const formatValue = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-autoforce-darkest border border-autoforce-blue p-3 rounded-lg shadow-xl backdrop-blur-sm">
        <p className="text-white font-bold mb-2 text-sm">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-autoforce-lightGrey">{entry.name}:</span>
              </div>
              <span className="font-mono font-bold text-white">
                {entry.value.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const EmptyState: React.FC<{ message?: string }> = ({ message = 'Nenhum dado disponível' }) => (
  <div className="h-full flex flex-col items-center justify-center text-autoforce-lightGrey">
    <AlertCircle size={48} className="mb-4 opacity-50" />
    <p className="text-sm">{message}</p>
  </div>
);

export const PerformanceChart: React.FC<ChartsProps> = ({ data, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="h-[350px] w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-autoforce-blue"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] w-full">
        <EmptyState message="Nenhum dado de performance disponível" />
      </div>
    );
  }

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1440FF" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#1440FF" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorQualified" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FFA814" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#FFA814" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#4E5265" 
            vertical={false} 
            opacity={0.3} 
          />
          <XAxis 
            dataKey="name" 
            stroke="#8A92B7" 
            tick={{ fill: '#8A92B7', fontSize: 12 }} 
            tickLine={false}
            axisLine={{ stroke: '#4E5265' }}
          />
          <YAxis 
            stroke="#8A92B7" 
            tick={{ fill: '#8A92B7', fontSize: 12 }} 
            tickLine={false}
            axisLine={{ stroke: '#4E5265' }}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
            formatter={(value: string) => <span className="text-autoforce-lightGrey text-sm">{value}</span>}
          />
          <Area 
            type="monotone" 
            dataKey="leads" 
            name="Total Leads" 
            stroke="#1440FF" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorLeads)"
            animationDuration={800}
            isAnimationActive={true}
          />
          <Area 
            type="monotone" 
            dataKey="qualified" 
            name="Leads Qualificados" 
            stroke="#FFA814" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorQualified)"
            animationDuration={800}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ConversionBarChart: React.FC<ChartsProps> = ({ data, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="h-[350px] w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-autoforce-blue"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] w-full">
        <EmptyState message="Nenhum dado de conversão disponível" />
      </div>
    );
  }

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          barSize={20}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#4E5265" 
            vertical={false} 
            opacity={0.3} 
          />
          <XAxis 
            dataKey="name" 
            stroke="#8A92B7" 
            tick={{ fill: '#8A92B7', fontSize: 12 }} 
            tickLine={false}
            axisLine={{ stroke: '#4E5265' }}
          />
          <YAxis 
            stroke="#8A92B7" 
            tick={{ fill: '#8A92B7', fontSize: 12 }} 
            tickLine={false}
            axisLine={{ stroke: '#4E5265' }}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value: string) => <span className="text-autoforce-lightGrey text-sm">{value}</span>}
          />
          <Bar 
            dataKey="sales" 
            name="Vendas (Deals)" 
            fill="#0027D4" 
            radius={[4, 4, 0, 0]}
            animationDuration={800}
            isAnimationActive={true}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── FunnelChart ──────────────────────────────────────────────────────────────

export interface FunnelStep {
  label: string;
  value: number;
  color: string; // CSS color string (hex, var(), rgb…)
}

interface FunnelChartProps {
  steps: FunnelStep[];
  isLoading?: boolean;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({ steps, isLoading = false }) => {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 72, height: 14, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
            <div style={{ flex: 1, height: 32, background: 'var(--bg-muted)', borderRadius: 20 }} className="animate-pulse" />
            <div style={{ width: 60, height: 14, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const hasData = steps.some(s => s.value > 0);
  if (!steps.length || !hasData) {
    return (
      <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState message="Nenhum dado de funil disponível" />
      </div>
    );
  }

  const maxValue = Math.max(...steps.map(s => s.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {steps.map((step) => {
        const pct = Math.max(4, Math.round((step.value / maxValue) * 100));
        return (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', textAlign: 'right', flexShrink: 0 }}>
              {step.label}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ width: '100%', height: 32, background: 'var(--bg-muted)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 9999,
                  background: step.color,
                  transition: 'width .6s ease',
                  opacity: 0.9,
                }} />
              </div>
            </div>
            <div style={{ width: 72, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {step.value.toLocaleString('pt-BR')}
            </div>
          </div>
        );
      })}
    </div>
  );
};
