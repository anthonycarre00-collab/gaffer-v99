import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Simple error boundary that catches rendering errors and shows them
 * instead of a blank white screen. This helps diagnose runtime crashes.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-white dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-navy-600 p-6 shadow-lg">
            <h1 className="text-xl font-heading font-bold text-danger-500 mb-4">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The application encountered an error. Check the console (F12 → Console) for details.
            </p>
            <pre className="text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-navy-900 p-3 rounded overflow-auto max-h-48 mb-4">
              {this.state.error?.message ?? "Unknown error"}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-500 text-white rounded text-sm font-heading font-bold uppercase tracking-wider hover:bg-primary-600 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
