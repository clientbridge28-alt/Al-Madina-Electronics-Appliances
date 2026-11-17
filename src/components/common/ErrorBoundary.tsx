import React from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  details?: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error.message || 'An unexpected application error occurred.';
    let details: string | undefined;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.operationType && parsed.error) {
        message = `Database access denied (${parsed.operationType} on ${parsed.path || 'collection'}): ${parsed.error}`;
        details = JSON.stringify(parsed, null, 2);
      }
    } catch {
      // plain error message
    }
    return { hasError: true, message, details };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl bg-white border border-rose-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-2.5 rounded-xl bg-rose-100">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Protected Workspace Error</h2>
                <p className="text-xs text-slate-500">Operation halted safely to preserve data integrity</p>
              </div>
            </div>
            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 font-medium">
              {this.state.message}
            </p>
            {this.state.details && (
              <pre className="text-[10px] font-mono bg-slate-900 text-slate-200 p-3 rounded-xl overflow-x-auto max-h-40">
                {this.state.details}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white py-2.5 text-xs font-bold transition"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
