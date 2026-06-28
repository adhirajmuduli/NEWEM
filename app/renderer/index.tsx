import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './components/AppShell';
import './styles/app.css';

type BoundaryState = { error: string | null };

class RendererErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    console.error('renderer_boundary_error', error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="boot-failure" role="alert">
          <h1>READIT could not render</h1>
          <p>{this.state.error}</p>
          <p>Restart the application. If the problem continues, export the startup logs.</p>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Renderer root element is missing');
console.info('renderer_bootstrap');
createRoot(rootElement).render(
  <RendererErrorBoundary>
    <AppShell />
  </RendererErrorBoundary>
);