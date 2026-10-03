import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Tony Kitchen Uncaught Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFFBF5] text-[#1F2937] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4 shadow-sm">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            เกิดข้อผิดพลาดในการโหลดระบบ (Tony's Kitchen)
          </h1>
          <p className="text-sm text-gray-600 max-w-md mb-6">
            An unexpected error occurred while rendering the application. Your data stored in IndexedDB is safe.
          </p>

          <div className="flex flex-wrap gap-3 justify-center mb-6">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              รีโหลดหน้าเว็บ (Reload)
            </button>
            <button
              onClick={this.handleResetCache}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              ล้างแคชและเริ่มใหม่ (Clear Cache & Reload)
            </button>
          </div>

          {this.state.error && (
            <div className="max-w-xl w-full p-4 bg-red-50 border border-red-200 rounded-xl text-left text-xs font-mono text-red-800 overflow-x-auto">
              <p className="font-bold mb-1">{this.state.error.name}: {this.state.error.message}</p>
              {this.state.error.stack && (
                <pre className="whitespace-pre-wrap text-[11px] text-red-700 opacity-80 max-h-48 overflow-y-auto">
                  {this.state.error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
