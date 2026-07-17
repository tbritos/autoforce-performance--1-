import React from 'react';
import { AlertCircle } from 'lucide-react';

interface WidgetFrameProps {
  title: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}

export const WidgetFrame: React.FC<WidgetFrameProps> = ({ title, loading, error, empty, children, headerExtra }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, height: '100%', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        {headerExtra}
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '8px 12px', overflow: 'auto' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 22, height: 22, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} className="animate-spin" />
          </div>
        ) : error ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--red-500)', fontSize: 11, textAlign: 'center' }}>
            <AlertCircle size={18} />
            {error}
          </div>
        ) : empty ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-subtle)', fontSize: 12 }}>
            Sem dados
          </div>
        ) : children}
      </div>
    </div>
  );
};
