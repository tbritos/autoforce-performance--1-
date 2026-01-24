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

export const FunnelChart: React.FC<ChartsProps> = ({ data, isLoading = false }) => {
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
        <EmptyState message="Nenhum dado de funil disponível" />
      </div>
    );
  }

  const totals = data.reduce(
    (acc, item) => ({
      mql: acc.mql + (item.leads || 0),
      sql: acc.sql + (item.qualified || 0),
      sales: acc.sales + (item.sales || 0),
    }),
    { mql: 0, sql: 0, sales: 0 }
  );

  if (totals.mql === 0 && totals.sql === 0 && totals.sales === 0) {
    return (
      <div className="h-[350px] w-full">
        <EmptyState message="Nenhum dado de funil disponível" />
      </div>
    );
  }

  const maxValue = Math.max(totals.mql, totals.sql, totals.sales, 1);
  const steps = [
    { label: 'MQL', value: totals.mql, color: 'bg-autoforce-blue' },
    { label: 'SQL', value: totals.sql, color: 'bg-autoforce-accent' },
    { label: 'Vendas', value: totals.sales, color: 'bg-green-500' },
  ];

  return (
    <div className="h-[350px] w-full flex flex-col justify-center gap-4">
      {steps.map(step => (
        <div key={step.label} className="flex items-center gap-4">
          <div className="w-16 text-sm font-bold text-white">{step.label}</div>
          <div className="flex-1">
            <div className="w-full bg-autoforce-black/60 h-8 rounded-full overflow-hidden border border-autoforce-grey/20">
              <div
                className={`${step.color} h-full rounded-full transition-all`}
                style={{ width: `${Math.round((step.value / maxValue) * 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="w-20 text-right text-sm font-mono text-autoforce-lightGrey">
            {step.value.toLocaleString('pt-BR')}
          </div>
        </div>
      ))}
    </div>
  );
};
