
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Limpar LocalStorage se houver erro crítico de renderização causado por dados corrompidos
    if (error.message.includes("JSON") || error.message.includes("reading")) {
       console.warn("Possível corrupção de dados. Limpando sessão.");
       // localStorage.clear(); // Opcional: Descomentar se quiser resetar tudo no erro
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'white', backgroundColor: '#00020A', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#ff4444' }}>Algo deu errado.</h1>
          <p style={{ color: '#C7CDE9', marginBottom: '2rem' }}>Ocorreu um erro inesperado na aplicação.</p>
          <pre style={{ backgroundColor: '#000D3D', padding: '1rem', borderRadius: '8px', color: '#FFA814', marginBottom: '2rem', maxWidth: '80vw', overflow: 'auto' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => {
                localStorage.removeItem('autoforce_user');
                window.location.reload();
            }}
            style={{ padding: '10px 20px', backgroundColor: '#1440FF', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reiniciar Sistema (Logout Forçado)
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
  </React.StrictMode>
);
